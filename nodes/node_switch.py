# type: ignore
from .config import NumericConfig
import traceback
try:
    import torch
except Exception as e:
    torch = None
    print(f"[A1rSpace] Warning: torch not available in node_utils_switch: {e}")
    traceback.print_exc()

try:
    import comfy.model_management
except Exception as e:
    comfy = None
    print(f"[A1rSpace] Warning: comfy.model_management not available in node_utils_switch: {e}")
    traceback.print_exc()

"""input switch"""
class Image_InputSwitch:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image1": ("IMAGE",),
                "Input": ("INT", {"default": 1, "min": 1, "max": 4}),
            },
            "optional": {
                "image2": ("IMAGE",),
                "image3": ("IMAGE",),
                "image4": ("IMAGE",),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("IMAGE",)
    FUNCTION = "switch"
    CATEGORY = "A1rSpace/Utils/switch"
    DESCRIPTION = "Switch between 4 inputs, it will put 'image1' to output when the scend was null."

    def switch(self, Input, image1, image2=None, image3=None, image4=None):
        if Input == 1:
            return (image1,)
        elif Input == 2:
            if image2 is None:
                return (image1,)
            else:
                return (image2,)
        elif Input == 3:
            if image3 is None:
                if image2 is None:
                    return (image1,)
                else:
                    return (image2,)
            else:
                return (image3,)
        elif Input == 4:
            if image4 is None:
                if image3 is None:
                    if image2 is None:
                        return (image1,)
                    else:
                        return (image2,)
                else:
                    return (image3,)
            else:
                return (image4,)
        else:
            return (image1,)

class Text_InputSwitch:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "Input": ("INT", {"default": 1, "min": 1, "max": 2}),
                "text1": ("STRING", {"default": "A1rSpace"}),
            },
            "optional": {
                "text2": ("STRING", {"default": "A1rSpace"}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "switch"
    CATEGORY = "A1rSpace/Utils/switch"
    DESCRIPTION = "Switch between two text inputs, it will put 'text1' to output when the scend was null."

    def switch(self, Input, text1, text2=None):
        if Input == 2:
            if text2 is None or text2.strip() == "":
                return (text1,)
            else:
                return (text2,)
        else:
            return (text1,)

class Checkpoint_InputSwitch:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "Input": ("INT", {"default": 1, "min": 1, "max": 2}),
                "model1": ("MODEL",),
                "clip1": ("CLIP",),
                "vae1": ("VAE",),
            },
            "optional": {
                "model2": ("MODEL",),
                "clip2": ("CLIP",),
                "vae2": ("VAE",),
            }
        }

    RETURN_TYPES = ("MODEL", "CLIP", "VAE",)
    RETURN_NAMES = ("MODEL", "CLIP", "VAE",)
    FUNCTION = "switch"
    CATEGORY = "A1rSpace/Utils/switch"
    DESCRIPTION = "Switch between two inputs, it will put 'model1' to output when the scend was null."

    def switch(self, Input, vae1, clip1, model1, vae2=None, clip2=None, model2=None):
        if Input == 2:
            if model2 is None or clip2 is None or vae2 is None:
                return (model1, clip1, vae1,)
            else:
                return (model2, clip2, vae2,)
        else:
            return (model1, clip1, vae1,)

class Conditioning_InputSwitch:
    def __init__(self):
        pass
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "positive1": ("CONDITIONING",),
                "negative1": ("CONDITIONING",),
                "Input": ("INT", {"default": 1, "min": 1, "max": 2}),
            },
            "optional": {
                "positive2": ("CONDITIONING",),
                "negative2": ("CONDITIONING",),
            }
        }

    RETURN_TYPES = ("CONDITIONING", "CONDITIONING",)
    RETURN_NAMES = ("positive", "negative",)
    FUNCTION = "switch"
    CATEGORY = "A1rSpace/Utils/switch"
    DESCRIPTION = "Switch between two conditioning inputs, it will put 'cond1' to output when the second was null."

    def switch(self, Input, positive1, negative1, positive2=None, negative2=None):
        if Input == 2:
            if positive2 is None or negative2 is None:
                return (positive1, negative1,)
            else:
                return (positive2, negative2,)
        else:
            return (positive1, negative1,)

