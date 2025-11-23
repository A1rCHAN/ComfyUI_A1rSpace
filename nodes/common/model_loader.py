# type: ignore
"""
Model loading utilities for ComfyUI A1rSpace extension.

Provides base class for loading checkpoints, VAEs, LoRAs, and ControlNets.
"""
import torch
import folder_paths
import comfy.sd
import comfy.utils
import comfy.controlnet


class ModelLoaderBase:
    """
    Base class for loading and applying models, LoRAs, VAEs, and ControlNets.
    
    Provides static methods for loading various model types and applying LoRAs
    with caching support for improved performance.
    """
    _lora_cache = {}

    @staticmethod
    def load_checkpoint(ckpt_name):
        """Load a checkpoint file."""
        ckpt_path = folder_paths.get_full_path_or_raise("checkpoints", ckpt_name)
        out = comfy.sd.load_checkpoint_guess_config(
            ckpt_path,
            output_vae=True,
            output_clip=True,
            embedding_directory=folder_paths.get_folder_paths("embeddings")
        )
        return out[0], out[1], out[2]
    
    @staticmethod
    def load_taesd(name):
        """Load TAESD VAE."""
        sd = {}
        approx_vaes = folder_paths.get_filename_list("vae_approx")

        encoder = next(filter(lambda a: a.startswith(f"{name}_encoder."), approx_vaes), None)
        decoder = next(filter(lambda a: a.startswith(f"{name}_decoder."), approx_vaes), None)
        
        if not encoder or not decoder:
            raise FileNotFoundError(f"TAESD files not found for {name}")

        enc = comfy.utils.load_torch_file(folder_paths.get_full_path_or_raise("vae_approx", encoder))
        for k in enc:
            sd[f"taesd_encoder.{k}"] = enc[k]

        dec = comfy.utils.load_torch_file(folder_paths.get_full_path_or_raise("vae_approx", decoder))
        for k in dec:
            sd[f"taesd_decoder.{k}"] = dec[k]
        
        scale_shift_map = {
            "taesd": (0.18215, 0.0),
            "taesdxl": (0.13025, 0.0),
            "taesd3": (1.5305, 0.0609),
            "taef1": (0.3611, 0.1159),
        }

        if name in scale_shift_map:
            scale, shift = scale_shift_map[name]
            sd["vae_scale"] = torch.tensor(scale)
            sd["vae_shift"] = torch.tensor(shift)
        
        return sd
    
    @staticmethod
    def load_vae(vae_name):
        """Load a VAE file."""
        if vae_name == "None":
            return None
        
        try:
            if vae_name == "pixel_space":
                sd = {"pixel_space_vae": torch.tensor(1.0)}
            elif vae_name in ["taesd", "taesdxl", "taesd3", "taef1"]:
                sd = ModelLoaderBase.load_taesd(vae_name)
            else:
                vae_path = folder_paths.get_full_path_or_raise("vae", vae_name)
                sd = comfy.utils.load_torch_file(vae_path)
            
            vae = comfy.sd.VAE(sd=sd)
            vae.throw_exception_if_invalid()
            return vae
            
        except Exception as e:
            print(f"[ModelLoaderBase] Failed to load VAE {vae_name}: {e}")
            return None
    
    @classmethod
    def load_lora_file(cls, lora_name):
        """Load a LoRA file from disk with caching."""
        try:
            lora_path = folder_paths.get_full_path_or_raise("loras", lora_name)

            if lora_path in cls._lora_cache:
                return cls._lora_cache[lora_path]

            lora = comfy.utils.load_torch_file(lora_path, safe_load=True)
            cls._lora_cache[lora_path] = lora
            return lora

        except Exception as e:
            print(f"[ModelLoaderBase] Failed to load LoRA {lora_name}: {e}")
            return None
    
    @classmethod
    def apply_lora_single(cls, model, clip, lora_name, model_strength, clip_strength):
        """Apply a single LoRA to model and clip."""
        if not lora_name or lora_name == "None":
            return (model, clip)
        
        if model_strength == 0 and clip_strength == 0:
            return (model, clip)
        
        lora = cls.load_lora_file(lora_name)
        if lora is None:
            return (model, clip)
        
        try:
            new_model, new_clip = comfy.sd.load_lora_for_models(
                model, clip, lora, 
                model_strength or 0.0, 
                clip_strength or 0.0
            )
            return (new_model, new_clip)
        except Exception as e:
            print(f"[ModelLoaderBase] Failed to apply LoRA {lora_name}: {e}")
            return (model, clip)
    
    @classmethod
    def apply_lora_stack(cls, model, clip, lora_stack):
        """Apply a stack of LoRAs with adaptive strength handling."""
        current_model = model
        current_clip = clip

        if not isinstance(lora_stack, dict):
            return (current_model, current_clip)
        
        entries = lora_stack.get("entries", [])
        if not isinstance(entries, (list, tuple)):
            return (current_model, current_clip)
        
        for entry in entries:
            try:
                enabled = bool(entry.get("enabled", False))
                name = entry.get("name")
                
                # Adaptive strength handling
                if "model_strength" in entry and "clip_strength" in entry:
                    model_strength = float(entry.get("model_strength", 0.0))
                    clip_strength = float(entry.get("clip_strength", 0.0))
                elif "strength" in entry:
                    strength = float(entry.get("strength", 0.0))
                    model_strength = strength
                    clip_strength = strength
                else:
                    model_strength = 0.0
                    clip_strength = 0.0
                    
            except Exception as e:
                print(f"[ModelLoaderBase] Error parsing LoRA stack entry: {e}")
                continue

            if not enabled or not name or name == "None":
                continue
            if model_strength == 0.0 and clip_strength == 0.0:
                continue

            current_model, current_clip = cls.apply_lora_single(
                current_model, current_clip, name, model_strength, clip_strength
            )

        return (current_model, current_clip)
    
    @staticmethod
    def load_controlnet(control_net_name):
        """Load a ControlNet model."""
        try:
            controlnet_path = folder_paths.get_full_path_or_raise("controlnet", control_net_name)
            control_net = comfy.controlnet.load_controlnet(controlnet_path)
            
            if control_net is None:
                raise RuntimeError(
                    f"ControlNet file '{control_net_name}' is invalid and does not contain a valid controlnet model."
                )
            return control_net
        except Exception as e:
            print(f"[ModelLoaderBase] Failed to load ControlNet '{control_net_name}': {e}")
            return None
    
    @staticmethod
    def apply_controlnet(positive, negative, image, control_net, strength, start_percent, end_percent, vae=None):
        """Apply a ControlNet to conditioning."""
        control_hint = image.movedim(-1, 1)
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
                    c_net = control_net.copy().set_cond_hint(
                        control_hint, 
                        strength, 
                        (start_percent, end_percent), 
                        vae=vae
                    )
                    c_net.set_previous_controlnet(prev_cnet)
                    cnets[prev_cnet] = c_net

                d['control'] = c_net
                d['control_apply_to_uncond'] = False
                n = [t[0], d]
                c.append(n)
            out.append(c)
        
        return (out[0], out[1])
