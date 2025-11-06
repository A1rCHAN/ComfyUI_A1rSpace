# ComfyUI_A1rSpace
[English / 英文](README.md)
## 前言
一个我自己使用的ComfyUI自定义节点包。  
因为之前使用的工作流太复杂了，很难加载和调试，大量的节点消耗了太多资源。我需要一个功能强大但简单易用且UI清爽的解决方案。  
这张图片是我之前使用的工作流（图片内嵌了工作流），感兴趣的小伙伴可以试试看。  
![Example Image](template/old_workflow.png)  
注意，此节点包是基于ComfyUI Desktop v0.3.6x + 版本开发的，如果你使用的是旧很多的版本，我不能保证它能正常工作。  
使用这个节点包能让臃肿的工作流变得干净易读，更好维护也更灵活，让我展示一个简单的示例（同样内嵌了工作流）：  
![Example Image](template/template_workflow.png)  
图片中有些节点看起来是空的，这是因为工作流嵌入的PNG图片没有渲染DOM小部件，不用担心，正常使用时你完全能够看得到它门。  

## 功能介绍
### K采样器：
* **联合K采样器**  
"mode"小部件可以在"文生图"、"图生图"和"潜空间放大"之间切换，UI会相应改变。  
在"文生图"模式下，像素和VAE输入是可选的，"denoise"小部件不可用（只读）。  
在"图生图"模式下，宽度、高度和批次大小是可选的。  
![Example Image](template/unity_ksampler.png)

### 节点模式控制：
* **部件收集器**  
收集节点的小部件，更改将同步到原始节点。  
* **节点收集器**  
将节点和组收集为布尔小部件，开/关将改变节点模式（激活/旁路/静音），你可以在属性中更改关闭行为（旁路/静音）。  
* **节点控制台**  
一个节点/组收集器加上"小部件收集器"，输出"TRIGGER"，当连接到"节点模式收集器"时，布尔小部件改变时会触发"节点模式收集器"。  
**注意：**要使用这些节点，你需要在节点菜单中"设置为活动面板"，然后你可以右键点击其他你想要的节点，你会看到选项，当你完成添加后，你需要右键点击"收集器"节点并"停用面板"。  
* **模式中继器 & 模式反转器**  
"模式中继"只是一个中继，"模式反转器"会反转模式。  
![Example Image](template/node_mode.png)

### 自定义工具：
* **自定义滑块**  
一个自定义滑块，你可以设置最小值、最大值、步长、精度。  
* **自定义布尔**  
一个自定义布尔到整数输出，你可以设置真/假值和名称。  
![Example Image](template/custom_tool.png)

### 图片保存助手：
* **保存/预览图片**  
添加一个按钮来启用保存。  
* **图片过滤器**  
设置"超时"和"超时时行为"来配置过滤器，当图片通过过滤器时，会有一个对话框来手动过滤图片。  
![Example Image](template/image.png)

### 转换节点：
* **潜空间编码转换 & VAE解码转换**  
"编码"节点结合了"空潜空间"和"VAE编码"节点，切换"模式"在"文生图"和"图生图"之间选择。"解码"节点结合了"VAE解码"和"VAE解码（平铺）"节点，并添加了图片预览功能。  
* **图像放大转换 & 潜空间放大转换**  
它们结合了"放大"和"按倍数放大"，你可以切换它们。  
![Example Image](template/transform.png)

### 配置面板：
* **K采样器配置面板 & K采样器数值配置面板 & ControlNet配置面板**  
它们是简单的配置面板，直接链接到它们的小部件，就是这样。  
* **LoRA配置面板**  
添加了一个"lora_stack"使链接更容易，但这个"LORASTACK"只接受我特殊的"LoRA加载器"节点。  
* **高级LoRA配置面板**  
从rgthree的"Power Lora Loader"学习而来，但只有"lora_stack"输入/输出和添加了6个小部件。  
![Example Image](template/config_pad.png)

### 加载器节点：
* **大模型加载器 & 双大模型加载器 & 分离大模型加载器**  
"检查点加载器"添加了VAE选择器，"vae_name"可以是"None"，那么"VAE"将输出ckpt嵌入的VAE。  
"双检查点加载器"提供两种加载方式，"enable_second"可以切换"ckpt_name_b"。  
"独立检查点加载器"只加载你指定的ckpt。  
![Example Image](template/ckpt_loader.png)

* **六LoRA加载器 & 双通道六LoRA加载器 & 分离六LoRA加载器**  
它们的工作方式与我的检查点加载器相同。  
![Example Image](template/six_lora.png)

* **堆栈LoRA加载器 & 双通道堆栈LoRA加载器 & 分离堆栈LoRA加载器**  
移除了小部件，只在"lora_stack"上工作。  
![Example Image](template/stack_lora.png)

* **ControlNet加载器**  
只是结合了"ControlNet加载器"和"ControlNet应用"。  
![Example Image](template/cn_loader.png)

### 种子：
* **种子控制**  
"手动随机"可以排队一个随机种子，有2.5秒冷却时间。  
"拉取上次种子"可以从历史记录中拉取并排队上一次的种子。  
![Example Image](template/seed.png)

