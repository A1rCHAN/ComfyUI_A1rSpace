class KSampler_ControlPad_Advanced:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image_detailer": ("BOOLEAN", {"default": False, "label_on": "On", "label_off": "Off"}),
                "generate_ksampler": ("BOOLEAN", {"default": True, "label_on": "On", "label_off": "Off"}),
                "latent_upscale": ("BOOLEAN", {"default": False, "label_on": "On", "label_off": "Off"}),
                "face_detailer": ("BOOLEAN", {"default": False, "label_on": "On", "label_off": "Off"}),
                "hand_detailer": ("BOOLEAN", {"default": False, "label_on": "On", "label_off": "Off"}),
                "debug_detailer": ("BOOLEAN", {"default": False, "label_on": "On", "label_off": "Off"}),
            }   
        }

    RETURN_TYPES = ("BOOLEAN", "BOOLEAN", "BOOLEAN", "BOOLEAN", "BOOLEAN", "BOOLEAN",)
    RETURN_NAMES = ("image_detailer", "generate_ksampler", "latent_upscale", "face_detailer", "hand_detailer", "debug_detailer",)
    FUNCTION = "control_ks"

    CATEGORY = "A1rSpace/Control"

    def control_ks(self, image_detailer, generate_ksampler, latent_upscale, face_detailer, hand_detailer, debug_detailer):
        image = bool(image_detailer)
        gen = bool(generate_ksampler)
        latent = bool(latent_upscale)
        face = bool(face_detailer)
        hand = bool(hand_detailer)
        debug = bool(debug_detailer)

        # 1
        if image and latent:
            image = False
            gen = True
            debug = False
            face = False
            hand = False
        # 2
        if gen and debug:
            image = True
            gen = False
            latent = False
            face = False
            hand = False
            debug = True
        # 3
        if image:
            gen = False
            latent = False
            if face or hand:
                debug = False
            else:
                debug = True
        # 4
        if image and gen:
            gen = False
        if not image and not gen:
            gen = True
        # 5
        if gen:
            debug = False

        return (image, gen, latent, face, hand, debug)

class LoRA_ControlPad:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "toggle_all": ("BOOLEAN", {"default": False}),
                "lora_1": ("BOOLEAN", {"default": False, "label_on": "On", "label_off": "Off"}),
                "lora_2": ("BOOLEAN", {"default": False, "label_on": "On", "label_off": "Off"}),
                "lora_3": ("BOOLEAN", {"default": False, "label_on": "On", "label_off": "Off"}),
                "lora_4": ("BOOLEAN", {"default": False, "label_on": "On", "label_off": "Off"}),
                "lora_5": ("BOOLEAN", {"default": False, "label_on": "On", "label_off": "Off"}),
                "lora_6": ("BOOLEAN", {"default": False, "label_on": "On", "label_off": "Off"}),
            }
        }

    RETURN_TYPES = ("BOOLEAN", "BOOLEAN", "BOOLEAN", "BOOLEAN", "BOOLEAN", "BOOLEAN",)
    RETURN_NAMES = ("lora_1", "lora_2", "lora_3", "lora_4", "lora_5", "lora_6",)
    FUNCTION = "control_la"

    CATEGORY = "A1rSpace/Control"

    def control_la(self, toggle_all, lora_1, lora_2, lora_3, lora_4, lora_5, lora_6):
        if toggle_all:
            lora_1 = True
            lora_2 = True
            lora_3 = True
            lora_4 = True
            lora_5 = True
            lora_6 = True
        return (lora_1, lora_2, lora_3, lora_4, lora_5, lora_6)

class Seed_Control:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
            }
        }

    RETURN_TYPES = ("INT", "STRING",)
    RETURN_NAMES = ("seed", "string")
    FUNCTION = "put_seed"

    CATEGORY = "A1rSpace/Utils"

    def put_seed(self, seed):
        string_value = str(seed)
        return {
            "ui": {
                "seed": [string_value],
            },
            "result": (seed, string_value),
        }

CONTROL_CLASS_MAPPINGS = {
    "A1r KSampler ControlPad Advanced": KSampler_ControlPad_Advanced,
    "A1r LoRA ControlPad": LoRA_ControlPad,
    "A1r Seed Control": Seed_Control,
}

CONTROL_DISPLAY_NAME_MAPPINGS = {
    "A1r KSampler ControlPad Advanced": "KSampler ControlPad AD",
    "A1r LoRA ControlPad": "LoRA Control Pad",
    "A1r Seed Control": "Seed Control",
}