# type: ignore
"""
Transform nodes - latent/image transformations and switches.

Complete set of transform, upscale, and switch nodes for ComfyUI_A1rSpace.
"""
from ..common.shared_utils import NumericConfig, UpscaleMethods
import torch
import folder_paths
import numpy as np
from PIL import Image
from PIL.PngImagePlugin import PngInfo
import json
import os

# Lazy load heavy dependencies
_comfy_utils = None
_comfy_model_management = None

def _get_comfy_utils():
    global _comfy_utils
    if _comfy_utils is None:
        import comfy.utils
        _comfy_utils = comfy.utils
    return _comfy_utils

def _get_comfy_model_management():
    global _comfy_model_management
    if _comfy_model_management is None:
        import comfy.model_management
        _comfy_model_management = comfy.model_management
    return _comfy_model_management

# ========== Transform Nodes ==========

class LatentEncodeTransform:
    """Switch between text-to-image (empty latent) and image-to-image (encoded pixels) modes."""
    
    def __init__(self):
        model_mgmt = _get_comfy_model_management()
        self.device = model_mgmt.intermediate_device()

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "width": ("INT", {"default": 1024, "min": 64, "max": 4096}),
                "height": ("INT", {"default": 1024, "min": 64, "max": 4096}),
                "batch_size": ("INT", NumericConfig.batch_size(),),
                "mode": (['text to image', 'image to image'], {"default": "text to image"}),
            },
            "optional": {
                "pixels": ("IMAGE",),
                "vae": ("VAE",),
            },
        }

    RETURN_TYPES = ("LATENT",)
    FUNCTION = "switch"
    CATEGORY = "A1rSpace/Transform"

    def switch(self, width, height, batch_size, mode, pixels=None, vae=None):
        if mode == 'text to image':
            latent = torch.zeros([batch_size, 4, height // 8, width // 8], device=self.device)
        else:
            if pixels is None or vae is None:
                raise ValueError("'pixels' and 'vae' required for image to image mode")
            latent = vae.encode(pixels[:, :, :, :3])
        return ({"samples": latent},)

class VAEDecodeTransform:
    """Unified VAE decoder with conditional decoding, tiled mode, and preview support."""
    
    def __init__(self):
        self.output_dir = folder_paths.get_temp_directory()
        self.type = "temp"
        self.compress_level = 4

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "decode": ("BOOLEAN", {"default": True}),
                "tiled": ("BOOLEAN", {"default": False}),
                "preview": ("BOOLEAN", {"default": False}),
                "samples": ("LATENT",),
                "vae": ("VAE",),
            },
            "optional": {
                "tile_size": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 32}),
                "overlap": ("INT", {"default": 64, "min": 0, "max": 4096, "step": 32}),
            },
            "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
        }

    RETURN_TYPES = ("IMAGE", "LATENT",)
    OUTPUT_NODE = True
    FUNCTION = "decode"
    CATEGORY = "A1rSpace/Transform"

    def decode(self, decode, tiled, preview, samples, vae, tile_size=512, overlap=64, prompt=None, extra_pnginfo=None):
        latent_output = samples
        
        if not decode:
            batch_size = samples["samples"].shape[0]
            return {"result": (torch.zeros((batch_size, 64, 64, 3)), latent_output)}
        
        if not tiled:
            images = vae.decode(samples["samples"])
        else:
            if tile_size < overlap * 4:
                overlap = tile_size // 4
            images = vae.decode_tiled(samples["samples"], tile_x=tile_size // 8, tile_y=tile_size // 8, overlap=overlap // 8)
        
        if preview:
            results = []
            for batch_number, img_tensor in enumerate(images):
                i = 255. * img_tensor.cpu().numpy()
                img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
                
                metadata = PngInfo() if (prompt or extra_pnginfo) else None
                if metadata:
                    if prompt:
                        metadata.add_text("prompt", json.dumps(prompt))
                    if extra_pnginfo:
                        for key in extra_pnginfo:
                            metadata.add_text(key, json.dumps(extra_pnginfo[key]))
                
                filename = f"vae_preview_{batch_number:05}.png"
                img.save(os.path.join(self.output_dir, filename), pnginfo=metadata, compress_level=self.compress_level)
                results.append({"filename": filename, "subfolder": "", "type": self.type})
            
            return {"ui": {"images": results}, "result": (images, latent_output)}
        
        return {"result": (images, latent_output)}

class ImageUpscaleTransform:
    """Upscale images using various interpolation methods."""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "mode": (['Scale with size', 'Scale by factor'], {"default": 'Scale with size'}),
                "upscale_method": (UpscaleMethods.IMAGE_METHODS, {"default": UpscaleMethods.DEFAULT}),
                "width": ("INT", NumericConfig.canvas_size(),),
                "height": ("INT", NumericConfig.canvas_size(),),
                "scale_by": ("FLOAT", NumericConfig.upscale_scaleby(),),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "upscale"
    CATEGORY = "A1rSpace/Transform"

    def upscale(self, image, mode, upscale_method, width, height, scale_by):
        comfy_utils = _get_comfy_utils()
        samples = image.movedim(-1, 1)
        
        if mode == 'Scale with size':
            if width == 0 and height == 0:
                result = samples
            else:
                if width == 0:
                    width = max(1, round(samples.shape[3] * height / samples.shape[2]))
                elif height == 0:
                    height = max(1, round(samples.shape[2] * width / samples.shape[3]))
                result = comfy_utils.common_upscale(samples, width, height, upscale_method, "center")
        else:
            new_width = round(samples.shape[3] * scale_by)
            new_height = round(samples.shape[2] * scale_by)
            result = comfy_utils.common_upscale(samples, new_width, new_height, upscale_method, "disabled")
            
        return (result.movedim(1, -1),)

class LatentUpscaleTransform:
    """Upscale latent samples."""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "samples": ("LATENT",),
                "mode": (['Scale with size', 'Scale by factor'], {"default": 'Scale by factor'}),
                "upscale_method": (UpscaleMethods.LATENT_METHODS, {"default": UpscaleMethods.DEFAULT}),
                "width": ("INT", NumericConfig.canvas_size(),),
                "height": ("INT", NumericConfig.canvas_size(),),
                "scale_by": ("FLOAT", NumericConfig.upscale_scaleby(),),
            }
        }
    
    RETURN_TYPES = ("LATENT",)
    FUNCTION = "upscale"
    CATEGORY = "A1rSpace/Transform"

    def upscale(self, samples, mode, upscale_method, width, height, scale_by):
        comfy_utils = _get_comfy_utils()
        s = samples.copy()

        if mode == 'Scale with size':
            if width == 0 and height == 0:
                return (s,)
            if width == 0:
                width = max(1, round(s["samples"].shape[-1] * height / s["samples"].shape[-2]))
            elif height == 0:
                height = max(1, round(s["samples"].shape[-2] * width / s["samples"].shape[-1]))
            s["samples"] = comfy_utils.common_upscale(s["samples"], width, height, upscale_method, "center")
        else:
            s_width = round(s["samples"].shape[-1] * scale_by)
            s_height = round(s["samples"].shape[-2] * scale_by)
            s["samples"] = comfy_utils.common_upscale(s["samples"], s_width, s_height, upscale_method, "disabled")
        return (s,)

