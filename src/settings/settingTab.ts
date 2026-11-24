import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { PAPER_COLOR_PRESETS, TOOL_WIDTH_RANGES } from "../config";
import { ocrSettingRows, type OcrSettingsHost } from "../ocr/settingsRows";
import { shapeOptionRows } from "../ui/shapeOptionsRows";
import type { InkEasingMode, InkInputPolicy, InkPressureMode, InkRenderSettings, LivePreviewMode, PDFAnnotatorSettings, ShapeOptions, ToolPreset, ToolStateSnapshot } from "../types";

type SettingDefinitionCompat = {
	name: string;
	desc?: string;
	render: (setting: Setting) => void;
	visible?: () => boolean;
};

export interface PDFAnnotatorSettingsHost extends OcrSettingsHost {
	cleanAnnotationFiles(removeOrphans: boolean): Promise<void>;
	restoreActiveAnnotationData(): Promise<void>;
	getInlineToolbarPreference(): boolean;
	shouldSeparateToolOptions(): boolean;
	getToolbarFixedWidth(): number;
	getToolbarAlignment(): "left" | "right";
	getToolOptionsPresentation(): "menus" | "buttons";
	getDrawingModifier(): PDFAnnotatorSettings["drawingModifier"];
	getRightTriangleModifier(): PDFAnnotatorSettings["rightTriangleModifier"];
	shouldShowRegionToolbarButton(): boolean;
	shouldShowCopyEmbedToolbarButton(): boolean;
	shouldAutoCopyRegionEmbed(): boolean;
	shouldShowAnnotatedEmbedHeader(): boolean;
	shouldShowDrawingNotices(): boolean;
	shouldShowRenderTelemetry(): boolean;
	getInkInputPolicy(): InkInputPolicy;
	getLivePreviewMode(): LivePreviewMode;
	getInkRenderSettings(): InkRenderSettings;
	getQuickAddPageSettings(): PDFAnnotatorSettings["quickAddPageSettings"];
	getAutosaveDelayMs(): number;
	getToolDefaults(): ToolStateSnapshot;
	getStoredPresets(): ToolPreset[];
	updateBehaviorSettings(
		nextSettings: Partial<Pick<PDFAnnotatorSettings, "preferInlineToolbar" | "separateToolOptions" | "toolbarFixedWidth" | "toolbarAlignment" | "toolOptionsPresentation" | "drawingModifier" | "rightTriangleModifier" | "showRegionToolbarButton" | "showCopyEmbedToolbarButton" | "autoCopyRegionEmbed" | "showAnnotatedEmbedHeader" | "showDrawingNotices" | "showRenderTelemetry" | "inkInputPolicy" | "livePreviewMode" | "inkRenderSettings" | "quickAddPageSettings" | "autosaveDelayMs">>
	): Promise<void>;
	updateToolPreferences(snapshot: ToolStateSnapshot, presets: ToolPreset[]): void;
	updateShapeToolOptions(options: ShapeOptions): void;
}

export class PDFAnnotatorSettingTab extends PluginSettingTab {
	private quickAddDefaultsEl: HTMLElement | null = null;
	constructor(app: App, private readonly plugin: Plugin & PDFAnnotatorSettingsHost) {
		super(app, plugin);
	}

