# ComfyUI_A1rSpace
A comfyui custom node package used by myself. Cause the workflow is too complicated when I used before, it's hard to load and debug, lots of nodes spend too much source. I need a powerful but simple and easy to use and a clean UI.  
![Example Image](template/old_workflow.png)  
This image have embedded workflow, you can try it anyway.  
Notice, this node package is development base on ComfyUI Desketop v0.3.6x +.  
If you are using older version, I can't guarantee it will work.  
Let me show a simple template:  
![Example Image](template/template_workflow.png)  
There have some nodes looks like empty, it cause of the workflow embedded png can't show DOM widgets, don't worry about it.  

## Introduce
### KSampler:
* Unity KSampler  
The "mode" widget can choose between "text to image", "image to image" and "latent upscale", UI will change accordingly.  
In "text to image" mode, pixel and vae input are optional, and the "denoise" widget is not available (Read-only).  
In "image to image" mode, width, height and batch_size are optional.  
![Example Image](template/unity_ksampler.png)

### Nodes Mode Control:
* Widget Collector  
Collect the widgets of the node, changes will be synced to the origin node.  
* Node Mode Collector  
Collect the node and group as a bool widget, on/off will change the node mode (active/bypass/mute), you can change the off behavior (bypass/mute) in properties.  
* Node Mode Console  
One node/group collector plus "Widget Collector", output "TRIGGER", when linked to a "Node Mode Collector", the "Node Mode Collector" will be triggered when the bool widget is change.  
**Note:**
To use these nodes, you need "Set as Active Panel" in the node menu, then you can right click other nodes you want, and you will see the options, when you finish adding, you need right click the "collector" node and "Deactivate Panel".  
* Mode Relay & Mode Inverter 
"Mode Relay" Just a relay, "Mode Inverter" will invert the mode.  
![Example Image](template/node_mode.png)

### Custom tools:
* Custom Silder  
A custom slider, you can set the min, max, step, precision.  
* Custom Boolean  
A custom boolean to integer output, you can set the true/false value and name.  
![Example Image](template/custom_tool.png)

### Image Save Helper:
* Save/Preview Image  
Add a button to enable saving.  
* Image Filter  
Set a "timeout" and "on_timeout" to configure the filter, when image pass the filter, will have a dialog to filter the image by hand.  
![Example Image](template/image.png)

### Transform Nodes:
* Latent Encode Transform & Latent Decode Transform  
"Encode" node combined "Empty Latent" and "VAE Encode" node, switch "mode" to choose between "text to image" and "image to image". The "Decode" node combined "VAE Decode" and "VAE Decode (Tiled)" node, and add a image preview function.  
* Image Upscale Transform & Latent Upscale Transform  
They combined the "Upscale" and "UpscaleBy", you can switch them.  
![Example Image](template/transform.png)

### Config Pads:
* KSampler Config Pad & KSampler Config Pad (Lite) & ControlNet Config Pad  
They are simple config pad, link to their widgets directly, just its.  
* LoRA Config Pad  
Add a "lora_stack" that made linking easier, but this "LORASTACK" just accept my special "LoRA Loader" nodes.  
* LoRA Config Pad AD  
Learn from rgthree's "Power Lora Loader", but just "lora_stack" in/output and 6 widgets added.  
![Example Image](template/config_pad.png)

### Loader Nodes:
* Checkpoint Loader & Double Checkpoint Loader & Separate Checkpoint Loader  
"Checkpoint Loader" added a VAE chooser, "vae_name" can be "None", that "VAE" will output the embedded VAE by ckpt.  
"Double Checkpoint Loader" provide two ways of loading, and "enable_second" can switch "ckpt_name_b".  
"Separate Checkpoint Loader" just load the ckpt that you specified.  
![Example Image](template/ckpt_loader.png)

* Six LoRA Loader & Six LoRA Loader (2P) & Six LoRA Loader (Separate)  
They work same as my Checkpoint Loaders.  
![Example Image](template/six_lora.png)

* Stack LoRA Loader & Stack LoRA Loader (2P) & Stack LoRA Loader (Separate)  
Removed the widgets, just work on "lora_stack".  
![Example Image](template/stack_lora.png)

* ControlNet Loader  
Just combined "ControlNet Loader" and "ControlNet Apply".  
![Example Image](template/cn_loader.png)

