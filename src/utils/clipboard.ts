export async function writeClipboardText(text: string): Promise<void> {
	const electronClipboard = (window as unknown as { require?: (moduleName: string) => { clipboard?: { writeText?: (value: string) => void } } }).require?.("electron")?.clipboard;
	if (electronClipboard?.writeText) {
		electronClipboard.writeText(text);
		return;
	}
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}
	throw new Error("当前 Obsidian 环境无法写入剪贴板。");
}

export async function readClipboardText(): Promise<string> {
	const electronClipboard = (window as unknown as { require?: (moduleName: string) => { clipboard?: { readText?: () => string } } }).require?.("electron")?.clipboard;
	if (electronClipboard?.readText) {
		return electronClipboard.readText();
	}
	if (navigator.clipboard?.readText) {
		return navigator.clipboard.readText();
	}
	throw new Error("当前 Obsidian 环境无法读取剪贴板。");
}
