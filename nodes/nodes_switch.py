# type: ignore
"""
Switch nodes for ComfyUI A1rSpace extension.

This module provides various switch and transform nodes for controlling
workflow logic, transforming latents/images, and routing data between nodes.
"""
from .config import NumericConfig, UpscaleMethods
import torch
import comfy.utils
import comfy.model_management
import folder_paths
import numpy as np
from PIL import Image
from PIL.PngImagePlugin import PngInfo
import json
import os

class LatentEncodeTransform:
    """
    Switch between text-to-image (empty latent) and image-to-image (encoded pixels) modes.
    """
    
    def __init__(self):
        self.device = comfy.model_management.intermediate_device()

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
    RETURN_NAMES = ("LATENT",)
    FUNCTION = "switch"

    CATEGORY = "A1rSpace/Switch"
    DESCRIPTION = "Switch between 'text to image' and 'image to image' latent encoding."

    def switch(self, width, height, batch_size, mode, pixels=None, vae=None):
        if mode == 'text to image':
            latent = torch.zeros([batch_size, 4, height // 8, width // 8], device=self.device)
        else:
            if pixels is None:
                raise ValueError("'pixels' is required when mode is 'image to image'")
            if vae is None:
                raise ValueError("'vae' is required when mode is 'image to image'")

            latent = vae.encode(pixels[:, :, :, :3])

        return ({"samples": latent},)

class VAEDecodeTransform:
    """
    Unified VAE decoder with conditional decoding, tiled mode, and preview support.
    Decode must be enabled for tiled or preview modes to work.
    """
    
    def __init__(self):
        self.output_dir = folder_paths.get_temp_directory()
        self.type = "temp"
        self.prefix_append = ""
        self.compress_level = 4

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "decode": ("BOOLEAN", {"default": True, "label_on": "On", "label_off": "Off", "tooltip": "Enable decoding (required for tiled/preview)"}),
                "tiled": ("BOOLEAN", {"default": False, "label_on": "On", "label_off": "Off", "tooltip": "Enable tiled decoding for large images"}),
                "preview": ("BOOLEAN", {"default": False, "label_on": "On", "label_off": "Off", "tooltip": "Enable preview image functionality"}),
                "samples": ("LATENT",),
                "vae": ("VAE",),
            },
            "optional": {
                # Tiled 模式参数
                "tile_size": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 32, "tooltip": "Tile size for decoding (Tiled mode only)"}),
                "overlap": ("INT", {"default": 64, "min": 0, "max": 4096, "step": 32, "tooltip": "Overlap between tiles (Tiled mode only)"}),
                "temporal_size": ("INT", {"default": 64, "min": 8, "max": 4096, "step": 4, "tooltip": "Amount of frames to decode at a time (video VAEs only, Tiled mode only)"}),
                "temporal_overlap": ("INT", {"default": 8, "min": 4, "max": 4096, "step": 4, "tooltip": "Amount of frames to overlap (video VAEs only, Tiled mode only)"}),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO"
            },
        }

    RETURN_TYPES = ("IMAGE", "LATENT",)
    RETURN_NAMES = ("image", "latent",)
    OUTPUT_NODE = True
    FUNCTION = "decode"

    CATEGORY = "A1rSpace/Switch"
    DESCRIPTION = "Unified VAE decoder with Standard and Tiled decoding modes, preview support, and conditional decoding."

    def decode(self, decode, tiled, preview, samples, vae, tile_size=512, overlap=64, temporal_size=64, temporal_overlap=8, prompt=None, extra_pnginfo=None):
        """
        Decode latent samples to images with optional tiling and preview.
        
        Args:
            decode: Whether to perform decoding (if False, returns empty image)
            tiled: Whether to use tiled decoding for large images
            preview: Whether to save preview images to temp directory
            samples: Input latent samples
            vae: VAE model for decoding
            tile_size: Tile size for tiled decoding
            overlap: Overlap between tiles
            temporal_size: Temporal tile size for video VAEs
            temporal_overlap: Temporal overlap for video VAEs
            prompt: Optional prompt metadata
            extra_pnginfo: Optional extra PNG metadata
        
        Returns:
            Tuple of (decoded images, latent samples)
        """
        # Always output latent
        latent_output = samples
        
        # Check if decoding is enabled
        if not decode:
            # Return empty image if decode is disabled
            batch_size = samples["samples"].shape[0]
            empty_image = torch.zeros((batch_size, 64, 64, 3))
            return {"result": (empty_image, latent_output)}
        
        # Perform decoding based on mode
        if not tiled:
            # Standard decoding mode
            images = vae.decode(samples["samples"])
        else:
            # Tiled decoding mode
            # Validate and adjust parameters
            if tile_size < overlap * 4:
                overlap = tile_size // 4
            if temporal_size < temporal_overlap * 2:
                temporal_overlap = temporal_overlap // 2

            # Handle temporal compression for video VAEs
            temporal_compression = vae.temporal_compression_decode()
            if temporal_compression is not None:
                temporal_size = max(2, temporal_size // temporal_compression)
                temporal_overlap = max(1, min(temporal_size // 2, temporal_overlap // temporal_compression))
            else:
                temporal_size = None
                temporal_overlap = None
            
            # Perform tiled decoding with spatial compression
            compression = vae.spacial_compression_decode()
            images = vae.decode_tiled(
                samples["samples"],
                tile_x=tile_size // compression,
                tile_y=tile_size // compression,
                overlap=overlap // compression,
                tile_t=temporal_size,
                overlap_t=temporal_overlap
            )
        
        # Merge batches if 5D tensor
        if len(images.shape) == 5:
            images = images.reshape(-1, images.shape[-3], images.shape[-2], images.shape[-1])
        
        # Preview functionality
        results = []
        if preview:
            # Save preview images
            filename_prefix = "VAEDecode_preview"
            full_output_folder, filename, counter, subfolder, _ = folder_paths.get_save_image_path(
                filename_prefix, self.output_dir, images[0].shape[1], images[0].shape[0]
            )
            
            for batch_number, image in enumerate(images):
                # Convert image format (tensor -> numpy -> PIL)
                i = 255. * image.cpu().numpy()
                img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
                
                # Prepare metadata
                metadata = None
                if prompt is not None:
                    metadata = PngInfo()
                    metadata.add_text("prompt", json.dumps(prompt))
                    if extra_pnginfo is not None:
                        for x in extra_pnginfo:
                            metadata.add_text(x, json.dumps(extra_pnginfo[x]))
                
                # Build filename
                file = f"{filename}_{counter:05d}_.png"
                img.save(os.path.join(full_output_folder, file), pnginfo=metadata, compress_level=self.compress_level)
                
                results.append({
                    "filename": file,
                    "subfolder": subfolder,
                    "type": self.type
                })
                counter += 1
        
        # Return results
        output = {
            "result": (images, latent_output),
        }
        
        if preview and results:
            output["ui"] = {"images": results}
        
        return output

class ImageUpscaleTransform:
    """
    Upscale images using various interpolation methods with size or factor modes.
    """
    
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

    CATEGORY = "A1rSpace/Switch"
    DESCRIPTION = "Upscale images by specifying target size or scale factor with various interpolation methods."

    def upscale(self, image, mode, upscale_method, width, height, scale_by):
        samples = image.movedim(-1, 1)
        
        if mode == 'Scale with size':
            if width == 0 and height == 0:
                result = samples
            else:
                if width == 0:
                    width = max(1, round(samples.shape[3] * height / samples.shape[2]))
                elif height == 0:
                    height = max(1, round(samples.shape[2] * width / samples.shape[3]))
                    
                result = comfy.utils.common_upscale(samples, width, height, upscale_method, "center")
        else: # Scale by
            new_width = round(samples.shape[3] * scale_by)
            new_height = round(samples.shape[2] * scale_by)
            result = comfy.utils.common_upscale(samples, new_width, new_height, upscale_method, "disabled")
            
        result_image = result.movedim(1, -1)
        
        return (result_image,)

class LatentUpscaleTransform:
    """
    Upscale latent samples using various interpolation methods with size or factor modes.
    """
    
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

    CATEGORY = "A1rSpace/Switch"
    DESCRIPTION = "Upscale latent samples by specifying target size or scale factor with various interpolation methods."

    def upscale(self, samples, mode, upscale_method, width, height, scale_by):
        s = samples.copy()

        if mode == 'Scale with size':
            if width == 0 and height == 0:
                return (s,)
            if width == 0:
                width = max(1, round(s["samples"].shape[-1] * height / s["samples"].shape[-2]))
            elif height == 0:
                height = max(1, round(s["samples"].shape[-2] * width / s["samples"].shape[-1]))
            
            s["samples"] = comfy.utils.common_upscale(s["samples"], width, height, upscale_method, "center")
        else:
            s_width = round(s["samples"].shape[-1] * scale_by)
            s_height = round(s["samples"].shape[-2] * scale_by)
            s["samples"] = comfy.utils.common_upscale(s["samples"], s_width, s_height, upscale_method, "disabled")
        return (s,)

class CheckpointInputSwitch:
    """
    Switch between two checkpoint inputs (model, CLIP, VAE) based on Input parameter.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model_a": ("MODEL",),
                "clip_a": ("CLIP",),
                "vae_a": ("VAE",),
                "Input": ("INT", {"default": 1, "min": 1, "max": 2}),
            },
            "optional": {
                "model_b": ("MODEL",),
                "clip_b": ("CLIP",),
                "vae_b": ("VAE",),
            }
        }

    RETURN_TYPES = ("MODEL", "CLIP", "VAE",)
    FUNCTION = "switch"

    CATEGORY = "A1rSpace/Switch"
    DESCRIPTION = "Switch between two inputs, it will put 'model_a' to output when the second was null."

    def switch(self, model_a, clip_a, vae_a, model_b=None, clip_b=None, vae_b=None, Input=1):
        if Input == 2:
            if model_b is None or clip_b is None or vae_b is None:
                return (model_a, clip_a, vae_a,)
            else:
                return (model_b, clip_b, vae_b,)
        else:
            return (model_a, clip_a, vae_a,)

class ModelInputSwitch:
    """
    Switch between two model inputs based on Input parameter.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model_a": ("MODEL",),
                "Input": ("INT", {"default": 1, "min": 1, "max": 2}),
            },
            "optional": {
                "model_b": ("MODEL",),
            }
        }

    RETURN_TYPES = ("MODEL",)
    FUNCTION = "switch"

    CATEGORY = "A1rSpace/Switch"
    DESCRIPTION = "Switch between two model inputs, it will put 'model_a' to output when the second was null."

    def switch(self, model_a, model_b=None, Input=1):
        if Input == 2:
            return (model_b if model_b is not None else model_a,)
        else:
            return (model_a,)

class CLIPInputSwitch:
    """
    Switch between two CLIP inputs based on Input parameter.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "clip_a": ("CLIP",),
                "Input": ("INT", {"default": 1, "min": 1, "max": 2}),
            },
            "optional": {
                "clip_b": ("CLIP",),
            }
        }

    RETURN_TYPES = ("CLIP",)
    FUNCTION = "switch"

    CATEGORY = "A1rSpace/Switch"
    DESCRIPTION = "Switch between two inputs, it will put 'clip_a' to output when the second was null."

    def switch(self, clip_a, clip_b=None, Input=1):
        if Input == 2:
            return (clip_b if clip_b is not None else clip_a,)
        else:
            return (clip_a,)

class VAEInputSwitch:
    """
    Switch between two VAE inputs based on Input parameter.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "vae_a": ("VAE",),
                "Input": ("INT", {"default": 1, "min": 1, "max": 2}),
            },
            "optional": {
                "vae_b": ("VAE",),
            }
        }
    
    RETURN_TYPES = ("VAE",)
    FUNCTION = "switch"

    CATEGORY = "A1rSpace/Switch"
    DESCRIPTION = "Switch between two VAE inputs, it will put 'vae_a' to output when the second was null."

    def switch(self, vae_a, vae_b=None, Input=1):
        if Input == 2:
            return (vae_b if vae_b is not None else vae_a,)
        else:
            return (vae_a,)

