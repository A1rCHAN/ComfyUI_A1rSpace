def get_node_mappings():
    from .util_nodes import UTIL_CLASS_MAPPINGS, UTIL_DISPLAY_NAME_MAPPINGS
    from .util_observer import UTIL_OB_CLASS_MAPPINGS, UTIL_OB_DISPLAY_NAME_MAPPINGS
    return {
        **UTIL_CLASS_MAPPINGS,
        **UTIL_OB_CLASS_MAPPINGS
    }, {
        **UTIL_DISPLAY_NAME_MAPPINGS,
        **UTIL_OB_DISPLAY_NAME_MAPPINGS
    }