# type: ignore
from .config import ModelList, NumericConfig
import folder_paths
import comfy.sd
import comfy.utils
import torch

class Double_CheckpointLoader:
    def __init__(self):
        pass
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "ckpt_name_a": (ModelList.ckpt_list(),),
                "ckpt_name_b": (ModelList.ckpt_list(),),
                "enable_second": ("BOOLEAN", {"default": False}),
            }
        }
    
    RETURN_TYPES = ("MODEL", "CLIP", "VAE", "MODEL", "CLIP", "VAE", "INT")
    RETURN_NAMES = ("MODEL_A", "CLIP_A", "VAE_A", "MODEL_B", "CLIP_B", "VAE_B", "int_value")
    FUNCTION = "load_ckpt"
    
    CATEGORY = "A1rSpace/Loader"

    def load_ckpt(self, ckpt_name_a, ckpt_name_b=None, enable_second=False):
        LOADER_path_1 = folder_paths.get_full_path_or_raise("checkpoints", ckpt_name_a)
        out1 = comfy.sd.load_checkpoint_guess_config(
            LOADER_path_1, 
            output_vae=True, 
            output_clip=True,
            embedding_directory=folder_paths.get_folder_paths("embeddings")
        )
        
        model_2, clip_2, vae_2 = None, None, None
        
        if enable_second and ckpt_name_b:
            LOADER_path_2 = folder_paths.get_full_path_or_raise("checkpoints", ckpt_name_b)
            out2 = comfy.sd.load_checkpoint_guess_config(
                LOADER_path_2, 
                output_vae=True, 
                output_clip=True,
                embedding_directory=folder_paths.get_folder_paths("embeddings")
            )
            model_2, clip_2, vae_2 = out2[0], out2[1], out2[2]
        
        int_value = 2 if (enable_second and ckpt_name_b) else 1
        
        return (out1[0], out1[1], out1[2], model_2, clip_2, vae_2, int_value)

class Six_LoraLoader:
    def __init__(self):
        self.loaded_loras = {}
    
    @classmethod
    def INPUT_TYPES(cls):
        inputs = {
            "required": {
                "model": ("MODEL",),
                "clip": ("CLIP",),
            }
        }

        lora_list = ModelList.lora_list()
        
        for i in range(1, 7):
            inputs["required"].update({
                f"enable_lora_{i}": ("BOOLEAN", {"default": False}),
                f"lora_name_{i}": (lora_list,),
                f"model_strength_{i}": ("FLOAT", NumericConfig.default_float()),
                f"clip_strength_{i}": ("FLOAT", NumericConfig.default_float()),
            })
        
        return inputs

    RETURN_TYPES = ("MODEL", "CLIP",)
    FUNCTION = "load_lora"

    CATEGORY = "A1rSpace/Loader"

    def load_lora(self, model, clip, **kwargs):
        current_model = model
        current_clip = clip
        
        # Process each of the 6 LoRA groups
        for i in range(1, 7):
            enable = kwargs.get(f"enable_lora_{i}")
            lora_name = kwargs.get(f"lora_name_{i}")
            model_strength = kwargs.get(f"model_strength_{i}")
            clip_strength = kwargs.get(f"clip_strength_{i}")
            
            # Skip if LoRA is disabled or set to "None"
            if not enable or lora_name == "None":
                continue
                
            # Skip if both strengths are zero
            if model_strength == 0 and clip_strength == 0:
                continue
                
            # Get full path to LoRA file
            lora_path = folder_paths.get_full_path("loras", lora_name)
            
            # Load LoRA file (using cache if available)
            if lora_path in self.loaded_loras:
                lora = self.loaded_loras[lora_path]
            else:
                lora = comfy.utils.load_torch_file(lora_path, safe_load=True)
                self.loaded_loras[lora_path] = lora
                
            # Apply LoRA to current model and clip
            try:
                current_model, current_clip = comfy.sd.load_lora_for_models(
                    current_model, current_clip, lora, model_strength, clip_strength
                )
            except Exception as e:
                print(f"Not applying LoRA {lora_name}: {e}")
                continue
            
        return (current_model, current_clip,)

