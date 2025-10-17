# type: ignore
import os
import json
import folder_paths

config_data = None
_base_path = None
_config_path = None
_template_path = None

def load_config():
    global config_data, _base_path, _config_path, _template_path

    if config_data is not None:
        return config_data

    if _base_path is None:
        plugin_base_path = os.path.abspath(os.path.dirname(__file__))
        _template_path = os.path.join(plugin_base_path, "../config.json.template")
        _config_path = os.path.join(plugin_base_path, "../config.json")

    try:
        if os.path.exists(_config_path):
            with open(_config_path, "r", encoding='utf-8') as f:
                content = f.read()
                config_data = json.loads(content)
        else:
            print("config.json not found, use config.json.template")
            with open(_template_path, "r", encoding='utf-8') as f:
                content = f.read()
                config_data = json.loads(content)

        config_data["base_path"] = os.path.dirname(os.path.dirname(__file__))
        return config_data

    except FileNotFoundError as e:
        raise Exception(f"Configuration file not found: {e}")
    except json.JSONDecodeError as e:
        raise Exception(f"Invalid JSON in configuration file: {e}")
    except Exception as e:
        raise Exception(f"Error loading configuration: {e}")

class AlwaysEqual(str):
    def __eq__(self, other):
        return True
    def __ne__(self, other):
        return False

# ====== Model config ======
class ModelList:
    @staticmethod
    def ckpt_list():
        if folder_paths is None:
            ckpt_model_list = ["None"]
        else:
            ckpt_model_list = ["None"] + folder_paths.get_filename_list("checkpoints")
        return ckpt_model_list
    
    @staticmethod
    def lora_list():
        if folder_paths is None:
            lora_model_list = ["None"]
        else:
            lora_model_list = ["None"] + folder_paths.get_filename_list("loras")
        return lora_model_list
    
    @staticmethod
    def controlnet_list():
        if folder_paths is None:
            controlnet_model_list = ["None"]
        else:
            controlnet_model_list = ["None"] + folder_paths.get_filename_list("controlnet")
        return controlnet_model_list
    
    @staticmethod
    def sampler_list():
        try:
            import comfy.samplers
            if hasattr(comfy.samplers, 'KSampler') and hasattr(comfy.samplers.KSampler, 'SAMPLERS'):
                return comfy.samplers.KSampler.SAMPLERS
        except (ImportError, AttributeError):
            pass
        return ["euler", "euler_ancestral", "dpmpp_2m", "dpmpp_2m_sde"]
    
    @staticmethod
    def scheduler_list():
        try:
            import comfy.samplers
            if hasattr(comfy.samplers, 'KSampler') and hasattr(comfy.samplers.KSampler, 'SCHEDULERS'):
                return comfy.samplers.KSampler.SCHEDULERS
        except (ImportError, AttributeError):
            pass
        return ["normal", "karras"]

# ====== Numeric config ======
def _num_cfg(default, min_val, max_val, step, display=None):
    """
    Build a numeric widget config dict.

    Parameters
    - default/min_val/max_val/step: numeric bounds and step size
    - display: Optional display style, e.g., "slider"

    Returns
    - dict compatible with ComfyUI widget options
    """
    cfg = {
        "default": default,
        "min": min_val,
        "max": max_val,
        "step": step,
    }
    if display is not None:
        cfg["display"] = display
    return cfg

class NumericConfig:
    # ====== Int config ======

    # default
    @staticmethod
    def default_int(default=0, min_val=0, max_val=100, step=1):
        return _num_cfg(default, min_val, max_val, step)
    # default slider
    @staticmethod
    def default_int_slider(default=0, min_val=0, max_val=100, step=1):
        return _num_cfg(default, min_val, max_val, step, "slider")

    """ksampler"""
    # step
    @staticmethod
    def ks_step():
        return NumericConfig.default_int(default=15, max_val=60, step=5)
    
    """latent upscale"""
    # batch size
    @staticmethod
    def batch_size():
        return NumericConfig.default_int(default=1, min_val=1, max_val=16)

    # ====== Float config ======

    # default
    @staticmethod
    def default_float(default=0.0, min_val=0.0, max_val=10.0, step=0.01):
        return _num_cfg(default, min_val, max_val, step)
    # default slider
    @staticmethod
    def default_float_slider(default=0.0, min_val=0.0, max_val=10.0, step=0.01):
        return _num_cfg(default, min_val, max_val, step, "slider")

    """ksampler"""
    # cfg
    @staticmethod
    def ks_cfg():
        return NumericConfig.default_float(default=7.0, max_val=12.0, step=0.5)
    
    # denoise
    @staticmethod
    def ks_denoise():
        return NumericConfig.default_float(default=0.5, max_val=1.0, step=0.05)
    
    """upscale"""
    # scale by
    @staticmethod
    def upscale_scaleby():
        return NumericConfig.default_float(default=1.0, min_val=0.1, max_val=2.0, step=0.1)
    
    """lora"""
    # strength
    @staticmethod
    def lora_strength():
        return NumericConfig.default_float(min_val=-1.0, max_val=1.0, step=0.05)
    
    # mini
    @staticmethod
    def lora_strength_mini():
        return NumericConfig.default_float(min_val=-0.5, max_val=0.5, step=0.05)
    
    # extended
    @staticmethod
    def lora_strength_extended():
        return NumericConfig.default_float(min_val=-2.0, max_val=2.0, step=0.05)
    
    # wide
    @staticmethod
    def lora_strength_wide():
        return NumericConfig.default_float(min_val=-3.0, max_val=3.0, step=0.05)
    
    # large
    @staticmethod
    def lora_strength_large():
        return NumericConfig.default_float(min_val=-4.0, max_val=4.0, step=0.05)
    
    """controlnet"""
    # strength
    @staticmethod
    def cn_strength():
        return NumericConfig.default_float(max_val=1.0, step=0.1)
    
    # percent
    @staticmethod
    def cn_percent():
        return NumericConfig.default_float(max_val=1.0, step=0.05)

    # ====== CustomNum config ======

    @staticmethod
    def custom_int_float():
        return {
            "default": 0,
            "min": -4294967296,
            "max": 4294967296,
        }

    # ====== Size config ======

    @staticmethod
    def size_list():
        return [
            "704x1408 (0.5)",
            "704x1344 (0.52)",
            "768x1344 (0.57)",
            "768x1280 (0.6)",
            "832x1216 (0.68)",
            "832x1152 (0.72)",
            "896x1152 (0.78)",
            "896x1088 (0.82)",
            "960x1088 (0.88)",
            "960x1024 (0.94)",
            "1024x1024 (1.0)",
            "1024x960 (1.07)",
            "1088x960 (1.13)",
            "1088x896 (1.21)",
            "1152x896 (1.29)",
            "1152x832 (1.38)",
            "1216x832 (1.46)",
            "1280x768 (1.67)",
            "1344x768 (1.75)",
            "1344x704 (1.91)",
            "1408x704 (2.0)",
            "1472x704 (2.09)",
            "1536x640 (2.4)",
            "1600x640 (2.5)",
            "1664x576 (2.89)",
            "1728x576 (3.0)",
        ]

class UpscaleMethods:
    IMAGE_METHODS = ["nearest-exact", "bilinear", "area", "bicubic", "lanczos"]
    LATENT_METHODS = ["nearest-exact", "bilinear", "area", "bicubic", "bislerp"]
    DEFAULT = "nearest-exact"