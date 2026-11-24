import { AbstractInputSuggest, App, Modal, Setting, normalizePath, prepareFuzzySearch } from "obsidian";

export type AnnotationCleanupScope = { kind: "vault" | "folder" | "pdf"; path: string };
export type AnnotationFileResult = { path: string; reason: string };

export class AnnotationPathSuggest extends AbstractInputSuggest<string> {
	constructor(app:App, private readonly input:HTMLInputElement, private readonly paths:string[], private readonly picked:(path:string)=>void) {
		super(app,input);this.limit=50;
	}
	getSuggestions(query:string):string[] {
		const text=query.trim();if(!text || text==="/")return [];
		const search=prepareFuzzySearch(text);
		return this.paths.map(path=>({path,match:search(path)})).filter(entry=>entry.match!==null)
			.sort((a,b)=>b.match!.score-a.match!.score || a.path.localeCompare(b.path)).map(entry=>entry.path);
	}
	renderSuggestion(path:string,element:HTMLElement):void {element.setText(path || "库根目录 (/)");}
	selectSuggestion(path:string):void {this.setValue(path || "/");this.picked(path);this.close();this.input.focus();}
}

class AnnotationScopeModal extends Modal {
	private cleanupScope:AnnotationCleanupScope;
	private accepted=false;
	private suggest:AnnotationPathSuggest|null=null;
	private pathInput:HTMLInputElement|null=null;
	constructor(app:App,private readonly pdfs:string[],private readonly folders:string[],activePdf:string|undefined,
		private readonly finish:(scope:AnnotationCleanupScope|null)=>void) {
		super(app);this.cleanupScope={kind:activePdf?"pdf":"vault",path:activePdf??""};
	}
	onOpen():void {
		this.setTitle("选择批注清理范围");
		this.modalEl?.addClass("pdf-native-annotator-dialog");
		let validate=()=>true;
		new Setting(this.contentEl).setName("包含范围").addDropdown(dropdown=>dropdown
			.addOption("pdf","单个 PDF").addOption("folder","一个文件夹及其子文件夹").addOption("vault","整个库")
			.setValue(this.cleanupScope.kind).onChange(value=>{this.cleanupScope={kind:value as AnnotationCleanupScope["kind"],path:""};renderTarget();}));
		const target=this.contentEl.createDiv();
		const renderTarget=()=>{
			this.suggest?.close();this.suggest=null;target.empty();
			if(this.cleanupScope.kind==="vault"){this.pathInput=null;validate=()=>true;target.createEl("p",{text:"包含本库中所有批注 JSON 文件。"});return;}
			const paths=this.cleanupScope.kind==="pdf"?this.pdfs:this.folders;
			const error=target.createEl("p",{cls:"freedraw-pdf-path-error"});
			error.hidden=true;
			const update=(value:string)=>{
				const path=normalizePath(value.trim()).replace(/^\/+|\/+$/g,"");
				this.cleanupScope.path=path;error.hidden=true;
			};
			validate=()=>{
				const typed=this.cleanupScope.path.toLocaleLowerCase();
				const matches=paths.filter(path=>path.toLocaleLowerCase()===typed);
				if(matches.length===1){this.cleanupScope.path=matches[0];return true;}
				error.setText(`请输入有效的${this.cleanupScope.kind==="pdf"?" PDF":"文件夹"}路径。可以自己输入，也可以用建议项。`);error.hidden=false;this.pathInput?.focus();return false;
			};
			const row=new Setting(target).setName(this.cleanupScope.kind==="pdf"?"PDF":"文件夹")
				.setDesc(this.cleanupScope.kind==="pdf"?"输入 PDF 路径，或选择一项建议。":"输入文件夹路径，或选择一项建议。库根目录用 / 。")
				.addText(text=>{
					this.pathInput=text.inputEl;
					text.inputEl.disabled=false;text.inputEl.readOnly=false;
					text.inputEl.setAttribute("autocomplete","off");
					text.inputEl.addClass("freedraw-pdf-path-input");
					text.inputEl.setAttribute("aria-label",this.cleanupScope.kind==="pdf"?"PDF 路径":"文件夹路径");
					text.setPlaceholder(this.cleanupScope.kind==="pdf"?"文件夹/试卷.pdf":"文件夹/子文件夹")
						.setValue(this.cleanupScope.path || (this.cleanupScope.kind==="folder"?"/":"")).onChange(update);
					this.suggest=new AnnotationPathSuggest(this.app,text.inputEl,paths,path=>update(path));
					update(text.getValue());
				});
			row.settingEl.addClass("freedraw-pdf-path-setting");
		};
		renderTarget();
		new Setting(this.contentEl).addButton(button=>button.setButtonText("取消").onClick(()=>this.close()))
			.addButton(button=>{button.setButtonText("继续").setCta().onClick(()=>{if(!validate())return;this.accepted=true;this.close();});});
	}
	onClose():void {this.suggest?.close();this.suggest=null;this.contentEl.empty();this.finish(this.accepted?this.cleanupScope:null);}
}