class ConditioningInputSwitch:
    """
    Switch between two conditioning input pairs (positive/negative) based on Input parameter.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "positive_a": ("CONDITIONING",),
                "negative_a": ("CONDITIONING",),
                "Input": ("INT", {"default": 1, "min": 1, "max": 2}),
            },
            "optional": {
                "positive_b": ("CONDITIONING",),
                "negative_b": ("CONDITIONING",),
            }
        }

    RETURN_TYPES = ("CONDITIONING", "CONDITIONING",)
    RETURN_NAMES = ("positive", "negative",)
    FUNCTION = "switch"

    CATEGORY = "A1rSpace/Switch"
    DESCRIPTION = "Switch between two conditioning inputs, it will put 'conditioning_a' to output when the second was null."

    def switch(self, positive_a, negative_a, Input=1, positive_b=None, negative_b=None):
        if Input == 2:
            return (
                positive_b if positive_b is not None else positive_a,
                negative_b if negative_b is not None else negative_a,
            )
        else:
            return (positive_a, negative_a)

class ImageInputSwitch:
    """
    Switch between up to four image inputs with fallback logic.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image_a": ("IMAGE",),
                "Input": ("INT", {"default": 1, "min": 1, "max": 4}),
            },
            "optional": {
                "image_b": ("IMAGE",),
                "image_c": ("IMAGE",),
                "image_d": ("IMAGE",),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "switch"

    CATEGORY = "A1rSpace/Switch"
    DESCRIPTION = "Switch between up to four image inputs; if an input is missing it falls back to the highest-priority available input."

    def switch(self, image_a, image_b=None, image_c=None, image_d=None, Input=1):
        if Input == 1:
            return (image_a,)
        elif Input == 2:
            return (image_b,)
        elif Input == 3:
            if image_c is not None:
                return (image_c,)
            if image_b is not None:
                return (image_b,)
            return (image_a,)
        elif Input == 4:
            if image_d is not None:
                return (image_d,)
            if image_c is not None:
                return (image_c,)
            if image_b is not None:
                return (image_b,)
            return (image_a,)
        else:
            return (image_a,)

class TextInputSwitch:
    """
    Switch between two text inputs with empty string fallback.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text_a": ("STRING", {"forceInput": True}),
                "Input": ("INT", {"default": 1, "min": 1, "max": 2}),
            },
            "optional": {
                "text_b": ("STRING", {"forceInput": True}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "switch"

    CATEGORY = "A1rSpace/Switch"
    DESCRIPTION = "Switch between two text inputs; if the second is empty it outputs 'text1'."

    def switch(self, text_a, text_b=None, Input=1):
        if Input == 2:
            return (text_b if text_b is not None and text_b.strip() != "" else text_a,)
        else:
            return (text_a,)

class IntInputSwitch:
    """
    Switch between two integer inputs based on Input parameter.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "a": ("INT", NumericConfig.default_int(),),
                "b": ("INT", NumericConfig.default_int(),),
                "Input": ("INT", {"default": 1, "min": 1, "max": 2}),
            }
        }

    RETURN_TYPES = ("INT",)
    FUNCTION = "switch"

    CATEGORY = "A1rSpace/Switch"
    DESCRIPTION = "Switch between two integer inputs."

    def switch(self, a, b=None, Input=1):
        # INPUT_TYPES: a, b, Input
        if Input == 2:
            return (b if b is not None else a,)
        else:
            return (a,)

