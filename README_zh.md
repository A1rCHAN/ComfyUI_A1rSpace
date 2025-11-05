# ComfyUI_A1rSpace
一个我自己使用的ComfyUI自定义节点包。因为之前使用的工作流太复杂了，很难加载和调试，大量的节点消耗了太多资源。我需要一个功能强大但简单易用且UI清爽的解决方案。
![Example Image](template/old_workflow.png)  
这张图片内嵌了工作流，你可以试试看。  
注意，此节点包是基于ComfyUI Desktop v0.3.6x + 版本开发的。  
如果你使用的是旧版本，我不能保证它能正常工作。  
让我展示一个简单的模板：  
![Example Image](template/template_workflow.png)  
有些节点看起来是空的，这是因为工作流嵌入的PNG图片无法显示DOM小部件，不用担心。  

## 功能介绍
### KSampler采样器：
* 联合K采样器  
"mode"小部件可以在"文生图"、"图生图"和"潜空间放大"之间切换，UI会相应改变。  
在"文生图"模式下，像素和VAE输入是可选的，"denoise"小部件不可用（只读）。  
在"图生图"模式下，宽度、高度和批次大小是可选的。  
![Example Image](template/unity_ksampler.png)

### 节点模式控制：
* Widget Collector 小部件收集器  
收集节点的小部件，更改将同步到原始节点。  
* Node Mode Collector 节点模式收集器  
将节点和组收集为布尔小部件，开/关将改变节点模式（激活/旁路/静音），你可以在属性中更改关闭行为（旁路/静音）。  
* Node Mode Console 节点模式控制台  
一个节点/组收集器加上"小部件收集器"，输出"TRIGGER"，当连接到"节点模式收集器"时，布尔小部件改变时会触发"节点模式收集器"。  
**注意:**
要使用这些节点，你需要在节点菜单中"设置为活动面板"，然后你可以右键点击其他你想要的节点，你会看到选项，当你完成添加后，你需要右键点击"收集器"节点并"停用面板"。  
* Mode Relay 模式中继 & Mode Inverter 模式反转器  
"模式中继"只是一个中继，"模式反转器"会反转模式。  
![Example Image](template/node_mode.png)

### 自定义工具：
* Custom Slider 自定义滑块  
一个自定义滑块，你可以设置最小值、最大值、步长、精度。  
* Custom Boolean 自定义布尔  
一个自定义布尔到整数输出，你可以设置真/假值和名称。  
![Example Image](template/custom_tool.png)

### 图片保存助手：
* Save/Preview Image 保存/预览图片  
添加一个按钮来启用保存。  
* Image Filter 图片过滤器  
设置"超时"和"超时时行为"来配置过滤器，当图片通过过滤器时，会有一个对话框来手动过滤图片。  
![Example Image](template/image.png)

### 转换节点：
* Latent Encode Transform 潜空间编码转换 & Latent Decode Transform 潜空间解码转换  
"编码"节点结合了"空潜空间"和"VAE编码"节点，切换"模式"在"文生图"和"图生图"之间选择。"解码"节点结合了"VAE解码"和"VAE解码（平铺）"节点，并添加了图片预览功能。  
* Image Upscale Transform 图片放大转换 & Latent Upscale Transform 潜空间放大转换  
它们结合了"放大"和"按倍数放大"，你可以切换它们。  
![Example Image](template/transform.png)

### 配置面板：
* KSampler Config Pad 采样器配置面板 & KSampler Config Pad (Lite) 采样器配置面板(精简版) & ControlNet Config Pad ControlNet配置面板  
它们是简单的配置面板，直接链接到它们的小部件，就是这样。  
* LoRA Config Pad LoRA配置面板  
添加了一个"lora_stack"使链接更容易，但这个"LORASTACK"只接受我特殊的"LoRA加载器"节点。  
* LoRA Config Pad AD LoRA配置面板AD  
从rgthree的"Power Lora Loader"学习而来，但只有"lora_stack"输入/输出和添加了6个小部件。  
![Example Image](template/config_pad.png)

### 加载器节点：
* Checkpoint Loader 检查点加载器 & Double Checkpoint Loader 双检查点加载器 & Separate Checkpoint Loader 独立检查点加载器  
"检查点加载器"添加了VAE选择器，"vae_name"可以是"None"，那么"VAE"将输出ckpt嵌入的VAE。  
"双检查点加载器"提供两种加载方式，"enable_second"可以切换"ckpt_name_b"。  
"独立检查点加载器"只加载你指定的ckpt。  
![Example Image](template/ckpt_loader.png)

* Six LoRA Loader 六LoRA加载器 & Six LoRA Loader (2P) 六LoRA加载器(2P) & Six LoRA Loader (Separate) 六LoRA加载器(独立)  
它们的工作方式与我的检查点加载器相同。  
![Example Image](template/six_lora.png)

* Stack LoRA Loader 堆栈LoRA加载器 & Stack LoRA Loader (2P) 堆栈LoRA加载器(2P) & Stack LoRA Loader (Separate) 堆栈LoRA加载器(独立)  
移除了小部件，只在"lora_stack"上工作。  
![Example Image](template/stack_lora.png)

* ControlNet Loader ControlNet加载器  
只是结合了"ControlNet加载器"和"ControlNet应用"。  
![Example Image](template/cn_loader.png)

### 种子：
* Seed Control 种子控制  
"手动随机"可以排队一个随机种子，有2.5秒冷却时间。  
"拉取上次种子"可以从历史记录中拉取并排队上一次的种子。  
![Example Image](template/seed.png)

