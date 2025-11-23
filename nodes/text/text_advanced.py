"""
Advanced text processing nodes with optional dependencies.
Includes translation (Baidu/DeepSeek) and image tagging (JoyTag/WD14).
"""

import os
import csv
import random
import hashlib
import traceback
from hashlib import md5
from datetime import datetime
from pathlib import Path

import torch
import numpy as np
from PIL import Image

# Lazy imports for optional dependencies
_requests = None
_OpenAI = None
_InferenceSession = None
_VisionModel = None
_TVF = None
_huggingface_hub = None

def _lazy_load_requests():
    global _requests
    if _requests is None:
        try:
            import requests
            _requests = requests
        except ImportError:
            print("[A1rSpace] Warning: 'requests' not available. Translation disabled.")
    return _requests

def _lazy_load_openai():
    global _OpenAI
    if _OpenAI is None:
        try:
            from openai import OpenAI
            _OpenAI = OpenAI
        except ImportError:
            print("[A1rSpace] Warning: 'openai' not available. DeepSeek translation disabled.")
    return _OpenAI

def _lazy_load_onnxruntime():
    global _InferenceSession
    if _InferenceSession is None:
        try:
            from onnxruntime import InferenceSession
            _InferenceSession = InferenceSession
        except ImportError:
            print("[A1rSpace] Warning: 'onnxruntime' not available. WD14 tagging disabled.")
    return _InferenceSession

def _lazy_load_joytag():
    global _TVF
    if _TVF is None:
        try:
            import torchvision.transforms.functional as TVF
            _TVF = TVF
        except ImportError:
            print("[A1rSpace] Warning: 'torchvision' not available. JoyTag disabled.")
    return _TVF

def _lazy_load_huggingface_hub():
    global _huggingface_hub
    if _huggingface_hub is None:
        try:
            from huggingface_hub import snapshot_download
            _huggingface_hub = snapshot_download
        except ImportError:
            print("[A1rSpace] Warning: 'huggingface_hub' not available. Model download disabled.")
    return _huggingface_hub

# Import from common modules
from ..common.shared_utils import print_log, TextCleanerMixin
from ..common.config_loader import load_config
from ..common.joytag_model import VisionModel

# Import folder_paths at module level for path operations
import folder_paths

# ========== Translation Support ==========

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

def _encode_with_clip(clip, text):
    """Helper function to encode text with CLIP."""
    if clip is None:
        return [[]]
    tokens = clip.tokenize(text)
    output = clip.encode_from_tokens(tokens, return_pooled=True, return_dict=True)
    cond = output.pop("cond")
    return [[cond, output]]