class FloatInputSwitch:
    """
    Switch between two float inputs based on Input parameter.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "a": ("FLOAT", NumericConfig.default_float(),),
                "b": ("FLOAT", NumericConfig.default_float(),),
                "Input": ("INT", {"default": 1, "min": 1, "max": 2}),
            }
        }

    RETURN_TYPES = ("FLOAT",)
    FUNCTION = "switch"

    CATEGORY = "A1rSpace/Switch"
    DESCRIPTION = "Switch between two float inputs."

    def switch(self, a, b=None, Input=1):
        # Align parameter order to INPUT_TYPES: a, b, Input
        if Input == 2:
            return (b if b is not None else a,)
        else:
            return (a,)

class ImageOutputSwitch:
    """
    Route a single image to one of two outputs, with placeholder for unused output.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "Input": ("INT", {"default": 1, "min": 1, "max": 2}),
            }   
        }

    RETURN_TYPES = ("IMAGE", "IMAGE",)
    RETURN_NAMES = ("image_a", "image_b",)
    FUNCTION = "switch"

    CATEGORY = "A1rSpace/Switch"
    DESCRIPTION = "Route a single image input to one of two outputs based on Input parameter; the unused output receives a placeholder image."

    def switch(self, image, Input=1):
        batch_size = image.shape[0]
        none_image = torch.zeros(batch_size, 64, 64, 3, dtype=image.dtype, device=image.device)

        if Input == 1:
            image_a_output = image
            image_b_output = none_image
        else:
            image_a_output = none_image
            image_b_output = image

        return (image_a_output, image_b_output)