### 文本节点：
* Text Show 文本显示  
提供一个框架来显示输入的文本。有一个复制按钮。  
* Text Box 文本框  
只是一个文本输入框。  
![Example Image](template/text_box_show.png)  

* Text Merge 文本合并  
使用指定的分隔符合并文本。  
它可以在合并之前自动删除每个框末尾的多余标点符号。  
* TextMerge withClipEncode 文本合并与CLIP编码  
基于文本合并，但带有CLIP编码。  
* Text Translate 文本翻译  
使用百度或Deepseek API翻译文本。  
有一个按钮来启用/禁用翻译。  
只支持英文<->中文。  
允许空输入。  
这是它们的API网站：  
百度：[https://api.fanyi.baidu.com/manage/developer]  
Deepseek：[https://platform.deepseek.com/api_keys]  
Deepseek更专业但需要付费。  
* Translate ClipEncode Merge 翻译CLIP编码合并  
结合合并、CLIP编码和翻译。  
* JoyTag Text Box JoyTag文本框  
一个带有JoyTag的文本框。  
通过禁用'apply_tag'按钮可以直接输出文本。  
需要JoyTag模型。  
需要文件"model.safetensors"、"config.json"、"top_tags.txt"。  
将它们放入`ComfyUI\models\joytag`。  
如果找不到，节点会自动下载它们。  
你也可以从[https://huggingface.co/fancyfeast/joytag/tree/main]手动下载它们。（不需要下载model.onnx文件）  
![Example Image](template/text.png)

### 选择器：
* Checkpoint Picker 检查点选择器  
从检查点列表中选择一个检查点。  
* Upscale Method Picker 放大方法选择器  
从方法列表中选择一个放大方法。  
* Size Picker 尺寸选择器  
从尺寸列表中选择一个尺寸。  
* Sampler Picker 采样器选择器  
从采样器列表中选择一个采样器。  
![Example Image](template/picker.png)

### 切换器：
* Checkpoint Input Switch 检查点输入切换  
* Model Input Switch 模型输入切换  
* CLIP Input Switch CLIP输入切换  
* VAE Input Switch VAE输入切换  
* Conditioning Input Switch 条件输入切换  
* Text Input Switch 文本输入切换  
* Image Input Switch 图片输入切换  
* Int Input Switch 整数输入切换  
* Float Input Switch 浮点数输入切换  
* Image Output Switch 图片输出切换  
* Image & Mask Output Switch 图片和遮罩输出切换  
它们只是切换，就这样。  
![Example Image](template/switch.png)

### 工具：
* Int to Boolean 整数转布尔  
* Simple Boolean 简单布尔  
* Boolean A&B 布尔A&B  
* Boolean A|B 布尔A|B  
* Math Int 数学整数  
* Math LogicGate 数学逻辑门  
"Boolean A&B"和"Boolean A|B"是特殊的，"A&B"意味着"A或B"，"A|B"意味着"A与B"。  
![Example Image](template/utils.png)

### 折叠输出：
这不是一个节点，而是一个功能。  
你可以折叠节点的输出，只需右键点击节点并选择"折叠输出"。  
当你有很多输出时，它可以让你的节点更清爽。  
为了避免不可预测的问题，它只在我的节点上工作。  

## 安装和更新
### 安装：
* 将仓库克隆到custom_nodes目录并安装依赖：
  ```
  git clone https://github.com/A1rCHAN/ComfyUI_A1rSpace.git
  ```
* 在你的Python环境中安装依赖。
  * 对于Windows便携版，在`ComfyUI\custom_nodes\ComfyUI_A1rSpace`内运行以下命令：
    ```
    ..\..\..\python_embeded\python.exe -m pip install -r requirements.txt
    ```
  * 如果你的ComfyUI虚拟环境在`ComfyUI\.venv\Scripts\python.exe`：
    ```
    ..\..\.venv\Scripts\python.exe -m pip install -r requirements.txt
    ```
  * 对于使用venv或conda，首先激活你的Python环境，然后运行：
    ```
    pip install -r requirements.txt
    ```

### 更新：
* 在`ComfyUI\custom_nodes\ComfyUI_A1rSpace`内：
  ```
  git pull
  ```
### 更新历史
- 版本 1.1.0：  
  一个重要的更新。重建了所有节点，提供更强大的功能。开发版本(1.0.x)不稳定，我会很快删除它。  
  如果你发现任何错误，请报告问题。  

## 计划TODO：
1. 改进前端交互。
2. 添加和修改更多节点以提供完整功能。
3. 查找并修复错误。
4. 语言支持。

## 我的旧工作流使用的自定义节点：  
[https://github.com/Fannovel16/comfyui_controlnet_aux]  
[https://github.com/ltdrdata/ComfyUI-Impact-Pack]  
[https://github.com/pythongosssss/ComfyUI-Custom-Scripts]  
[https://github.com/chflame163/ComfyUI_LayerStyle]  
[https://github.com/yolain/ComfyUI-Easy-Use]  
[https://github.com/Suzie1/ComfyUI_Comfyroll_CustomNodes]  
[https://github.com/pythongosssss/ComfyUI-WD14-Tagger]  
[https://github.com/Smirnov75/ComfyUI-mxToolkit]  
[https://github.com/ltdrdata/ComfyUI-Impact-Subpack]  
[https://github.com/aidenli/ComfyUI_NYJY]  
[https://github.com/chrisgoringe/cg-image-filter]  
他们都很棒，令人难以置信的自定义节点作者。  
实际上，我不太擅长编码，但从他们那里学到了很多，我用AI工具完成了这个项目。  
感谢所有人。
