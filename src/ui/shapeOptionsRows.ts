import { type DropdownComponent, type Setting } from "obsidian";
import { normalizeShapeToolOptions } from "../shapes/shapeOptions";
import type { ShapeOptions } from "../types";

export interface ShapeOptionRow { name: string; render: (setting: Setting) => void; }
export function shapeOptionRows(getOptions: () => ShapeOptions | undefined, onChange: (options: ShapeOptions) => void): ShapeOptionRow[] {
 let methodControl: DropdownComponent | undefined, shapeControl: DropdownComponent | undefined, lineControl: DropdownComponent | undefined;
 const read = () => normalizeShapeToolOptions(getOptions());
 const refresh = () => {
  const options = read();
  methodControl?.setValue(options.method);
  shapeControl?.setValue(options.dragShape ?? "line").setDisabled(options.method !== "drag");
  lineControl?.setValue(options.lineStyle).setDisabled(options.method !== "drag" || options.shape !== "line");
 };
 const update = (patch: Partial<ShapeOptions>) => { onChange(normalizeShapeToolOptions({ ...read(), ...patch })); refresh(); };
 return [
  { name: "形状创建方式", render: setting => {
   setting.setName("形状创建方式").addDropdown(dropdown => {
    methodControl = dropdown;
    dropdown.addOptions({ hold: "画完后按住", drag: "拖拽定大小" }).onChange(value => update({ method: value === "drag" ? "drag" : "hold" }));
   }); refresh();
  }},
  { name: "拖拽形状", render: setting => {
   setting.setName("拖拽形状").addDropdown(dropdown => {
    shapeControl = dropdown;
    dropdown.addOptions({ line: "直线", rectangle: "矩形", ellipse: "椭圆", triangle: "三角形" }).onChange(value => update({ shape: value as ShapeOptions["shape"] }));
   }); refresh();
  }},
  { name: "形状线型", render: setting => {
   setting.setName("形状线型").addDropdown(dropdown => {
    lineControl = dropdown;
    dropdown.addOptions({ solid: "实线", dashed: "虚线", dotted: "点线", wavy: "波浪线" }).onChange(value => update({ lineStyle: value as ShapeOptions["lineStyle"] }));
   }); refresh();
  }}
 ];
}

