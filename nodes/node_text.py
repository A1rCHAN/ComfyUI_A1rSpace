# type: ignore
import time
import random
import re
import json
import hashlib
from inspect import stack
from hashlib import md5
from .config import load_config, TextCleanerMixin
import requests
from openai import OpenAI

class Text_Box:
    def __init__(self):
        pass

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

    def output_text(self, text):
        return (text,)

# text show
# Inspired by pysssss Custom-Scripts show_text.py
# made some changes: just show, nothing returned, a button to copy text

class Text_Show:
    def __init__(self):
        pass
    
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

    INPUT_IS_LIST = True
    FUNCTION = "show_text"
    OUTPUT_NODE = True
    RETURN_TYPES = tuple()
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

class Text_Merge(TextCleanerMixin):
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text1": ("STRING", {"default": "", "multiline": True}),
                "text2": ("STRING", {"default": "", "multiline": True}),
                "text3": ("STRING", {"default": "", "multiline": True}),
                "text4": ("STRING", {"default": "", "multiline": True}),
                "delimiter": ("STRING", {"default": ", "}),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "merge_texts"

    CATEGORY = "A1rSpace/Text"

    def merge_texts(self, text1, text2, text3, text4, delimiter):
        texts = [self.clean_text(text) for text in [text1, text2, text3, text4]]

        non_empty_texts = [text for text in texts if text.strip()]
        
        merged = delimiter.join(non_empty_texts)
        return (merged,)

class TextMerge_WithClipEncode(TextCleanerMixin):
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text1": ("STRING", {"multiline": True, "default": ""}),
                "text2": ("STRING", {"multiline": True, "default": ""}),
                "text3": ("STRING", {"multiline": True, "default": ""}),
                "text4": ("STRING", {"multiline": True, "default": ""}),
                "delimiter": ("STRING", {"default": ", ", "multiline": False}),
                "clip": ("CLIP",),
            }
        }
    
    RETURN_TYPES = ("STRING", "CONDITIONING")
    RETURN_NAMES = ("text", "conditioning")
    FUNCTION = "merge_and_encode"

    CATEGORY = "A1rSpace/Text"
    
    def merge_and_encode(self, text1, text2, text3, text4, delimiter, clip):
        texts = [
            self.clean_text(text1),
            self.clean_text(text2),
            self.clean_text(text3),
            self.clean_text(text4)
        ]
        
        non_empty_texts = [t for t in texts if t]
        merged_text = delimiter.join(non_empty_texts)
        
        tokens = clip.tokenize(merged_text)
        cond, pooled = clip.encode_from_tokens(tokens, return_pooled=True)
        conditioning = [[cond, {"pooled_output": pooled}]]
        
        return (merged_text, conditioning)

# text translate
# power by NYJY Translate.py utils.py
# made sample changes: enable/disable translate

lang_list = {
    "Chinese": "zh",
    "English": "en",
}

cache_result = {}

def create_mission_key(from_lang, to_lang, text, platform):
    source = f"{from_lang}-{to_lang}-{text}-{platform}"
    input_bytes = source.encode('utf-8')
    md5_hash = hashlib.md5()
    md5_hash.update(input_bytes)
    return md5_hash.hexdigest()

def print_log(str_msg):
    str_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    print(f"[NYJY][{str_time}][{stack()[1][1]}, line: {stack()[1][2]}]: {str_msg}")

class Text_Translate:
    def __init__(self):
        pass

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

class Translate_ClipEncode_Merge(Text_Translate, TextCleanerMixin):
    def __init__(self):
        pass

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
                "text1": ("STRING", {"default": "", "multiline": True}),
                "enable1": ("BOOLEAN", {"default": False}),
                "text2": ("STRING", {"default": "", "multiline": True}),
                "enable2": ("BOOLEAN", {"default": False}),
                "text3": ("STRING", {"default": "", "multiline": True}),
                "enable3": ("BOOLEAN", {"default": False}),
                "text4": ("STRING", {"default": "", "multiline": True}),
                "enable4": ("BOOLEAN", {"default": False}),
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
        text1, enable1, text2, enable2, text3, enable3, text4, enable4,
        delimiter, clip
    ):
        # 处理每个输入
        texts = []
        for text, enable in [
            (text1, enable1), (text2, enable2), (text3, enable3), (text4, enable4)
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

TEXT_CLASS_MAPPINGS = {
    "A1r Text Box": Text_Box,
    "A1r Text Show": Text_Show,
    "A1r Merge Text": Text_Merge,
    "A1r MergeText WithClipEncode": TextMerge_WithClipEncode,
    "A1r Text Translate": Text_Translate,
    "A1r Translate ClipEncode Merge": Translate_ClipEncode_Merge,
}

TEXT_DISPLAY_NAME_MAPPINGS = {
    "A1r Text Box": "Text Box",
    "A1r Text Show": "Text Show",
    "A1r Merge Text": "Text Merge",
    "A1r MergeText WithClipEncode": "TextMerge withClipEncode",
    "A1r Text Translate": "Text Translate",
    "A1r Translate ClipEncode Merge": "Translate ClipEncode Merge",
}