"""
ControlNet loader node for ComfyUI A1rSpace extension.

This module provides a combined ControlNet loader and applier node.
"""

from ..common.model_loader import ModelLoaderBase
from ..common.shared_utils import ModelList, NumericConfig

class ControlNetLoader(ModelLoaderBase):
    """
    Load and apply ControlNet to conditioning.
    
    This node combines loader and apply functionality, automatically handling
    the ControlNet loading and application in a single step.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
                "image": ("IMAGE",),
                "control_net_name": (ModelList.controlnet_list(),),
                "strength": ("FLOAT", NumericConfig.cn_strength()),
                "start_percent": ("FLOAT", NumericConfig.cn_percent()),
                "end_percent": ("FLOAT", NumericConfig.cn_percent()),
            },
            "optional": {
                "vae": ("VAE",),
            }
        }

    RETURN_TYPES = ("CONDITIONING", "CONDITIONING")
    RETURN_NAMES = ("positive", "negative")
    FUNCTION = "apply_cn"

    CATEGORY = "A1rSpace/Loader"
    DESCRIPTION = "Load and apply ControlNet to conditioning. Combines loader and apply functionality."

    def apply_cn(self, positive, negative, image, control_net_name, strength, start_percent, end_percent, vae=None):
        # Early exit if strength is zero or no ControlNet selected
        if strength == 0:
            return (positive, negative)
        
        if control_net_name == "None":
            return (positive, negative)
        
        # Load ControlNet using base class method
        control_net = self.load_controlnet(control_net_name)
        if control_net is None:
            return (positive, negative)
        
        # Apply ControlNet using base class method
        return self.apply_controlnet(positive, negative, image, control_net, strength, start_percent, end_percent, vae)

# Exported mappings
CONTROLNET_LOADER_CLASS_MAPPINGS = {
    "A1r ControlNet Loader": ControlNetLoader,
}

CONTROLNET_LOADER_DISPLAY_NAME_MAPPINGS = {
    "A1r ControlNet Loader": "ControlNet Loader",
}
