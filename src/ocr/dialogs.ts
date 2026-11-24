import { App, Modal, Setting, type ButtonComponent, type DropdownComponent, type ToggleComponent } from "obsidian";
import type { OcrLine } from "./model";
import type { NormalizedRect } from "../types";
import { ocrSettingRows, type OcrSettingsHost } from "./settingsRows";

export type OcrScope = "selection" | "page" | "document";
export type OcrAction = "recognise" | "paste" | "text" | "ink" | "cancel" | "retry";
export interface OcrProgressState {
 stage: "idle" | "preparing" | "recognising" | "review" | "completed" | "failed" | "cancelled";
 running: boolean; scope: OcrScope; total: number; index: number; page?: number; completed: number; failed: number; skipped: number;
 startedAt: number; message: string; errors: string[];
}
function styleButtons(container: HTMLElement): void {
 for (const button of Array.from(container.querySelectorAll<HTMLButtonElement>("button:not(.clickable-icon)")))
  button.classList.add("pdf-native-annotator-button", "pdf-native-annotator-text-button");
}
export function openOcrServiceSettings(app: App, host: OcrSettingsHost, onClose?: () => void): void {
 class ServiceOptions extends Modal {
  onOpen(): void {
   this.setTitle("OCR 服务选项"); this.modalEl?.addClass("pdf-native-annotator-dialog"); this.contentEl.addClass("freedraw-pdf-ocr-service-options");
   for (const row of ocrSettingRows(host).filter(row => row.name !== "OCR 工具栏按钮" && row.name !== "保留手写，复制文字")) row.render(new Setting(this.contentEl));
   new Setting(this.contentEl).addButton(button => button.setButtonText("完成").onClick(() => this.close()));
   styleButtons(this.contentEl);
  }
  onClose(): void { this.contentEl.empty(); onClose?.(); }
 }
 new ServiceOptions(app).open();
}
interface OptionsConfig {
 selectedCount: number; pageStrokeCount?: number; pageCount?: number; provider: string; busy: boolean; settingsHost?: OcrSettingsHost; error?: string;
 state?: OcrProgressState; initialScope?: OcrScope;
 subscribe?: (listener: (state: OcrProgressState) => void) => () => void;
 canDisplay?: (scope: OcrScope, mode: "text" | "ink") => boolean;
 run: (scope: OcrScope, action: OcrAction) => void;
}
export function openOcrOptions(app: App, options: OptionsConfig): () => void {
 let closed = false;
 class Options extends Modal {
  private unsubscribe: (() => void) | undefined;
  private timer: number | undefined;
  onOpen(): void {
   this.setTitle("手写识别"); this.modalEl?.addClass("pdf-native-annotator-dialog"); this.contentEl.addClass("freedraw-pdf-ocr-options");
   const owner = this.contentEl.ownerDocument.defaultView;
   let scope: OcrScope = options.state?.stage && options.state.stage !== "idle" ? options.initialScope ?? "page" : options.selectedCount ? "selection" : "page";
   if (scope === "selection" && !options.selectedCount || scope === "document" && !options.pageCount) scope = "page";
   let state = options.state;
   let scopeControl: DropdownComponent | undefined, recognise: ButtonComponent | undefined, cancel: ButtonComponent | undefined;
   let retry: ButtonComponent | undefined, paste: ButtonComponent | undefined, text: ButtonComponent | undefined, ink: ButtonComponent | undefined, configure: ButtonComponent | undefined;
   let keepHandwriting: ToggleComponent | undefined;
   const scopeRow = new Setting(this.contentEl).setName("应用到");
   let refresh = (): void => undefined;
   scopeRow.addDropdown(dropdown => {
    scopeControl = dropdown;
    dropdown.addOption("page", "当前页").addOption("selection", options.selectedCount ? "所选手写内容（" + options.selectedCount + " 笔）" : "所选手写内容：请先选中笔迹")
     .addOption("document", "整份 PDF（" + (options.pageCount ?? 0) + " 页有手写内容）").setValue(scope);
    const selection = dropdown.selectEl.querySelector<HTMLOptionElement>('option[value="selection"]');
    if (selection) selection.disabled = !options.selectedCount;
    const documentOption = dropdown.selectEl.querySelector<HTMLOptionElement>('option[value="document"]');
    if (documentOption) documentOption.disabled = !options.pageCount;
    dropdown.onChange(value => { scope = value === "document" ? "document" : value === "selection" ? "selection" : "page"; refresh(); });
   });
   const status = new Setting(this.contentEl).setName("状态");
   status.settingEl.classList.add("freedraw-pdf-ocr-progress");
   status.settingEl.setAttribute("role", "status"); status.settingEl.setAttribute("aria-live", "polite");
   const progress = status.settingEl.createEl("progress", { cls: "freedraw-pdf-ocr-progress-bar", attr: { "aria-label": "已处理页数" } });
   const details = this.contentEl.createEl("details", { cls: "freedraw-pdf-ocr-job-details" });
   details.createEl("summary", { text: "页面详情" });
   const errors = details.createEl("div");
   const service = new Setting(this.contentEl).setName("识别服务");
   const describeService = (): void => {
    const settings = options.settingsHost?.getOcrSettings();
    service.setDesc(settings ? (settings.provider === "gemini" ? "Gemini" : settings.provider === "openai" ? "在线视觉服务" : "本地 OCR 服务器") + " · " + (settings.model || "请在配置里选择模型") : options.provider);
   };
   describeService();
   const settingsHost = options.settingsHost;
   if (settingsHost) service.addButton(button => { configure = button; button.setButtonText("配置").onClick(() => openOcrServiceSettings(app, settingsHost, describeService)); });
   const act = (action: OcrAction): void => { options.run(scope, action); };
   new Setting(this.contentEl).setName("识别手写").setDesc("替换显示前请先核对结果。原始手写会保留。")
    .addButton(button => { recognise = button; button.setButtonText("识别").setCta().onClick(() => act("recognise")); })
    .addButton(button => { cancel = button; button.setButtonText("取消").onClick(() => act("cancel")); })
    .addButton(button => { retry = button; button.setButtonText("重试失败的页").onClick(() => act("retry")); });
   new Setting(this.contentEl).setName("使用已有识别稿").setDesc("粘贴来自其他应用或设备 OCR 的文字。不会联系识别服务。")
    .addButton(button => { paste = button; button.setButtonText("粘贴识别稿").onClick(() => act("paste")); });
   new Setting(this.contentEl).setName("显示").setDesc("已接受的文字在导出 PDF 里仍可选中，包括同时显示手写时。")
    .addButton(button => { ink = button; button.setButtonText("手写").onClick(() => act("ink")); })
    .addButton(button => { text = button; button.setButtonText("文字").onClick(() => act("text")); });
   if (settingsHost) new Setting(this.contentEl).setName("保留手写，复制文字")
    .setDesc("识别后仍显示手写。复制时使用已接受的文字。")
    .addToggle(toggle => { keepHandwriting = toggle; toggle.setValue(settingsHost.getOcrSettings().copyHandwritingAsText === true)
     .onChange(value => settingsHost.updateOcrSettings({ ...settingsHost.getOcrSettings(), copyHandwritingAsText: value })); });
   refresh = (): void => {
    const running = state?.running ?? options.busy;
    keepHandwriting?.setDisabled(running);
    scopeRow.setDesc(scope === "document" ? "逐页识别这份 PDF 中用插件的笔写下的手写内容。空白页会跳过；页面上印刷或扫描的文字不会被包含。"
     : scope === "selection" ? "只识别本页中选中的笔画。"
     : options.pageStrokeCount === 0 ? "本页没有可编辑的笔画。请打开你写下手写内容的那份 PDF。"
     : options.pageStrokeCount !== undefined ? options.pageStrokeCount + " 笔笔画在本页。可先选中笔画来限定识别范围。"
     : "当前页所有笔写的手写内容。可先选中笔画来限定识别范围。");
    scopeControl?.setDisabled(running); configure?.setDisabled(running); recognise?.setDisabled(running || scope === "page" && options.pageStrokeCount === 0);
    cancel?.buttonEl.toggleClass("is-hidden", !running);
    retry?.buttonEl.toggleClass("is-hidden", running || !state?.failed);
    paste?.setDisabled(running || scope === "document");
    text?.setDisabled(running || !(options.canDisplay?.(scope, "text") ?? true));
    ink?.setDisabled(running || !(options.canDisplay?.(scope, "ink") ?? true));
    const seconds = state?.startedAt ? Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000)) : 0;
    status.setName(running ? state?.stage === "review" ? "可以核对" : "正在识别" : state?.stage === "failed" ? "识别需要处理" : "状态")
     .setDesc((state?.message || options.error || "就绪。请选择范围和识别服务。") + (running ? " · " + seconds + " s elapsed" : ""));
    progress.hidden = !state?.total;
    progress.max = Math.max(1, state?.total ?? 1); progress.value = (state?.completed ?? 0) + (state?.failed ?? 0) + (state?.skipped ?? 0);
    details.hidden = !state?.errors.length; errors.textContent = state?.errors.join("\n\n") ?? "";
    if (running && this.timer === undefined) this.timer = owner?.setInterval(() => refresh(), 1000);
    else if (!running && this.timer !== undefined) { owner?.clearInterval(this.timer); this.timer = undefined; }
   };
   this.unsubscribe = options.subscribe?.(value => { state = value; if (value.running) scope = value.scope; scopeControl?.setValue(scope); refresh(); });
   refresh(); styleButtons(this.contentEl);
  }
  onClose(): void {
   closed = true;
   this.unsubscribe?.(); this.unsubscribe = undefined;
   if (this.timer !== undefined) this.contentEl.ownerDocument.defaultView?.clearInterval(this.timer);
   this.timer = undefined; this.contentEl.empty();
  }
 }
 const modal = new Options(app); modal.open();
 return () => { if (!closed) modal.close(); };
}
export function reviewOcrResult(app: App, initial: { text: string; lines: OcrLine[]; box: NormalizedRect; image?: string; pageLabel?: string; skipPage?: boolean; onOpen?: (close: () => void) => void; cancelJob?: () => void }): Promise<{ text: string; lines: OcrLine[] } | null> {
 return new Promise(resolve => {
  class Review extends Modal {
   private accepted = false;
   onOpen(): void {
    this.setTitle(initial.pageLabel ? "查看手写内容 · " + initial.pageLabel : "查看识别出的手写内容");
    this.modalEl?.addClass("pdf-native-annotator-dialog");
    this.contentEl.addClass("freedraw-pdf-ocr-review"); let text = initial.text;
    if (initial.image) this.contentEl.createEl("img", { attr: { src: initial.image, alt: "原始手写内容" }, cls: "freedraw-pdf-ocr-review-image" });
    new Setting(this.contentEl).setName("识别稿").setDesc("接受前请改正文字。原始手写会保留。")
     .addTextArea(control => { control.setValue(text).onChange(value => { text = value; }); control.inputEl.rows = 8; control.inputEl.setAttribute("aria-label", "识别稿"); });
    const actions = new Setting(this.contentEl);
    if (initial.cancelJob) actions.addButton(button => button.setButtonText("取消剩余页面").onClick(() => initial.cancelJob?.()));
    actions.addButton(button => button.setButtonText(initial.skipPage ? "跳过此页" : "取消").onClick(() => this.close()))
     .addButton(button => button.setButtonText("接受文字").setCta().onClick(() => {
      if (!text.trim() || text.length > 50000) return;
      const parts = text.trim().split("\n");
      const lines = text.trim() === initial.text.trim() ? initial.lines : parts.length === initial.lines.length ? initial.lines.map((line, index) => ({ ...line, text: parts[index] })) : [{ text: text.trim(), box: { ...initial.box } }];
      this.accepted = true; resolve({ text: text.trim(), lines }); this.close();
     }));
    styleButtons(this.contentEl); initial.onOpen?.(() => this.close());
   }
   onClose(): void { if (!this.accepted) resolve(null); this.contentEl.empty(); }
  }
  new Review(app).open();
 });
}