class ImageMaskOutputSwitch:
    """
    Route image and mask to one of two output pairs, with placeholders for unused outputs.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "mask": ("MASK",),
                "Input": ("INT", {"default": 1, "min": 1, "max": 2}),
            }   
        }

    RETURN_TYPES = ("IMAGE", "IMAGE", "MASK", "MASK",)
    RETURN_NAMES = ("image_a", "image_b", "mask_a", "mask_b",)
    FUNCTION = "switch"

    CATEGORY = "A1rSpace/Switch"
    DESCRIPTION = "Route image and mask inputs to one of two output pairs based on Input parameter; unused outputs receive placeholders."

    def switch(self, image, mask, Input=1):
        batch_size = image.shape[0]
        none_image = torch.zeros(batch_size, 64, 64, 3, dtype=image.dtype, device=image.device)
        none_mask = torch.zeros(batch_size, 64, 64, 1, dtype=mask.dtype, device=mask.device)
        # Ensure mask has expected channel dimension
        if mask.ndim == 3:
            # mask likely shape [B,H,W] -> add channel dim
            mask = mask.unsqueeze(-1)

        if Input == 1:
            image_a_output = image
            image_b_output = none_image
            mask_a_output = mask
            mask_b_output = none_mask
        else:
            # Input == 2: swap outputs
            image_a_output = none_image
            image_b_output = image
            mask_a_output = none_mask
            mask_b_output = mask

        return (image_a_output, image_b_output, mask_a_output, mask_b_output)

SWITCH_CLASS_MAPPINGS = {
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
    "A1r Float Input Switch": FloatInputSwitch,
    "A1r Image Output Switch": ImageOutputSwitch,
    "A1r Image Mask Output Switch": ImageMaskOutputSwitch,
}

SWITCH_DISPLAY_NAME_MAPPINGS = {
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
    "A1r Float Input Switch": "Float Input Switch",
    "A1r Image Output Switch": "Image Output Switch",
    "A1r Image Mask Output Switch": "Image & Mask Output Switch",
}