class Toggle_VAE_Loader:
    @staticmethod
    def vae_list():
        vaes = folder_paths.get_filename_list("vae")
        approx_vaes = folder_paths.get_filename_list("vae_approx")
        sdxl_taesd_enc = False
        sdxl_taesd_dec = False
        sd1_taesd_enc = False
        sd1_taesd_dec = False
        sd3_taesd_enc = False
        sd3_taesd_dec = False
        f1_taesd_enc = False
        f1_taesd_dec = False

        for v in approx_vaes:
            if v.startswith("taesd_decoder."):
                sd1_taesd_dec = True
            elif v.startswith("taesd_encoder."):
                sd1_taesd_enc = True
            elif v.startswith("taesdxl_decoder."):
                sdxl_taesd_dec = True
            elif v.startswith("taesdxl_encoder."):
                sdxl_taesd_enc = True
            elif v.startswith("taesd3_decoder."):
                sd3_taesd_dec = True
            elif v.startswith("taesd3_encoder."):
                sd3_taesd_enc = True
            elif v.startswith("taef1_encoder."):
                f1_taesd_dec = True
            elif v.startswith("taef1_decoder."):
                f1_taesd_enc = True
        if sd1_taesd_dec and sd1_taesd_enc:
            vaes.append("taesd")
        if sdxl_taesd_dec and sdxl_taesd_enc:
            vaes.append("taesdxl")
        if sd3_taesd_dec and sd3_taesd_enc:
            vaes.append("taesd3")
        if f1_taesd_dec and f1_taesd_enc:
            vaes.append("taef1")
        vaes.append("pixel_space")
        return vaes

    @staticmethod
    def load_taesd(name):
        sd = {}
        approx_vaes = folder_paths.get_filename_list("vae_approx")

        encoder = next(filter(lambda a: a.startswith("{}_encoder.".format(name)), approx_vaes))
        decoder = next(filter(lambda a: a.startswith("{}_decoder.".format(name)), approx_vaes))

        enc = comfy.utils.load_torch_file(folder_paths.get_full_path_or_raise("vae_approx", encoder))
        for k in enc:
            sd["taesd_encoder.{}".format(k)] = enc[k]

        dec = comfy.utils.load_torch_file(folder_paths.get_full_path_or_raise("vae_approx", decoder))
        for k in dec:
            sd["taesd_decoder.{}".format(k)] = dec[k]

        if name == "taesd":
            sd["vae_scale"] = torch.tensor(0.18215)
            sd["vae_shift"] = torch.tensor(0.0)
        elif name == "taesdxl":
            sd["vae_scale"] = torch.tensor(0.13025)
            sd["vae_shift"] = torch.tensor(0.0)
        elif name == "taesd3":
            sd["vae_scale"] = torch.tensor(1.5305)
            sd["vae_shift"] = torch.tensor(0.0609)
        elif name == "taef1":
            sd["vae_scale"] = torch.tensor(0.3611)
            sd["vae_shift"] = torch.tensor(0.1159)
        return sd

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "vae_name": (s.vae_list(), ),
                "enable_vae": ("BOOLEAN", {"default": False}),
            },
        }
    RETURN_TYPES = ("VAE",)
    FUNCTION = "load_vae"

    CATEGORY = "A1rSpace/Loader"

    def load_vae(self, vae_name, enable_vae=False):
        if not enable_vae:
            return (comfy.sd.VAE(),)
        
        if vae_name == "pixel_space":
            sd = {}
            sd["pixel_space_vae"] = torch.tensor(1.0)
        elif vae_name in ["taesd", "taesdxl", "taesd3", "taef1"]:
            sd = self.load_taesd(vae_name)
        else:
            vae_path = folder_paths.get_full_path_or_raise("vae", vae_name)
            sd = comfy.utils.load_torch_file(vae_path)
        vae = comfy.sd.VAE(sd=sd)
        vae.throw_exception_if_invalid()
        return (vae,)

LOADER_CLASS_MAPPINGS = {
    "A1r Conditional CheckpointLoader": Double_CheckpointLoader,
    "A1r Six LoRA Loader": Six_LoraLoader,
    "A1r Toggle VAE Loader": Toggle_VAE_Loader,
}

LOADER_DISPLAY_NAME_MAPPINGS = {
    "A1r Conditional CheckpointLoader": "A&B Checkpoint Loader",
    "A1r Six LoRA Loader": "Six LoRA Loader",
    "A1r Toggle VAE Loader": "Toggle VAE Loader",
}