import importlib
import traceback

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

_MODULES = [
	("nodes.node_ksampler", ("KSAMPLER_CLASS_MAPPINGS", "KSAMPLER_DISPLAY_NAME_MAPPINGS")),
	("nodes.node_loader", ("LOADER_CLASS_MAPPINGS", "LOADER_DISPLAY_NAME_MAPPINGS")),
	("nodes.node_upscale", ("UPSCALE_CLASS_MAPPINGS", "UPSCALE_DISPLAY_NAME_MAPPINGS")),
	("nodes.node_controlnet", ("CN_CLASS_MAPPINGS", "CN_DISPLAY_NAME_MAPPINGS")),
	("nodes.node_utils", ("UTILS_CLASS_MAPPINGS", "UTILS_DISPLAY_NAME_MAPPINGS")),
	("nodes.node_text", ("TEXT_CLASS_MAPPINGS", "TEXT_DISPLAY_NAME_MAPPINGS")),
	("nodes.node_switch", ("SWITCH_CLASS_MAPPINGS", "SWITCH_DISPLAY_NAME_MAPPINGS")),
	("nodes.node_config_pad", ("CONFIG_CLASS_MAPPINGS", "CONFIG_DISPLAY_NAME_MAPPINGS")),
	("nodes.node_control_pad", ("CONTROL_CLASS_MAPPINGS", "CONTROL_DISPLAY_NAME_MAPPINGS")),
	("nodes.node_slider_custom", ("SLIDER_CLASS_MAPPINGS", "SLIDER_DISPLAY_NAME_MAPPINGS")),
	("nodes.JoyTag.node_joytag", ("JOYTAG_CLASS_MAPPINGS", "JOYTAG_DISPLAY_NAME_MAPPINGS")),
]

for module_name, exported in _MODULES:
	try:
		mod = importlib.import_module(f".{module_name}", __package__)
		class_map = getattr(mod, exported[0], None)
		disp_map = getattr(mod, exported[1], None)
		if class_map:
			NODE_CLASS_MAPPINGS.update(class_map)
		if disp_map:
			NODE_DISPLAY_NAME_MAPPINGS.update(disp_map)
	except Exception as e:
		print(f"[A1rSpace] Warning: failed to import {module_name}: {e}")
		traceback.print_exc()

WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]

__version__ = "1.0.3"

print("==========================================================")
print(" ")
print(f"A1rSpace: Loaded {len(NODE_CLASS_MAPPINGS)} nodes successfully!")
print(" ")
print("==========================================================")