# ========== Translation Nodes ==========

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
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "translate"

    CATEGORY = "A1rSpace/Text"
    DESCRIPTION = "Chinese-English translation node with platform and API key input."

    def baidu_translate(self, from_lang, to_lang, text):
        requests = _lazy_load_requests()
        if requests is None:
            return "", "Error: requests library not installed"

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
                errmsg = str(result)
            print_log(f"[A1rSpace_Translate] exec translate failed：{errmsg}")
            return "", errmsg

        arr_res = []
        for item in result["trans_result"]:
            arr_res.append(item["dst"])

        str_res = ("\n").join(arr_res)
        return str_res, ""

    def deepseek_translate(self, from_lang, to_lang, text):
        OpenAI = _lazy_load_openai()
        if OpenAI is None:
            return "", "Error: openai library not installed"

        config_data = load_config()
        api_key = config_data["DeepSeek"].get("api_key",  config_data["DeepSeek"].get("Key", ""))

        client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

        try:
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "你是一个翻译助手。"},
                    {"role": "user", "content": f"按照stable diffusion生图模型提示词的书写规范,将以下文本翻译成{to_lang}:{text}"},
                ],
                stream=False,
            )

            translate_str = response.choices[0].message.content
            return translate_str, ""
        except Exception as e:
            errmsg = f"DeepSeek translate failed:{e}"
            print_log(errmsg)
            return "", errmsg

    def translate(self, from_lang, to_lang, text, platform, enable_translate):
        # 1. directly return input text when translation is disabled
        if not enable_translate:
            return {
                "ui": {"text": ("",)},
                "result": (text,),
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

        return {
            "ui": {"text": (ui_msg,)},
            "result": (translate_str,),
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
                "trans_a": ("BOOLEAN", {"default": False}),
                "text_b": ("STRING", {"default": "", "multiline": True}),
                "trans_b": ("BOOLEAN", {"default": False}),
                "text_c": ("STRING", {"default": "", "multiline": True}),
                "trans_c": ("BOOLEAN", {"default": False}),
                "text_d": ("STRING", {"default": "", "multiline": True}),
                "trans_d": ("BOOLEAN", {"default": False}),
                "delimiter": ("STRING", {"default": ", ", "multiline": False}),
                "clip_a": ("CLIP",),
            },
            "optional": {
                "clip_b": ("CLIP",)
            }
        }

    RETURN_TYPES = ("CONDITIONING", "CONDITIONING", "STRING")
    RETURN_NAMES = ("conditioning_a", "conditioning_b", "text")
    FUNCTION = "merge_and_translate"

    CATEGORY = "A1rSpace/Text"
    DESCRIPTION = "Merge 4 texts with translation and dual CLIP encoding."

    def merge_and_translate(
        self, platform, from_lang, to_lang,
        text_a, trans_a, text_b, trans_b, text_c, trans_c, text_d, trans_d,
        delimiter, clip_a, clip_b=None
    ):
        # 处理每个输入
        texts = []
        for text, enable in [
            (text_a, trans_a), (text_b, trans_b), (text_c, trans_c), (text_d, trans_d)
        ]:
            if not text.strip():
                continue

            if enable:
                # 调用父类translate方法，clip=None只做翻译
                translated = self.translate(
                    from_lang, to_lang, text, platform, True
                )["result"][0]
                texts.append(self.clean_text(translated))
            else:
                texts.append(self.clean_text(text))

        non_empty_texts = [t for t in texts if t]
        merged_text = delimiter.join(non_empty_texts)

        conditioning_a = _encode_with_clip(clip_a, merged_text)
        conditioning_b = _encode_with_clip(clip_b, merged_text)

        return (merged_text, conditioning_a, conditioning_b)

# ========== Image Tagging Nodes ==========

