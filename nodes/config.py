# type: ignore
"""
Configuration module for ComfyUI A1rSpace extension.

This module provides configuration loading, model lists, numeric widget configs,
and text cleaning utilities for the A1rSpace nodes.
"""
import os
import re
import sys
import json
import folder_paths

config_data = None
_base_path = None
_config_path = None
_template_path = None

def load_config():
    """
    Load configuration from config.json or fall back to config.json.template.
    
    Returns:
        dict: Configuration data with base_path added
        
    Raises:
        Exception: If configuration file not found or invalid JSON
    """
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
    """
    Special string class that always returns True for equality comparisons.
    Used for wildcard type matching in ComfyUI node connections.
    """
    
    def __eq__(self, other):
        return True
    
    def __ne__(self, other):
        return False

# ====== Model config ======
class ModelList:
    """
    Static utility class for retrieving available model lists from ComfyUI folders.
    """
    
    @staticmethod
    def ckpt_list():
        if folder_paths is None:
            ckpt_model_list = ["None"]
        else:
            ckpt_model_list = ["None"] + folder_paths.get_filename_list("checkpoints")
        return ckpt_model_list
    
    @staticmethod
    def vae_list():
        vaes = folder_paths.get_filename_list("vae")
        approx_vaes = folder_paths.get_filename_list("vae_approx")
        sdxl_taesd_enc = False
        sdxl_taesd_dec = False
        sd1_taesd_enc = False
        sd1_taesd_dec = False
        sd3_taesd_enc = False
        sd3_taesd_dec = False
        f1_taesd_enc = False
        f1_taesd_dec = False

        for v in approx_vaes:
            if v.startswith("taesd_decoder."):
                sd1_taesd_dec = True
            elif v.startswith("taesd_encoder."):
                sd1_taesd_enc = True
            elif v.startswith("taesdxl_decoder."):
                sdxl_taesd_dec = True
            elif v.startswith("taesdxl_encoder."):
                sdxl_taesd_enc = True
            elif v.startswith("taesd3_decoder."):
                sd3_taesd_dec = True
            elif v.startswith("taesd3_encoder."):
                sd3_taesd_enc = True
            elif v.startswith("taef1_encoder."):
                f1_taesd_dec = True
            elif v.startswith("taef1_decoder."):
                f1_taesd_enc = True
        if sd1_taesd_dec and sd1_taesd_enc:
            vaes.append("taesd")
        if sdxl_taesd_dec and sdxl_taesd_enc:
            vaes.append("taesdxl")
        if sd3_taesd_dec and sd3_taesd_enc:
            vaes.append("taesd3")
        if f1_taesd_dec and f1_taesd_enc:
            vaes.append("taef1")
        vaes.append("pixel_space")
        return vaes
    
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
    """
    Static utility class providing numeric widget configurations for various node parameters.
    Includes integer and float configs for KSampler, LoRA, ControlNet, and canvas settings.
    """
    
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
        return NumericConfig.default_int(default=20, max_val=60, step=5)
    
    """latent upscale"""
    # batch size
    @staticmethod
    def batch_size():
        return NumericConfig.default_int(default=1, min_val=1, max_val=16)

    """canvas size"""
    @staticmethod
    def canvas_size():
        return NumericConfig.default_int(default=512, min_val=0, max_val=16384, step=1)
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
        return NumericConfig.default_float(default=1.0, max_val=1.0, step=0.05)
    
    """upscale"""
    # scale by
    @staticmethod
    def upscale_scaleby():
        return NumericConfig.default_float(default=1.5, min_val=0.1, max_val=8.0, step=0.1)
    
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
        return NumericConfig.default_float(default=1.0, max_val=10.0, step=0.05)
    
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
        sizeList = {
            "Square 512": (512, 512),
            "Square 768": (768, 768),
            "Square 1024": (1024, 1024),
            "Portrait 512x768": (512, 768),
            "Portrait 768x1024": (768, 1024),
            "Portrait 1024x1536": (1024, 1536),
            "Landscape 768x512": (768, 512),
            "Landscape 1024x768": (1024, 768),
            "Landscape 1536x1024": (1536, 1024),
            "16:9 1920x1080": (1920, 1080),
            "16:9 1280x720": (1280, 720),
            "9:16 1080x1920": (1080, 1920),
            "4:3 1024x768": (1024, 768),
            "3:4 768x1024": (768, 1024),
        }
        return sizeList
    
    @staticmethod
    def default_config():
        defConfig = {
            "canvas_max": 2048,
            "canvas_min": 512,
            "canvas_step": 128,
            "default_width": 1024,
            "default_height": 1024,
        }
        return defConfig

