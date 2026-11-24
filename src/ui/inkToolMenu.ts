import type { InkToolOptions } from "../types";
import { menuSeparator, type MenuDescriptor } from "./menuDescriptors";

/** Native checked lists, matching the Selection and Eraser menus. */
export function inkToolMenuItems(options: InkToolOptions, onChange: (patch: Partial<InkToolOptions>) => void, onWaveSizes: () => void, kind: "pen" | "highlighter" = "pen"): MenuDescriptor[] {
	const items: MenuDescriptor[] = [
		{ title: "自由绘制", checked: options.mode === "freehand", run: () => onChange({ mode: "freehand" }) },
		{ title: "直线", checked: options.mode === "straight", run: () => onChange({ mode: "straight" }) }
	];
	if (kind === "highlighter") items.push({ title: "区域高亮（拖出矩形）", checked: options.mode === "region", run: () => onChange({ mode: "region" }) });
	if (options.mode === "straight") {
		items.push(menuSeparator);
		for (const [style, title] of [["solid", "实线"], ["dashed", "虚线"], ["dotted", "点线"], ["wavy", "波浪线"]] as const) {
			items.push({ title, checked: options.lineStyle === style, run: () => onChange({ lineStyle: style }) });
		}
		if (options.lineStyle === "wavy") items.push(menuSeparator, { title: `波浪大小：${options.waveSize}`, run: onWaveSizes });
	}
	return items;
}

export function inkWaveSizeMenuItems(size: number, onChange: (size: number) => void): MenuDescriptor[] {
	return Array.from({ length: 24 }, (_, index) => {
		const value = (index + 1) / 4;
		return { title: String(value), checked: size === value, run: () => onChange(value) };
	});
}
