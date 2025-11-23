"""
Shared utility functions and classes for ComfyUI A1rSpace extension.

This module provides common functionality used across multiple nodes including:
- Type conversion utilities (to_int, to_float)
- Logging utilities
- Model/sampler lists
- Numeric configuration builders
- Text cleaning utilities
"""
import re
import time
from inspect import stack

# Lazy import to reduce startup overhead
_folder_paths = None
_comfy_samplers = None

# ========== AlwaysEqual Utility ==========

class AlwaysEqual(str):
    """
    Special string class that always returns True for equality comparisons.
    Used for wildcard type matching in ComfyUI node connections.
    """
    
    def __eq__(self, other):
        return True
    
    def __ne__(self, other):
        return False

# ========== Lazy Loading Functions ==========

def _get_folder_paths():
    """Lazy import folder_paths to reduce initial load time."""
    global _folder_paths
    if _folder_paths is None:
        import folder_paths
        _folder_paths = folder_paths
    return _folder_paths


def _get_comfy_samplers():
    """Lazy import comfy.samplers to reduce initial load time."""
    global _comfy_samplers
    if _comfy_samplers is None:
        import comfy.samplers
        _comfy_samplers = comfy.samplers
    return _comfy_samplers


# ====== Type conversion utilities ======

def to_int(name, v):
    """
    Convert value to integer with detailed error handling.
    
    Args:
        name (str): Parameter name for error messages
        v: Value to convert (int, float, or string)
    
    Returns:
        int: Converted integer value
    
    Raises:
        TypeError: If conversion fails
        
    Example:
        steps = to_int("steps", "20")  # Returns 20
    """
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        return int(v)
    if isinstance(v, str):
        v_strip = v.strip()
        if v_strip.isdigit():
            return int(v_strip)
        try:
            return int(v_strip, 0)
        except Exception:
            raise TypeError(f"{name} must be INT, got string '{v}'")
    raise TypeError(f"{name} must be INT, got {type(v).__name__}")


def to_float(name, v):
    """
    Convert value to float with detailed error handling.
    
    Args:
        name (str): Parameter name for error messages
        v: Value to convert (int, float, or string)
    
    Returns:
        float: Converted float value
    
    Raises:
        TypeError: If conversion fails
        
    Example:
        cfg = to_float("cfg", "7.5")  # Returns 7.5
    """
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        v_strip = v.strip()
        try:
            return float(v_strip)
        except ValueError:
            raise TypeError(f"{name} must be FLOAT, got string '{v}'")
    raise TypeError(f"{name} must be FLOAT, got {type(v).__name__}")


def print_log(str_msg):
    """
    Print log message with timestamp and caller information.
    
    Args:
        str_msg (str): Message to log
        
    Example:
        print_log("Loading model checkpoint...")
    """
    str_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    try:
        caller = stack()[1]
        caller_info = f"[{caller[1]}, line: {caller[2]}]"
    except Exception:
        caller_info = "[Unknown caller]"
    print(f"[{str_time}] {caller_info} {str_msg}")


# ====== Model Lists ======

class ModelList:
    """
    Static utility class for retrieving available model lists from ComfyUI folders.
    
    Uses lazy loading to avoid importing folder_paths until actually needed,
    improving plugin startup performance.
    """
    
    @staticmethod
    def ckpt_list():
        """Get list of available checkpoint models."""
        folder_paths = _get_folder_paths()
        return ["None"] + folder_paths.get_filename_list("checkpoints")
    
    @staticmethod
    def vae_list():
        """Get list of available VAE models including TAESD variants."""
        folder_paths = _get_folder_paths()
        vaes = ["None"] + folder_paths.get_filename_list("vae")
        approx_vaes = folder_paths.get_filename_list("vae_approx")
        
        # Check for TAESD variants
        sdxl_taesd_enc = sdxl_taesd_dec = False
        sd1_taesd_enc = sd1_taesd_dec = False
        sd3_taesd_enc = sd3_taesd_dec = False
        f1_taesd_enc = f1_taesd_dec = False

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
        """Get list of available LoRA models."""
        folder_paths = _get_folder_paths()
        return ["None"] + folder_paths.get_filename_list("loras")
    
    @staticmethod
    def controlnet_list():
        """Get list of available ControlNet models."""
        folder_paths = _get_folder_paths()
        return ["None"] + folder_paths.get_filename_list("controlnet")
    
    @staticmethod
    def sampler_list():
        """Get list of available sampler algorithms."""
        try:
            samplers = _get_comfy_samplers()
            if hasattr(samplers, 'KSampler') and hasattr(samplers.KSampler, 'SAMPLERS'):
                return samplers.KSampler.SAMPLERS
        except (ImportError, AttributeError):
            pass
        return ["euler", "euler_ancestral", "dpmpp_2m", "dpmpp_2m_sde"]
    
    @staticmethod
    def scheduler_list():
        """Get list of available schedulers."""
        try:
            samplers = _get_comfy_samplers()
            if hasattr(samplers, 'KSampler') and hasattr(samplers.KSampler, 'SCHEDULERS'):
                return samplers.KSampler.SCHEDULERS
        except (ImportError, AttributeError):
            pass
        return ["normal", "karras"]


