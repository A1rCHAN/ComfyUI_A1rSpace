"""
Checkpoint loader nodes for ComfyUI A1rSpace extension.

This module provides checkpoint loading nodes with VAE override support,
dual-model workflows, and separate loading modes.
"""

from ..common.model_loader import ModelLoaderBase
from ..common.shared_utils import ModelList

class CheckpointLoaderVAE(ModelLoaderBase):
    """
    Load checkpoint with optional custom VAE override.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "ckpt_name": (ModelList.ckpt_list(),),
                "vae_name": (ModelList.vae_list(), {"default": "None"}),
            }
        }
    
    RETURN_TYPES = ("MODEL", "CLIP", "VAE")
    FUNCTION = "load_model"

    CATEGORY = "A1rSpace/Loader"
    DESCRIPTION = "Load checkpoint with optional custom VAE override."

    def load_model(self, ckpt_name, vae_name):
        model, clip, ckpt_vae = self.load_checkpoint(ckpt_name)

        custom_vae = self.load_vae(vae_name)
        vae = custom_vae if custom_vae is not None else ckpt_vae

        return (model, clip, vae)

class DoubleCheckpointLoaderVAE(ModelLoaderBase):
    """
    Load two checkpoints simultaneously with optional second checkpoint enable/disable.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "ckpt_name_a": (ModelList.ckpt_list(),),
                "ckpt_name_b": (ModelList.ckpt_list(),),
                "vae_name": (ModelList.vae_list(), {"default": "None"}),
                "enable_second": ("BOOLEAN", {"default": False,}),
            }
        }
    
    RETURN_TYPES = ("MODEL", "CLIP", "VAE", "MODEL", "CLIP", "VAE", "STRING")
    RETURN_NAMES = ("MODEL_A", "CLIP_A", "VAE_A", "MODEL_B", "CLIP_B", "VAE_B", "ckpt_name")
    FUNCTION = "load_model"
    
    CATEGORY = "A1rSpace/Loader"
    DESCRIPTION = "Load two checkpoints simultaneously with optional second checkpoint enable/disable."

    def load_model(self, ckpt_name_a, ckpt_name_b, vae_name, enable_second):
        model_a, clip_a, ckpt_vae_a = self.load_checkpoint(ckpt_name_a)
        model_b, clip_b, ckpt_vae_b = None, None, None

        if enable_second:
            model_b, clip_b, ckpt_vae_b = self.load_checkpoint(ckpt_name_b)
        else:
            model_b = model_a
            clip_b = clip_a
            ckpt_vae_b = ckpt_vae_a

        custom_vae = self.load_vae(vae_name)
        if custom_vae is not None:
            ckpt_vae_a = custom_vae
            if enable_second:
                ckpt_vae_b = custom_vae
        
        ckpt_name = ckpt_name_b if enable_second else ckpt_name_a

        return (model_a, clip_a, ckpt_vae_a, model_b, clip_b, ckpt_vae_b, ckpt_name)

class SeparateCheckpointLoaderVAE(ModelLoaderBase):
    """
    Switch between two checkpoints based on separate_mode boolean.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "ckpt_name_a": (ModelList.ckpt_list(),),
                "ckpt_name_b": (ModelList.ckpt_list(),),
                "vae_name": (ModelList.vae_list(), {"default": "None"}),
                "separate_mode": ("BOOLEAN", {"default": False, "label_on": "Model B", "label_off": "Model A"}),
            }
        }
    
    RETURN_TYPES = ("MODEL", "CLIP", "VAE")
    FUNCTION = "load_ckpt"

    CATEGORY = "A1rSpace/Loader"
    DESCRIPTION = "Switch between two checkpoints based on separate_mode boolean."

    def load_ckpt(self, ckpt_name_a, ckpt_name_b, vae_name, separate_mode,):
        ckpt_name = ckpt_name_b if separate_mode else ckpt_name_a
        model, clip, ckpt_vae = self.load_checkpoint(ckpt_name)

        custom_vae = self.load_vae(vae_name)
        vae = custom_vae if custom_vae is not None else ckpt_vae
        
        return (model, clip, vae)

# Exported mappings
CHECKPOINT_LOADER_CLASS_MAPPINGS = {
    "A1r Checkpoint Loader": CheckpointLoaderVAE,
    "A1r Double CheckpointLoader": DoubleCheckpointLoaderVAE,
    "A1r Separate CheckpointLoader": SeparateCheckpointLoaderVAE,
}

CHECKPOINT_LOADER_DISPLAY_NAME_MAPPINGS = {
    "A1r Checkpoint Loader": "Checkpoint Loader",
    "A1r Double CheckpointLoader": "Double Checkpoint Loader",
    "A1r Separate CheckpointLoader": "Separate Checkpoint Loader",
}
