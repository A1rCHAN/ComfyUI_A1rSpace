# type: ignore
"""
Configuration pad nodes for ComfyUI A1rSpace extension.

This module provides configuration pads for KSampler, LoRA, ControlNet settings,
and various utility nodes for workflow control including mode management,
size pickers, and widget collectors.
"""
from ..common import AlwaysEqual, ModelList, NumericConfig, UpscaleMethods

class KSamplerConfig:
    """
    Configuration pad for KSampler parameters (sampler, scheduler, steps, CFG, denoise).
    """
    
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

    RETURN_TYPES = (AlwaysEqual('*'), AlwaysEqual('*'), "INT", "FLOAT", "FLOAT")
    RETURN_NAMES = ("sampler", "scheduler", "steps", "cfg", "denoise")
    FUNCTION = "ks_config"

    CATEGORY = "A1rSpace/Config"
    DESCRIPTION = "Configuration pad for KSampler parameters including sampler, scheduler, steps, CFG, and denoise strength."

    def ks_config(self, sampler_name, scheduler, steps, cfg, denoise):
        return (sampler_name, scheduler, steps, cfg, denoise)

class KSamplerConfigValues:
    """
    Lightweight configuration pad for KSampler values only (steps, CFG, denoise).
    """
    
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
    DESCRIPTION = "Lightweight configuration pad for KSampler numerical values (steps, CFG, denoise)."

    def ks_value(self, steps, cfg, denoise):
        return (steps, cfg, denoise,)

class LoRAConfig:
    """
    Configuration pad for single LoRA with stackable output.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "lora_name": (ModelList.lora_list(),),
                "model_strength": ("FLOAT", NumericConfig.lora_strength(),),
                "clip_strength": ("FLOAT", NumericConfig.lora_strength(),),
                "range": (["mini", "standard", "extended", "wide", "large"], {"default": "standard", "hide_value": True, "on_change": True}),
                },
            "optional": {
                "lora_stack": ("LORASTACK", {"forceInput": True}),
            }
        }

    RETURN_TYPES = ("LORASTACK", AlwaysEqual('*'), "FLOAT", "FLOAT",)
    RETURN_NAMES = ("lora_stack", "name", "model", "clip",)
    FUNCTION = "la_config"

    CATEGORY = "A1rSpace/Config"
    DESCRIPTION = "Configuration pad for single LoRA with dynamic strength range and stackable output."
    
    def la_config(self, lora_name, model_strength, clip_strength, range, lora_stack=None):
        # 更新范围配置
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

        # 构建或扩展 lora_stack
        if lora_stack is None:
            # 创建新的 stack
            stack = {"entries": []}
        elif isinstance(lora_stack, dict):
            # 复制现有的 stack
            stack = {
                "entries": list(lora_stack.get("entries", [])),
                **{k: v for k, v in lora_stack.items() if k != "entries"}
            }
        else:
            # 异常情况，创建新的 stack
            print(f"[LoRA Config] Warning: Invalid lora_stack format, creating new stack")
            stack = {"entries": []}
        
        # 添加当前 LoRA 配置到 stack
        if lora_name and lora_name != "None":
            stack["entries"].append({
                "enabled": True,
                "name": lora_name,
                "model_strength": model_strength,
                "clip_strength": clip_strength,
            })
        
        # 返回: (stack, name, model_strength, clip_strength)
        return (stack, lora_name, model_strength, clip_strength)
    
class LoRAConfigAdvance:
    """
    Advanced configuration pad for up to 6 LoRAs with individual enable switches.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        # 将 LoRA 相关输入放到 optional 中
        lora_inputs = {}
        
        for i in range(1, 7):
            lora_inputs[f"enable_{i}"] = ("BOOLEAN", {
                "default": False, 
                "label_on": "On", 
                "label_off": "Off"
            })
            lora_inputs[f"lora_name_{i}"] = (ModelList.lora_list(),)
            lora_inputs[f"strength_{i}"] = ("FLOAT", {
                **NumericConfig.lora_strength_large(),
            })
            lora_inputs[f"strength_clip_{i}"] = ("FLOAT", {
                **NumericConfig.lora_strength_large(),
            })
        
        # 将 lora_stack 也放到 optional 中
        lora_inputs["lora_stack"] = ("LORASTACK", {"forceInput": True})

        return {
            "required": {},
            "optional": lora_inputs
        }
    
    RETURN_TYPES = ("LORASTACK",)
    RETURN_NAMES = ("lora_stack",)
    FUNCTION = "set_lora_stack"
    
    CATEGORY = "A1rSpace/Config"
    DESCRIPTION = "Advanced configuration pad for up to 6 LoRAs with individual enable/disable switches."

    def set_lora_stack(self, **kwargs):
        """
        处理 LoRA stack
        """
        # 获取输入的 lora_stack，如果没有则初始化为空
        lora_stack = kwargs.get("lora_stack", None)
        
        # 安全地解析输入的 lora_stack
        try:
            if lora_stack is None:
                # 没有输入连接时，创建新的 stack
                stack = {"entries": []}
            elif isinstance(lora_stack, dict):
                # 复制现有的 stack
                stack = {
                    "entries": list(lora_stack.get("entries", [])), 
                    **{k: v for k, v in lora_stack.items() if k != "entries"}
                }
            elif isinstance(lora_stack, (list, tuple)) and len(lora_stack) > 0:
                if isinstance(lora_stack[0], dict):
                    stack = {
                        "entries": list(lora_stack[0].get("entries", [])), 
                        **{k: v for k, v in lora_stack[0].items() if k != "entries"}
                    }
                else:
                    stack = {"entries": []}
            else:
                stack = {"entries": []}
        except Exception as e:
            print(f"[LoRA ControlPad Advanced] Error parsing lora_stack: {e}")
            stack = {"entries": []}

        # 处理新的 LoRA 条目
        new_entries = []
        for i in range(1, 7):
            enabled = bool(kwargs.get(f"enable_{i}", False))
            name = kwargs.get(f"lora_name_{i}", "") or ""
            strength = float(kwargs.get(f"strength_{i}", 1.0))
            strength_clip = float(kwargs.get(f"strength_clip_{i}", 1.0))

            # 过滤有效的 LoRA 条目
            if enabled and name and name != "None":
                new_entries.append({
                    "enabled": enabled,
                    "name": name,
                    "model_strength": strength,
                    "clip_strength": strength_clip,
                })

        # 合并到 stack
        stack["entries"].extend(new_entries)

        return (stack,)

