import type { App } from "obsidian";

type ScaleMode = "page-width" | "page-fit" | "page-actual";
const MODES: Array<[ScaleMode, string]> = [["page-width", "宽度适合"], ["page-fit", "适合页面"], ["page-actual", "实际大小"]];

interface PdfViewerLike { currentScaleValue?: unknown; currentScale?: unknown; pdfViewer?: PdfViewerLike }

function activePdfLeaf(app: App) {
	const leaf = app.workspace.activeLeaf;
	return leaf && leaf.view.getViewType() === "pdf" ? leaf : null;
}

function pdfViewer(app: App): PdfViewerLike | null {
	const view = activePdfLeaf(app)?.view as unknown as { viewer?: { child?: { pdfViewer?: PdfViewerLike } } } | undefined;
	const child = view?.viewer?.child?.pdfViewer;
	if (!child) return null;
	if (child.pdfViewer && (child.pdfViewer.currentScaleValue != null || typeof child.pdfViewer.currentScale === "number")) return child.pdfViewer;
	return child;
}

/** Floating 宽度适合 / 适合页面 / 实际大小 buttons in the bottom-right corner of the active PDF view. Returns a disposer. */
export function installZoomDock(app: App, registerInterval: (id: number) => number): () => void {
	const doc = activeDocument;
	const dock = doc.body.createDiv({ cls: "freedraw-pdf-zoom-dock" });
	dock.setAttribute("aria-label", "PDF 显示大小");
	const buttons = new Map<ScaleMode, HTMLButtonElement>();
	for (const [mode, label] of MODES) {
		const button = dock.createEl("button", { text: label, attr: { type: "button" } });
		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			const viewer = pdfViewer(app);
			if (viewer) viewer.currentScaleValue = mode;
			place();
		});
		buttons.set(mode, button);
	}
	function place(): void {
		const view = activePdfLeaf(app)?.view as unknown as { contentEl?: HTMLElement } | undefined;
		const content = view?.contentEl;
		if (!content || !content.isShown()) { dock.hide(); return; }
		dock.show();
		const rect = content.getBoundingClientRect();
		dock.style.left = `${Math.max(8, rect.right - dock.offsetWidth - 16)}px`;
		dock.style.top = `${Math.max(8, rect.bottom - dock.offsetHeight - 16)}px`;
		const current = pdfViewer(app)?.currentScaleValue;
		for (const [mode, button] of buttons) button.toggleClass("is-active", mode === current);
	}
	registerInterval(window.setInterval(place, 800));
	window.addEventListener("resize", place);
	place();
	return () => { window.removeEventListener("resize", place); dock.remove(); };
}