export function chooseAnnotationScope(app: App, activePdf?: string): Promise<AnnotationCleanupScope | null> {
	const pdfs = new Set<string>();
	const folders = new Set<string>([""]);
	for (const file of app.vault.getFiles()) {
		if (file.extension.toLowerCase() === "pdf") pdfs.add(file.path);
		if (file.path.endsWith(".annot.json")) pdfs.add(file.path.slice(0, -".annot.json".length).replace(/\.recovery-[^/]+$/, ""));
		let folder = file.parent?.path ?? "";
		while (folder) { folders.add(folder); folder = folder.slice(0, Math.max(0, folder.lastIndexOf("/"))); }
	}
	return new Promise(resolve => new AnnotationScopeModal(app, [...pdfs].sort(), [...folders].sort(), activePdf, resolve).open());
}

class AnnotationReportModal extends Modal {
	constructor(app: App, private readonly summary: string, private readonly rows: AnnotationFileResult[]) { super(app); }
	onOpen(): void {
		this.setTitle("清理完成");
		this.modalEl?.addClass("pdf-native-annotator-dialog");
		this.contentEl.createEl("p", {text: this.summary});
		const list = this.contentEl.createDiv({cls:"freedraw-pdf-file-report"});
		for (const row of this.rows) new Setting(list).setName(row.path.slice(row.path.lastIndexOf("/") + 1)).setDesc(row.reason);
		if (!this.rows.length) list.createEl("p", {text:"没有需要处理的批注文件。"});
		new Setting(this.contentEl).addButton(button => button.setButtonText("关闭").onClick(() => this.close()));
	}
	onClose(): void { this.contentEl.empty(); }
}

export function showAnnotationReport(app: App, summary: string, rows: AnnotationFileResult[]): void {
	new AnnotationReportModal(app, summary, rows).open();
}

class AnnotationConfirmationModal extends Modal {
	private accepted = false;
	constructor(app: App, private readonly title: string, private readonly message: string,
		private readonly action: string, private readonly finish: (value: boolean) => void,
		private readonly details: { label: string; value: string }[] = []) { super(app); }
	onOpen(): void {
		this.setTitle(this.title);
		this.modalEl?.addClass("pdf-native-annotator-dialog");
		this.contentEl.createEl("p", { text: this.message });
		if (this.details.length) {
			const list = this.contentEl.createEl("dl", { cls: "freedraw-pdf-file-details" });
			for (const detail of this.details) {
				list.createEl("dt", { text: detail.label });
				list.createEl("dd", { text: detail.value });
			}
		}
		new Setting(this.contentEl)
			.addButton(button => button.setButtonText("保留数据").onClick(() => this.close()))
			.addButton(button => button.setButtonText(this.action).setWarning().onClick(() => {
				this.accepted = true;
				this.close();
			}));
	}
	onClose(): void { this.contentEl.empty(); this.finish(this.accepted); }
}

export function confirmAnnotationAction(app: App, title: string, message: string, action: string,
	details: { label: string; value: string }[] = []): Promise<boolean> {
	return new Promise(resolve => new AnnotationConfirmationModal(app, title, message, action, resolve, details).open());
}

class AnnotationFileChoiceModal extends Modal {
	private selected: string;
	private accepted = false;
	constructor(app: App, private readonly title: string, private readonly message: string,
		private readonly paths: string[], private readonly finish: (value: string | null) => void) {
		super(app); this.selected = paths[0];
	}
	onOpen(): void {
		this.setTitle(this.title);
		this.modalEl?.addClass("pdf-native-annotator-dialog");
		this.contentEl.createEl("p", { text: this.message });
		new Setting(this.contentEl).setName("批注数据 JSON").addDropdown(dropdown => {
			for (const path of this.paths) dropdown.addOption(path, path.slice(path.lastIndexOf("/") + 1));
			dropdown.setValue(this.selected).onChange(value => this.selected = value);
		});
		new Setting(this.contentEl)
			.addButton(button => button.setButtonText("取消").onClick(() => this.close()))
			.addButton(button => button.setButtonText("使用所选数据").setCta().onClick(() => {
				this.accepted = true; this.close();
			}));
	}
	onClose(): void { this.contentEl.empty(); this.finish(this.accepted ? this.selected : null); }
}

export function chooseAnnotationFile(app: App, title: string, message: string, paths: string[]): Promise<string | null> {
	if (!paths.length) return Promise.resolve(null);
	return new Promise(resolve => new AnnotationFileChoiceModal(app, title, message, paths, resolve).open());
}