# ========== Switch Nodes ==========

class CheckpointInputSwitch:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"model_a": ("MODEL",), "clip_a": ("CLIP",), "vae_a": ("VAE",), "Input": ("INT", {"default": 1, "min": 1, "max": 2})},
            "optional": {"model_b": ("MODEL",), "clip_b": ("CLIP",), "vae_b": ("VAE",)}
        }

    RETURN_TYPES = ("MODEL", "CLIP", "VAE",)
    FUNCTION = "switch"
    CATEGORY = "A1rSpace/Switch"

    def switch(self, model_a, clip_a, vae_a, model_b=None, clip_b=None, vae_b=None, Input=1):
        if Input == 2 and model_b and clip_b and vae_b:
            return (model_b, clip_b, vae_b,)
        return (model_a, clip_a, vae_a,)

class ModelInputSwitch:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"model_a": ("MODEL",), "Input": ("INT", {"default": 1, "min": 1, "max": 2})}, "optional": {"model_b": ("MODEL",)}}
    RETURN_TYPES = ("MODEL",)
    FUNCTION = "switch"
    CATEGORY = "A1rSpace/Switch"
    def switch(self, model_a, model_b=None, Input=1):
        return (model_b if Input == 2 and model_b else model_a,)

class CLIPInputSwitch:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"clip_a": ("CLIP",), "Input": ("INT", {"default": 1, "min": 1, "max": 2})}, "optional": {"clip_b": ("CLIP",)}}
    RETURN_TYPES = ("CLIP",)
    FUNCTION = "switch"
    CATEGORY = "A1rSpace/Switch"
    def switch(self, clip_a, clip_b=None, Input=1):
        return (clip_b if Input == 2 and clip_b else clip_a,)

