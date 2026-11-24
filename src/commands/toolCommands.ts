import type { SessionCommandDefinition } from "./sessionCommands";
import type { AnnotationTool, InkDrawingMode, InkToolKind, ShapeLineStyle, ShapeOptions, ToolPresetKind } from "../types";

export interface ToolCommandSession {
	selectToolFromCommand(tool: AnnotationTool): void;
	setInkToolDrawingMode(kind: InkToolKind, mode: InkDrawingMode): void;
	setInkToolLineStyle(kind: InkToolKind, style: ShapeLineStyle): void;
	chooseToolPreset(kind: ToolPresetKind, index: number): void;
	configureShapeTool(options: Partial<ShapeOptions>): void;
	reshapeSelectedShapes(kind: "circle" | "square" | "equilateral" | "right"): void;
}

/** Normal Obsidian commands so users manage all shortcuts in Settings → Hotkeys. */
export function toolCommandDefinitions<TSession extends ToolCommandSession>(): SessionCommandDefinition<TSession>[] {
	const definitions: SessionCommandDefinition<TSession>[] = [];
	const selectHotkeys: Record<string, string> = { pen: "b", highlighter: "h", eraser: "r", text: "t" };
	for (const [tool, label] of [["pen", "笔"], ["highlighter", "荧光笔"], ["eraser", "橡皮"], ["select", "选择"], ["text", "文字"], ["region", "区域截取"]] as const) {
		definitions.push({
			id: `tool-select-${tool}`,
			name: `工具：${label}`,
			hotkeys: selectHotkeys[tool] ? [{ modifiers: ["Ctrl", "Shift"], key: selectHotkeys[tool] }] : undefined,
			run: session => session.selectToolFromCommand(tool)
		});
	}
	for (const [kind, label] of [["pen", "笔"], ["highlighter", "荧光笔"]] as const) {
		for (const [mode, name] of [["freehand", "自由绘制"], ["straight", "直线"], ["region", "区域高亮"]] as const) if (mode !== "region" || kind === "highlighter") definitions.push({ id: `tool-${kind}-${mode}`, name: `${label}：${name}`, run: session => session.setInkToolDrawingMode(kind, mode) });
		for (const [style, name] of [["solid", "实线"], ["dashed", "虚线"], ["dotted", "点线"], ["wavy", "波浪线"]] as const) definitions.push({ id: `tool-${kind}-line-${style}`, name: `${label}：${name}`, run: session => session.setInkToolLineStyle(kind, style) });
	}
	const presetHotkeys: Record<string, string> = {
		"pen-1": "q", "pen-2": "w", "pen-3": "e",
		"highlighter-1": "a", "highlighter-2": "s", "highlighter-3": "d",
		"eraser-1": "z", "eraser-2": "x", "eraser-3": "c"
	};
	for (const [kind, label] of [["pen", "笔刷"], ["highlighter", "荧光笔"], ["eraser", "橡皮"]] as const) for (let index = 0; index < 3; index++) definitions.push({
		id: `tool-${kind}-preset-${index + 1}`,
		name: `${label}：预设 ${index + 1}`,
		hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: presetHotkeys[`${kind}-${index + 1}`] }],
		run: session => session.chooseToolPreset(kind, index)
	});
	definitions.push({ id: "shape-method-hold", name: "形状：画完后按住", run: session => session.configureShapeTool({ method: "hold", shape: "auto" }) });
	definitions.push({ id: "shape-method-drag", name: "形状：拖拽定大小", run: session => session.configureShapeTool({ method: "drag" }) });
	for (const [shape, name] of [["line", "直线"], ["rectangle", "矩形"], ["ellipse", "椭圆"], ["triangle", "三角形"]] as const) definitions.push({ id: `shape-drag-${shape}`, name: `形状：拖拽${name}`, run: session => session.configureShapeTool({ method: "drag", shape }) });
	for (const [kind, name] of [["circle", "圆"], ["square", "正方形"], ["equilateral", "等边三角形"], ["right", "直角三角形或直线"]] as const) definitions.push({ id: `reshape-selected-${kind}`, name: `所选形状：变成${name}`, run: session => session.reshapeSelectedShapes(kind) });
	return definitions;
}
