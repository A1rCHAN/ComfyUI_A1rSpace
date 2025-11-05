# type: ignore
"""
Model loader nodes for ComfyUI A1rSpace extension.

This module provides various checkpoint, LoRA, and ControlNet loader nodes
with support for dual-model workflows, stacking, and separate loading modes.
"""
from .config import ModelList, NumericConfig
from .models import ModelLoaderBase
import folder_paths

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
        inputs = {
            "required": {
                "ckpt_name_a": (ModelList.ckpt_list(),),
                "ckpt_name_b": (ModelList.ckpt_list(),),
                "vae_name": (ModelList.vae_list(), {"default": "None"}),
                "enable_second": ("BOOLEAN", {"default": False,}),
            }
        }
        return inputs
    
    RETURN_TYPES = ("MODEL", "CLIP", "VAE", "MODEL", "CLIP", "VAE",)
    RETURN_NAMES = ("MODEL_A", "CLIP_A", "VAE_A", "MODEL_B", "CLIP_B", "VAE_B",)
    FUNCTION = "load_model"
    
    CATEGORY = "A1rSpace/Loader"
    DESCRIPTION = "Load two checkpoints simultaneously with optional second checkpoint enable/disable."

    def load_model(self, ckpt_name_a, ckpt_name_b, vae_name, enable_second):
        model_a, clip_a, ckpt_vae_a = self.load_checkpoint(ckpt_name_a)
        model_b, clip_b, ckpt_vae_b = None, None, None

        if enable_second:
            model_b, clip_b, ckpt_vae_b = self.load_checkpoint(ckpt_name_b)

        custom_vae = self.load_vae(vae_name)
        if custom_vae is not None:
            ckpt_vae_a = custom_vae
            if enable_second:
                ckpt_vae_b = custom_vae

        control = 2 if enable_second else 1
        return (model_a, clip_a, ckpt_vae_a, model_b, clip_b, ckpt_vae_b, control)

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

class SixLoRALoader(ModelLoaderBase):
    """
    Load up to six LoRAs with individual enable/disable switches and strength controls.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        inputs = {
            "required": {
                "model": ("MODEL",),
                "clip": ("CLIP",),
            }
        }

        inputs.setdefault("optional", {})
        inputs["optional"].update({
            "lora_stack": ("LORASTACK",),
        })

        for i in range(1, 7):
            inputs["required"].update({
                f"enable_lora_{i}": ("BOOLEAN", {"default": False}),
                f"lora_name_{i}": (ModelList.lora_list(),),
                f"model_strength_{i}": ("FLOAT", NumericConfig.lora_strength_large(),),
                f"clip_strength_{i}": ("FLOAT", NumericConfig.lora_strength_large(),),
            })
        
        return inputs

    RETURN_TYPES = ("MODEL", "CLIP",)
    FUNCTION = "load_lora"

    CATEGORY = "A1rSpace/Loader"
    DESCRIPTION = "Load up to six LoRAs with individual enable/disable switches and strength controls."

    def load_lora(self, model, clip, **kwargs):
        current_model = model
        current_clip = clip
        
        lora_stack = kwargs.get("lora_stack")
        if lora_stack:
            current_model, current_clip = self.apply_lora_stack(
                current_model, current_clip, lora_stack
            )
            return (current_model, current_clip,)

        for i in range(1, 7):
            enable = kwargs.get(f"enable_lora_{i}")
            if not enable:
                continue

            lora_name = kwargs.get(f"lora_name_{i}")
            model_strength = kwargs.get(f"model_strength_{i}")
            clip_strength = kwargs.get(f"clip_strength_{i}")

            current_model, current_clip = self.apply_lora_single(
                current_model, current_clip, lora_name, model_strength, clip_strength
            )

        return (current_model, current_clip)

class SixLoRALoader2P(ModelLoaderBase):
    """
    Load up to six LoRAs and output to two separate model/clip pairs with source selection.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        inputs = {
            "required": {
                "model_a": ("MODEL",),
                "clip_a": ("CLIP",),
                "model_b": ("MODEL",),
                "clip_b": ("CLIP",),
            }
        }

        inputs.setdefault("optional", {})
        inputs["optional"].update({
            "lora_stack": ("LORASTACK",),
        })

        for i in range(1, 7):
            inputs["required"].update({
                f"enable_lora_{i}": ("BOOLEAN", {"default": False}),
                f"lora_name_{i}": (ModelList.lora_list(),),
                f"model_strength_{i}": ("FLOAT", NumericConfig.lora_strength_large(),),
                f"clip_strength_{i}": ("FLOAT", NumericConfig.lora_strength_large(),),
            })

        inputs["required"].update({
            "output1_source": ("INT", {"default": 1, "min": 1, "max": 2}),
            "output2_source": ("INT", {"default": 1, "min": 1, "max": 2}),
        })

        return inputs

    RETURN_TYPES = ("MODEL", "CLIP", "MODEL", "CLIP")
    RETURN_NAMES = ("MODEL_A", "CLIP_A", "MODEL_B", "CLIP_B")
    FUNCTION = "load_lora_2p"

    CATEGORY = "A1rSpace/Loader"
    DESCRIPTION = "Load up to six LoRAs and output to two separate model/clip pairs with source selection."

    def load_lora_2p(self, model_a, clip_a, model_b, clip_b, **kwargs):
        output1_source = kwargs.pop("output1_source", 1)
        output2_source = kwargs.pop("output2_source", 1)

        base1_model = model_a if output1_source == 1 else model_b
        base1_clip = clip_a if output1_source == 1 else clip_b

        base2_model = model_a if output2_source == 1 else model_b
        base2_clip = clip_a if output2_source == 1 else clip_b

        lora_stack = kwargs.get("lora_stack")

        if lora_stack:
            out1_model, out1_clip = self.apply_lora_stack(
                base1_model, base1_clip, lora_stack
            )

            if output1_source == output2_source:
                out2_model, out2_clip = out1_model, out1_clip
            else:
                out2_model, out2_clip = self.apply_lora_stack(
                    base2_model, base2_clip, lora_stack
                )

        else:
            out1_model, out1_clip = self._apply_loras(
                base1_model, base1_clip, kwargs
                )

            if output1_source == output2_source:
                out2_model, out2_clip = out1_model, out1_clip
            else:
                out2_model, out2_clip = self._apply_loras(
                    base2_model, base2_clip, kwargs
                )

        return (out1_model, out1_clip, out2_model, out2_clip)
    
    def _apply_loras(self, model, clip, kwargs):
        current_model = model
        current_clip = clip

        for i in range(1, 7):
            enable = kwargs.get(f"enable_lora_{i}")
            if not enable:
                continue

            lora_name = kwargs.get(f"lora_name_{i}")
            model_strength = kwargs.get(f"model_strength_{i}")
            clip_strength = kwargs.get(f"clip_strength_{i}")

            current_model, current_clip = self.apply_lora_single(
                current_model, current_clip, lora_name, model_strength, clip_strength
            )

        return (current_model, current_clip)

