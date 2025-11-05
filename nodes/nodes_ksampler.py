# type: ignore
"""
KSampler nodes for A1rSpace
Provides unified sampling interface and sampler/scheduler selection utilities.
"""

import torch
import comfy.sample
import comfy.model_management as mm
import comfy.utils
import comfy
import latent_preview

from .config import AlwaysEqual, ModelList, NumericConfig


def _to_int(name, v):
    """
    Convert value to integer with detailed error handling.
    
    Args:
        name: Parameter name for error messages
        v: Value to convert (int, float, or string)
    
    Returns:
        Integer value
    
    Raises:
        TypeError: If conversion fails
    """
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        return int(v)
    if isinstance(v, str):
        v_strip = v.strip()
        if v_strip.isdigit():
            return int(v_strip)
        try:
            return int(v_strip, 0)
        except Exception:
            raise TypeError(f"{name} must be INT, got string '{v}'")
    raise TypeError(f"{name} must be INT, got {type(v).__name__}")


def _to_float(name, v):
    """
    Convert value to float with detailed error handling.
    
    Args:
        name: Parameter name for error messages
        v: Value to convert (int, float, or string)
    
    Returns:
        Float value
    
    Raises:
        TypeError: If conversion fails
    """
    if isinstance(v, (float, int)):
        return float(v)
    if isinstance(v, str):
        try:
            return float(v.strip())
        except Exception:
            raise TypeError(f"{name} must be FLOAT, got string '{v}'")
    raise TypeError(f"{name} must be FLOAT, got {type(v).__name__}")


def common_ksampler(model, seed, steps, cfg, sampler_name, scheduler, positive, negative, latent, 
                    denoise=1.0, disable_noise=False, start_step=None, last_step=None, force_full_denoise=False):
    """
    Common KSampler function used by all sampling nodes.
    
    Args:
        model: The model to use for sampling
        seed: Random seed for noise generation
        steps: Number of sampling steps
        cfg: Classifier-free guidance scale
        sampler_name: Name of the sampler algorithm
        scheduler: Name of the noise scheduler
        positive: Positive conditioning
        negative: Negative conditioning
        latent: Latent image dictionary
        denoise: Denoising strength (0.0-1.0)
        disable_noise: Whether to disable noise
        start_step: Optional starting step
        last_step: Optional ending step
        force_full_denoise: Whether to force full denoising
    
    Returns:
        Tuple containing the sampled latent
    """
    latent_image = latent["samples"]
    latent_image = comfy.sample.fix_empty_latent_channels(model, latent_image)

    if disable_noise:
        noise = torch.zeros(latent_image.size(), dtype=latent_image.dtype, layout=latent_image.layout, device="cpu")
    else:
        batch_inds = latent.get("batch_index")
        noise = comfy.sample.prepare_noise(latent_image, seed, batch_inds)

    noise_mask = latent.get("noise_mask")

    callback = latent_preview.prepare_callback(model, steps)
    disable_pbar = not comfy.utils.PROGRESS_BAR_ENABLED
    samples = comfy.sample.sample(model, noise, steps, cfg, sampler_name, scheduler, positive, negative, latent_image,
                                    denoise=denoise, disable_noise=disable_noise, start_step=start_step, last_step=last_step,
                                    force_full_denoise=force_full_denoise, noise_mask=noise_mask, callback=callback, 
                                    disable_pbar=disable_pbar, seed=seed)
    out = latent.copy()
    out["samples"] = samples
    return (out,)


