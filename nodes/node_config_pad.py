from .config import AlwaysEqual, ModelList, NumericConfig, UpscaleMethods

class Checkpoint_Select:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "checkpoint": (ModelList.ckpt_list(),),
            }
        }
    
    RETURN_TYPES = (AlwaysEqual('*'),)
    RETURN_NAMES = ("ckpt",)
    FUNCTION = "get_ckpt_name"

    CATEGORY = "A1rSpace/Config"

    def get_ckpt_name(self, checkpoint):
        return (checkpoint,)

class AB_Checkpoint:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "checkpoint_a": (ModelList.ckpt_list(),),
                "checkpoint_b": (ModelList.ckpt_list(),),
                "lora_separate": ("BOOLEAN", {"default": False}),
                "ckpt_separate": ("BOOLEAN", {"default": False}),
                "generate_mode": (["text to image", "image to image"], {"default": "text to image"}),
            }
        }
    
    RETURN_TYPES = (AlwaysEqual('*'), AlwaysEqual('*'), "BOOLEAN", "BOOLEAN", "INT")
    RETURN_NAMES = ("ckpt_a", "ckpt_b", "lora_separate", "ckpt_separate", "generate_mode")
    FUNCTION = "get_ckpt_names"

    CATEGORY = "A1rSpace/Config"

    def get_ckpt_names(self, checkpoint_a, checkpoint_b, lora_separate, ckpt_separate, generate_mode):
        # Backend safety (new rule):
        # - Allow both False.
        # - lora_separate toggle doesn't affect ckpt_separate.
        # - If ckpt_separate is True while lora_separate is False, force lora_separate=True.
        # - Turning ckpt_separate False doesn't change lora_separate.
        if ckpt_separate and not lora_separate:
            lora_separate = True

        generate_mode_map = {
            "text to image": 1,
            "image to image": 2
        }
        generate_mode_int = generate_mode_map.get(generate_mode, 1)

        return (checkpoint_a, checkpoint_b, lora_separate, ckpt_separate, generate_mode_int)

class KSampler_Config:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        samplers = ModelList.sampler_list()
        schedulers = ModelList.scheduler_list()

        return {
            "required": {
                "sampler_name": (samplers, {"default": samplers[0]}),
                "scheduler": (schedulers, {"default": schedulers[0]}),
                "steps": ("INT", NumericConfig.ks_step(),),
                "cfg": ("FLOAT", NumericConfig.ks_cfg(),),
                "denoise": ("FLOAT", NumericConfig.ks_denoise(),),
            }
        }

    RETURN_TYPES = ("SAMPLER", "SCHEDULER", "INT", "FLOAT", "FLOAT")
    RETURN_NAMES = ("sampler", "scheduler", "steps", "cfg", "denoise")
    FUNCTION = "ks_config"

    CATEGORY = "A1rSpace/Config"

    def ks_config(self, sampler_name, scheduler, steps, cfg, denoise):
        return (sampler_name, scheduler, steps, cfg, denoise)
    
class KSampler_Config_Values:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "steps": ("INT", NumericConfig.ks_step(),),
                "cfg": ("FLOAT", NumericConfig.ks_cfg(),),
                "denoise": ("FLOAT", NumericConfig.ks_denoise(),),
            }
        }

    RETURN_TYPES = ("INT", "FLOAT", "FLOAT",)
    RETURN_NAMES = ("steps", "cfg", "denoise",)
    FUNCTION = "ks_value"

    CATEGORY = "A1rSpace/Config"

    def ks_value(self, steps, cfg, denoise):
        return (steps, cfg, denoise,)

class KSampler_Config_Values_Lite:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "steps": ("INT", NumericConfig.ks_step(),),
                "cfg": ("FLOAT", NumericConfig.ks_cfg(),),
            }
        }

    RETURN_TYPES = ("INT", "FLOAT",)
    RETURN_NAMES = ("steps", "cfg",)
    FUNCTION = "pass_value"

    CATEGORY = "A1rSpace/Config"
    DESCRIPTION = "Pass steps and cfg values to KSampler."

    def pass_value(self, steps, cfg):
        return (steps, cfg,)

