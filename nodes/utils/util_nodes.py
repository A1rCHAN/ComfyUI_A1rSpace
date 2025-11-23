"""
Utility nodes - boolean operations, math, image saver API, and custom value switching.

Provides utility nodes for boolean logic, integer math operations, server-side image saving,
and dynamic value switching between types.
"""
from ..common.shared_utils import AlwaysEqual, NumericConfig

# ========== Boolean Utility Nodes ==========

class SimpleBoolean:
    """Simple boolean pass-through node for workflow control."""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "enable": ("BOOLEAN", {"default": True}),
            }
        }

    RETURN_TYPES = ("BOOLEAN",)
    FUNCTION = "pass_through"
    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "A simple boolean pass-through node."

    def pass_through(self, enable):
        return (enable,)

class IntToBoolean:
    """Convert an integer value to boolean (0 = False, non-zero = True)."""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "input_int": ("INT", {"default": 0, "min": -0xffffffffffffffff, "max": 0xffffffffffffffff, "step": 1}),
            }
        }

    RETURN_TYPES = ("BOOLEAN",)
    FUNCTION = "IntToBoolean"
    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Convert an integer to a boolean value."

    def IntToBoolean(self, input_int):
        return (input_int != 0,)

class Boolean_AB:
    """Boolean toggle ensuring at least one is always enabled (mutual exclusion)."""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "enable_a": ("BOOLEAN", {"default": True}),
                "enable_b": ("BOOLEAN", {"default": False}),
            }
        }
    
    RETURN_TYPES = ("BOOLEAN", "BOOLEAN",)
    RETURN_NAMES = ("boolean_a", "boolean_b")
    FUNCTION = "boolean_ab"
    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Boolean toggle with always one behavior."

    def boolean_ab(self, enable_a, enable_b):
        if not enable_a and not enable_b:
            enable_a = True
        elif enable_a and enable_b:
            enable_b = False
        return (enable_a, enable_b)

class Boolean_A_B:
    """Boolean toggle with A as main control (A auto-enables when B is enabled)."""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "enable_a": ("BOOLEAN", {"default": True}),
                "enable_b": ("BOOLEAN", {"default": False}),
            }
        }
    
    RETURN_TYPES = ("BOOLEAN", "BOOLEAN",)
    RETURN_NAMES = ("boolean_a", "boolean_b")
    FUNCTION = "boolean_a_b"
    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Boolean toggle with one main behavior."

    def boolean_a_b(self, enable_a, enable_b):
        if (not enable_a) and enable_b:
            enable_a = True
        return (enable_a, enable_b)

# ========== Math Utility Nodes ==========

class MathInt:
    """Perform basic arithmetic operations on two integer values."""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "a": ("INT", {"default": 0, "min": -0xffffffffffffffff, "max": 0xffffffffffffffff, "step": 1}),
                "b": ("INT", {"default": 0, "min": -0xffffffffffffffff, "max": 0xffffffffffffffff, "step": 1}),
                "operation": (["add", "subtract", "multiply", "divide", "modulo", "power"],),
            },
        }

    RETURN_TYPES = ("INT",)
    FUNCTION = "int_math_operation"
    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Perform basic arithmetic operations (add, subtract, multiply, divide, modulo, power) on two integers."

    def int_math_operation(self, a, b, operation):
        if operation == "add":
            result = a + b
        elif operation == "subtract":
            result = a - b
        elif operation == "multiply":
            result = a * b
        elif operation == "divide":
            result = a // b if b != 0 else 0
        elif operation == "modulo":
            result = a % b if b != 0 else 0
        elif operation == "power":
            result = a ** b
        return (result,)

class MathLogicGate:
    """Perform logical operations (AND, OR, NOT) on boolean inputs."""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "a": ("BOOLEAN",),
                "b": ("BOOLEAN",),
                "operation": (["AND", "OR", "NOT"], {"default": "AND"}),
            },
        }

    RETURN_TYPES = ("BOOLEAN", "INT")
    FUNCTION = "logic_gate"
    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Perform logical operations on two boolean inputs."

    def logic_gate(self, a, b, operation):
        if operation == "AND":
            result = a and b
        elif operation == "OR":
            result = a or b
        elif operation == "NOT":
            result = not a

        int_value = 1 if result else 0
        return (result, int_value)

# ========== Custom Value Switching Nodes ==========

class Custom_Slider:
    """Switch between integer and float values dynamically based on switch_type."""
    
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
    """Convert boolean to integer with configurable true/false value mappings."""
    
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

# Exported mappings
UTIL_CLASS_MAPPINGS = {
    "A1r Simple Boolean": SimpleBoolean,
    "A1r Int to Boolean": IntToBoolean,
    "A1r Boolean AB": Boolean_AB,
    "A1r Boolean A B": Boolean_A_B,
    "A1r Math Int": MathInt,
    "A1r Math Logic Gate": MathLogicGate,
    "A1r Custom Slider": Custom_Slider,
    "A1r Custom Boolean": Custom_Boolean,
}

UTIL_DISPLAY_NAME_MAPPINGS = {
    "A1r Simple Boolean": "Simple Boolean",
    "A1r Int to Boolean": "Int to Boolean",
    "A1r Boolean AB": "Boolean A&B",
    "A1r Boolean A B": "Boolean A|B",
    "A1r Math Int": "Math Int",
    "A1r Math Logic Gate": "Math LogicGate",
    "A1r Custom Slider": "Custom Slider",
    "A1r Custom Boolean": "Custom Boolean",
}
