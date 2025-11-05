"""
A1rSpace Custom Nodes for ComfyUI
Author: A1rCHAN
Version: 1.1.0
Description: Custom nodes collection including utilities, loaders, samplers, and more.
"""

import importlib
import traceback

# Version and metadata
__version__ = "1.1.0"
__author__ = "A1rCHAN"

# ComfyUI required exports
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
WEB_DIRECTORY = "./web"

# Node modules to load
_NODE_MODULES = [
	("nodes.nodes_config", ("CONFIG_CLASS_MAPPINGS", "CONFIG_DISPLAY_NAME_MAPPINGS")),
	("nodes.nodes_custom", ("CUSTOM_CLASS_MAPPINGS", "CUSTOM_DISPLAY_NAME_MAPPINGS")),
	("nodes.nodes_ksampler", ("KSAMPLER_CLASS_MAPPINGS", "KSAMPLER_DISPLAY_NAME_MAPPINGS")),
	("nodes.nodes_loader", ("LOADER_CLASS_MAPPINGS", "LOADER_DISPLAY_NAME_MAPPINGS")),
	("nodes.nodes_switch", ("SWITCH_CLASS_MAPPINGS", "SWITCH_DISPLAY_NAME_MAPPINGS")),
	("nodes.nodes_text", ("TEXT_CLASS_MAPPINGS", "TEXT_DISPLAY_NAME_MAPPINGS")),
	("nodes.nodes_utils", ("UTILS_CLASS_MAPPINGS", "UTILS_DISPLAY_NAME_MAPPINGS")),
	("nodes.node_tag_stack", ("TEST_NODE_CLASS_MAPPINGS", "TEST_NODE_DISPLAY_NAME_MAPPINGS")),
]

def _load_nodes():
	"""Load all node modules and register their mappings."""
	for module_name, (class_map_name, display_map_name) in _NODE_MODULES:
		try:
			mod = importlib.import_module(f".{module_name}", __package__)
			
			class_map = getattr(mod, class_map_name, None)
			if class_map:
				NODE_CLASS_MAPPINGS.update(class_map)
			
			display_map = getattr(mod, display_map_name, None)
			if display_map:
				NODE_DISPLAY_NAME_MAPPINGS.update(display_map)
				
		except Exception as e:
			print(f"[A1rSpace] Warning: Failed to import {module_name}: {e}")
			traceback.print_exc()

def _register_api_routes():
	"""Register API routes for custom endpoints."""
	try:
		from . import a1r_api
	except Exception as e:
		print(f"[A1rSpace] Warning: Failed to register API routes: {e}")
		traceback.print_exc()

# Initialize
_load_nodes()
_register_api_routes()

# Print startup message
print("=" * 60)
print(f"A1rSpace v{__version__}: Loaded {len(NODE_CLASS_MAPPINGS)} nodes successfully!")
print("=" * 60)

# Export for ComfyUI
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]