	// Share row renderers between searchable groups and the pre-1.13 fallback.
	private buildSettingRows(): SettingDefinitionCompat[] {
		return [
			...shapeOptionRows(() => this.plugin.getToolDefaults().shapeOptions, options => this.plugin.updateShapeToolOptions(options)),
			{
				name: "工具栏位置",
				desc: "把批注控件放在 PDF 工具栏里；若和其他扩展重叠，可改用浮动工具栏。",
				render: (setting) => {
					setting
						.setName("工具栏位置")
						.setDesc("把批注控件放在 PDF 工具栏里；若和其他扩展重叠，可改用浮动工具栏。")
						.addDropdown((dropdown) => {
							dropdown
								.addOption("inline", "放在 PDF 工具栏内")
								.addOption("floating", "浮动")
								.setValue(this.plugin.getInlineToolbarPreference() ? "inline" : "floating")
								.onChange(async (value) => {
									await this.plugin.updateBehaviorSettings({ preferInlineToolbar: value === "inline" });
								});
						});
				}
			},
			{
				name: "区域截取按钮",
				desc: "在工具栏直接显示区域截取。隐藏后仍可从「更多」里使用。",
				render: setting => {
					setting.setName("区域截取按钮").setDesc("在工具栏直接显示区域截取。隐藏后仍可从「更多」里使用。").addToggle(toggle => toggle.setValue(this.plugin.shouldShowRegionToolbarButton()).onChange(value => { void this.plugin.updateBehaviorSettings({ showRegionToolbarButton: value }); }));
				}
			},
			{
				name: "工具栏对齐",
				desc: "批注控件靠左（紧挨 PDF 控件）或靠右。两种布局都可以滚动。",
				render: setting => {
					setting.setName("工具栏对齐").setDesc("批注控件靠左（紧挨 PDF 控件）或靠右。两种布局都可以滚动。").addDropdown(dropdown => dropdown.addOptions({ left: "靠左", right: "靠右" }).setValue(this.plugin.getToolbarAlignment()).onChange(value => { void this.plugin.updateBehaviorSettings({ toolbarAlignment: value === "right" ? "right" : "left" }); }));
				}
			},
			{
				name: "工具选项",
				desc: "用文字按钮显示当前选项，或点击当前工具图标打开菜单。颜色、粗细和预设仍留在工具栏。",
				render: setting => {
					setting.setName("工具选项").setDesc("用文字按钮显示当前选项，或点击当前工具图标打开菜单。颜色、粗细和预设仍留在工具栏。").addDropdown(dropdown => dropdown.addOptions({ buttons: "文字按钮", menus: "菜单" }).setValue(this.plugin.getToolOptionsPresentation()).onChange(value => { void this.plugin.updateBehaviorSettings({ toolOptionsPresentation: value === "menus" ? "menus" : "buttons" }); }));
				}
			},
			{
				name: "绘图修饰键",
				desc: "按住时，笔和荧光笔画实线直线；形状工具则约束为圆、正方形、等边三角形或吸附直线。",
				render: setting => {
					setting.setName("绘图修饰键").setDesc("按住时，笔和荧光笔画实线直线；形状工具则约束为圆、正方形、等边三角形或吸附直线。").addDropdown(dropdown => dropdown.addOptions({ shift: "Shift", alt: "Alt / Option", control: "Ctrl", meta: "Cmd / Windows", none: "关闭" }).setValue(this.plugin.getDrawingModifier()).onChange(value => { void this.plugin.updateBehaviorSettings({ drawingModifier: value as PDFAnnotatorSettings["drawingModifier"] }); }));
				}
			},
			{
				name: "直角三角形修饰键",
				desc: "画形状时按住，拟合为直角三角形。会覆盖等边约束；请与绘图修饰键使用不同按键。",
				render: setting => {
					setting.setName("直角三角形修饰键").setDesc("画形状时按住，拟合为直角三角形。会覆盖等边约束；请与绘图修饰键使用不同按键。").addDropdown(dropdown => dropdown.addOptions({ alt: "Alt / Option", shift: "Shift", control: "Ctrl", meta: "Cmd / Windows", none: "关闭" }).setValue(this.plugin.getRightTriangleModifier()).onChange(value => { void this.plugin.updateBehaviorSettings({ rightTriangleModifier: value as PDFAnnotatorSettings["rightTriangleModifier"] }); }));
				}
			},
			{
				name: "复制嵌入按钮",
				desc: "选中区域后显示「复制嵌入」。隐藏后该操作仍在区域菜单里。",
				render: (setting) => {
					setting
						.setName("复制嵌入按钮")
						.setDesc("选中区域后显示「复制嵌入」。隐藏后该操作仍在区域菜单里。")
						.addToggle((toggle) => {
							toggle
								.setValue(this.plugin.shouldShowCopyEmbedToolbarButton())
								.onChange(async (value) => {
									await this.plugin.updateBehaviorSettings({ showCopyEmbedToolbarButton: value });
								});
					});
				}
			},
			{
				name: "自动复制区域嵌入",
				desc: "截取区域后立即复制带批注的 Markdown 嵌入块。",
				render: (setting) => {
					setting
						.setName("自动复制区域嵌入")
						.setDesc("截取区域后立即复制带批注的 Markdown 嵌入块。")
						.addToggle((toggle) => {
							toggle
								.setValue(this.plugin.shouldAutoCopyRegionEmbed())
								.onChange(async (value) => {
									await this.plugin.updateBehaviorSettings({ autoCopyRegionEmbed: value });
								});
						});
				}
			},
			{
				name: "嵌入控件",
				desc: "在笔记里的批注 PDF 嵌入上方显示标题，以及打开、刷新、复制按钮。",
				render: (setting) => {
					setting
						.setName("嵌入控件")
						.setDesc("在笔记里的批注 PDF 嵌入上方显示标题，以及打开、刷新、复制按钮。")
						.addToggle((toggle) => {
							toggle
								.setValue(this.plugin.shouldShowAnnotatedEmbedHeader())
								.onChange(async (value) => {
									await this.plugin.updateBehaviorSettings({ showAnnotatedEmbedHeader: value });
								});
						});
				}
			},
			{
				name: "操作提示",
				desc: "绘制、保存、撤销和重做时显示简短提示。保存失败总会提示。",
				render: (setting) => {
					setting
						.setName("操作提示")
						.setDesc("绘制、保存、撤销和重做时显示简短提示。保存失败总会提示。")
						.addToggle((toggle) => {
							toggle
								.setValue(this.plugin.shouldShowDrawingNotices())
								.onChange(async (value) => {
									await this.plugin.updateBehaviorSettings({ showDrawingNotices: value });
								});
						});
				}
			},
			{
				name: "渲染诊断",
				desc: "显示实时输入和渲染耗时。只在排查绘制问题时打开。",
				render: (setting) => {
					setting
						.setName("渲染诊断")
						.setDesc("显示实时输入和渲染耗时。只在排查绘制问题时打开。")
						.addToggle((toggle) => {
							toggle
								.setValue(this.plugin.shouldShowRenderTelemetry())
								.onChange(async (value) => {
									await this.plugin.updateBehaviorSettings({ showRenderTelemetry: value });
								});
						});
				}
			},
			{
				name: "手指输入",
				desc: "选择单指在页面上的作用。Apple Pencil 和鼠标在两种模式下都会绘制。",
				render: (setting) => {
					setting
						.setName("手指输入")
						.setDesc("选择单指在页面上的作用。Apple Pencil 和鼠标在两种模式下都会绘制。")
						.addDropdown((dropdown) => {
							dropdown
								.addOption("allow-touch", "手指绘制")
								.addOption("pen-mouse-only", "手指平移")
								.setValue(this.plugin.getInkInputPolicy())
								.onChange(async (value) => {
									await this.plugin.updateBehaviorSettings({ inkInputPolicy: value as InkInputPolicy });
								});
						});
				}
			},
			{
				name: "笔迹预览",
				desc: "选择快速预览、精确预览，或自动平滑。所有模式下 Pencil 压感都保持开启。",
				render: (setting) => {
					setting
						.setName("笔迹预览")
						.setDesc("快速：书写时曲线细分更少。精确：与保存的几何一致。最顺滑：使用自动平滑。新笔迹按测到的 Pencil 接触画连续曲线；旧笔迹保留自适应笔尖预测。压感保持开启。")
						.addDropdown((dropdown) => {
							dropdown
								.addOption("fast", "快速")
								.addOption("accurate", "精确")
								.addOption("auto-smooth", "最顺滑")
								.setValue(this.plugin.getLivePreviewMode())
								.onChange(async (value) => {
									await this.plugin.updateBehaviorSettings({ livePreviewMode: value as LivePreviewMode });
								});
						});
				}
			},
			...this.getInkSettingDefinitions(),
			...this.getQuickAddPageSettingDefinitions(),
			...this.getDefaultToolSettingDefinitions()
		];
	}

