# type: ignore
"""
Text processing nodes for ComfyUI A1rSpace extension.

This module provides text manipulation, translation, merging, and tagging nodes
including integration with Baidu/DeepSeek translation APIs and JoyTag image tagging.
"""
import time
import random
import sys
import json
import hashlib
from inspect import stack
from hashlib import md5
from .config import load_config, TextCleanerMixin
import requests
from openai import OpenAI
from .models import VisionModel
from PIL import Image
import torch
import torch.amp.autocast_mode
import torchvision.transforms.functional as TVF
from huggingface_hub import snapshot_download
import numpy as np
import folder_paths
import os
import shutil
import traceback
import re

def print_log(str_msg):
    """Print log message with timestamp and caller information."""
    str_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    try:
        caller = stack()[1]
        caller_info = f"[{caller[1]}, line: {caller[2]}]"
    except Exception:
        caller_info = ""
    print(f"[A1rSpace][{str_time}]{caller_info}: {str_msg}")

class TextBox:
    """
    Basic text input node for entering and outputting text strings.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"default": "", "multiline": True}),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "output_text"
    
    CATEGORY = "A1rSpace/Text"
    DESCRIPTION = "Basic text input node for entering multiline text strings."

    def output_text(self, text):
        return (text,)

class TextShow:
    """
    Display text content with UI output support.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"forceInput": True}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    RETURN_TYPES = tuple()
    INPUT_IS_LIST = True
    OUTPUT_NODE = True
    FUNCTION = "show_text"

    CATEGORY = "A1rSpace/Text"
    DESCRIPTION = "Display the input text."

    def show_text(self, text, unique_id=None, extra_pnginfo=None):
        text_content = text[0] if isinstance(text, list) and len(text) > 0 else str(text)

        if unique_id is not None and extra_pnginfo is not None:
            if not isinstance(extra_pnginfo, list):
                print("Error: extra_pnginfo is not a list")
            elif (
                not isinstance(extra_pnginfo[0], dict)
                or "workflow" not in extra_pnginfo[0]
            ):
                print("Error: extra_pnginfo[0] is not a dict or missing 'workflow' key")
            else:
                workflow = extra_pnginfo[0]["workflow"]
                node = next(
                    (x for x in workflow["nodes"] if str(x["id"]) == str(unique_id[0])),
                    None,
                )
                if node:
                    node["widgets_values"] = [text_content]
        return {"ui": {"text": [text_content]}, "result": ()}

class TextMerge(TextCleanerMixin):
    """
    Merge up to four text inputs with a custom delimiter, filtering empty strings.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text_a": ("STRING", {"default": "", "multiline": True}),
                "text_b": ("STRING", {"default": "", "multiline": True}),
                "text_c": ("STRING", {"default": "", "multiline": True}),
                "text_d": ("STRING", {"default": "", "multiline": True}),
                "delimiter": ("STRING", {"default": ", "}),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "merge_texts"

    CATEGORY = "A1rSpace/Text"
    DESCRIPTION = "Merge up to four text inputs with a custom delimiter, filtering empty strings."

    def merge_texts(self, text_a, text_b, text_c, text_d, delimiter):
        texts = [self.clean_text(text) for text in [text_a, text_b, text_c, text_d]]
        non_empty_texts = [text for text in texts if text.strip()]
        
        merged = delimiter.join(non_empty_texts)

        return (merged,)

class TextMergeWithClipEncode(TextCleanerMixin):
    """
    Merge multiple text inputs and encode them with CLIP in one step.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text_a": ("STRING", {"multiline": True, "default": ""}),
                "text_b": ("STRING", {"multiline": True, "default": ""}),
                "text_c": ("STRING", {"multiline": True, "default": ""}),
                "text_d": ("STRING", {"multiline": True, "default": ""}),
                "delimiter": ("STRING", {"default": ", ", "multiline": False}),
                "clip": ("CLIP",),
            }
        }
    
    RETURN_TYPES = ("STRING", "CONDITIONING")
    RETURN_NAMES = ("text", "conditioning")
    FUNCTION = "merge_and_encode"

    CATEGORY = "A1rSpace/Text"
    DESCRIPTION = "Merge multiple text inputs and encode them with CLIP in one step."

    def merge_and_encode(self, text_a, text_b, text_c, text_d, delimiter, clip):
        texts = [
            self.clean_text(text_a),
            self.clean_text(text_b),
            self.clean_text(text_c),
            self.clean_text(text_d)
        ]
        
        non_empty_texts = [t for t in texts if t]
        merged_text = delimiter.join(non_empty_texts)
        
        tokens = clip.tokenize(merged_text)
        cond, pooled = clip.encode_from_tokens(tokens, return_pooled=True)
        conditioning = [[cond, {"pooled_output": pooled}]]
        
        return (merged_text, conditioning)

