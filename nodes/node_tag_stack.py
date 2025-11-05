class DraggableTextList:
    """
    A node with draggable text items that can be reordered
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text1": ("STRING", {"default": "First item", "multiline": False}),
                "text2": ("STRING", {"default": "Second item", "multiline": False}),
                "text3": ("STRING", {"default": "Third item", "multiline": False}),
                "text4": ("STRING", {"default": "Fourth item", "multiline": False}),
            },
            "optional": {
                # Hidden widget to store the order
                "item_order": ("STRING", {"default": "0,1,2,3", "multiline": False}),
            }
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("merged_text",)
    FUNCTION = "merge_in_order"
    CATEGORY = "A1rSpace/Developing"
    
    def merge_in_order(self, text1, text2, text3, text4, item_order="0,1,2,3"):
        """
        Merge texts according to the dragged order
        """
        texts = [text1, text2, text3, text4]
        
        # Parse order
        try:
            order = [int(x.strip()) for x in item_order.split(',')]
        except:
            order = [0, 1, 2, 3]
        
        # Reorder texts
        ordered_texts = [texts[i] for i in order if i < len(texts)]
        
        # Filter empty texts and join
        non_empty = [t for t in ordered_texts if t.strip()]
        result = ", ".join(non_empty)
        
        return (result,)


# Node registration
TEST_NODE_CLASS_MAPPINGS = {
    "A1r Draggable List": DraggableTextList,
}

TEST_NODE_DISPLAY_NAME_MAPPINGS = {
    "A1r Draggable List": "Draggable Text List"
}