class TextTagBox:
    """
    Extract image tags using JoyTag or WD14Tagger vision models for auto-tagging images.
    """
    
    # WD14 model configurations
    WD14_MODELS = {
        "wd-v1-4-moat-tagger-v2": "SmilingWolf/wd-v1-4-moat-tagger-v2",
        "wd-v1-4-swinv2-tagger-v2": "SmilingWolf/wd-v1-4-swinv2-tagger-v2",
        "wd-v1-4-convnext-tagger-v2": "SmilingWolf/wd-v1-4-convnext-tagger-v2",
        "wd-v1-4-vit-tagger-v2": "SmilingWolf/wd-v1-4-vit-tagger-v2",
    }
    
    def __init__(self):
        config_data = load_config()
        self.config_data = config_data
        
        # JoyTag paths
        text_encoder_paths = folder_paths.get_folder_paths("text_encoders")
        if text_encoder_paths:
            self.joytag_model_path = os.path.join(text_encoder_paths[0], "joytag")
        else:
            self.joytag_model_path = os.path.join(folder_paths.models_dir, "text_encoders", "joytag")
        os.makedirs(self.joytag_model_path, exist_ok=True)
        self.joytag_loaded_model = None
        self.joytag_tag_list = None
        
        # WD14 paths
        if "wd14_tagger" in folder_paths.folder_names_and_paths:
            self.wd14_models_dir = folder_paths.get_folder_paths("wd14_tagger")[0]
        else:
            if text_encoder_paths:
                self.wd14_models_dir = os.path.join(text_encoder_paths[0], "wd14")
            else:
                self.wd14_models_dir = os.path.join(folder_paths.models_dir, "text_encoders", "wd14")
        os.makedirs(self.wd14_models_dir, exist_ok=True)
        
        # Check ONNX availability
        InferenceSession = _lazy_load_onnxruntime()
        self.ort_providers = ["CUDAExecutionProvider", "CPUExecutionProvider"] if InferenceSession is not None else []

    @classmethod
    def _get_wd14_models(cls):
        """Get list of available WD14 models from directory."""
        text_encoder_paths = folder_paths.get_folder_paths("text_encoders")
        if "wd14_tagger" in folder_paths.folder_names_and_paths:
            wd14_dir = folder_paths.get_folder_paths("wd14_tagger")[0]
        else:
            if text_encoder_paths:
                wd14_dir = os.path.join(text_encoder_paths[0], "wd14")
            else:
                wd14_dir = os.path.join(folder_paths.models_dir, "text_encoders", "wd14")
        
        wd14_models = []
        if os.path.exists(wd14_dir):
            for file in os.listdir(wd14_dir):
                if file.endswith(".onnx"):
                    model_name = file[:-5]
                    csv_file = os.path.join(wd14_dir, f"{model_name}.csv")
                    if os.path.exists(csv_file):
                        wd14_models.append(model_name)
        
        if not wd14_models:
            wd14_models = list(cls.WD14_MODELS.keys())
        
        return wd14_models

    @classmethod
    def INPUT_TYPES(cls):
        wd14_models = cls._get_wd14_models()
        model_list = ["JoyTag"] + [f"WD14/{m}" for m in wd14_models]
        
        return {
            "required": {
                "image": ("IMAGE",),
                "model": (model_list, {"default": "JoyTag"}),
                "threshold": ("FLOAT", {"default": 0.35, "min": 0.0, "max": 1.0, "step": 0.05}),
                "character_threshold": ("FLOAT", {"default": 0.85, "min": 0.0, "max": 1.0, "step": 0.05}),
                "apply_tag": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                "text": ("STRING", {"default": "", "multiline": True}),
                "exclude_tags": ("STRING", {"default": "", "multiline": False}),
                "replace_underscore": ("BOOLEAN", {"default": False}),
                "trailing_comma": ("BOOLEAN", {"default": False}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("tags",)
    OUTPUT_NODE = False
    FUNCTION = "run"
    
    CATEGORY = "A1rSpace/Text"
    DESCRIPTION = "Extract image tags using JoyTag or WD14Tagger vision models."

    def ensure_joytag_loaded(self):
        """Load JoyTag model if not already loaded."""
        if self.joytag_loaded_model is not None:
            return True
        
        TVF = _lazy_load_joytag()
        if TVF is None:
            print_log("JoyTag dependencies (torchvision) not available")
            return False
        
        required_files = ["model.safetensors", "config.json", "top_tags.txt"]
        model_files_exist = all(os.path.exists(os.path.join(self.joytag_model_path, f)) for f in required_files)
        
        if not model_files_exist:
            snapshot_download = _lazy_load_huggingface_hub()
            if snapshot_download is None:
                print_log("huggingface_hub not available for model download")
                return False
            
            print_log("Downloading JoyTag model...")
            try:
                os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
                snapshot_download(
                    repo_id="fancyfeast/joytag",
                    ignore_patterns=["*.onnx"],
                    local_dir=self.joytag_model_path,
                )
                print_log("JoyTag model downloaded successfully")
            except Exception as e:
                print_log(f"Error downloading JoyTag model: {e}")
                traceback.print_exc()
                return False
        
        try:
            self.joytag_loaded_model = VisionModel.load_model(self.joytag_model_path, device="cuda")
            self.joytag_loaded_model.eval()
            
            with open(os.path.join(self.joytag_model_path, "top_tags.txt"), "r", encoding="utf-8") as f:
                self.joytag_tag_list = [line.strip() for line in f if line.strip()]
                
            print_log("JoyTag model loaded successfully")
            return True
            
        except Exception as e:
            print_log(f"Error loading JoyTag model: {e}")
            traceback.print_exc()
            return False

    def prepare_joytag_image(self, image, target_size: int):
        """Prepare image for JoyTag model."""
        TVF = _lazy_load_joytag()
        
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

    def predict_joytag(self, image, threshold, replace_underscore, trailing_comma, exclude_tags):
        """Run JoyTag prediction."""
        if not self.ensure_joytag_loaded():
            return "Error: Could not load JoyTag model"

        try:
            image_tensor = self.prepare_joytag_image(image, self.joytag_loaded_model.image_size)
            batch = {"image": image_tensor.unsqueeze(0).to("cuda")}

            with torch.no_grad(), torch.amp.autocast_mode.autocast("cuda", enabled=True):
                preds = self.joytag_loaded_model(batch)
                tag_preds = preds['tags'].sigmoid().cpu()

            scores = {self.joytag_tag_list[i]: tag_preds[0][i] for i in range(len(self.joytag_tag_list))}
            predicted_tags = [tag for tag, score in scores.items() if score > threshold]
            
            if replace_underscore:
                predicted_tags = [tag.replace("_", " ") for tag in predicted_tags]
            
            if exclude_tags:
                exclude_list = [s.strip().lower() for s in exclude_tags.split(",") if s.strip()]
                predicted_tags = [tag for tag in predicted_tags if tag.lower() not in exclude_list]
            
            if trailing_comma:
                tag_string = "".join([tag + ", " for tag in predicted_tags])
            else:
                tag_string = ", ".join(predicted_tags)
            
            return tag_string
            
        except Exception as e:
            print_log(f"Error during JoyTag prediction: {e}")
            traceback.print_exc()
            return "Error during JoyTag prediction"

    def ensure_wd14_model(self, model_name):
        """Download WD14 model if not present."""
        InferenceSession = _lazy_load_onnxruntime()
        if InferenceSession is None:
            print_log("Error: onnxruntime is not installed. Cannot use WD14 models.")
            return False
            
        onnx_path = os.path.join(self.wd14_models_dir, f"{model_name}.onnx")
        csv_path = os.path.join(self.wd14_models_dir, f"{model_name}.csv")
        
        if os.path.exists(onnx_path) and os.path.exists(csv_path):
            return True
        
        print_log(f"Downloading WD14 model: {model_name}...")
        try:
            hf_endpoint = os.getenv("HF_ENDPOINT", "https://huggingface.co")
            if not hf_endpoint.startswith("https://"):
                hf_endpoint = f"https://{hf_endpoint}"
            hf_endpoint = hf_endpoint.rstrip("/")
            
            repo_id = self.WD14_MODELS[model_name]
            base_url = f"{hf_endpoint}/{repo_id}/resolve/main/"
            
            import urllib.request
            urllib.request.urlretrieve(f"{base_url}model.onnx", onnx_path)
            urllib.request.urlretrieve(f"{base_url}selected_tags.csv", csv_path)
            
            print_log(f"WD14 model {model_name} downloaded successfully")
            return True
            
        except Exception as e:
            print_log(f"Error downloading WD14 model: {e}")
            traceback.print_exc()
            return False

    def predict_wd14(self, image, model_name, threshold, character_threshold, exclude_tags, replace_underscore, trailing_comma):
        """Run WD14 prediction."""
        if not self.ensure_wd14_model(model_name):
            return "Error: Could not load WD14 model"
        
        InferenceSession = _lazy_load_onnxruntime()
        
        try:
            onnx_path = os.path.join(self.wd14_models_dir, f"{model_name}.onnx")
            csv_path = os.path.join(self.wd14_models_dir, f"{model_name}.csv")
            
            model = InferenceSession(onnx_path, providers=self.ort_providers)
            
            input_meta = model.get_inputs()[0]
            height = input_meta.shape[1]
            
            # Resize and pad image
            ratio = float(height) / max(image.size)
            new_size = tuple([int(x * ratio) for x in image.size])
            image = image.resize(new_size, Image.LANCZOS)
            square = Image.new("RGB", (height, height), (255, 255, 255))
            square.paste(image, ((height - new_size[0]) // 2, (height - new_size[1]) // 2))
            
            # Prepare image array
            image_array = np.array(square).astype(np.float32)
            image_array = image_array[:, :, ::-1]  # RGB -> BGR
            image_array = np.expand_dims(image_array, 0)
            
            # Read tags from CSV
            tags = []
            general_index = None
            character_index = None
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                next(reader)  # Skip header
                for row in reader:
                    if general_index is None and row[2] == "0":
                        general_index = reader.line_num - 2
                    elif character_index is None and row[2] == "4":
                        character_index = reader.line_num - 2
                    if replace_underscore:
                        tags.append(row[1].replace("_", " "))
                    else:
                        tags.append(row[1])
            
            # Run inference
            label_name = model.get_outputs()[0].name
            probs = model.run([label_name], {input_meta.name: image_array})[0]
            
            result = list(zip(tags, probs[0]))
            
            # Filter tags
            general = [item for item in result[general_index:character_index] if item[1] > threshold]
            character = [item for item in result[character_index:] if item[1] > character_threshold]
            
            all_tags = character + general
            remove = [s.strip() for s in exclude_tags.lower().split(",") if s.strip()]
            all_tags = [tag for tag in all_tags if tag[0].lower() not in remove]
            
            # Format output
            tag_string = ("" if trailing_comma else ", ").join(
                (item[0].replace("(", "\\(").replace(")", "\\)") + (", " if trailing_comma else "")
                 for item in all_tags)
            )
            
            return tag_string
            
        except Exception as e:
            print_log(f"Error during WD14 prediction: {e}")
            traceback.print_exc()
            return "Error during WD14 prediction"

    def run(self, image, model, threshold, character_threshold, apply_tag,
            text="", exclude_tags="", replace_underscore=False, trailing_comma=False):
        """Main execution function."""
        if not apply_tag:
            return (text,)
        
        try:
            # Convert tensor to PIL Image
            i = 255.0 * image[0].cpu().numpy()
            img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
            
            if model == "JoyTag":
                tag_string = self.predict_joytag(img, threshold, replace_underscore, trailing_comma, exclude_tags)
            elif model.startswith("WD14/"):
                wd14_model = model.split("/", 1)[1]
                tag_string = self.predict_wd14(
                    img, wd14_model, threshold, character_threshold,
                    exclude_tags, replace_underscore, trailing_comma
                )
            else:
                return ("Error: Unknown model type",)
            
            return (tag_string,)
            
        except Exception as e:
            print_log(f"Error in TagTextBox: {e}")
            traceback.print_exc()
            return (f"Error: {str(e)}",)

# ========== Utility Nodes ==========

class TextSaveFileName:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "name": ("STRING", {"default": "ComfyUI"}),
                "path_prefix": ("BOOLEAN", {"default": True}),
                "date_suffix": ("BOOLEAN", {"default": True}),
                "time_suffix": ("BOOLEAN", {"default": True})
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("file_name",)
    FUNCTION = "save_file_name"
    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Auto-detect checkpoint path & generate clean file name."

    def save_file_name(self, name, path_prefix, date_suffix, time_suffix):
        clean_name, rel_dir = self._sanitize_ckpt_name(name)

        date_str = datetime.now().strftime("%Y-%m-%d") if date_suffix else ""
        time_str = datetime.now().strftime("%H-%M-%S") if time_suffix else ""

        name_parts = [p for p in (clean_name, date_str, time_str) if p]
        final_name = "_".join(name_parts)

        if path_prefix and rel_dir:
            display_name = f"{rel_dir}/{final_name}"
        else:
            display_name = final_name

        return (display_name,)

    def _sanitize_ckpt_name(self, raw: str):
        ckpt_root = self.get_ckpt_path()
        if not ckpt_root:
            clean_name = Path(raw).stem.replace("?", "_")
            return clean_name, ""

        ckpt_root_path = Path(ckpt_root).resolve()
        full_path = folder_paths.get_full_path("checkpoints", raw)

        if full_path and os.path.isfile(full_path):
            path_obj = Path(full_path).resolve()
        else:
            path_str = raw.replace("?", os.sep)
            path_obj = Path(path_str)
            if not path_obj.is_absolute():
                path_obj = ckpt_root_path / path_obj

        try:
            rel_path = path_obj.relative_to(ckpt_root_path)
        except ValueError:
            clean_name = path_obj.stem
            return clean_name, ""

        rel_dir = str(rel_path.parent).replace(os.sep, "/") if rel_path.parent != Path(".") else ""
        clean_name = rel_path.stem
        return clean_name, rel_dir

    def get_ckpt_path(self) -> str:
        try:
            paths = folder_paths.get_folder_paths("checkpoints")
            if paths:
                path = paths[0]
                if not path.endswith(os.sep):
                    path += os.sep
                return path
        except Exception as e:
            print(f"[TextSaveFileName] Warning: {e}")
        return ""

# ========== Draggable Text List Node ==========

class DraggableTextList:
    """
    A node with draggable text items that can be reordered
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text1": ("STRING", {"default": "First item", "multiline": False}),
                "text2": ("STRING", {"default": "Second item", "multiline": False}),
                "text3": ("STRING", {"default": "Third item", "multiline": False}),
                "text4": ("STRING", {"default": "Fourth item", "multiline": False}),
            },
            "optional": {
                # Hidden widget to store the order
                "item_order": ("STRING", {"default": "0,1,2,3", "multiline": False}),
            }
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("merged_text",)
    FUNCTION = "merge_in_order"
    
    CATEGORY = "A1rSpace/Text"
    NODE_METADATA = {
        "status": "beta",
        "warning": "Beta version, may contain bugs or unexpected behavior."
    }
    
    def merge_in_order(self, text1, text2, text3, text4, item_order="0,1,2,3"):
        """
        Merge texts according to the dragged order
        """
        texts = [text1, text2, text3, text4]
        
        # Parse order
        try:
            order = [int(x.strip()) for x in item_order.split(',')]
        except:
            order = [0, 1, 2, 3]
        
        # Reorder texts
        ordered_texts = [texts[i] for i in order if i < len(texts)]
        
        # Filter empty texts and join
        non_empty = [t for t in ordered_texts if t.strip()]
        result = ", ".join(non_empty)
        
        return (result,)

# ========== Export Mappings ==========

TEXT_ADVANCED_CLASS_MAPPINGS = {
    "A1r Text Translate": TextTranslate,
    "A1r Text Translate Merge with Clip Encode": TranslateClipEncodeMerge,
    "A1r Text Tag Box": TextTagBox,
    "A1r Text Save File Name": TextSaveFileName,
    "A1r Draggable List": DraggableTextList,
}

TEXT_ADVANCED_DISPLAY_NAME_MAPPINGS = {
    "A1r Text Translate": "Text Translate",
    "A1r Text Translate Merge with Clip Encode": "Text Translate Merge with Clip Encode",
    "A1r Text Tag Box": "Text Tag Box",
    "A1r Text Save File Name": "Save Name Helper",
    "A1r Draggable List": "Draggable Text List"
}