# text translate
# inspired by NYJY Translate.py utils.py
# made sample changes: enable/disable translate

lang_list = {
    "Chinese": "zh",
    "English": "en",
}

cache_result = {}

def create_mission_key(from_lang, to_lang, text, platform):
    """Generate a unique cache key for translation missions."""
    source = f"{from_lang}-{to_lang}-{text}-{platform}"
    input_bytes = source.encode('utf-8')
    md5_hash = hashlib.md5()
    md5_hash.update(input_bytes)
    return md5_hash.hexdigest()

class TextTranslate:
    """
    Translate text between Chinese and English using Baidu or DeepSeek APIs.
    """
    
    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "platform": (["Baidu", "DeepSeek"], {"default": "Baidu"}),
                "from_lang": (
                    ["auto"] + list(lang_list.keys()),
                    {"default": "auto"},
                ),
                "to_lang": (list(lang_list.keys()), {"default": "English"}),
                "text": ("STRING", {"default": "", "multiline": True}),
                "enable_translate": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                "clip": ("CLIP",),   
            },
        }

    RETURN_TYPES = ("STRING", "CONDITIONING",)
    FUNCTION = "translate"

    CATEGORY = "A1rSpace/Text"
    DESCRIPTION = "Chinese-English translation node with platform and API key input."

    def baidu_translate(self, from_lang, to_lang, text):
        endpoint = "http://api.fanyi.baidu.com"
        path = "/api/trans/vip/translate"
        url = endpoint + path

        query = " ".join(text.split("_"))

        def make_md5(s, encoding="utf-8"):
            return md5(s.encode(encoding)).hexdigest()

        salt = random.randint(32768, 65536)
        sign = make_md5(self.appid + query + str(salt) + self.appkey)

        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        payload = {
            "appid": self.appid,
            "q": query,
            "from": (
                lang_list[from_lang] if from_lang in lang_list else "auto"
            ),
            "to": lang_list[to_lang],
            "salt": salt,
            "sign": sign,
        }

        r = requests.post(url, params=payload, headers=headers, proxies=None)
        result = r.json()

        if "error_code" in result:
            if result["error_code"] == "52003":
                errmsg = "Please config your api-key in ./custom_nodes/ComfyUI_A1rSpace/config.json"
            else:
                errmsg = json.dumps(result)
            print_log(f"[A1rSpace_Translate] exec translate failed：{errmsg}")
            return "", errmsg

        arr_res = []
        for item in result["trans_result"]:
            arr_res.append(item["dst"])

        str_res = ("\n").join(arr_res)
        return str_res, ""

    def deepseek_translate(self, from_lang, to_lang, text):
        config_data = load_config()
        api_key = config_data["DeepSeek"].get("api_key",  config_data["DeepSeek"].get("Key", ""))

        client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

        try:
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "你是一个翻译助手。"},
                    {"role": "user", "content": f"按照stable diffusion生图模型提示词的书写规范，将以下文本翻译成{to_lang}：{text}"},
                ],
                stream=False,
            )

            translate_str = response.choices[0].message.content
            return translate_str, ""
        except Exception as e:
            errmsg = f"DeepSeek translate failed：{e}"
            print_log(errmsg)
            return "", errmsg

    def translate(self, from_lang, to_lang, text, platform, enable_translate, clip=None):
        # 1. directly return input text when translation is disabled
        if not enable_translate:
            if clip is None:
                return {
                    "ui": {"text": ("",)},
                    "result": (
                        text,
                        [[]],
                    ),
                }
            tokens = clip.tokenize(text)
            output = clip.encode_from_tokens(tokens, return_pooled=True, return_dict=True)
            cond = output.pop("cond")
            return {
                "ui": {"text": ("",)},
                "result": (
                    text,
                    [[cond, output]],
                ),
            }

        # 2. keep consistent with previous behavior when translation is enabled
        config_data = load_config()
        self.appid = config_data["Baidu"]["AppId"] if "Baidu" in config_data else ""
        self.appkey = config_data["Baidu"]["Secret"] if "Baidu" in config_data else ""

        mission_key = create_mission_key(from_lang, to_lang, text, platform)
        ui_msg = ""
        translate_str = ""

        if mission_key in cache_result:
            print_log("aim cache")
            translate_str = cache_result[mission_key]
        else:
            if platform == "Baidu":
                translate_str, ui_msg = self.baidu_translate(from_lang, to_lang, text)
            elif platform == "DeepSeek":
                translate_str, ui_msg = self.deepseek_translate(from_lang, to_lang, text)
            else:
                translate_str, ui_msg = ("", "Haven't platform")

            if translate_str != "":
                cache_result[mission_key] = translate_str

        if clip is None:
            return {
                "ui": {"text": (ui_msg,)},
                "result": (
                    translate_str,
                    [[]],
                ),
            }

        tokens = clip.tokenize(translate_str)
        output = clip.encode_from_tokens(tokens, return_pooled=True, return_dict=True)
        cond = output.pop("cond")
        return {
            "ui": {"text": (ui_msg,)},
            "result": (
                translate_str,
                [[cond, output]],
            ),
        }