	private getInkSettingDefinitions(): SettingDefinitionCompat[] {
		const updateInkRenderSettings = async (patch: Partial<InkRenderSettings>): Promise<void> => {
			await this.plugin.updateBehaviorSettings({
				inkRenderSettings: {
					...this.plugin.getInkRenderSettings(),
					...patch
				}
			});
		};
		return [
			{
				name: "压感输入",
				desc: "笔始终使用上报的压感。请选择新笔画如何处理鼠标和手指的压感。",
				render: (setting) => {
					setting
						.setName("压感输入")
						.setDesc("笔始终使用上报的压感；没有压感时沿用上一次。绘制速度只作用于鼠标和手指。仅影响新笔迹。")
						.addDropdown((dropdown) => {
							dropdown
								.addOption("auto", "自动")
								.addOption("simulate", "绘制速度（鼠标/手指）")
								.addOption("stylus", "触控笔压感")
								.setValue(this.plugin.getInkRenderSettings().pressureMode)
								.onChange(async (value) => {
									await updateInkRenderSettings({ pressureMode: value as InkPressureMode });
								});
						});
				}
			},
			{
				name: "笔画粗细响应",
				desc: "压感对线宽的影响有多强。数值越高，粗细变化越明显。",
				render: (setting) => {
					setting
						.setName("压感灵敏度")
						.setDesc("0 表示粗细不变。数值越高，Pencil 按得越重，线条越粗。仅影响新笔迹。")
						.addSlider((slider) => {
							slider
								.setLimits(0, 1, 0.05)
								.setValue(this.plugin.getInkRenderSettings().thinning)
								.setDynamicTooltip()
								.onChange(async (value) => {
									await updateInkRenderSettings({ thinning: value });
								});
						});
				}
			},
			{
				name: "鼠标/触控板平滑",
				desc: "用于 Mac 触控板和鼠标：实时滤掉手抖和锯齿（One Euro 滤波），慢速更稳、快速依然跟手。0 关闭；越大越稳，但慢速书写时笔尖会稍滞后。仅影响新笔迹。",
				render: (setting) => {
					setting
						.setName("鼠标/触控板平滑")
						.setDesc("用于 Mac 触控板和鼠标：实时滤掉手抖和锯齿（One Euro 滤波），慢速更稳、快速依然跟手。0 关闭；越大越稳，但慢速书写时笔尖会稍滞后。仅影响新笔迹。")
						.addSlider((slider) => {
							slider
								.setLimits(0, 1, 0.05)
								.setValue(this.plugin.getInkRenderSettings().mouseSmoothing ?? 0.5)
								.setDynamicTooltip()
								.onChange(async (value) => {
									await updateInkRenderSettings({ mouseSmoothing: value });
								});
						});
				}
			},
			{
				name: "稳定",
				desc: "0 关闭路径稳定。数值越高，越能抹平手抖，但笔尖跟随会慢一些。仅影响新笔迹。",
				render: (setting) => {
					setting
						.setName("稳定")
						.setDesc("0 关闭路径稳定。数值越高，越能抹平手抖，但笔尖跟随会慢一些。仅影响新笔迹。")
						.addSlider((slider) => {
							slider
								.setLimits(0, 1, 0.05)
								.setValue(this.plugin.getInkRenderSettings().streamline)
								.setDynamicTooltip()
								.onChange(async (value) => {
									await updateInkRenderSettings({ streamline: value });
								});
						});
				}
			},
			{
				name: "粗细平滑模式",
				desc: "超平滑会在跟随 Pencil 压感的同时，轻轻混合相邻的压感变化。",
				render: (setting) => {
					setting.setName("粗细平滑模式")
						.setDesc("超平滑会跟随 Pencil 压感，并用少量局部混合减弱突然的粗细变化。仅影响新笔迹。")
						.addDropdown((dropdown) => {
							dropdown.addOption("original", "原始")
								.addOption("extra-smooth", "超平滑")
								.setValue(this.plugin.getInkRenderSettings().widthSmoothing ?? "extra-smooth")
								.onChange(async (value) => {
									await updateInkRenderSettings({ widthSmoothing: value === "original" ? "original" : "extra-smooth" });
								});
						});
				}
			},
			{
				name: "笔迹平滑",
				desc: "让转角更圆，并柔化相邻的粗细过渡。仅影响新笔迹。",
				render: (setting) => {
					setting
						.setName("笔迹平滑")
						.setDesc("数值越高，转角越圆，粗细过渡越柔和。超平滑把压感变化限制在局部；原始模式保留峰值粗细。仅影响新笔迹；手抖由「稳定」控制。")
						.addSlider((slider) => {
							slider
								.setLimits(0, 1, 0.05)
								.setValue(this.plugin.getInkRenderSettings().smoothing)
								.setDynamicTooltip()
								.onChange(async (value) => {
									await updateInkRenderSettings({ smoothing: value });
								});
						});
				}
			},
			{
				name: "压感曲线",
				desc: "选择压感变化反映到线宽时有多平缓。",
				render: (setting) => {
					setting
						.setName("压感曲线")
						.setDesc("选择压感变化反映到线宽时有多平缓。")
						.addDropdown((dropdown) => {
							dropdown
								.addOption("linear", "线性")
								.addOption("ease-in", "缓入")
								.addOption("ease-out", "缓出")
								.addOption("ease-in-out", "缓入缓出")
								.setValue(this.plugin.getInkRenderSettings().easing)
								.onChange(async (value) => {
									await updateInkRenderSettings({ easing: value as InkEasingMode });
								});
						});
				}
			},
			{
				name: "起笔渐细",
				desc: "起笔收窄的程度。0 表示起笔不变细。",
				render: (setting) => this.renderInkSlider(setting, "起笔渐细", "起笔收窄的程度。0 表示起笔不变细。", "taperStart", updateInkRenderSettings)
			},
			{
				name: "收笔渐细",
				desc: "收笔收窄的程度。0 表示收笔不变细。",
				render: (setting) => this.renderInkSlider(setting, "收笔渐细", "收笔收窄的程度。0 表示收笔不变细。", "taperEnd", updateInkRenderSettings)
			},
			{
				name: "保存延迟",
				desc: "最后一次编辑后等待多久再保存批注。数值越低，保存越快。",
				render: (setting) => {
					setting
						.setName("保存延迟")
						.setDesc("最后一次编辑后等待多久再保存批注。数值越低，保存越快。")
						.addSlider((slider) => {
							slider
								.setLimits(200, 2000, 100)
								.setValue(this.plugin.getAutosaveDelayMs())
								.setDynamicTooltip()
								.onChange(async (value) => {
									await this.plugin.updateBehaviorSettings({ autosaveDelayMs: value });
								});
						});
				}
			}
		];
	}

