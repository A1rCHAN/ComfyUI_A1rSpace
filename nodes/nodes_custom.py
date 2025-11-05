"""
Custom utility nodes for ComfyUI A1rSpace extension.

This module provides custom control nodes for dynamic value switching
and boolean-to-integer conversion with configurable mappings.
"""
from .config import AlwaysEqual, NumericConfig

class Custom_Slider:
    """
    Switch between integer and float values dynamically based on switch_type.
    """
    
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "int_value": ("INT", NumericConfig.custom_int_float()),
                "float_value": ("FLOAT", NumericConfig.custom_int_float()),
                "switch_type": ("INT", {"default": 0, "min": 0, "max": 1}),
            },
        }

    RETURN_TYPES = (AlwaysEqual('*'),)
    RETURN_NAMES = ("value",)
    FUNCTION = "out_value"
    
    CATEGORY = 'A1rSpace/Utils'
    DESCRIPTION = "Switch between integer and float values dynamically based on switch_type (0=int, 1=float)."

    def out_value(self, int_value, float_value, switch_type):
        if switch_type > 0:
            out = float_value
        else:
            out = int_value
        return (out,)

class Custom_Boolean:
    """
    Convert boolean to integer with configurable true/false value mappings.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "input_bool": ("BOOLEAN", {"default": True}),
                "true_value": ("INT", {"default": 1, "min": -0xffffffffffffffff, "max": 0xffffffffffffffff, "step": 1}),
                "false_value": ("INT", {"default": 0, "min": -0xffffffffffffffff, "max": 0xffffffffffffffff, "step": 1}),
            }
        }
    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("integer",)
    FUNCTION = "put_value"

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Convert a boolean value to a custom integer (configurable true/false mapping)."
    
    def put_value(self, input_bool, true_value, false_value):
        return (true_value if input_bool else false_value,)

CUSTOM_CLASS_MAPPINGS = {
    "A1r Custom Slider": Custom_Slider,
    "A1r Custom Boolean": Custom_Boolean,
}

CUSTOM_DISPLAY_NAME_MAPPINGS = {
    "A1r Custom Slider": "Custom Slider",
    "A1r Custom Boolean": "Custom Boolean",
}