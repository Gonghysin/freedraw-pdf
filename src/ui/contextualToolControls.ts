import type { AnnotationTool, InkToolKind, InkToolOptions, ShapeOptions } from "../types";

export interface ContextualToolControl { id: string; label: string; title: string; run: () => void; }
export interface ContextualToolActions {
	ink: (kind: InkToolKind, patch: Partial<InkToolOptions>) => void;
	shape: (patch: Partial<ShapeOptions>) => void;
}
const nextValue = <T>(values: readonly T[], current: T): T => values[(values.indexOf(current) + 1) % values.length];
const lineStyles = ["solid", "dashed", "dotted", "wavy"] as const;
const LABELS: Record<string, string> = { solid: "实线", dashed: "虚线", dotted: "点线", wavy: "波浪线", line: "直线", rectangle: "矩形", ellipse: "椭圆", triangle: "三角形" };
const label = (value: string) => LABELS[value] ?? value;

/** Discrete options cycle; controls depend only on the active tool's preferences. */
export function contextualToolControls(tool: AnnotationTool, ink: InkToolOptions | undefined, shape: ShapeOptions, actions: ContextualToolActions): ContextualToolControl[] {
	const controls: ContextualToolControl[] = [];
	const add = (id: string, text: string, title: string, run: () => void) => controls.push({ id, label: text, title, run });
	const wave = (value: number, run: (size: number) => void) => add("wave-size", `波浪 ${value}`, "波浪大小。点击循环切换。", () => run(nextValue([.25, .5, .75, 1, 1.5, 2, 3, 4, 6], value)));
	if ((tool === "pen" || tool === "highlighter") && ink) {
		const modes: InkToolOptions["mode"][] = tool === "highlighter" ? ["freehand", "straight", "region"] : ["freehand", "straight"];
		const modeLabel = ink.mode === "region" ? "区域高亮" : ink.mode === "straight" ? "直线" : "自由绘制";
		add("drawing-mode", modeLabel, tool === "highlighter" ? "绘制模式。点击在「自由绘制 / 直线 / 区域高亮」之间切换。" : "绘制模式。点击在「自由绘制 / 直线」之间切换。", () => actions.ink(tool, { mode: nextValue(modes, modes.includes(ink.mode) ? ink.mode : "freehand") }));
		if (ink.mode === "straight") {
			add("line-style", label(ink.lineStyle), "线型。点击在实线、虚线、点线、波浪线之间循环。", () => actions.ink(tool, { lineStyle: nextValue(lineStyles, ink.lineStyle) }));
			if (ink.lineStyle === "wavy") wave(ink.waveSize, waveSize => actions.ink(tool, { waveSize }));
		}
	} else if (["line", "rectangle", "ellipse", "triangle"].includes(tool)) {
		add("shape-method", shape.method === "drag" ? "拖拽定大小" : "画完后按住", "形状创建方式。点击在「画完后按住 / 拖拽定大小」之间切换。", () => actions.shape({ method: shape.method === "drag" ? "hold" : "drag" }));
		if (shape.method === "drag") {
			add("shape-type", label(shape.shape), "拖拽的形状。点击在直线、矩形、椭圆、三角形之间循环。", () => actions.shape({ shape: nextValue(["line", "rectangle", "ellipse", "triangle"] as const, shape.dragShape ?? "line") }));
			if (shape.shape === "line") {
				add("line-style", label(shape.lineStyle), "线型。点击在实线、虚线、点线、波浪线之间循环。", () => actions.shape({ lineStyle: nextValue(lineStyles, shape.lineStyle) }));
			}
		}
	}
	return controls;
}