	private getQuickAddPageSettingDefinitions(): SettingDefinitionCompat[] {
		const update = async (patch: Partial<PDFAnnotatorSettings["quickAddPageSettings"]>) => {
			await this.plugin.updateBehaviorSettings({ quickAddPageSettings: { ...this.plugin.getQuickAddPageSettings(), ...patch, source: "previous" } });
		};
		return [

			{ name: "快速添加模板", render: setting => { setting.setName("默认模板")
				.setDesc("新建可批注 PDF 和第一张添加页使用的模板。")
				.addDropdown(dropdown => dropdown.addOption("blank", "空白").addOption("ruled", "横线").addOption("grid", "网格").addOption("dot", "点线")
					.setValue(this.plugin.getQuickAddPageSettings().template).onChange(value => update({ template: value as PDFAnnotatorSettings["quickAddPageSettings"]["template"] }))); } },
			{ name: "快速添加的纸色", render: setting => {
				let syncDropdown: ((color: string) => void) | undefined;
				let syncPicker: ((color: string) => void) | undefined;
				const selectColor = async (color: string): Promise<void> => {
					syncDropdown?.(color);
					syncPicker?.(color);
					await update({ paperColor: color });
				};
				setting.setName("默认纸色")
					.setDesc("新建可批注 PDF 和第一张添加页使用的纸色。")
					.addDropdown(dropdown => {
						PAPER_COLOR_PRESETS.forEach(preset => { dropdown.addOption(preset.color, preset.label); });
						let customOption: HTMLOptionElement | null = null;
						syncDropdown = color => {
							const preset = PAPER_COLOR_PRESETS.find(entry => entry.color.toLowerCase() === color.toLowerCase());
							if (!preset) {
								if (customOption) customOption.value = color;
								else {
									dropdown.addOption(color, "自定义颜色");
									customOption = Array.from(dropdown.selectEl.options).find(option => option.value === color) ?? null;
								}
							}
							dropdown.setValue(preset?.color ?? color);
						};
						syncDropdown(this.plugin.getQuickAddPageSettings().paperColor);
						dropdown.onChange(selectColor);
					})
					.addColorPicker(picker => {
						picker.setValue(this.plugin.getQuickAddPageSettings().paperColor).onChange(selectColor);
						syncPicker = color => { picker.setValue(color); };
					});
			} },
			{ name: "自动页面样式", render: setting => {
				setting.setName("").setDesc("第一页使用这些默认值。之后的页面跟随这份 PDF 里最近一次模板或颜色更改。");
				setting.settingEl.addClass("freedraw-pdf-quick-add-note");
			} }
		];
	}

