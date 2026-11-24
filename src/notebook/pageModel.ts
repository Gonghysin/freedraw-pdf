import type { TFile } from "obsidian";
import { generateId } from "../utils/general";
import type { AnnotationDocument, NotebookPage, NotebookPageSize, NotebookTemplate } from "../types";

export const NOTEBOOK_TEMPLATES: readonly NotebookTemplate[] = ["blank", "ruled", "grid", "dot"];
export const NOTEBOOK_PAGE_SIZES: readonly NotebookPageSize[] = ["a4", "letter", "compact", "long"];

export function hasEditableNativePageTemplates(document: AnnotationDocument, realPdfPageCount: number): boolean {
	if (document.nativePageTemplatesEditable === true) {
		return true;
	}
	if (document.nativePageTemplatesEditable === false || realPdfPageCount < 1) {
		return false;
	}
	const templatePages = new Set((document.pdfPageTemplates ?? []).map((template) => template.page));
	if (templatePages.size !== realPdfPageCount) {
		return false;
	}
	for (let pageNumber = 1; pageNumber <= realPdfPageCount; pageNumber += 1) {
		if (!templatePages.has(pageNumber)) {
			return false;
		}
	}
	return true;
}

export function createTemplateNotebookPage(
	title: string,
	template: NotebookTemplate,
	pageSize: NotebookPageSize,
	paperColor: string,
	customSize?: { width: number; height: number }
): NotebookPage {
	return {
		id: generateId("page"),
		title,
		kind: "template",
		sourceLabel: "模板页",
		template,
		paperColor,
		pageSize,
		...(customSize ? { customSize } : {}),
		strokes: [],
		textItems: [],
		shapes: []
	};
}

export function createPdfBackedNotebookPage(
	title: string,
	sourceFile: TFile,
	sourcePage: number,
	pageSize: NotebookPageSize,
	paperColor: string
): NotebookPage {
	return {
		id: generateId("page"),
		title,
		kind: "pdf",
		sourceLabel: `${sourceFile.name} 第 ${sourcePage} 页`,
		pdfSource: {
			filePath: sourceFile.path,
			page: sourcePage
		},
		template: "blank",
		paperColor,
		pageSize,
		strokes: [],
		textItems: [],
		shapes: []
	};
}

export function getNotebookPageKindLabel(page: NotebookPage): string {
	if (page.kind === "pdf" && page.pdfSource) {
		return `PDF 第 ${page.pdfSource.page} 页`;
	}
	return "模板页";
}

export function getNotebookPageSourceSummary(page: NotebookPage): string {
	if (page.kind === "pdf" && page.pdfSource) {
		const fileName = page.pdfSource.filePath.split("/").pop()?.split("\\").pop() ?? page.pdfSource.filePath;
		return `${fileName} p.${page.pdfSource.page}`;
	}
	return getNotebookTemplateLabel(page.template);
}

export function getNotebookTemplateLabel(template: NotebookTemplate): string {
	switch (template) {
		case "blank":
			return "空白";
		case "grid":
			return "网格";
		case "dot":
			return "点阵";
		case "ruled":
		default:
			return "横线";
	}
}

export function getNotebookPageSizeLabel(pageSize: NotebookPageSize): string {
	switch (pageSize) {
		case "compact":
			return "紧凑";
		case "letter":
			return "Letter 竖向";
		case "long":
			return "长笔记";
		case "a4":
		default:
			return "A4 竖向";
	}
}

export function getNotebookPageSizeDimensions(pageSize: NotebookPageSize, custom?: { width: number; height: number }): { width: number; height: number } {
	if (custom && custom.width > 0 && custom.height > 0) return custom;
	switch (pageSize) {
		case "compact":
			return { width: 700, height: 980 };
		case "letter":
			return { width: 920, height: 1189 };
		case "long":
			return { width: 920, height: 1500 };
		case "a4":
		default:
			return { width: 920, height: 1301 };
	}
}

export function getNotebookPageRenderDimensions(pageSize: NotebookPageSize, a4ReferenceWidth: number, custom?: { width: number; height: number }): { width: number; height: number } {
	const dimensions = getNotebookPageSizeDimensions(pageSize, custom);
	const a4Dimensions = getNotebookPageSizeDimensions("a4");
	const width = Math.max(1, Math.round(a4ReferenceWidth * dimensions.width / Math.max(a4Dimensions.width, 1)));
	const height = Math.max(1, Math.round(width * dimensions.height / Math.max(dimensions.width, 1)));
	return { width, height };
}