class TranslateClipEncodeMerge(TextTranslate, TextCleanerMixin):
    """
    Merge multiple text inputs with individual translation switches and CLIP encoding.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "platform": (["Baidu", "DeepSeek"], {"default": "Baidu"}),
                "from_lang": (
                    ["auto"] + list(lang_list.keys()),
                    {"default": "auto"},
                ),
                "to_lang": (list(lang_list.keys()), {"default": "English"}),
                "text_a": ("STRING", {"default": "", "multiline": True}),
                "enable_a": ("BOOLEAN", {"default": False}),
                "text_b": ("STRING", {"default": "", "multiline": True}),
                "enable_b": ("BOOLEAN", {"default": False}),
                "text_c": ("STRING", {"default": "", "multiline": True}),
                "enable_c": ("BOOLEAN", {"default": False}),
                "text_d": ("STRING", {"default": "", "multiline": True}),
                "enable_d": ("BOOLEAN", {"default": False}),
                "delimiter": ("STRING", {"default": ", ", "multiline": False}),
                "clip": ("CLIP",),
            }
        }

    RETURN_TYPES = ("STRING", "CONDITIONING")
    RETURN_NAMES = ("text", "conditioning")
    FUNCTION = "merge_and_translate"

    CATEGORY = "A1rSpace/Text"
    DESCRIPTION = "Merge 4 texts, each with independent translation switch, and encode with CLIP."

    def merge_and_translate(
        self, platform, from_lang, to_lang,
        text_a, enable_a, text_b, enable_b, text_c, enable_c, text_d, enable_d,
        delimiter, clip
    ):
        # 处理每个输入
        texts = []
        for text, enable in [
            (text_a, enable_a), (text_b, enable_b), (text_c, enable_c), (text_d, enable_d)
        ]:
            if not text.strip():
                continue

            if enable:
                # 调用父类translate方法，clip=None只做翻译
                translated, _ = self.translate(
                    from_lang, to_lang, text, platform, True, None
                )["result"]
                texts.append(self.clean_text(translated))
            else:
                texts.append(self.clean_text(text))

        non_empty_texts = [t for t in texts if t]
        merged_text = delimiter.join(non_empty_texts)

        # clip encode
        tokens = clip.tokenize(merged_text)
        cond, pooled = clip.encode_from_tokens(tokens, return_pooled=True)
        conditioning = [[cond, {"pooled_output": pooled}]]

        return (merged_text, conditioning)

class JoyTagTextBox:
    """
    Extract image tags using the JoyTag vision model for auto-tagging images.
    """
    
    def __init__(self):
        config_data = load_config()
        self.config_data = config_data
        self.model_path = os.path.join(self.config_data["base_path"], "models/joytag/")
        self.clip_model_path = os.path.join(
            folder_paths.get_folder_paths("clip")[0], "joytag"
        )
        self.loaded_model = None
        self.tag_list = None

    @classmethod
    def INPUT_TYPES(self):
        return {
            "required": {
                "image": ("IMAGE", {"default": "", "multiline": False}),
                "THRESHOLD": (
                    "FLOAT",
                    {"default": 0.4, "min": 0.1, "max": 1, "step": 0.05},
                ),
                "apply_tag": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                "positive": (
                    "STRING",
                    {
                        "multiline": True,
                        "default": "",
                        "placeholder": "Enter text when apply_tag is False",
                    },
                ),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("tags",)
    OUTPUT_NODE = False
    FUNCTION = "run"
    
    CATEGORY = "A1rSpace/Text"
    DESCRIPTION = "Extract image tags using the JoyTag vision model for auto-tagging images."

    def ensure_model_loaded(self):
        if self.loaded_model is not None:
            return True
            
        os.makedirs(self.clip_model_path, exist_ok=True)
        
        required_files = ["model.safetensors", "config.json", "top_tags.txt"]
        model_files_exist = all(os.path.exists(os.path.join(self.clip_model_path, f)) for f in required_files)
        
        if not model_files_exist:
            print_log("Downloading JoyTag model...")
            try:
                if os.path.exists(self.model_path):
                    for file in os.listdir(self.model_path):
                        source_file = os.path.join(self.model_path, file)
                        target_file = os.path.join(self.clip_model_path, file)
                        if os.path.exists(source_file):
                            shutil.move(source_file, target_file)
                    if os.path.exists(self.model_path):
                        shutil.rmtree(self.model_path)
                
                os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
                snapshot_download(
                    repo_id="fancyfeast/joytag",
                    ignore_patterns=["*.onnx"],
                    local_dir=self.clip_model_path,
                )
                print_log("JoyTag model downloaded successfully")
            except Exception as e:
                print_log(f"Error downloading model: {e}")
                return False
        
        try:
            self.loaded_model = VisionModel.load_model(self.clip_model_path)
            self.loaded_model.eval()
            self.loaded_model = self.loaded_model.to("cuda")
            
            with open(os.path.join(self.clip_model_path, "top_tags.txt"), "r", encoding="utf-8") as f:
                self.tag_list = [line.strip() for line in f if line.strip()]
                
            print_log("JoyTag model loaded successfully")
            return True
            
        except Exception as e:
            print_log(f"Error loading model: {e}")
            return False

    def prepare_image(self, image, target_size: int):
        image_shape = image.size
        max_dim = max(image_shape)
        pad_left = (max_dim - image_shape[0]) // 2
        pad_top = (max_dim - image_shape[1]) // 2

        padded_image = Image.new("RGB", (max_dim, max_dim), (255, 255, 255))
        padded_image.paste(image, (pad_left, pad_top))

        if max_dim != target_size:
            padded_image = padded_image.resize(
                (target_size, target_size), Image.BICUBIC
            )

        image_tensor = TVF.pil_to_tensor(padded_image) / 255.0

        image_tensor = TVF.normalize(
            image_tensor,
            mean=[0.48145466, 0.4578275, 0.40821073],
            std=[0.26862954, 0.26130258, 0.27577711],
        )

        return image_tensor

    def predict(self, image, threshold):
        if not self.ensure_model_loaded():
            return "Error: Could not load JoyTag model", {}

        try:
            image_tensor = self.prepare_image(image, self.loaded_model.image_size)
            batch = {"image": image_tensor.unsqueeze(0).to("cuda")}

            with torch.no_grad(), torch.amp.autocast_mode.autocast("cuda", enabled=True):
                preds = self.loaded_model(batch)
                tag_preds = preds["tags"].sigmoid().cpu()

            scores = {self.tag_list[i]: tag_preds[0][i] for i in range(len(self.tag_list))}
            predicted_tags = [tag for tag, score in scores.items() if score > threshold]
            tag_string = ", ".join(predicted_tags)
            
            return tag_string, scores
            
        except Exception as e:
            print_log(f"Error during prediction: {e}")
            return "Error during prediction", {}

    def run(self, image, THRESHOLD, apply_tag, positive=""):
        if not apply_tag:
            return (positive,)
        
        try:
            i = 255.0 * image[0].cpu().numpy()
            img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
            
            tag_string, scores = self.predict(img, THRESHOLD)
            
            return (tag_string,)
            
        except Exception as e:
            print_log(f"Error in tag extraction: {e}")
            return ("Error in tag extraction",)

TEXT_CLASS_MAPPINGS = {
    "A1r Text Box": TextBox,
    "A1r Text Show": TextShow,
    "A1r Text Merge": TextMerge,
    "A1r Text Merge with Clip Encode": TextMergeWithClipEncode,
    "A1r Text Translate": TextTranslate,
    "A1r Text Translate Merge with Clip Encode": TranslateClipEncodeMerge,
    "A1r JoyTag TextBox": JoyTagTextBox,
}

TEXT_DISPLAY_NAME_MAPPINGS = {
    "A1r Text Box": "Text Box",
    "A1r Text Show": "Text Show",
    "A1r Text Merge": "Text Merge",
    "A1r Text Merge with Clip Encode": "Text Merge with Clip Encode",
    "A1r Text Translate": "Text Translate",
    "A1r Text Translate Merge with Clip Encode": "Text Translate Merge with Clip Encode",
    "A1r JoyTag TextBox": "JoyTag Text Box",
}