	private renderInkSlider(
		setting: Setting,
		name: string,
		desc: string,
		key: "taperStart" | "taperEnd",
		updateInkRenderSettings: (patch: Partial<InkRenderSettings>) => Promise<void>
	): void {
		setting
			.setName(name)
			.setDesc(desc)
			.addSlider((slider) => {
				slider
					.setLimits(0, 120, 1)
					.setValue(this.plugin.getInkRenderSettings()[key])
					.setDynamicTooltip()
					.onChange(async (value) => {
						await updateInkRenderSettings({ [key]: value });
					});
			});
	}

	private getDefaultToolSettingDefinitions(): SettingDefinitionCompat[] {
		return [
			{
				name: "笔的粗细",
				desc: "新笔画的起始粗细。",
				render: (setting) => this.renderDefaultWidthSetting(setting, "笔的粗细", "新笔画的起始粗细。", "pen", TOOL_WIDTH_RANGES.pen.min, TOOL_WIDTH_RANGES.pen.max)
			},
			{
				name: "荧光笔粗细",
				desc: "新荧光笔笔画的起始粗细。",
				render: (setting) => this.renderDefaultWidthSetting(setting, "荧光笔粗细", "新荧光笔笔画的起始粗细。", "highlighter", TOOL_WIDTH_RANGES.highlighter.min, TOOL_WIDTH_RANGES.highlighter.max)
			},
			{
				name: "橡皮大小",
				desc: "橡皮的起始接触范围。",
				render: (setting) => this.renderDefaultWidthSetting(setting, "橡皮大小", "橡皮的起始接触范围。", "eraser", TOOL_WIDTH_RANGES.eraser.min, TOOL_WIDTH_RANGES.eraser.max)
			}
		];
	}

