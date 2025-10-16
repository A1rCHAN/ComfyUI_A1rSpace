import torch
import comfy
import latent_preview
from .config import ModelList, NumericConfig

def _to_int(name, v):
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
    if isinstance(v, (float, int)):
        return float(v)
    if isinstance(v, str):
        try:
            return float(v.strip())
        except Exception:
            raise TypeError(f"{name} must be FLOAT, got string '{v}'")
    raise TypeError(f"{name} must be FLOAT, got {type(v).__name__}")

class Sampler_Picker:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "sampler_name": (ModelList.sampler_list(), {"default": ModelList.sampler_list()[0]}),
                "scheduler": (ModelList.scheduler_list(), {"default": ModelList.scheduler_list()[0]}),
            }
        }

    RETURN_TYPES = ("SAMPLER", "SCHEDULER")
    RETURN_NAMES = ("sampler_name", "scheduler")
    FUNCTION = "select"
    CATEGORY = "A1rSpace/Config"

    def select(self, sampler_name, scheduler):
        return (sampler_name, scheduler)

""" custom ksampler, turn sampler and scheduler to input required, add a buttom to enable/disable"""

def common_ksampler(model, seed, steps, cfg, sampler_name, scheduler, positive, negative, latent, denoise=1.0, disable_noise=False, start_step=None, last_step=None, force_full_denoise=False):
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
                                    force_full_denoise=force_full_denoise, noise_mask=noise_mask, callback=callback, disable_pbar=disable_pbar, seed=seed)
    out = latent.copy()
    out["samples"] = samples
    return (out, )

# custom ksampler node
class A1r_KSampler:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
                "latent_image": ("LATENT",),
                "sampler": ("SAMPLER",),
                "scheduler": ("SCHEDULER",),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "steps": ("INT", NumericConfig.ks_step(),),
                "cfg": ("FLOAT", NumericConfig.ks_cfg(),),
                "denoise": ("FLOAT", NumericConfig.ks_denoise(),),
                "enable": ("BOOLEAN", {"default": True, "label_on": "Enabled", "label_off": "Disabled"})
            }
        }

    RETURN_TYPES = ("LATENT",)
    FUNCTION = "sample"
    CATEGORY = "A1rSpace/KSampler"

    def sample(self, model, positive, negative, latent_image, sampler, scheduler, seed, steps, cfg, denoise, enable):
        if not enable:
            return (latent_image,)

        seed = _to_int("seed", seed)
        steps = _to_int("steps", steps)
        cfg = _to_float("cfg", cfg)
        denoise = _to_float("denoise", denoise)
        sampler = str(sampler)
        scheduler = str(scheduler)

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
            denoise=denoise
        )
        return result

KSAMPLER_CLASS_MAPPINGS = {
    "A1r Sampler Picker": Sampler_Picker,
    "A1r KSampler": A1r_KSampler,
}

KSAMPLER_DISPLAY_NAME_MAPPINGS = {
    "A1r Sampler Picker": "Sampler Picker",
    "A1r KSampler": "KSampler (A1rSpace)",
}