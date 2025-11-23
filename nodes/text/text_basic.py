# type: ignore
"""
Basic text processing nodes for ComfyUI A1rSpace extension.

This module provides text manipulation, merging, and display nodes
without any optional dependencies.
"""
import time
from inspect import stack
from ..common.shared_utils import TextCleanerMixin

def print_log(str_msg):
    """Print log message with timestamp and caller information."""
    str_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    try:
        caller = stack()[1]
        caller_info = f"[{caller[1]}, line: {caller[2]}]"
    except Exception:
        caller_info = ""
    print(f"[A1rSpace][{str_time}]{caller_info}: {str_msg}")


def _encode_with_clip(clip_obj, text):
    """Encode text with a clip-like object and return a conditioning list.

    Returns a list in the format expected by downstream nodes: [[cond, extra_dict]]
    If clip_obj is None or encoding fails, returns `[[]]` to represent an empty conditioning.
    """
    if clip_obj is None:
        return [[]]
    try:
        tokens = clip_obj.tokenize(text)
        # Some clip implementations return (cond, pooled) while others return a dict when
        # `return_dict=True` is used. Try the simple tuple form first.
        try:
            cond, pooled = clip_obj.encode_from_tokens(tokens, return_pooled=True)
            return [[cond, {"pooled_output": pooled}]]
        except TypeError:
            output = clip_obj.encode_from_tokens(tokens, return_pooled=True, return_dict=True)
            cond = output.pop("cond")
            return [[cond, output]]
    except Exception as e:
        print_log(f"Error encoding with clip: {e}")
        return [[]]

class TextBox:
    """
    Basic text input node for entering and outputting text strings.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"default": "", "multiline": True}),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "output_text"
    
    CATEGORY = "A1rSpace/Text"
    DESCRIPTION = "Basic text input node for entering multiline text strings."

    def output_text(self, text):
        return (text,)


class TextShow:
    """
    Display text with formatted output (shown in node preview).
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"forceInput": True}),
            }
        }

    INPUT_IS_LIST = True
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "show_text"
    OUTPUT_NODE = True

    CATEGORY = "A1rSpace/Text"
    DESCRIPTION = "Display text in node preview with formatted output."

    def show_text(self, text):
        text_str = "\n".join(text) if isinstance(text, list) else str(text)
        return {"ui": {"text": [text_str]}, "result": (text_str,)}


class TextMerge(TextCleanerMixin):
    """
    Merge two text strings with customizable separator.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text_a": ("STRING", {"default": "", "multiline": True}),
                "text_b": ("STRING", {"default": "", "multiline": True}),
                "separator": ("STRING", {"default": ", "}),
            },
            "optional": {
                "clip": ("CLIP",),
            }
        }

    RETURN_TYPES = ("CONDITIONING", "STRING")
    RETURN_NAMES = ("conditioning", "text")
    FUNCTION = "merge_text"

    CATEGORY = "A1rSpace/Text"
    DESCRIPTION = "Merge two text strings with customizable separator."

    def merge_text(self, text_a, text_b, separator, clip=None):
        text_a = self.clean_text(text_a)
        text_b = self.clean_text(text_b)

        if not text_a and not text_b:
            merged_text = ""
        elif not text_a:
            merged_text = text_b
        elif not text_b:
            merged_text = text_a
        else:
            merged_text = f"{text_a}{separator}{text_b}"
        
        conditioning = _encode_with_clip(clip, merged_text)
        
        return (conditioning, merged_text)


# Exported mappings
TEXT_BASIC_CLASS_MAPPINGS = {
    "A1r Text Box": TextBox,
    "A1r Text Show": TextShow,
    "A1r Text Merge": TextMerge,
}

TEXT_BASIC_DISPLAY_NAME_MAPPINGS = {
    "A1r Text Box": "Text Box",
    "A1r Text Show": "Text Show",
    "A1r Text Merge": "Text Merge",
}