	private renderDefaultWidthSetting(setting: Setting, name: string, desc: string, tool: "pen" | "highlighter" | "eraser", min: number, max: number): void {
		setting
			.setName(name)
			.setDesc(desc)
			.addSlider((slider) => {
				slider
					.setLimits(min, max, TOOL_WIDTH_RANGES[tool].step)
					.setValue(this.plugin.getToolDefaults().widths[tool])
					.setDynamicTooltip()
					.onChange((value) => {
						const next = this.plugin.getToolDefaults();
						next.widths[tool] = value;
						this.plugin.updateToolPreferences(next, this.plugin.getStoredPresets());
					});
			});
	}

	private renderSettingDefinitions(
		containerEl: HTMLElement,
		definitions: Map<string, SettingDefinitionCompat>,
		names: string[]
	): void {
		for (const name of names) {
			const definition = definitions.get(name);
			if (!definition) {
				continue;
			}
			definition.render(new Setting(containerEl));
		}
	}

	private renderSettingsSection(containerEl: HTMLElement, name: string): HTMLElement {
		const section = containerEl.createEl("section", { cls: "freedraw-pdf-settings-section" });
		const heading = new Setting(section).setName(name).setHeading();
		heading.settingEl.addClass("freedraw-pdf-settings-section-heading");
		return section.createDiv({ cls: "freedraw-pdf-settings-group" });
	}

