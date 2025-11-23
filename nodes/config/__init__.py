# type: ignore
"""
Configuration nodes for ComfyUI A1rSpace extension.

This module provides configuration pad nodes for KSampler, LoRA, ControlNet,
and various workflow control utilities.
"""

# Re-export common utilities for backward compatibility
from ..common.config_loader import load_config
from ..common.shared_utils import AlwaysEqual, NumericConfig, TextCleanerMixin

__all__ = ['get_node_mappings', 'load_config', 'AlwaysEqual', 'NumericConfig', 'TextCleanerMixin']

# Lazy loading mechanism
_config_loaded = False
_CONFIG_CLASS_MAPPINGS = {}
_CONFIG_DISPLAY_NAME_MAPPINGS = {}


def _load_config_nodes():
    """Lazy load configuration nodes."""
    global _config_loaded, _CONFIG_CLASS_MAPPINGS, _CONFIG_DISPLAY_NAME_MAPPINGS
    
    if _config_loaded:
        return
    
    from .config_pads import CONFIG_CLASS_MAPPINGS, CONFIG_DISPLAY_NAME_MAPPINGS
    
    _CONFIG_CLASS_MAPPINGS.update(CONFIG_CLASS_MAPPINGS)
    _CONFIG_DISPLAY_NAME_MAPPINGS.update(CONFIG_DISPLAY_NAME_MAPPINGS)
    
    _config_loaded = True


def get_node_mappings():
    """
    Get node class and display name mappings.
    Called by main __init__.py during node registration.
    
    Returns:
        tuple: (CLASS_MAPPINGS, DISPLAY_NAME_MAPPINGS)
    """
    _load_config_nodes()
    return _CONFIG_CLASS_MAPPINGS, _CONFIG_DISPLAY_NAME_MAPPINGS