class SixLoRALoaderSeparate(ModelLoaderBase):
    """
    Load up to six LoRAs with boolean switch to choose between two base models.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        inputs = {
            "required": {
                "model_a": ("MODEL",),
                "clip_a": ("CLIP",),
                "model_b": ("MODEL",),
                "clip_b": ("CLIP",),
                "separate_mode": ("BOOLEAN", {"default": False, "label_on": "Model B", "label_off": "Model A"}),
            }
        }

        inputs.setdefault("optional", {})
        inputs["optional"].update({
            "lora_stack": ("LORASTACK",),
        })

        for i in range(1, 7):
            inputs["required"].update({
                f"enable_lora_{i}": ("BOOLEAN", {"default": False}),
                f"lora_name_{i}": (ModelList.lora_list(),),
                f"model_strength_{i}": ("FLOAT", NumericConfig.lora_strength_large(),),
                f"clip_strength_{i}": ("FLOAT", NumericConfig.lora_strength_large(),),
            })
        
        return inputs
    
    RETURN_TYPES = ("MODEL", "CLIP")
    FUNCTION = "load_lora_separate"
    
    CATEGORY = "A1rSpace/Loader"
    DESCRIPTION = "Load up to six LoRAs with boolean switch to choose between two base models."

    def load_lora_separate(self, model_a, clip_a, model_b, clip_b, separate_mode, **kwargs):
        base_model = model_b if separate_mode else model_a
        base_clip = clip_b if separate_mode else clip_a

        lora_stack = kwargs.get("lora_stack")
        if lora_stack:
            return self.apply_lora_stack(base_model, base_clip, lora_stack)
        
        current_model = base_model
        current_clip = base_clip

        for i in range(1, 7):
            enable = kwargs.get(f"enable_lora_{i}")
            if not enable:
                continue

            lora_name = kwargs.get(f"lora_name_{i}")
            model_strength = kwargs.get(f"model_strength_{i}")
            clip_strength = kwargs.get(f"clip_strength_{i}")

            current_model, current_clip = self.apply_lora_single(
                current_model, current_clip, lora_name, model_strength, clip_strength
            )

        return (current_model, current_clip)

class StackLoRALoader(ModelLoaderBase):
    """
    Apply a LoRA stack to model and clip.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "clip": ("CLIP",),
                "lora_stack": ("LORASTACK",),
            }
        }

    RETURN_TYPES = ("MODEL", "CLIP",)
    FUNCTION = "load_lora_stack"

    CATEGORY = "A1rSpace/Loader"
    DESCRIPTION = "Apply a LoRA stack to model and clip."

    def load_lora_stack(self, model, clip, lora_stack):
        return self.apply_lora_stack(model, clip, lora_stack)