	private syncQuickAddDefaultFields(): void {
		if (this.quickAddDefaultsEl) this.quickAddDefaultsEl.hidden = false;
		// 1.13+ updates visibility in place, preserving focus and scroll.
		const tab = this as PluginSettingTab & { refreshDomState?: () => void };
		tab.refreshDomState?.();
	}

	private getFileManagementRows(): SettingDefinitionCompat[] {
		return [
			{ name: "从 JSON 恢复批注", render: setting => { setting.setName("从 JSON 恢复批注")
			.setDesc("用同一文件夹里的较早副本替换当前 PDF 的批注层。当前数据会先备份。补回缺失笔迹请用「合并 JSON」。")
			.addButton(button => button.setButtonText("选择恢复文件").onClick(() => this.plugin.restoreActiveAnnotationData())); } },
			{ name: "合并批注 JSON", render: setting => { setting.setName("合并批注 JSON")
			.setDesc("选择一个 PDF、一个文件夹或整个库。补上缺失笔迹，不同版本作为分开的叠层保留。合并用过的恢复副本在保存后移入回收站。")
			.addButton(button => button.setButtonText("合并 JSON").onClick(async () => {
				button.setDisabled(true);
				try { await this.plugin.cleanAnnotationFiles(false); } finally { button.setDisabled(false); }
			})); } },
			{ name: "清理已删除 PDF 的数据", render: setting => { setting.setName("清理已删除 PDF 的数据")
			.setDesc("删除 PDF 已不在时残留的批注和恢复 JSON。默认整个库，也可限定到文件夹或某个 PDF。移入回收站前会要求确认。")
			.addButton(button => button.setButtonText("清理已删除的 PDF").onClick(async () => {
				button.setDisabled(true);
				try { await this.plugin.cleanAnnotationFiles(true); } finally { button.setDisabled(false); }
			})); } }
		];
	}