class SamplerPicker:
    """
    Sampler and scheduler selection node.
    Allows separate selection of sampler algorithm and noise scheduler.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "sampler_name": (ModelList.sampler_list(), {"default": ModelList.sampler_list()[0]}),
                "scheduler": (ModelList.scheduler_list(), {"default": ModelList.scheduler_list()[0]})
            }
        }

    RETURN_TYPES = (AlwaysEqual('*'), AlwaysEqual('*'))
    RETURN_NAMES = ("sampler", "scheduler")
    FUNCTION = "select"

    CATEGORY = "A1rSpace/Config"
    DESCRIPTION = "Select sampler algorithm and noise scheduler separately. Output can be connected to any sampler node."

    def select(self, sampler_name, scheduler):
        """Return selected sampler and scheduler."""
        return (sampler_name, scheduler)

class UnityKSampler:
    """
    Unified KSampler with three modes: text to image, image to image, and latent upscale.
    Combines multiple workflows into a single versatile sampling node.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "mode": (["text to image", "image to image", "latent upscale"], {"default": "text to image"}),
                "model": ("MODEL",),
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
                "sampler": (ModelList.sampler_list(), {"default": ModelList.sampler_list()[0]}),
                "scheduler": (ModelList.scheduler_list(), {"default": ModelList.scheduler_list()[0]}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "steps": ("INT", NumericConfig.ks_step(),),
                "cfg": ("FLOAT", NumericConfig.ks_cfg(),),
                "denoise": ("FLOAT", NumericConfig.ks_denoise(),)
            },
            "optional": {
                # Text to image / image to image mode - force input (no widget)
                "width": ("INT", {"default": 512, "tooltip": "Width of the latent, if not provided, will be default to 512", "forceInput": True}),
                "height": ("INT", {"default": 512, "tooltip": "Height of the latent, if not provided, will be default to 512", "forceInput": True}),
                "batch_size": ("INT", {"default": 1, "tooltip": "Batch size, if not provided, will be default to 1", "forceInput": True}),
                # Image to image mode
                "pixels": ("IMAGE",),
                "vae": ("VAE",),
                # Latent Upscale mode - force input (no widget)
                "latent": ("LATENT",),
                "upscale_method": ("UPSCALEMETHOD", {"default": "nearest-exact", "tooltip": "Upscale method to use, if not provided, will be default to 'nearest-exact'", "forceInput": True}),
                "upscale_by": ("FLOAT", {"default": 1.5, "tooltip": "Upscale by factor, if not provided, will be default to 1.5", "forceInput": True})
            }
        }
    
    RETURN_TYPES = ("LATENT",)
    FUNCTION = "sample"
    
    CATEGORY = "A1rSpace/KSampler"
    DESCRIPTION = """Unified sampling node with three modes:
- Text to Image: Generate from empty latent (requires width/height/batch_size)
- Image to Image: Generate from encoded image (requires pixels/vae, uses denoise)
- Latent Upscale: Upscale existing latent (requires latent/upscale_method/upscale_by)"""

    def sample(self, mode, model, positive, negative, sampler, scheduler, seed, steps, cfg, denoise, 
                width=None, height=None, batch_size=None,
                pixels=None, vae=None,
                latent=None, upscale_method=None, upscale_by=None):
        """
        Execute sampling based on selected mode.
        
        Args:
            mode: Operation mode (text to image, image to image, latent upscale)
            model: The model to use for sampling
            positive: Positive conditioning
            negative: Negative conditioning
            sampler: Sampler algorithm name
            scheduler: Scheduler algorithm name
            seed: Random seed
            steps: Number of sampling steps
            cfg: CFG scale
            denoise: Denoise strength (used in image to image and latent upscale modes)
            width: Width for text to image mode
            height: Height for text to image mode
            batch_size: Batch size for text to image and image to image modes
            pixels: Input image for image to image mode
            vae: VAE for encoding pixels in image to image mode
            latent: Input latent for latent upscale mode
            upscale_method: Upscale method for latent upscale mode
            upscale_by: Upscale factor for latent upscale mode
        
        Returns:
            Tuple containing the sampled latent
        """
        # Convert and validate parameters
        seed = _to_int("seed", seed)
        steps = _to_int("steps", steps)
        cfg = _to_float("cfg", cfg)
        denoise = _to_float("denoise", denoise)
        
        sampler = str(sampler)
        scheduler = str(scheduler)

        # Prepare latent based on selected mode
        if mode == "text to image":
            # Text to image mode: Create empty latent from dimensions
            if width is None or height is None:
                raise ValueError("Width and height are required for 'text to image' mode")
            width = _to_int("width", width)
            height = _to_int("height", height)
            
            batch_size_value = _to_int("batch_size", batch_size) if batch_size is not None else 1
            if batch_size_value < 1:
                batch_size_value = 1
            
            # Create empty latent (same as EmptyLatentImage node)
            latent = torch.zeros([batch_size_value, 4, height // 8, width // 8], device=mm.intermediate_device())
            latent_image = {"samples": latent}
            
            # Text to image always uses full denoise
            denoise_value = 1.0
            
        elif mode == "image to image":
            # Image to image mode: Encode image to latent using VAE
            if pixels is None or vae is None:
                raise ValueError("Pixels and VAE are required for 'image to image' mode")
            
            batch_size_value = _to_int("batch_size", batch_size) if batch_size is not None else pixels.shape[0]
            if batch_size_value < 1:
                batch_size_value = 1
            
            # Encode pixels to latent (same as VAEEncode node)
            t = vae.encode(pixels[:,:,:,:3])
            
            # Adjust batch size if needed
            current_batch = t.shape[0]
            if batch_size_value != current_batch:
                if batch_size_value > current_batch:
                    # Repeat to match requested batch size
                    repeat_times = (batch_size_value + current_batch - 1) // current_batch
                    t = t.repeat(repeat_times, 1, 1, 1)[:batch_size_value]
                else:
                    # Trim to match requested batch size
                    t = t[:batch_size_value]
            
            latent_image = {"samples": t}
            denoise_value = denoise
            
        elif mode == "latent upscale":
            # Latent upscale mode: Upscale existing latent
            if latent is None:
                raise ValueError("Latent input is required for 'latent upscale' mode")
            upscale_by = _to_float("upscale_by", upscale_by) if upscale_by is not None else 1.5
            method = str(upscale_method) if upscale_method is not None else "nearest-exact"
            
            # Upscale latent (same as LatentUpscale node)
            samples = latent["samples"]
            s = comfy.utils.common_upscale(
                samples, 
                round(samples.shape[3] * upscale_by), 
                round(samples.shape[2] * upscale_by), 
                method, 
                "disabled"
            )
            latent_image = {"samples": s}
            denoise_value = denoise
            
        else:
            raise ValueError(f"Unknown mode: {mode}")

        # Execute sampling with prepared latent
        result = common_ksampler(
            model=model,
            seed=seed,
            steps=steps,
            cfg=cfg,
            sampler_name=sampler,
            scheduler=scheduler,
            positive=positive,
            negative=negative,
            latent=latent_image,
            denoise=denoise_value
        )

        return result

KSAMPLER_CLASS_MAPPINGS = {
    "A1r Sampler Picker": SamplerPicker,
    "A1r Unity KSampler": UnityKSampler,
}

KSAMPLER_DISPLAY_NAME_MAPPINGS = {
    "A1r Sampler Picker": "Sampler Picker",
    "A1r Unity KSampler": "Unity KSampler",
}