class VAEInputSwitch:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"vae_a": ("VAE",), "Input": ("INT", {"default": 1, "min": 1, "max": 2})}, "optional": {"vae_b": ("VAE",)}}
    RETURN_TYPES = ("VAE",)
    FUNCTION = "switch"
    CATEGORY = "A1rSpace/Switch"
    def switch(self, vae_a, vae_b=None, Input=1):
        return (vae_b if Input == 2 and vae_b else vae_a,)

class ConditioningInputSwitch:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"positive_a": ("CONDITIONING",), "negative_a": ("CONDITIONING",), "Input": ("INT", {"default": 1, "min": 1, "max": 2})},
            "optional": {"positive_b": ("CONDITIONING",), "negative_b": ("CONDITIONING",)}
        }
    RETURN_TYPES = ("CONDITIONING", "CONDITIONING",)
    RETURN_NAMES = ("positive", "negative",)
    FUNCTION = "switch"
    CATEGORY = "A1rSpace/Switch"
    def switch(self, positive_a, negative_a, Input=1, positive_b=None, negative_b=None):
        if Input == 2:
            return (positive_b if positive_b else positive_a, negative_b if negative_b else negative_a)
        return (positive_a, negative_a)

class ImageInputSwitch:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"Input": ("INT", {"default": 1, "min": 1, "max": 4})},
            "optional": {"image_a": ("IMAGE",), "image_b": ("IMAGE",), "image_c": ("IMAGE",), "image_d": ("IMAGE",)}
        }
    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "switch"
    CATEGORY = "A1rSpace/Switch"
    def switch(self, Input=1, image_a=None, image_b=None, image_c=None, image_d=None):
        images = [image_a, image_b, image_c, image_d]
        idx = max(0, min(3, int(Input) - 1))
        for i in range(4):
            if images[(idx + i) % 4] is not None:
                return (images[(idx + i) % 4],)
        return (torch.zeros(1, 64, 64, 3),)

class TextInputSwitch:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"text_a": ("STRING", {"forceInput": True}), "Input": ("INT", {"default": 1, "min": 1, "max": 2})}, "optional": {"text_b": ("STRING", {"forceInput": True})}}
    RETURN_TYPES = ("STRING",)
    FUNCTION = "switch"
    CATEGORY = "A1rSpace/Switch"
    def switch(self, text_a, text_b=None, Input=1):
        return (text_b if Input == 2 and text_b and text_b.strip() else text_a,)

class IntInputSwitch:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"int_a": ("INT", {"forceInput": True}), "Input": ("INT", {"default": 1, "min": 1, "max": 2})}, "optional": {"int_b": ("INT", {"forceInput": True})}}
    RETURN_TYPES = ("INT",)
    FUNCTION = "switch"
    CATEGORY = "A1rSpace/Switch"
    def switch(self, int_a, int_b=None, Input=1):
        return (int_b if Input == 2 and int_b is not None else int_a,)

# Exported mappings
TRANSFORM_CLASS_MAPPINGS = {
    "A1r Latent Encode Transform": LatentEncodeTransform,
    "A1r VAE Decode Transform": VAEDecodeTransform,
    "A1r Image Upscale Transform": ImageUpscaleTransform,
    "A1r Latent Upscale Transform": LatentUpscaleTransform,
    "A1r Checkpoint Input Switch": CheckpointInputSwitch,
    "A1r Model Input Switch": ModelInputSwitch,
    "A1r CLIP Input Switch": CLIPInputSwitch,
    "A1r VAE Input Switch": VAEInputSwitch,
    "A1r Conditioning Input Switch": ConditioningInputSwitch,
    "A1r Image Input Switch": ImageInputSwitch,
    "A1r Text Input Switch": TextInputSwitch,
    "A1r Int Input Switch": IntInputSwitch,
}

TRANSFORM_DISPLAY_NAME_MAPPINGS = {
    "A1r Latent Encode Transform": "Latent Encode Transform",
    "A1r VAE Decode Transform": "VAE Decode Transform",
    "A1r Image Upscale Transform": "Image Upscale Transform",
    "A1r Latent Upscale Transform": "Latent Upscale Transform",
    "A1r Checkpoint Input Switch": "Checkpoint Input Switch",
    "A1r Model Input Switch": "Model Input Switch",
    "A1r CLIP Input Switch": "CLIP Input Switch",
    "A1r VAE Input Switch": "VAE Input Switch",
    "A1r Conditioning Input Switch": "Conditioning Input Switch",
    "A1r Image Input Switch": "Image Input Switch",
    "A1r Text Input Switch": "Text Input Switch",
    "A1r Int Input Switch": "Int Input Switch",
}
