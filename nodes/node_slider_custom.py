# Inspired from https://github.com/Smirnov75/ComfyUI-mxToolkit
# That was absolutely a great tool, I just make a lite version for my own workflow.
from .config import AlwaysEqual, NumericConfig

class Slider_Custom:
    def __init__(self):
        pass

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

    def out_value(self, int_value, float_value, switch_type):
        if switch_type > 0:
            out = float_value
        else:
            out = int_value
        return (out,)

SLIDER_CLASS_MAPPINGS = {
    "A1r Slider Custom": Slider_Custom,
}

SLIDER_DISPLAY_NAME_MAPPINGS = {
    "A1r Slider Custom": "Slider Custom",
}