### Seed:
* Seed Control  
"Manual random" can queue a random seed, have 2.5s cd.  
"Pull last seed" can pull and queue the last one seed from the history.  
![Example Image](template/seed.png)

### Text nodes:
* Text Show  
Provide a frame to display inputs texts. Have a copy button.  
* Text Box  
Just a text enter box.  
![Example Image](template/text_box_show.png)  

* Text Merge  
Merge the text using the specified separator.  
It can automatically remove extra punctuation at the end of each box before merging them.  
* TextMerge withClipEncode  
base on TextMerge, but with clip encode.  
* Text Translate  
Translate the text using Baidu or Deepseek API.  
Have a button to enable/disable the translation.  
Just EN<->ZH.  
Allow empty input.  
There is their api website:  
Baidu: [https://api.fanyi.baidu.com/manage/developer]  
Deepseek: [https://platform.deepseek.com/api_keys]  
Deepseek will more professional but paid.  
* Translate ClipEncode Merge  
Combine Merge, CLIP Encode and Translate.  
* JoyTag Text Box  
A text box with JoyTag.  
It will output the text directly by disable 'apply_tag' button.  
Needs JoyTag model.  
Required files "model.safetensors", "config.json", "top_tags.txt".  
Put them in to `ComfyUI\models\joytag`.  
Node will dowload them automatically if not found.  
You can also manually download them from [https://huggingface.co/fancyfeast/joytag/tree/main]. (The model.onnx file does not need to be downloaded)  
![Example Image](template/text.png)

### Pickers:
* Checkpoint Picker  
Pick a checkpoint from the checkpoint list.  
* Upscale Method Picker  
Pick a upscale method from the method list.  
* Size Picker  
Pick a size from the size list.  
* Sampler Picker  
Pick a sampler from the sampler list.  
![Example Image](template/picker.png)

### Switchers:
* Checkpoint Input Switch  
* Model Input Switch  
* CLIP Input Switch  
* VAE Input Switch  
* Conditioning Input Switch  
* Text Input Switch  
* Image Input Switch  
* Int Input Switch  
* Float Input Switch  
* Image Output Switch  
* Image & Mask Output Switch  
They just switch, that's all.  
![Example Image](template/switch.png)

### Utils:
* Int to Boolean  
* Simple Boolean  
* Boolean A&B  
* Boolean A|B  
* Math Int  
* Math LogicGate
"Boolean A&B" and "Boolean A|B" are special, "A&B" means "A or B", "A|B" means "A with B".  
![Example Image](template/utils.png)

### Collapse Outputs:
This wasn't a node, but a feature.  
You can collapse the outputs of a node, just right click the node and "Collapse Outputs".  
It can made your nodes more clean when you have many outputs.  
In case of unpredictable problems, it just works on my nodes.  

## Installation and Update
### Installation:
* Clone the repo into the custom_nodes directory and install the requirements:
  ```
  git clone https://github.com/A1rCHAN/ComfyUI_A1rSpace.git
  ```
* Install dependencies in your Python environment.
  * For Windows Portable, run the following command inside `ComfyUI\custom_nodes\ComfyUI_A1rSpace`:
    ```
    ..\..\..\python_embeded\python.exe -m pip install -r requirements.txt
    ```
  * If your ComfyUI venv inside `ComfyUI\.venv\Scripts\python.exe`:
    ```
    ..\..\.venv\Scripts\python.exe -m pip install -r requirements.txt
    ```
  * For using venv or conda, activate your Python environment first, then run:
    ```
    pip install -r requirements.txt
    ```

### Update:
* Inside `ComfyUI\custom_nodes\ComfyUI_A1rSpace`:
  ```
  git pull
  ```
### Update history
- version 1.1.0:  
  A important update. Re-build all the nodes, provide more powerful functions. The dev version(1.0.x) is not stable, I will delete it soon.  
  If you find any bugs, please report issues.  

## Plan TODO:
1. Improve front interaction.
2. Add and modify more nodes to provide complete functions.
3. Find and fix bugs.
4. Language support.

## The custom nodes that my old workflow uses:  
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
They are all great, unbelievable custom node autohers.  
Actually, I am not good at coding, but learned a lot from them, and I finished this with AI tools.  
Thanks all.