	// Structural compatibility keeps the minimum supported API at 1.12.
	// Obsidian 1.13+ renders and indexes these native groups; older versions use display().
	getSettingDefinitions(): { type: "group"; heading: string; cls: string; items: SettingDefinitionCompat[] }[] {
		const shortcuts: SettingDefinitionCompat = { name: "工具与预设快捷键", desc: "在「设置 → 快捷键」中搜索「笔刷」「荧光笔」「橡皮」「文字」即可修改。预设槽位的颜色和粗细在工具栏里配置。", render: setting => { setting.setName("工具与预设快捷键").setDesc("默认快捷键（仅在打开 PDF 时生效，可在「设置 → 快捷键」搜索「笔刷」「荧光笔」「橡皮」「文字」修改）：笔刷预设 1/2/3 为 Ctrl+Shift+Q/W/E；荧光笔预设 1/2/3 为 Ctrl+Shift+A/S/D；橡皮预设 1/2/3 为 Ctrl+Shift+Z/X/C；文字为 Ctrl+Shift+T。颜色、粗细和透明度在 PDF 工具栏的对应槽位里改，快捷键始终切到那个槽位。"); } };
		const rows = new Map([...this.buildSettingRows(), shortcuts, ...ocrSettingRows(this.plugin), ...this.getFileManagementRows()].map(row => [row.name, row]));
		for (const name of ["快速添加模板", "快速添加的纸色", "自动页面样式"]) {
			const row = rows.get(name);
			if (row) row.visible = () => true;
		}
		const groups: [string, string[]][] = [
			["绘图输入", ["手指输入", "笔迹预览"]],
			["笔的压感", ["压感输入", "笔画粗细响应", "压感曲线"]],
			["笔迹平滑", ["鼠标/触控板平滑", "稳定", "粗细平滑模式", "笔迹平滑"]],
			["工具大小", ["笔的粗细", "荧光笔粗细", "橡皮大小"]],
			["形状", ["形状创建方式", "拖拽形状", "形状线型"]],
			["笔画两端", ["起笔渐细", "收笔渐细"]],
			["页面 / 快速添加", ["快速添加模板", "快速添加的纸色", "自动页面样式"]],
			["工具栏", ["工具栏位置", "工具栏对齐", "工具选项", "绘图修饰键", "直角三角形修饰键", "区域截取按钮", "复制嵌入按钮"]],
			["快捷键", ["工具与预设快捷键"]],
			["Markdown 嵌入", ["自动复制区域嵌入", "嵌入控件"]],
			["保存", ["保存延迟"]],
			["手写识别", ocrSettingRows(this.plugin).map(row=>row.name)],
			["文件管理", ["从 JSON 恢复批注", "合并批注 JSON", "清理已删除 PDF 的数据"]],
			["调试", ["操作提示", "渲染诊断"]]
		];
		return groups.map(([heading, names]) => ({
			type: "group", heading, cls: "freedraw-pdf-settings-native-group",
			items: names.map(name => rows.get(name)).filter((row): row is SettingDefinitionCompat => !!row)
		}));
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("freedraw-pdf-settings");
		const definitions = new Map(this.buildSettingRows().map(definition => [definition.name, definition]));
		const renderSection = (name: string, names: string[]) => {
			const body = this.renderSettingsSection(containerEl, name);
			this.renderSettingDefinitions(body, definitions, names);
			return body;
		};
		renderSection("绘图输入", ["手指输入", "笔迹预览"]);
		renderSection("笔的压感", ["压感输入", "笔画粗细响应", "压感曲线"]);
		renderSection("笔迹平滑", ["鼠标/触控板平滑", "稳定", "粗细平滑模式", "笔迹平滑"]);
		renderSection("工具大小", ["笔的粗细", "荧光笔粗细", "橡皮大小"]);
		renderSection("形状", ["形状创建方式", "拖拽形状", "形状线型"]);
		renderSection("笔画两端", ["起笔渐细", "收笔渐细"]);
		const pages = renderSection("页面 / 快速添加", []);
		this.quickAddDefaultsEl = pages.createDiv({ cls: "freedraw-pdf-quick-add-defaults" });
		this.renderSettingDefinitions(this.quickAddDefaultsEl, definitions, ["快速添加模板", "快速添加的纸色", "自动页面样式"]);
		this.syncQuickAddDefaultFields();
		renderSection("工具栏", ["工具栏位置", "工具栏对齐", "工具选项", "绘图修饰键", "直角三角形修饰键", "区域截取按钮", "复制嵌入按钮"]);
		const hotkeys = this.renderSettingsSection(containerEl, "快捷键");
		new Setting(hotkeys).setName("工具与预设快捷键").setDesc("默认快捷键（仅在打开 PDF 时生效，可在「设置 → 快捷键」搜索「笔刷」「荧光笔」「橡皮」「文字」修改）：笔刷预设 1/2/3 为 Ctrl+Shift+Q/W/E；荧光笔预设 1/2/3 为 Ctrl+Shift+A/S/D；橡皮预设 1/2/3 为 Ctrl+Shift+Z/X/C；文字为 Ctrl+Shift+T。颜色、粗细和透明度在 PDF 工具栏的对应槽位里改，快捷键始终切到那个槽位。");
		renderSection("Markdown 嵌入", ["自动复制区域嵌入", "嵌入控件"]);
		renderSection("保存", ["保存延迟"]);
		const recognition = this.renderSettingsSection(containerEl, "手写识别");
		for (const row of ocrSettingRows(this.plugin)) row.render(new Setting(recognition));
		const files = this.renderSettingsSection(containerEl, "文件管理");
		for (const row of this.getFileManagementRows()) row.render(new Setting(files));
		renderSection("调试", ["操作提示", "渲染诊断"]);
	}
}