### 文本节点：
* **文本显示**  
提供一个框架来显示输入的文本。有一个复制按钮。  
* **文本框**  
只是一个文本输入框。  
![Example Image](template/text_box_show.png)  

* **文本合并**  
使用指定的分隔符合并文本。  
它可以在合并之前自动删除每个框末尾的多余标点符号。  
* **文本合并CLIP编码**  
基于文本合并，但带有CLIP编码。  
* **文本翻译**  
使用百度或Deepseek API翻译文本。  
有一个按钮来启用/禁用翻译。  
只支持英文<->中文。  
允许空输入。  
这是它们的API网站：  
[百度翻译](https://api.fanyi.baidu.com/manage/developer)  
[Deepseek](https://platform.deepseek.com/api_keys)  
Deepseek更专业但需要付费。  
* **文本翻译合并CLIP编码**  
结合合并、CLIP编码和翻译。  
* **JoyTag文本框**  
一个带有JoyTag的文本框。  
通过禁用'apply_tag'按钮可以直接输出文本。  
需要JoyTag模型。  
需要文件"model.safetensors"、"config.json"、"top_tags.txt"。  
将它们放入`ComfyUI\models\joytag`。  
如果找不到，节点会自动下载它们（当然前提是你的网络允许）。  
你也可以从[Hugging Face](https://huggingface.co/fancyfeast/joytag/tree/main)手动下载它们。（不需要下载model.onnx文件也可以）  
![Example Image](template/text.png)

### 选择器：
* **大模型选择器**  
从检查点列表中选择一个检查点。  
* **放大方法选择器**  
从方法列表中选择一个放大方法。  
* **尺寸选择器**  
从尺寸列表中选择一个尺寸。  
* **采样器选择器**  
从采样器列表中选择一个采样器。  
![Example Image](template/picker.png)

### 切换器：
* **大模型输入切换**  
* **模型输入切换**  
* **CLIP输入切换**  
* **VAE输入切换**  
* **条件输入切换**  
* **文本输入切换**  
* **图像输入切换**  
* **整数输入切换**  
* **浮点输入切换**  
* **图像输出切换**  
* **图像和遮罩输出切换**  
只是切换，就这样而已。  
![Example Image](template/switch.png)

### 工具：
* **整数转布尔**  
* **布尔**  
* **布尔 或**  
* **布尔 与**  
* **整数计算**  
* **逻辑门计算**
"Boolean A&B"和"Boolean A|B"是特殊的，"A&B"意味着"A或B"，"A|B"意味着"A与B"。  
![Example Image](template/utils.png)

### 折叠输出：
这不是一个节点，而是一个功能。  
你可以折叠节点的输出，只需右键点击节点并选择"折叠输出"。  
当你有很多输出时，它可以让你的节点更清爽。  
为了避免不可预测的问题，它只在我的节点上工作。  
**注意：**该功能会在“折叠”和“展开”时，强制刷新节点尺寸，可能对有些用户来说不太友好（比如我自己，未来会针对这个功能展开修复工作），但不影响功能。  

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

## 计划：
1. 改进前端交互。
2. 添加和修改更多节点以提供完整功能。
3. 查找并修复错误。
4. 语言支持。

## 感谢这些节点作者，我学习了他们的代码，也是我的旧工作流使用的节点：  
[ControlNet Aux，强力的CN辅助节点](https://github.com/Fannovel16/comfyui_controlnet_aux)  
[Impact Pack，没人离得开他，修脸修手局部重绘！](https://github.com/ltdrdata/ComfyUI-Impact-Pack)  
[Custom Scripts，输入提示词的好帮手](https://github.com/pythongosssss/ComfyUI-Custom-Scripts)  
[Layer Style，丰富而强大的图像处理节点包](https://github.com/chflame163/ComfyUI_LayerStyle)  
[Easy Use，正如它的名称，很多好用的工具](https://github.com/yolain/ComfyUI-Easy-Use)  
[CR，我喜欢他的文本处理节点和输入切换](https://github.com/Suzie1/ComfyUI_Comfyroll_CustomNodes)  
[WD14 Tagger，自动提词谁不爱呢](https://github.com/pythongosssss/ComfyUI-WD14-Tagger)  
[mxToolkit，我爱死他的节点了，少而精悍](https://github.com/Smirnov75/ComfyUI-mxToolkit)  
[Impact Subpack，主要是使用box检测（doge）](https://github.com/ltdrdata/ComfyUI-Impact-Subpack)  
[NYJY，翻译，提词，好使，我用了很多他的代码](https://github.com/aidenli/ComfyUI_NYJY)  
[Image Filter，是的过滤图像，我喜欢](https://github.com/chrisgoringe/cg-image-filter)  
他们都很棒，令人难以置信的，杰出的自定义节点作者。  
我通过ComfyUI的官方开发文档，结合这些作者的代码和自己过往的编码经验，借助AI工具，完成了这个项目。  
感谢所有人。