class LoRA_Config:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "lora_name": (ModelList.lora_list(),),
                "model_strength": ("FLOAT", NumericConfig.lora_strength(),),
                "clip_strength": ("FLOAT", NumericConfig.lora_strength(),),
                "range": (["mini", "standard", "extended", "wide", "large"], {"default": "standard", "hide_value": True, "on_change": True}),
                }
        }

    RETURN_TYPES = (AlwaysEqual('*'), "FLOAT", "FLOAT",)
    RETURN_NAMES = ("name", "model", "clip",)
    FUNCTION = "la_config"

    CATEGORY = "A1rSpace/Config"
    
    def la_config(self, lora_name, model_strength, clip_strength, range):
        if range == "mini":
            config = NumericConfig.lora_strength_mini()
        elif range == "standard":
            config = NumericConfig.lora_strength()
        elif range == "extended":
            config = NumericConfig.lora_strength_extended()
        elif range == "wide":
            config = NumericConfig.lora_strength_wide()
        else: # large
            config = NumericConfig.lora_strength_large()

        return (lora_name, model_strength, clip_strength, {"range": range, "model_strength": config, "clip_strength": config})

class ControlNet_Config:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "control_net_name": (ModelList.controlnet_list(),),
                "strength": ("FLOAT", NumericConfig.cn_strength(),),
                "start_percent": ("FLOAT", NumericConfig.cn_percent(),),
                "end_percent": ("FLOAT", NumericConfig.cn_percent(),)
            }
        }

    RETURN_TYPES = (AlwaysEqual('*'), "FLOAT", "FLOAT", "FLOAT",)
    RETURN_NAMES = ("cn_name", "strength", "start", "end",)
    FUNCTION = "cn_config"

    CATEGORY = "A1rSpace/Config"

    def cn_config(self, control_net_name, strength, start_percent, end_percent):
        return (control_net_name, strength, start_percent, end_percent)

class Size_Picker:
    def __init__(self):
        pass
    
    @classmethod
    def INPUT_TYPES(cls):
        resolution_options = NumericConfig.size_list()

        return {
            "required": {
                "resolution": (resolution_options, {"default": "1024x1024 (1.0)"}),
            }
        }

    RETURN_TYPES = ("INT", "INT",)
    RETURN_NAMES = ("width", "height",)
    FUNCTION = "put_resolution"
    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Pick a resolution from the dropdown."

    def put_resolution(self, resolution):
        resolution_parts = resolution.split(" ")[0].split("x")
        
        width = int(resolution_parts[0])
        height = int(resolution_parts[1])

        return (width, height)

class UpscaleMethods_Picker:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "upscale_method": (UpscaleMethods.LATENT_METHODS, {"default": UpscaleMethods.DEFAULT}),
            }
        }

    RETURN_TYPES = (AlwaysEqual("*"),)
    RETURN_NAMES = ("upscale_method",)
    FUNCTION = "put_method"

    CATEGORY = "A1rSpace/Config"

    def put_method(self, upscale_method):
        return (upscale_method,)

CONFIG_CLASS_MAPPINGS = {
    # Checkpoint
    "A1r Checkpoint Select": Checkpoint_Select,
    "A1r AB Checkpoint": AB_Checkpoint,
    # KSampler
    "A1r KSampler Config": KSampler_Config,
    "A1r KSampler Config Values": KSampler_Config_Values,
    "A1r KSampler Config Values Lite": KSampler_Config_Values_Lite,

    # LoRA
    "A1r LoRA Config": LoRA_Config,

    # ControlNet
    "A1r ControlNet Config": ControlNet_Config,

    # Utils
    "A1r Size Picker": Size_Picker,
    "A1r Upscale Methods Picker": UpscaleMethods_Picker,
}

CONFIG_DISPLAY_NAME_MAPPINGS = {
    # Checkpoint
    "A1r Checkpoint Select": "Checkpoint Select",
    "A1r AB Checkpoint": "A&B Checkpoint",

    # KSampler
    "A1r KSampler Config": "KSampler Config Pad",
    "A1r KSampler Config Values": "KSampler Config-Values",
    "A1r KSampler Config Values Lite": "KSampler Config-Values (Lite)",

    # LoRA
    "A1r LoRA Config": "LoRA Config Pad",

    # ControlNet
    "A1r ControlNet Config": "ControlNet Config Pad",

    # Utils
    "A1r Size Picker": "Size Picker",
    "A1r Upscale Methods Picker": "Upscale Methods Picker",
}