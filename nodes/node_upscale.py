# type: ignore
from .config import NumericConfig, UpscaleMethods
import comfy.utils

class ImageUpscaleSwitch_Toggle:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "upscale_method": (UpscaleMethods.IMAGE_METHODS, {"default": UpscaleMethods.DEFAULT}),
                "mode": ("INT", {"default": 1, "min": 1, "max": 2, "step": 1, "tooltip": "1: Scale to width/height, 2: Scale by factor"}),
                "enable": ("BOOLEAN", {"default": True, "label_on": "Enabled", "label_off": "Disabled"}),
                "width": ("INT", {"default": 512, "min": 0, "max": 16384, "step": 1, "tooltip": "Target width (used in mode 1)"}),
                "height": ("INT", {"default": 512, "min": 0, "max": 16384, "step": 1, "tooltip": "Target height (used in mode 1)"}),
                "scale_by": ("FLOAT", {"default": 2.0, "min": 0.01, "max": 8.0, "step": 0.01, "tooltip": "Scale multiplier (used in mode 2)"}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "upscale"

    CATEGORY = "A1rSpace/Upscale"

    def upscale(self, image, upscale_method, mode, enable, width, height, scale_by):
        if not enable:
            return (image,)
        
        samples = image.movedim(-1, 1)
        
        if mode == 1:
            if width == 0 and height == 0:
                result = samples
            else:
                if width == 0:
                    width = max(1, round(samples.shape[3] * height / samples.shape[2]))
                elif height == 0:
                    height = max(1, round(samples.shape[2] * width / samples.shape[3]))
                    
                result = comfy.utils.common_upscale(samples, width, height, upscale_method, "disabled")
        else:
            new_width = round(samples.shape[3] * scale_by)
            new_height = round(samples.shape[2] * scale_by)
            result = comfy.utils.common_upscale(samples, new_width, new_height, upscale_method, "disabled")
            
        result_image = result.movedim(1, -1)
        
        return (result_image,)

class LatentUpscaleBy_Toggle:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "samples": ("LATENT",),
                "upscale_method": (UpscaleMethods.LATENT_METHODS, {"default": UpscaleMethods.DEFAULT}),
                "scale_by": ("FLOAT", NumericConfig.upscale_scaleby(),),
                "enable": ("BOOLEAN", {"default": True, "label_on": "Enabled", "label_off": "Disabled"}),
            }
        }
    
    RETURN_TYPES = ("LATENT",)
    FUNCTION = "upscale"

    CATEGORY = "A1rSpace/Upscale"

    def upscale(self, samples, upscale_method, scale_by, enable):
        if not enable:
            return (samples,)
        
        s = samples.copy()
        width = round(samples["samples"].shape[-1] * scale_by)
        height = round(samples["samples"].shape[-2] * scale_by)
        s["samples"] = comfy.utils.common_upscale(samples["samples"], width, height, upscale_method, "disabled")
        return (s,)

UPSCALE_CLASS_MAPPINGS = {
    "A1r ImageUpscaleSwitch Toggle": ImageUpscaleSwitch_Toggle,
    "A1r LatentUpscaleBy Toggle": LatentUpscaleBy_Toggle,
}

UPSCALE_DISPLAY_NAME_MAPPINGS = {
    "A1r ImageUpscaleSwitch Toggle": "Image Upscale Switch (Toggled)",
    "A1r LatentUpscaleBy Toggle": "Latent UpscaleBy (Toggled)",
}