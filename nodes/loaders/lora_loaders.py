"""
LoRA loader nodes for ComfyUI A1rSpace extension.

This module provides various LoRA loading nodes with support for:
- Up to six LoRAs with individual enable/disable switches
- Dual-model output workflows
- LoRA stack support
- Separate model selection modes
"""

from ..common.model_loader import ModelLoaderBase
from ..common.shared_utils import ModelList, NumericConfig

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

# Exported mappings
LORA_LOADER_CLASS_MAPPINGS = {
    "A1r Six LoRA Loader": SixLoRALoader,
    "A1r Six LoRA Loader 2P": SixLoRALoader2P,
    "A1r Six LoRA Loader Separate": SixLoRALoaderSeparate,
    "A1r Stack LoRA Loader": StackLoRALoader,
    "A1r Stack LoRA Loader 2P": StackLoRALoader2P,
    "A1r Stack LoRA Loader Separate": StackLoRALoaderSeparate,
}

LORA_LOADER_DISPLAY_NAME_MAPPINGS = {
    "A1r Six LoRA Loader": "Six LoRA Loader",
    "A1r Six LoRA Loader 2P": "Six LoRA Loader (2P)",
    "A1r Six LoRA Loader Separate": "Six LoRA Loader (Separate)",
    "A1r Stack LoRA Loader": "Stack LoRA Loader",
    "A1r Stack LoRA Loader 2P": "Stack LoRA Loader (2P)",
    "A1r Stack LoRA Loader Separate": "Stack LoRA Loader (Separate)",
}
