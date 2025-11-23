# type: ignore
"""
Configuration loading utilities for ComfyUI A1rSpace extension.

Provides centralized configuration management with automatic fallback
to template files and caching for improved performance.
"""
import os
import json

# Cache configuration data globally
_config_data = None
_base_path = None
_config_path = None

def load_config():
    """
    Load configuration from config.json.
    
    Configuration is cached after first load for improved performance.
    
    Returns:
        dict: Configuration data with base_path added
        
    Raises:
        Exception: If configuration file not found or invalid JSON
    """
    global _config_data, _base_path, _config_path

    if _config_data is not None:
        return _config_data

    if _base_path is None:
        # Calculate paths relative to common/ directory
        plugin_base_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        _config_path = os.path.join(plugin_base_path, "../config.json")

    try:
        if os.path.exists(_config_path):
            with open(_config_path, "r", encoding='utf-8') as f:
                content = f.read()
                _config_data = json.loads(content)
        else:
            # Create default config if not exists
            _config_data = {"Baidu": {"AppId": "", "Secret": ""}, "DeepSeek": {"api_key": ""}}
            with open(_config_path, "w", encoding='utf-8') as f:
                json.dump(_config_data, f, indent=4, ensure_ascii=False)

        _config_data["base_path"] = os.path.dirname(os.path.dirname(plugin_base_path))
        return _config_data

    except FileNotFoundError as e:
        raise Exception(f"[A1rSpace] Configuration file not found: {e}")
    except json.JSONDecodeError as e:
        raise Exception(f"[A1rSpace] Invalid JSON in configuration file: {e}")
    except Exception as e:
        raise Exception(f"[A1rSpace] Error loading configuration: {e}")


def reload_config():
    """
    Reload configuration from disk.
    """
    global _config_data
    _config_data = None
    return load_config()


class AlwaysEqual(str):
    """
    Special string class that always returns True for equality comparisons.
    
    Used for wildcard type matching in ComfyUI node connections, allowing
    flexible connections between nodes without strict type checking.
    
    Example:
        RETURN_TYPES = (AlwaysEqual('*'), "INT")  # First output accepts any connection
    """
    
    def __eq__(self, other):
        return True
    
    def __ne__(self, other):
        return False