class Denoise_InputSwitch:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "a": ("FLOAT", NumericConfig.ks_denoise(),),
                "b": ("FLOAT", NumericConfig.ks_denoise(),),
                "Input": ("INT", {"default": 1, "min": 1, "max": 2}),
            }
        }

    RETURN_TYPES = ("FLOAT",)
    RETURN_NAMES = ("denoise",)
    FUNCTION = "switch"
    CATEGORY = "A1rSpace/Utils/switch"
    DESCRIPTION = "Switch between two denoise inputs, it will put 'a' to output when the scend was null."

    def switch(self, Input, a, b=None):
        if Input == 2:
            if b is None:
                return (a,)
            else:
                return (b,)
        else:
            return (a,)

class LatentEncode_InputSwitch:
    def __init__(self):
        self.device = comfy.model_management.intermediate_device()

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "width": ("INT", {"default": 1024, "min": 64, "max": 4096}),
                "height": ("INT", {"default": 1024, "min": 64, "max": 4096}),
                "batch_size": ("INT", NumericConfig.batch_size(),),
                "mode": ("INT", {"default": 1, "min": 1, "max": 2}),
            },
            "optional": {
                "pixels": ("IMAGE",),
                "vae": ("VAE",),
            },
        }

    RETURN_TYPES = ("LATENT",)
    FUNCTION = "execute"
    CATEGORY = "A1rSpace/Utils/switch"

    def execute(self, width, height, batch_size, mode, pixels=None, vae=None):
        if mode == 1:
            latent = torch.zeros([batch_size, 4, height // 8, width // 8], device=self.device)
        else:
            latent = vae.encode(pixels[:,:,:,:3])

        return ({"samples": latent}, mode)
        
"""output switch"""
class Image_OutputSwitch:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "Input": ("INT", {"default": 1, "min": 1, "max": 2}),
                "image": ("IMAGE",),
            }   
        }

    RETURN_TYPES = ("IMAGE", "IMAGE",)
    RETURN_NAMES = ("image_a", "image_b",)
    FUNCTION = "switch"
    CATEGORY = "A1rSpace/Utils/switch"
    DESCRIPTION = "Switch between two image outputs, 'image' will put a black image with 64x64 size when the scend was enable."

    def switch(self, Input, image):
        batch_size = image.shape[0]
        none_image = torch.zeros(batch_size, 64, 64, 3, dtype=image.dtype, device=image.device)

        if Input == 1:
            image_a_output = image
            image_b_output = none_image
        else:
            image_a_output = none_image
            image_b_output = image

        return (image_a_output, image_b_output)

SWITCH_CLASS_MAPPINGS = {
    # Input Class
    "A1r Image InputSwitch": Image_InputSwitch,
    "A1r Text InputSwitch": Text_InputSwitch,

    # Custom for KSampler
    "A1r Checkpoint InputSwitch": Checkpoint_InputSwitch,
    "A1r Conditioning InputSwitch": Conditioning_InputSwitch,
    "A1r Denoise InputSwitch": Denoise_InputSwitch,
    "A1r LatentEncode InputSwitch": LatentEncode_InputSwitch,

    # Output Class
    "A1r Image OutputSwitch": Image_OutputSwitch,
}

SWITCH_DISPLAY_NAME_MAPPINGS = {
    # Input Class
    "A1r Image InputSwitch": "Image Input Switch",
    "A1r Text InputSwitch": "Text Input Switch",

    # Custom for KSampler
    "A1r Checkpoint InputSwitch": "Checkpoint Input Switch",
    "A1r Conditioning InputSwitch": "Conditioning Input Switch",
    "A1r Denoise InputSwitch": "Denoise Input Switch",
    "A1r LatentEncode InputSwitch": "Latent Encode Switch",
    
    # Output Class
    "A1r Image OutputSwitch": "Image Output Switch",
}