# ====== Upscale methods ======
class UpscaleMethods:
    """
    Available upscale methods for image and latent upscaling operations.
    """
    
    IMAGE_METHODS = ["nearest-exact", "bilinear", "area", "bicubic", "lanczos"]
    LATENT_METHODS = ["nearest-exact", "bilinear", "area", "bicubic", "bislerp"]
    DEFAULT = "nearest-exact"

# ====== Text merge ======
class TextCleanerMixin:
    """
    Text cleaning utility mixin class.
    Provides reusable methods for cleaning text with intelligent punctuation handling
    and emoticon protection.
    """
    
    def clean_text(self, text):
        """
        Clean trailing punctuation and whitespace from text while protecting emoticons.
        
        Args:
            text (str): Input text to clean
            
        Returns:
            str: Cleaned text with trailing punctuation removed but emoticons preserved
        """
        if not text:
            return ""
        
        # Remove leading/trailing whitespace (including full-width spaces)
        s = text.strip().rstrip('\u3000')
        if not s:
            return ""
        
        # Detect and protect emoticons at the end of text
        emoticon = self._detect_emoticon_at_end(s)
        if emoticon:
            prefix = s[:-len(emoticon)]
            cleaned_prefix = self._remove_trailing_punctuation(prefix)
            result = cleaned_prefix + emoticon
        else:
            result = self._remove_trailing_punctuation(s)
        
        return result
    
    def _detect_emoticon_at_end(self, text):
        """
        Detect emoticons at the end of text.
        Distinguishes between true emoticons and pure punctuation marks.
        
        Args:
            text (str): Text to check for emoticons
            
        Returns:
            str: The emoticon string if found, empty string otherwise
        """
        if not text or len(text) < 2:
            return ""
        
        # Unicode emoji detection (precise ranges to exclude CJK punctuation)
        unicode_emoticon_pattern = re.compile(
            r'([\U0001F600-\U0001F64F]|'  # Emoticons
            r'[\U0001F300-\U0001F5FF]|'   # Miscellaneous Symbols and Pictographs
            r'[\U0001F680-\U0001F6FF]|'   # Transport and Map Symbols
            r'[\U0001F700-\U0001F77F]|'   # Alchemical Symbols
            r'[\U0001F780-\U0001F7FF]|'   # Geometric Shapes Extended
            r'[\U0001F800-\U0001F8FF]|'   # Supplemental Arrows-C
            r'[\U0001F900-\U0001F9FF]|'   # Supplemental Symbols and Pictographs
            r'[\U0001FA00-\U0001FA6F]|'   # Chess Symbols
            r'[\U0001FA70-\U0001FAFF]|'   # Symbols and Pictographs Extended-A
            r'[\U00002702-\U000027B0]|'   # Dingbats
            r'[\U0001F1E0-\U0001F1FF])'   # Regional Indicator Symbols (flags)
            r'+$'
        )
        
        match = unicode_emoticon_pattern.search(text)
        if match:
            return match.group(0)
        
        # ASCII emoticon detection (e.g., ^_^, T_T, >_<)
        # Find the start of potential emoticon by scanning backwards
        i = len(text) - 1
        while i >= 0:
            char = text[i]
            # Stop at alphanumeric, whitespace, or CJK characters
            if char.isalnum() or char.isspace() or '\u4e00' <= char <= '\u9fff':
                break
            i -= 1
        
        potential_emoticon = text[i + 1:]
        
        # Must be at least 2 characters
        if len(potential_emoticon) < 2:
            return ""
        
        unique_chars = set(potential_emoticon)
        
        # Define pure punctuation marks (should NOT be treated as emoticons)
        pure_punctuation = {
            ',', '\uff0c', '\u3001',  # Commas (English, CJK full-width, ideographic)
            '.', '\u3002', '\uff0e',  # Periods (English, CJK, full-width)
            '!', '\uff01',             # Exclamation marks
            '?', '\uff1f',             # Question marks
            ';', '\uff1b',             # Semicolons
            ':', '\uff1a',             # Colons
        }
        
        # If all characters are pure punctuation, it's NOT an emoticon
        if unique_chars <= pure_punctuation:
            return ""
        
        # Define emoticon marker characters (must contain these to be an emoticon)
        emoticon_markers = {
            '_', '^', '<', '>', 
            'T', 't', 'O', 'o', 
            '-', '~', '\'', '"', 
            '|', '\\', '/', 
            'v', 'V', 'w', 'W', 
            'x', 'X', 'u', 'U'
        }
        
        # Must contain emoticon markers AND have at least 2 different characters
        if (unique_chars & emoticon_markers) and len(unique_chars) >= 2:
            return potential_emoticon
        
        return ""
    
    def _remove_trailing_punctuation(self, text):
        """
        Remove trailing punctuation marks from text.
        
        Rules:
        1. Preserve ellipsis (exactly 3 consecutive periods: ... or 。。。)
        2. Remove all other consecutive identical punctuation marks
        3. For mixed punctuation (e.g., ...,), remove only the trailing comma
        
        Args:
            text (str): Text to clean
            
        Returns:
            str: Text with trailing punctuation removed
        """
        if not text:
            return ""
        
        s = text.rstrip()
        if not s:
            return ""
        
        # Define removable punctuation (commas, exclamations, questions, etc.)
        removable_punctuation = {
            ',', '\uff0c', '\u3001',  # Commas
            '!', '\uff01',             # Exclamation marks
            '?', '\uff1f',             # Question marks
            ';', '\uff1b',             # Semicolons
            ':', '\uff1a',             # Colons
        }
        
        # Periods need special handling (might be ellipsis)
        period_marks = {
            '.', '\u3002', '\uff0e',  # Periods (English, CJK, full-width)
        }
        
        max_iterations = 100  # Prevent infinite loops
        iteration = 0
        
        while iteration < max_iterations and s:
            iteration += 1
            original_s = s
            
            if not s:
                break
            
            last_char = s[-1]
            
            # Handle directly removable punctuation (remove all consecutive)
            if last_char in removable_punctuation:
                count = 0
                for i in range(len(s) - 1, -1, -1):
                    if s[i] == last_char:
                        count += 1
                    else:
                        break
                
                if count > 0:
                    s = s[:-count].rstrip()
                continue
            
            # Handle periods (check if it's an ellipsis)
            if last_char in period_marks:
                count = 0
                for i in range(len(s) - 1, -1, -1):
                    if s[i] in period_marks:
                        count += 1
                    else:
                        break
                
                # Check if it's exactly 3 periods (ellipsis)
                if count == 3:
                    # Check if there are more periods before the ellipsis
                    if len(s) > 3 and s[-4] in period_marks:
                        # More than 3 periods, remove all
                        total_count = 0
                        for i in range(len(s) - 1, -1, -1):
                            if s[i] in period_marks:
                                total_count += 1
                            else:
                                break
                        s = s[:-total_count].rstrip()
                        continue
                    else:
                        # Exactly 3 periods (ellipsis), preserve and stop
                        break
                
                # Not an ellipsis, remove all periods
                if count > 0:
                    s = s[:-count].rstrip()
                    continue
            
            # No change made, stop iteration
            if s == original_s:
                break
        
        return s