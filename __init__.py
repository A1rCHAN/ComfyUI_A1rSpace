"""
A1rSpace Custom Nodes for ComfyUI
Author: A1rCHAN
Version: 1.2.0 (Refactored with lazy loading and modular structure)
Description: Custom nodes collection with optimized performance and organized architecture.

Major Changes in v1.2.0:
- Restructured nodes/ directory by functionality
- Implemented lazy loading for heavy dependencies
- Extracted common utilities to reduce code duplication
- Split requirements into core and optional dependencies
"""

import importlib
import traceback

# Version and metadata
__version__ = "1.2.0"
__author__ = "A1rCHAN"

# ComfyUI required exports
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
WEB_DIRECTORY = "./web"

# Node module registry with lazy loading support
# Format: (module_path, is_legacy_format)
# - New modules use get_node_mappings() function
# - Legacy modules use direct mapping variables
_NODE_MODULES = [
    # New modular structure (lazy loaded)
    ("nodes.samplers", False),
    ("nodes.loaders", False),
    ("nodes.text", False),
    ("nodes.transforms", False),
    ("nodes.config", False),
    ("nodes.utils", False),
    ("nodes.images", False),
    
    # Test/Development nodes
    ("nodes.node_tag_stack", ("TEST_NODE_CLASS_MAPPINGS", "TEST_NODE_DISPLAY_NAME_MAPPINGS")),
]


def _load_nodes():
    """
    Load all node modules and register their mappings.
    
    Supports two loading modes:
    1. New modules: Call get_node_mappings() for lazy loading
    2. Legacy modules: Direct import of mapping dictionaries
    """
    loaded_count = 0
    failed_count = 0
    
    for module_config in _NODE_MODULES:
        if isinstance(module_config, tuple) and len(module_config) == 2:
            module_name, loader_type = module_config
            
            # New modular structure (lazy loading)
            if loader_type is False:
                try:
                    mod = importlib.import_module(f".{module_name}", __package__)
                    
                    # Call get_node_mappings() to trigger lazy loading
                    if hasattr(mod, 'get_node_mappings'):
                        class_map, display_map = mod.get_node_mappings()
                        
                        if class_map:
                            NODE_CLASS_MAPPINGS.update(class_map)
                            loaded_count += len(class_map)
                        
                        if display_map:
                            NODE_DISPLAY_NAME_MAPPINGS.update(display_map)
                    else:
                        print(f"[A1rSpace] Warning: {module_name} missing get_node_mappings()")
                        failed_count += 1
                        
                except Exception as e:
                    print(f"[A1rSpace] Error loading {module_name}: {e}")
                    traceback.print_exc()
                    failed_count += 1
            
            # Legacy format (direct mapping variables)
            else:
                class_map_name, display_map_name = loader_type
                try:
                    mod = importlib.import_module(f".{module_name}", __package__)
                    
                    class_map = getattr(mod, class_map_name, None)
                    if class_map:
                        NODE_CLASS_MAPPINGS.update(class_map)
                        loaded_count += len(class_map)
                    
                    display_map = getattr(mod, display_map_name, None)
                    if display_map:
                        NODE_DISPLAY_NAME_MAPPINGS.update(display_map)
                        
                except Exception as e:
                    print(f"[A1rSpace] Warning: Failed to import {module_name}: {e}")
                    traceback.print_exc()
                    failed_count += 1
    
    return loaded_count, failed_count


def _register_api_routes():
    """Register custom API routes for image saving, filtering, etc."""
    try:
        from . import a1r_api
        print("[A1rSpace] API routes registered successfully")
    except Exception as e:
        print(f"[A1rSpace] Warning: Failed to register API routes: {e}")
        traceback.print_exc()


def _check_optional_dependencies():
    """
    Check optional dependencies and print installation hints.
    
    This helps users understand which features require additional packages.
    """
    optional_deps = {
        'Translation nodes': ['requests', 'openai'],
        'Image tagging nodes': ['onnxruntime', 'huggingface_hub'],
        'Advanced transforms': ['einops', 'kornia'],
    }
    
    missing_features = []
    
    for feature, deps in optional_deps.items():
        missing_deps = []
        for dep in deps:
            try:
                __import__(dep)
            except ImportError:
                missing_deps.append(dep)
        
        if missing_deps:
            missing_features.append((feature, missing_deps))
    
    if missing_features:
        print("\n" + "=" * 60)
        print("[A1rSpace] Optional dependencies not installed:")
        print("=" * 60)
        for feature, deps in missing_features:
            print(f"  • {feature}: pip install {' '.join(deps)}")
        print("\nNote: These features will be disabled until dependencies are installed.")
        print("=" * 60 + "\n")


# Initialize plugin
try:
    print("=" * 60)
    print(f"[A1rSpace] Loading v{__version__}...")
    
    loaded_count, failed_count = _load_nodes()
    _register_api_routes()
    
    # Check optional dependencies (only warn, don't fail)
    try:
        _check_optional_dependencies()
    except Exception as e:
        print(f"[A1rSpace] Warning: Failed to check optional dependencies: {e}")
    
    print("=" * 60)
    print(f"[A1rSpace] ✓ Loaded {loaded_count} nodes successfully!")
    if failed_count > 0:
        print(f"[A1rSpace] ✗ Failed to load {failed_count} modules (see warnings above)")
    print("=" * 60)
    
except Exception as e:
    print("=" * 60)
    print(f"[A1rSpace] ✗ CRITICAL ERROR during initialization: {e}")
    print("=" * 60)
    traceback.print_exc()

# Export for ComfyUI
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
