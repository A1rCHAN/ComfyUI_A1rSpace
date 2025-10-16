# Copy from https://github.com/aidenli/ComfyUI_NYJY
# Just add a enable button to ignore the model
# type: ignore
import traceback
from pathlib import Path
import os
import json
import re
import shutil
from inspect import stack
import time
from ..config import load_config

try:
    from .models import VisionModel
except Exception as e:
    VisionModel = None
    print(f"[A1rSpace] Warning: JoyTag VisionModel import failed: {e}")
    traceback.print_exc()

try:
    from PIL import Image
except Exception as e:
    Image = None
    print(f"[A1rSpace] Warning: PIL not available: {e}")
    traceback.print_exc()

try:
    import torch
    import torch.amp.autocast_mode
except Exception as e:
    torch = None
    print(f"[A1rSpace] Warning: torch not available: {e}")
    traceback.print_exc()

try:
    import torchvision.transforms.functional as TVF
except Exception as e:
    TVF = None
    print(f"[A1rSpace] Warning: torchvision.transforms.functional not available: {e}")
    traceback.print_exc()

try:
    from huggingface_hub import snapshot_download
except Exception as e:
    snapshot_download = None
    print(f"[A1rSpace] Warning: huggingface_hub.snapshot_download not available: {e}")
    traceback.print_exc()

try:
    import numpy as np
except Exception as e:
    np = None
    print(f"[A1rSpace] Warning: numpy not available: {e}")
    traceback.print_exc()

try:
    import folder_paths
except Exception as e:
    folder_paths = None
    print(f"[A1rSpace] Warning: folder_paths import failed: {e}")
    traceback.print_exc()

def print_log(str_msg):
    str_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    print(f"[A1rSpace: ][{str_time}][{stack()[1][1]}, line: {stack()[1][2]}]: {str_msg}")

class JoyTag_TextBox:
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
                    {"default": 0.4, "min": 0.1, "max": 1, "step": 0.1},
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
    FUNCTION = "run"
    OUTPUT_NODE = False
    CATEGORY = "A1rSpace/Text"

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

JOYTAG_CLASS_MAPPINGS = {
    "A1r JoyTag TextBox": JoyTag_TextBox,
}

JOYTAG_DISPLAY_NAME_MAPPINGS = {
    "A1r JoyTag TextBox": "JoyTag Text Box",
}