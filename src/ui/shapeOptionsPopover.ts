import { Setting } from "obsidian";
import { shapeOptionRows } from "./shapeOptionsRows";
import { normalizeShapeToolOptions } from "../shapes/shapeOptions";
import type { ShapeOptions } from "../types";

export function createShapeOptionsPopover(document: Document, initial: ShapeOptions, onChange: (options: ShapeOptions) => void, onClose: () => void): HTMLElement {
 const popover = document.createElement("div");
 popover.className = "modal pdf-native-annotator-shape-popover";
 popover.setAttribute("role", "dialog");
 popover.setAttribute("aria-label", "形状选项");
 let options = normalizeShapeToolOptions(initial);
 new Setting(popover).setName("形状").setHeading()
  .addExtraButton(button => button.setIcon("x").setTooltip("关闭形状选项").onClick(onClose));
 const description = popover.createEl("p", { cls: "setting-item-description" });
 const controls: { setting: Setting; name: string }[] = [];
 const refresh = () => {
  for (const row of controls) row.setting.settingEl.hidden = options.method === "hold" && row.name !== "形状创建方式" || row.name === "形状线型" && options.shape !== "line";
  description.textContent = options.method === "hold" ? "先画，再按住半秒。按住绘图修饰键可得到规则形状。" : "拖拽自由定大小。按住绘图修饰键可得到规则形状。";
 };
 for (const row of shapeOptionRows(() => options, next => { options = next; onChange(next); refresh(); })) {
  const setting = new Setting(popover); controls.push({ setting, name: row.name }); row.render(setting);
 }
 refresh();
 return popover;
}

