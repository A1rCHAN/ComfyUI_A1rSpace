import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

app.registerExtension({
	name: "A1r.APIConfig",
	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		if (
			nodeData.name === "A1r Text Translate" ||
			nodeData.name === "A1r Text Translate Merge with Clip Encode" ||
			nodeData.name === "A1r Text Double Translate Merge with Clip Encode"
		) {
			const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
			nodeType.prototype.getExtraMenuOptions = function (_, options) {
				getExtraMenuOptions?.apply(this, arguments);
				options.push({
					content: "Open API Config",
					callback: async () => {
						const dialog = new app.ui.dialog.constructor();
						
						// Fetch current config
						let currentConfig = {};
						try {
							const response = await api.fetchApi("/a1rspace/api_config");
							if (response.ok) {
								currentConfig = await response.json();
							}
						} catch (e) {
							console.error("Failed to fetch config", e);
						}

						const content = document.createElement("div");
						content.style.display = "flex";
						content.style.flexDirection = "column";
						content.style.gap = "10px";
						content.style.minWidth = "400px";

						const title = document.createElement("h3");
						title.textContent = "API Configuration";
						title.style.margin = "0 0 10px 0";
						content.appendChild(title);

						// Baidu Config
						const baiduGroup = document.createElement("fieldset");
						baiduGroup.style.border = "1px solid #444";
						baiduGroup.style.padding = "10px";
						baiduGroup.style.borderRadius = "4px";
						const baiduLegend = document.createElement("legend");
						baiduLegend.textContent = "Baidu Translate";
						baiduGroup.appendChild(baiduLegend);

						const createInput = (label, value, type = "text") => {
							const wrapper = document.createElement("div");
							wrapper.style.display = "flex";
							wrapper.style.justifyContent = "space-between";
							wrapper.style.alignItems = "center";
							wrapper.style.marginBottom = "5px";
							
							const lbl = document.createElement("label");
							lbl.textContent = label;
							lbl.style.marginRight = "10px";
							
							const inp = document.createElement("input");
							inp.type = type;
							inp.value = value || "";
							inp.style.flex = "1";
							inp.style.background = "var(--comfy-input-bg)";
							inp.style.color = "var(--comfy-input-text)";
							inp.style.border = "1px solid var(--border-color)";
							inp.style.padding = "4px";
							
							wrapper.appendChild(lbl);
							wrapper.appendChild(inp);
							return { wrapper, inp };
						};

						const baiduAppId = createInput("App ID:", currentConfig.Baidu?.AppId);
						const baiduSecret = createInput("Secret:", currentConfig.Baidu?.Secret, "password");
						
						baiduGroup.appendChild(baiduAppId.wrapper);
						baiduGroup.appendChild(baiduSecret.wrapper);
						content.appendChild(baiduGroup);

						// DeepSeek Config
						const deepSeekGroup = document.createElement("fieldset");
						deepSeekGroup.style.border = "1px solid #444";
						deepSeekGroup.style.padding = "10px";
						deepSeekGroup.style.borderRadius = "4px";
						const deepSeekLegend = document.createElement("legend");
						deepSeekLegend.textContent = "DeepSeek";
						deepSeekGroup.appendChild(deepSeekLegend);

						const deepSeekKey = createInput("API Key:", currentConfig.DeepSeek?.api_key || currentConfig.DeepSeek?.Key, "password");
						
						deepSeekGroup.appendChild(deepSeekKey.wrapper);
						content.appendChild(deepSeekGroup);

						// Buttons
						const btnGroup = document.createElement("div");
						btnGroup.style.display = "flex";
						btnGroup.style.justifyContent = "flex-end";
						btnGroup.style.gap = "10px";
						btnGroup.style.marginTop = "10px";

						const cancelBtn = document.createElement("button");
						cancelBtn.textContent = "Cancel";
						cancelBtn.onclick = () => dialog.close();
						
						const saveBtn = document.createElement("button");
						saveBtn.textContent = "Save";
						saveBtn.onclick = async () => {
							const newConfig = {
								Baidu: {
									AppId: baiduAppId.inp.value.trim(),
									Secret: baiduSecret.inp.value.trim()
								},
								DeepSeek: {
									api_key: deepSeekKey.inp.value.trim()
								}
							};
							
							try {
								const response = await api.fetchApi("/a1rspace/api_config", {
									method: "POST",
									body: JSON.stringify(newConfig)
								});
								
								if (response.ok) {
									dialog.close();
									app.ui.dialog.show("Success: Configuration saved.");
								} else {
									const err = await response.json();
									alert("Error saving config: " + (err.error || "Unknown error"));
								}
							} catch (e) {
								alert("Error saving config: " + e.message);
							}
						};

						btnGroup.appendChild(cancelBtn);
						btnGroup.appendChild(saveBtn);
						content.appendChild(btnGroup);

						dialog.show(content);
					},
				});
			};
		}
	},
});
