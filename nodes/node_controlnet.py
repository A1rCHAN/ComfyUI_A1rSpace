from .config import AlwaysEqual, NumericConfig
import folder_paths
import comfy.controlnet

# ControlNet_Config_Three: same as above, but three sets of inputs
"""
class ControlNet_Config_Three:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "cn_name_a": (folder_paths.get_filename_list("controlnet"),),
                "strength_a": ("FLOAT", NumericConfig.cn_strength_slider(),),
                "cn_start_a": ("FLOAT", NumericConfig.cn_percent_slider(),),
                "cn_end_a": ("FLOAT", NumericConfig.cn_percent_slider(),),

                "cn_name_b": (folder_paths.get_filename_list("controlnet"),),
                "strength_b": ("FLOAT", NumericConfig.cn_strength_slider(),),
                "cn_start_b": ("FLOAT", NumericConfig.cn_percent_slider(),),
                "cn_end_b": ("FLOAT", NumericConfig.cn_percent_slider(),),

                "cn_name_c": (folder_paths.get_filename_list("controlnet"),),
                "strength_c": ("FLOAT", NumericConfig.cn_strength_slider(),),
                "cn_start_c": ("FLOAT", NumericConfig.cn_percent_slider(),),
                "cn_end_c": ("FLOAT", NumericConfig.cn_percent_slider(),),
            }   
        }

    RETURN_TYPES = (AlwaysEqual('*'), "FLOAT", "FLOAT", "FLOAT",
                    AlwaysEqual('*'), "FLOAT", "FLOAT", "FLOAT",
                    AlwaysEqual('*'), "FLOAT", "FLOAT", "FLOAT",)
    RETURN_NAMES = ("name_a", "strength_a", "start_a", "end_a",
                    "name_b", "strength_b", "start_b", "end_b",
                    "name_c", "strength_c", "start_c", "end_c",)
    FUNCTION = "apply_cn_config"

    CATEGORY = "A1rSpace/ControlNet/Config"

    def apply_cn_config(self,
                        cn_name_a, strength_a, cn_start_a, cn_end_a,
                        cn_name_b, strength_b, cn_start_b, cn_end_b,
                        cn_name_c, strength_c, cn_start_c, cn_end_c):
        return (cn_name_a, strength_a, cn_start_a, cn_end_a,
                cn_name_b, strength_b, cn_start_b, cn_end_b,
                cn_name_c, strength_c, cn_start_c, cn_end_c)
    
"""
# power by ComfyUI Offical
# just add a toggle
"""
class ControlNetApply_Toggle:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
                "control_net": ("CONTROL_NET",),
                "image": ("IMAGE",),
                "strength": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 10.0, "step": 0.01}),
                "start_percent": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.001}),
                "end_percent": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.001}),
                "enable": ("BOOLEAN", {"default": True})
                },
            "optional": {
                "vae": ("VAE",),
            }
        }

    RETURN_TYPES = ("CONDITIONING","CONDITIONING",)
    RETURN_NAMES = ("positive", "negative",)
    FUNCTION = "apply_controlnet"

    CATEGORY = "A1rSpace/ControlNet"

    def apply_controlnet(self, positive, negative, control_net, image, strength, start_percent, end_percent, enable, vae=None, extra_concat=[]):
        if not enable or strength == 0:
            return (positive, negative)

        control_hint = image.movedim(-1,1)
        cnets = {}

        out = []
        for conditioning in [positive, negative]:
            c = []
            for t in conditioning:
                d = t[1].copy()

                prev_cnet = d.get('control', None)
                if prev_cnet in cnets:
                    c_net = cnets[prev_cnet]
                else:
                    c_net = control_net.copy().set_cond_hint(control_hint, strength, (start_percent, end_percent), vae=vae, extra_concat=extra_concat)
                    c_net.set_previous_controlnet(prev_cnet)
                    cnets[prev_cnet] = c_net

                d['control'] = c_net
                d['control_apply_to_uncond'] = False
                n = [t[0], d]
                c.append(n)
            out.append(c)
        return (out[0], out[1])
"""

CN_CLASS_MAPPINGS = {
    #"A1r ControlNet Config Three": ControlNet_Config_Three,
    #"A1r ControlNet Apply Toggle": ControlNetApply_Toggle,
}

CN_DISPLAY_NAME_MAPPINGS = {
    #"A1r ControlNet Config Three": "ControlNet Config Plus",
    #"A1r ControlNet Apply Toggle": "Apply ControlNet with Toggle",
}