class ControlNetConfig:
    """
    Configuration pad for ControlNet parameters (name, strength, start/end percent).
    """
    
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
    DESCRIPTION = "Configuration pad for ControlNet parameters including model name, strength, and start/end percentages."

    def cn_config(self, control_net_name, strength, start_percent, end_percent):
        return (control_net_name, strength, start_percent, end_percent)


class SeedControl:
    """
    Seed control node with UI display for tracking seed values.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
            }
        }

    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("seed",)
    FUNCTION = "put_seed"

    CATEGORY = "A1rSpace/Config"
    DESCRIPTION = "Seed control node with UI display for tracking and managing seed values in workflows."

    def put_seed(self, seed):
        return {
            "ui": {
                "seed": [str(seed)],
            },
            "result": (seed,),
        }

class WidgetCollector:
    """
    Utility node for collecting and storing widget values in workflow metadata.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "hidden": {
                "unique_id": ("UNIQUE_ID",),
                "extra_pnginfo": ("EXTRA_PNGINFO",),
            }
        }
    
    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "execute"
    
    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Utility node for collecting and storing widget values in workflow metadata."

    def execute(self, unique_id=None, extra_pnginfo=None, **kwargs):
        return {}

class NodeModeCollector:
    """
    Collector node for mode trigger signals in workflow control systems.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "trigger": ("TRIGGER", {"forceInput": True}),
            },
            "hidden": {
                "unique_id": ("UNIQUE_ID",),
            }
        }

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "execute"

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Collector node for mode trigger signals in workflow control systems."

    def execute(self, trigger=None, unique_id=None):
        return {}

class ModeConsole:
    """
    Console node that generates trigger signals for mode control workflows.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "hidden": {
                "unique_id": ("UNIQUE_ID",),
            }
        }

    RETURN_TYPES = ("TRIGGER",)
    OUTPUT_NODE = True
    FUNCTION = "execute"

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Console node that generates trigger signals for mode control workflows."

    def execute(self, unique_id=None):
        return (True,)

class ModeRelay:
    """
    Relay node that passes trigger signals through without modification.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "trigger": ("TRIGGER", {"forceInput": True}),
            }
        }
    
    RETURN_TYPES = ("TRIGGER",)
    FUNCTION = "execute"

    CATEGORY = "A1rSpace/Utils"

    def execute(self, trigger=True):
        return (trigger,)

class ModeInverter:
    """
    Inverter node that flips trigger signals (True → False, False → True).
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "trigger": ("TRIGGER", {"forceInput": True}),
            }
        }
    
    RETURN_TYPES = ("TRIGGER",)
    FUNCTION = "execute"

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Inverter node that flips trigger signals (True → False, False → True)."

    def execute(self, trigger=True):
        return (not trigger,)

class CheckpointPicker:
    """
    Simple picker node for selecting checkpoint model names from a dropdown.
    """
    
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
    DESCRIPTION = "Simple picker node for selecting checkpoint model names from a dropdown list."

    def get_ckpt_name(self, checkpoint):
        return (checkpoint,)

