import { requestUrl, type ButtonComponent, type Setting, type TextComponent } from "obsidian";
import type { OcrSettings } from "./model";
import { listGeminiModels, type OcrModelChoice, type OcrTransport } from "./providers";

export interface OcrSettingsHost {
	getOcrSettings(): OcrSettings;
	updateOcrSettings(settings: OcrSettings): void;
	getOcrCredential(): string;
	hasOcrCredential(): boolean;
	setOcrCredential(value: string): void;
}
type SettingRow = {name:string;desc:string;render:(setting:Setting)=>void;visible?:()=>boolean};
const modelLists = new WeakMap<OcrSettingsHost,OcrModelChoice[]>();
const modelHelp = "加载你的 Gemini API 项目当前可用的模型，然后选一个。这个请求会把你的 API 密钥发给 Google，不会发送手写内容。";

/** The same controls are used in plugin settings and the OCR service dialog. */
export function ocrSettingRows(host: OcrSettingsHost, transport:OcrTransport=requestUrl): SettingRow[] {
	let modelRow:Setting|undefined, endpoint:TextComponent|undefined, credential:TextComponent|undefined;
	let loadButton:ButtonComponent|undefined, requestGeneration=0;
	const patch = (next:Partial<OcrSettings>):void => host.updateOcrSettings({...host.getOcrSettings(),...next});
	const renderModel=(setting:Setting):void=>{
		modelRow=setting;setting.clear().setName("识别模型");loadButton=undefined;
		const settings=host.getOcrSettings();
		if(settings.provider!=="gemini") {
			setting.setDesc("填写该服务支持图像的模型名。本地服务器可以留空，使用它的默认模型。")
				.addText(t=>t.setValue(settings.model).onChange(value=>patch({model:value})));
			return;
		}
		const models=modelLists.get(host)??[],saved=settings.model.replace(/^models\//,"");
		setting.setDesc(modelHelp).addDropdown(d=>{
			d.addOption("",models.length?"选择模型":"请先加载模型");
			for(const model of models)d.addOption(model.id,`${model.label} (${model.id})`);
			if(saved&&!models.some(m=>m.id===saved))d.addOption(saved,`${saved} — ${models.length?"不可用，请另选一个":"已保存，未检查"}`);
			d.setValue(saved).onChange(value=>{
				patch({model:value});
				setting.setDesc(value && models.some(model=>model.id===value) ? "Model selected. Handwriting is sent only when you choose Recognise." : modelHelp);
			});d.selectEl.setAttribute("aria-label","Gemini 识别模型");
		}).addButton(b=>{loadButton=b;b.setButtonText(models.length?"刷新模型":"加载模型").onClick(()=>{void loadModels();});});
	};
	const loadModels=async():Promise<void>=>{
		const generation=++requestGeneration,button=loadButton,row=modelRow;
		button?.setDisabled(true).setButtonText("正在加载…");
		try {
			const models=await listGeminiModels(host.getOcrCredential(),transport);
			if(generation!==requestGeneration||host.getOcrSettings().provider!=="gemini")return;
			modelLists.set(host,models);if(row)renderModel(row);
			const selected=host.getOcrSettings().model.replace(/^models\//,"");
			row?.setDesc(selected&&!models.some(m=>m.id===selected)?"Your saved model is unavailable to this API project. Choose an available model from the refreshed list.":`已从 Gemini 项目加载 ${models.length} 个模型。请选择模型；只有在你点击「识别」时才会发送手写内容。`);
		} catch(error) {
			if(generation===requestGeneration)row?.setDesc(error instanceof Error?error.message:"Could not load Gemini models. Try again.");
		} finally {
			if(generation===requestGeneration&&button===loadButton)button?.setDisabled(false).setButtonText(modelLists.has(host)?"刷新模型":"加载模型");
		}
	};
	return [
		{name:"OCR 工具栏按钮",desc:"单独显示 OCR 选项按钮。更多批注操作里也仍然可以打开 OCR。",render:s=>{
			s.setName("OCR 工具栏按钮").setDesc("单独显示 OCR 选项按钮。更多批注操作里也仍然可以打开 OCR。")
				.addToggle(t=>t.setValue(host.getOcrSettings().showToolbarButton).onChange(value=>patch({showToolbarButton:value})));
		}},
		{name:"识别服务",desc:"选择在线 API 账号，或你自己的 OCR 程序/服务器。",render:setting=>{
			setting.setName("识别服务").setDesc("Gemini 和 OpenAI 兼容服务使用你的 API 账号。本地服务器连接到这台电脑或其他设备上的 OCR 程序。")
				.addDropdown(d=>d.addOption("gemini","Gemini").addOption("openai","OpenAI 兼容的视觉接口").addOption("local","本地 OCR 服务器").setValue(host.getOcrSettings().provider).onChange(value=>{
					const provider=value==="openai"||value==="local"?value:"gemini";requestGeneration++;
					const next:Partial<OcrSettings>={provider,model:"",endpoint:provider==="openai"?"https://api.openai.com/v1/chat/completions":provider==="local"?"http://127.0.0.1:8767/ocr":""};
					patch(next);if(modelRow)renderModel(modelRow);endpoint?.setValue(next.endpoint??"").setDisabled(provider==="gemini");
					credential?.setValue("").setPlaceholder(host.hasOcrCredential()?"密钥已保存":"API 密钥或本地服务器令牌");
				}));
		}},
		{name:"识别模型",desc:modelHelp,render:renderModel},
		{name:"识别服务地址",desc:"完整的 OCR 服务器地址，或 OpenAI 兼容的 chat/completions 地址。Gemini 使用官方地址。在 iPad 上，localhost 指 iPad 自己。",render:s=>{
			s.setName("识别服务地址").setDesc("完整的 OCR 服务器地址，或 OpenAI 兼容的 chat/completions 地址。Gemini 使用官方地址。在 iPad 上，localhost 指 iPad 自己。")
				.addText(t=>{endpoint=t;t.setValue(host.getOcrSettings().endpoint).setPlaceholder("Gemini 官方地址").setDisabled(host.getOcrSettings().provider==="gemini").onChange(value=>{
					patch({endpoint:value});credential?.setValue("").setPlaceholder(host.hasOcrCredential()?"此地址的密钥已保存":"API 密钥或本地服务器令牌");
				});});
		}},
		{name:"识别 API 密钥",desc:"保存在 Obsidian 机密存储里，与批注 JSON 分开。无需认证的本地服务器可留空。",render:s=>{
			s.setName("识别 API 密钥").setDesc("按这个地址保存在 Obsidian 机密存储里。换服务器需要该服务器的密钥。留空表示保留已保存的密钥；用「清除密钥」删除。")
				.addText(t=>{credential=t;t.inputEl.type="password";t.setPlaceholder(host.hasOcrCredential()?"密钥已保存":"API 密钥或本地服务器令牌").onChange(value=>{if(value.trim()){host.setOcrCredential(value.trim());modelLists.delete(host);requestGeneration++;if(modelRow)renderModel(modelRow);}});})
				.addButton(b=>b.setButtonText("清除密钥").onClick(()=>{host.setOcrCredential("");modelLists.delete(host);requestGeneration++;credential?.setValue("").setPlaceholder("API 密钥或本地服务器令牌");if(modelRow)renderModel(modelRow);}));
		}},
		{name:"识别语言",desc:"语言提示。接受结果前请核对科学计数和公式。",render:s=>{
			s.setName("识别语言").setDesc("语言提示。接受结果前请核对科学计数和公式。")
				.addText(t=>t.setValue(host.getOcrSettings().language).onChange(value=>patch({language:value})));
		}},
		{name:"保留手写，复制文字",desc:"识别后仍显示手写。复制时使用已接受的文字。",render:s=>{
			s.setName("保留手写，复制文字").setDesc("识别后仍显示手写。复制时使用已接受的文字。")
				.addToggle(toggle=>toggle.setValue(host.getOcrSettings().copyHandwritingAsText === true).onChange(value=>patch({copyHandwritingAsText:value})));
		}},
		{name:"设备识别",desc:"Apple Vision、Android ML Kit 和 Windows OCR 需要原生辅助程序。可通过本地 OCR 服务器连接，或选择「粘贴识别稿」使用其他应用的文字。不会自动安装辅助程序或本地模型。",render:s=>{
			s.setName("设备识别").setDesc("Apple Vision、Android ML Kit 和 Windows OCR 需要原生辅助程序。可通过本地 OCR 服务器连接，或选择「粘贴识别稿」使用其他应用的文字。不会自动安装辅助程序或本地模型。");
		}}
	];
}