class StackLoRALoader2P(ModelLoaderBase):
    """
    Apply a LoRA stack to two separate model/clip pairs with source selection.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model_a": ("MODEL",),
                "clip_a": ("CLIP",),
                "model_b": ("MODEL",),
                "clip_b": ("CLIP",),
                "lora_stack": ("LORASTACK",),
                "output1_source": ("INT", {"default": 1, "min": 1, "max": 2}),
                "output2_source": ("INT", {"default": 1, "min": 1, "max": 2}),
            }
        }

    RETURN_TYPES = ("MODEL", "CLIP", "MODEL", "CLIP")
    RETURN_NAMES = ("MODEL_A", "CLIP_A", "MODEL_B", "CLIP_B")
    FUNCTION = "load_lora_stack_2p"

    CATEGORY = "A1rSpace/Loader"
    DESCRIPTION = "Apply a LoRA stack to two separate model/clip pairs with source selection."

    def load_lora_stack_2p(self, model_a, clip_a, model_b, clip_b, lora_stack, output1_source, output2_source):
        base1_model = model_a if output1_source == 1 else model_b
        base1_clip = clip_a if output1_source == 1 else clip_b

        base2_model = model_a if output2_source == 1 else model_b
        base2_clip = clip_a if output2_source == 1 else clip_b

        out1_model, out1_clip = self.apply_lora_stack(base1_model, base1_clip, lora_stack)

        if output1_source == output2_source:
            out2_model, out2_clip = out1_model, out1_clip
        else:
            out2_model, out2_clip = self.apply_lora_stack(base2_model, base2_clip, lora_stack)

        return (out1_model, out1_clip, out2_model, out2_clip)

class StackLoRALoaderSeparate(ModelLoaderBase):
    """
    Apply a LoRA stack with boolean switch to choose between two base models.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model_a": ("MODEL",),
                "clip_a": ("CLIP",),
                "model_b": ("MODEL",),
                "clip_b": ("CLIP",),
                "separate_mode": ("BOOLEAN", {"default": False, "label_on": "Model B", "label_off": "Model A"}),
                "lora_stack": ("LORASTACK",),
            }
        }

    RETURN_TYPES = ("MODEL", "CLIP")
    FUNCTION = "load_lora_stack_separate"

    CATEGORY = "A1rSpace/Loader"
    DESCRIPTION = "Apply a LoRA stack with boolean switch to choose between two base models."

    def load_lora_stack_separate(self, model_a, clip_a, model_b, clip_b, separate_mode, lora_stack):
        base_model = model_b if separate_mode else model_a
        base_clip = clip_b if separate_mode else clip_a

        return self.apply_lora_stack(base_model, base_clip, lora_stack)

class ControlNetLoader(ModelLoaderBase):
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

LOADER_CLASS_MAPPINGS = {
    "A1r Checkpoint Loader": CheckpointLoaderVAE,
    "A1r Double CheckpointLoader": DoubleCheckpointLoaderVAE,
    "A1r Separate CheckpointLoader": SeparateCheckpointLoaderVAE,
    "A1r Six LoRA Loader": SixLoRALoader,
    "A1r Six LoRA Loader 2P": SixLoRALoader2P,
    "A1r Six LoRA Loader Separate": SixLoRALoaderSeparate,
    "A1r Stack LoRA Loader": StackLoRALoader,
    "A1r Stack LoRA Loader 2P": StackLoRALoader2P,
    "A1r Stack LoRA Loader Separate": StackLoRALoaderSeparate,
    "A1r ControlNet Loader": ControlNetLoader,
}

LOADER_DISPLAY_NAME_MAPPINGS = {
    "A1r Checkpoint Loader": "Checkpoint Loader",
    "A1r Double CheckpointLoader": "Double Checkpoint Loader",
    "A1r Separate CheckpointLoader": "Separate Checkpoint Loader",
    "A1r Six LoRA Loader": "Six LoRA Loader",
    "A1r Six LoRA Loader 2P": "Six LoRA Loader (2P)",
    "A1r Six LoRA Loader Separate": "Six LoRA Loader (Separate)",
    "A1r Stack LoRA Loader": "Stack LoRA Loader",
    "A1r Stack LoRA Loader 2P": "Stack LoRA Loader (2P)",
    "A1r Stack LoRA Loader Separate": "Stack LoRA Loader (Separate)",
    "A1r ControlNet Loader": "ControlNet Loader",
}