class UpscaleMethodPicker:
    """
    Picker node for selecting upscale methods (supports both image and latent methods).
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        all_methods = list(dict.fromkeys(UpscaleMethods.IMAGE_METHODS + UpscaleMethods.LATENT_METHODS))
        return {
            "required": {
                "upscale_method": (all_methods, {"default": UpscaleMethods.DEFAULT}),
            }
        }

    RETURN_TYPES = (AlwaysEqual('*'),)
    RETURN_NAMES = ("upscale_method",)
    FUNCTION = "select"

    CATEGORY = "A1rSpace/Config"
    DESCRIPTION = "Picker node for selecting upscale methods (supports both image and latent upscale methods)."

    def select(self, upscale_method):
        return (upscale_method,)

class SizePicker:
    """
    Dropdown picker for selecting predefined resolution presets.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        size_list = NumericConfig.size_list()

        return {
            "required": {
                "resolution": (list(size_list.keys()), {"default": "Square 1024"}),
            }
        }

    RETURN_TYPES = ("INT", "INT",)
    RETURN_NAMES = ("width", "height",)
    FUNCTION = "put_resolution"

    CATEGORY = "A1rSpace/Config"
    DESCRIPTION = "Pick a resolution from the dropdown."

    def put_resolution(self, resolution):
        resolution_parts = resolution.split(" ")[0].split("x")
        
        width = int(resolution_parts[0])
        height = int(resolution_parts[1])

        return (width, height)

class SizeCanvas:
    """
    Advanced size selector with preset dropdown and custom width/height inputs.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        # 获取配置
        try:
            size_list = NumericConfig.size_list()
            config = NumericConfig.default_config()
        except Exception as e:
            print(f"[A1rSpace] Error loading config: {e}")
            size_list = {"Square 1024": (1024, 1024)}
            config = {
                "canvas_max": 2048,
                "canvas_min": 512,
                "canvas_step": 128,
                "default_width": 1024,
                "default_height": 1024,
            }
        
        # 添加 Custom 选项到预设列表最前面
        preset_options = ["Custom"] + list(size_list.keys())

        return {
            "required": {
                "preset": (preset_options, {"default": "Square 1024"}),
            },
            "optional": {
                "width": ("INT", {
                    "default": config["default_width"],
                    "min": 64,
                    "max": 8192,
                    "step": 64,
                    "display": "number"
                }),
                "height": ("INT", {
                    "default": config["default_height"],
                    "min": 64,
                    "max": 8192,
                    "step": 64,
                    "display": "number"
                }),
            }
        }
    
    RETURN_TYPES = ("INT", "INT")
    RETURN_NAMES = ("width", "height")
    FUNCTION = "get_size"

    CATEGORY = "A1rSpace/Config"
    DESCRIPTION = "Advanced size selector with preset dropdown and custom width/height inputs for flexible resolution control."
    
    def get_size(self, preset, width=None, height=None):
        try:
            # 获取配置
            size_list = NumericConfig.size_list()
            config = NumericConfig.default_config()
        except Exception as e:
            print(f"[A1rSpace] Error in get_size: {e}")
            # 回退到传入值或默认常量
            return (width or 1024, height or 1024)

        # 如果选择了预设（非Custom），返回预设尺寸
        if preset in size_list and preset != "Custom":
            w, h = size_list[preset]
            return (w, h)

        # 否则使用传入参数（如果提供），否则使用默认配置中的值
        w = width if (width is not None) else config.get("default_width", 1024)
        h = height if (height is not None) else config.get("default_height", 1024)
        return (w, h)


# Export node mappings
CONFIG_CLASS_MAPPINGS = {
    # Config Pad
    "A1r KSampler Config": KSamplerConfig,
    "A1r KSampler Config Values": KSamplerConfigValues,
    "A1r LoRA Config": LoRAConfig,
    "A1r LoRA Config Advance": LoRAConfigAdvance,
    "A1r ControlNet Config": ControlNetConfig,

    # Control
    "A1r Seed Control": SeedControl,

    # Utils
    "A1r Widget Collector": WidgetCollector,
    "A1r Node Mode Collector": NodeModeCollector,
    "A1r Node Mode Console": ModeConsole,
    "A1r Mode Relay": ModeRelay,
    "A1r Mode Inverter": ModeInverter,
    "A1r Checkpoint Picker": CheckpointPicker,
    "A1r Upscale Method Picker": UpscaleMethodPicker,
    "A1r Size Picker": SizePicker,
    "A1r Size Canvas": SizeCanvas,
}

CONFIG_DISPLAY_NAME_MAPPINGS = {
    # Config Pad
    "A1r KSampler Config": "KSampler Config Pad",
    "A1r KSampler Config Values": "KSampler Config Pad (Lite)",
    "A1r LoRA Config": "LoRA Config Pad",
    "A1r LoRA Config Advance": "LoRA Config Pad AD",
    "A1r ControlNet Config": "ControlNet Config Pad",

    # Control
    "A1r Seed Control": "Seed Control",

    # Utils
    "A1r Widget Collector": "Widget Collector",
    "A1r Node Mode Collector": "Node Mode Collector",
    "A1r Node Mode Console": "Node Mode Console",
    "A1r Mode Relay": "Mode Relay",
    "A1r Mode Inverter": "Mode Inverter",
    "A1r Checkpoint Picker": "Checkpoint Picker",
    "A1r Upscale Method Picker": "Upscale Method Picker",
    "A1r Size Picker": "Size Picker",
    "A1r Size Canvas": "Size Canvas",
}