# ====== Numeric Configuration ======

def _num_cfg(default, min_val, max_val, step, display=None):
    """
    Build a numeric widget config dict for ComfyUI.

    Args:
        default: Default value
        min_val: Minimum allowed value
        max_val: Maximum allowed value
        step: Step increment size
        display: Optional display style (e.g., "slider")

    Returns:
        dict: Widget configuration compatible with ComfyUI
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
    
    Includes optimized integer and float configs for KSampler, LoRA, ControlNet,
    and canvas settings with sensible defaults and ranges.
    """
    
    # ====== Integer Configurations ======
    
    @staticmethod
    def default_int(default=0, min_val=0, max_val=100, step=1):
        """Generic integer configuration."""
        return _num_cfg(default, min_val, max_val, step)
    
    @staticmethod
    def default_int_slider(default=0, min_val=0, max_val=100, step=1):
        """Generic integer slider configuration."""
        return _num_cfg(default, min_val, max_val, step, "slider")
    
    @staticmethod
    def ks_step():
        """KSampler steps configuration (default: 20, max: 60, step: 5)."""
        return NumericConfig.default_int(default=20, max_val=60, step=5)
    
    @staticmethod
    def batch_size():
        """Batch size configuration (default: 1, min: 1, max: 16)."""
        return NumericConfig.default_int(default=1, min_val=1, max_val=16)
    
    @staticmethod
    def canvas_size():
        """Canvas size configuration (default: 512, min: 0, max: 16384)."""
        return NumericConfig.default_int(default=512, min_val=0, max_val=16384, step=1)
    
    # ====== Float Configurations ======
    
    @staticmethod
    def default_float(default=0.0, min_val=0.0, max_val=10.0, step=0.01):
        """Generic float configuration."""
        return _num_cfg(default, min_val, max_val, step)
    
    @staticmethod
    def default_float_slider(default=0.0, min_val=0.0, max_val=10.0, step=0.01):
        """Generic float slider configuration."""
        return _num_cfg(default, min_val, max_val, step, "slider")
    
    @staticmethod
    def ks_cfg():
        """KSampler CFG scale configuration (default: 7.0, max: 12.0, step: 0.5)."""
        return NumericConfig.default_float(default=7.0, max_val=12.0, step=0.5)
    
    @staticmethod
    def ks_denoise():
        """KSampler denoise strength configuration (default: 1.0, max: 1.0, step: 0.05)."""
        return NumericConfig.default_float(default=1.0, max_val=1.0, step=0.05)
    
    @staticmethod
    def upscale_scaleby():
        """Upscale factor configuration (default: 1.5, min: 0.1, max: 8.0, step: 0.1)."""
        return NumericConfig.default_float(default=1.5, min_val=0.1, max_val=8.0, step=0.1)
    
    # ====== LoRA Strength Configurations ======
    
    @staticmethod
    def lora_strength():
        """Standard LoRA strength (-1.0 to 1.0, step: 0.05)."""
        return NumericConfig.default_float(min_val=-1.0, max_val=1.0, step=0.05)
    
    @staticmethod
    def lora_strength_mini():
        """Mini LoRA strength (-0.5 to 0.5, step: 0.05)."""
        return NumericConfig.default_float(min_val=-0.5, max_val=0.5, step=0.05)
    
    @staticmethod
    def lora_strength_extended():
        """Extended LoRA strength (-2.0 to 2.0, step: 0.05)."""
        return NumericConfig.default_float(min_val=-2.0, max_val=2.0, step=0.05)
    
    @staticmethod
    def lora_strength_wide():
        """Wide LoRA strength (-3.0 to 3.0, step: 0.05)."""
        return NumericConfig.default_float(min_val=-3.0, max_val=3.0, step=0.05)
    
    @staticmethod
    def lora_strength_large():
        """Large LoRA strength (-4.0 to 4.0, step: 0.05)."""
        return NumericConfig.default_float(min_val=-4.0, max_val=4.0, step=0.05)
    
    # ====== ControlNet Configurations ======
    
    @staticmethod
    def cn_strength():
        """ControlNet strength configuration (default: 1.0, max: 10.0, step: 0.05)."""
        return NumericConfig.default_float(default=1.0, max_val=10.0, step=0.05)
    
    @staticmethod
    def cn_percent():
        """ControlNet percent configuration (default: 0.0, max: 1.0, step: 0.05)."""
        return NumericConfig.default_float(max_val=1.0, step=0.05)
    
    # ====== Custom Configurations ======
    
    @staticmethod
    def custom_int_float():
        """Custom wide-range numeric configuration."""
        return {
            "default": 0,
            "min": -4294967296,
            "max": 4294967296,
        }
    
    @staticmethod
    def size_list():
        """Predefined image size presets."""
        return {
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
    
    @staticmethod
    def default_config():
        """Default canvas configuration parameters."""
        return {
            "canvas_max": 2048,
            "canvas_min": 512,
            "canvas_step": 128,
            "default_width": 1024,
            "default_height": 1024,
        }


# ====== Upscale Methods ======

class UpscaleMethods:
    """
    Available upscale methods for image and latent upscaling operations.
    
    Attributes:
        IMAGE_METHODS: Interpolation methods for image upscaling
        LATENT_METHODS: Interpolation methods for latent upscaling (includes bislerp)
        DEFAULT: Default upscale method
    """
    
    IMAGE_METHODS = ["nearest-exact", "bilinear", "area", "bicubic", "lanczos"]
    LATENT_METHODS = ["nearest-exact", "bilinear", "area", "bicubic", "bislerp"]
    DEFAULT = "nearest-exact"


# ====== Text Cleaning Utilities ======

class TextCleanerMixin:
    """
    Text cleaning utility mixin class.
    
    Provides reusable methods for cleaning text with intelligent punctuation handling
    and emoticon protection. Can be mixed into node classes that need text processing.
    
    Example:
        class MyTextNode(TextCleanerMixin):
            def process(self, text):
                return self.clean_text(text)
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
        i = len(text) - 1
        while i >= 0:
            char = text[i]
            if char.isalnum() or char.isspace() or '\u4e00' <= char <= '\u9fff':
                break
            i -= 1
        
        potential_emoticon = text[i + 1:]
        
        if len(potential_emoticon) < 2:
            return ""
        
        unique_chars = set(potential_emoticon)
        
        # Define pure punctuation marks (should NOT be treated as emoticons)
        pure_punctuation = {
            ',', '\uff0c', '\u3001',
            '.', '\u3002', '\uff0e',
            '!', '\uff01',
            '?', '\uff1f',
            ';', '\uff1b',
            ':', '\uff1a',
        }
        
        if unique_chars <= pure_punctuation:
            return ""
        
        # Define emoticon marker characters
        emoticon_markers = {
            '_', '^', '<', '>', 
            'T', 't', 'O', 'o', 
            '-', '~', '\'', '"', 
            '|', '\\', '/', 
            'v', 'V', 'w', 'W', 
            'x', 'X', 'u', 'U'
        }
        
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
        
        removable_punctuation = {
            ',', '\uff0c', '\u3001',
            '!', '\uff01',
            '?', '\uff1f',
            ';', '\uff1b',
            ':', '\uff1a',
        }
        
        period_marks = {'.', '\u3002', '\uff0e'}
        
        max_iterations = 100
        iteration = 0
        
        while iteration < max_iterations and s:
            iteration += 1
            original_s = s
            
            if not s:
                break
            
            last_char = s[-1]
            
            # Handle directly removable punctuation
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
            
            # Handle periods (check for ellipsis)
            if last_char in period_marks:
                count = 0
                for i in range(len(s) - 1, -1, -1):
                    if s[i] in period_marks:
                        count += 1
                    else:
                        break
                
                # Preserve exactly 3 periods (ellipsis)
                if count == 3:
                    if len(s) > 3 and s[-4] in period_marks:
                        total_count = 0
                        for i in range(len(s) - 1, -1, -1):
                            if s[i] in period_marks:
                                total_count += 1
                            else:
                                break
                        s = s[:-total_count].rstrip()
                        continue
                    else:
                        break
                
                if count > 0:
                    s = s[:-count].rstrip()
                    continue
            
            if s == original_s:
                break
        
        return s
