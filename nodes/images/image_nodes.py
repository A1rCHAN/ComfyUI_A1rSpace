"""
Image saver nodes - loading, filtering, and advanced saving.

Provides nodes for image loading with crop functionality, interactive filtering,
and advanced saving with auto-naming capabilities.
"""
import os
import random
import hashlib
import time
import uuid
import json
import numpy as np
import torch
import folder_paths
from PIL import Image, ImageSequence, ImageOps, ImageDraw
from PIL.PngImagePlugin import PngInfo

from ..text.text_advanced import TextSaveFileName

# ========== Image Loader with Crop ==========

class LoadImage:
    """Load image with crop functionality similar to Windows 10 Photos app."""
    
    @classmethod
    def INPUT_TYPES(cls):
        input_dir = folder_paths.get_input_directory()
        files = [f for f in os.listdir(input_dir) if os.path.isfile(os.path.join(input_dir, f))]
        return {
            "required": {
                "image": (sorted(files), {"image_upload": True}),
            },
            "hidden": {
                "crop_data": "STRING",
            }
        }

    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("image", "mask")
    FUNCTION = "load_image"
    OUTPUT_NODE = True

    CATEGORY = "A1rSpace/Image"
    DESCRIPTION = "Load image with crop functionality. Right-click to open crop editor."

    def load_image(self, image, crop_data=""):
        image_path = folder_paths.get_annotated_filepath(image)
        
        img = Image.open(image_path)
        original_width = img.width
        original_height = img.height
        
        # Parse crop data
        crop_info = None
        if crop_data and crop_data.strip():
            try:
                crop_info = json.loads(crop_data)
                x = int(crop_info.get("x", 0))
                y = int(crop_info.get("y", 0))
                width = int(crop_info.get("width", img.width))
                height = int(crop_info.get("height", img.height))
                
                # Ensure crop is within bounds
                x = max(0, min(x, img.width - 1))
                y = max(0, min(y, img.height - 1))
                width = max(1, min(width, img.width - x))
                height = max(1, min(height, img.height - y))
                
                crop_info = {"x": x, "y": y, "width": width, "height": height}
            except Exception as e:
                print(f"[LoadImage] Failed to parse crop_data: {e}")
                crop_info = None
        
        # Generate preview image with crop overlay if crop exists
        preview_results = []
        if crop_info:
            preview_img = Image.open(image_path)
            preview_img = ImageOps.exif_transpose(preview_img)
            if preview_img.mode == 'I':
                preview_img = preview_img.point(lambda i: i * (1 / 255))
            preview_img = preview_img.convert("RGBA")
            
            # Create overlay
            overlay = Image.new('RGBA', preview_img.size, (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)
            
            x, y = crop_info['x'], crop_info['y']
            crop_width, crop_height = crop_info['width'], crop_info['height']
            
            # Draw semi-transparent mask outside crop area
            if y > 0:
                draw.rectangle([0, 0, original_width, y], fill=(64, 64, 64, 180))
            if y + crop_height < original_height:
                draw.rectangle([0, y + crop_height, original_width, original_height], fill=(64, 64, 64, 180))
            if x > 0:
                draw.rectangle([0, y, x, y + crop_height], fill=(64, 64, 64, 180))
            if x + crop_width < original_width:
                draw.rectangle([x + crop_width, y, original_width, y + crop_height], fill=(64, 64, 64, 180))
            
            # Draw crop border
            draw.rectangle([x, y, x + crop_width - 1, y + crop_height - 1], outline=(255, 255, 255, 255), width=2)
            
            # Composite and save preview
            preview_img = Image.alpha_composite(preview_img, overlay).convert("RGB")
            output_dir = folder_paths.get_temp_directory()
            filename_prefix = "LoadImage_temp_" + ''.join(random.choice("abcdefghijklmnopqrstupvxyz") for _ in range(5))
            filename = f"{filename_prefix}_00000.png"
            preview_img.save(os.path.join(output_dir, filename), compress_level=4)
            
            preview_results.append({"filename": filename, "subfolder": "", "type": "temp"})
        
        # Apply crop
        if crop_info:
            img = img.crop((crop_info['x'], crop_info['y'], 
                            crop_info['x'] + crop_info['width'], 
                            crop_info['y'] + crop_info['height']))
        
        # Convert to tensor
        output_images = []
        output_masks = []
        
        for i in ImageSequence.Iterator(img):
            i = ImageOps.exif_transpose(i)
            if i.mode == 'I':
                i = i.point(lambda i: i * (1 / 255))
            image_np = np.array(i).astype(np.float32) / 255.0
            
            if len(image_np.shape) == 2:
                image_np = np.stack([image_np] * 3, axis=-1)
            
            output_images.append(image_np)
            
            # Generate mask
            if 'A' in i.getbands():
                mask = 1. - np.array(i.getchannel('A')).astype(np.float32) / 255.0
            else:
                mask = np.zeros((image_np.shape[0], image_np.shape[1]), dtype=np.float32)
            
            output_masks.append(mask)
        
        if len(output_images) > 1:
            output_image = torch.cat([torch.from_numpy(i)[None, :] for i in output_images], dim=0)
            output_mask = torch.cat([torch.from_numpy(m)[None, :] for m in output_masks], dim=0)
        else:
            output_image = torch.from_numpy(output_images[0])[None, :]
            output_mask = torch.from_numpy(output_masks[0])[None, :]
        
        ui_data = {"images": preview_results} if preview_results else {}
        return {"ui": ui_data, "result": (output_image, output_mask)}
    
    @classmethod
    def IS_CHANGED(cls, image, crop_data=""):
        image_path = folder_paths.get_annotated_filepath(image)
        m = hashlib.sha256()
        with open(image_path, 'rb') as f:
            m.update(f.read())
        return m.digest().hex() + str(crop_data)
    
    @classmethod
    def VALIDATE_INPUTS(cls, image, crop_data=""):
        if not folder_paths.exists_annotated_filepath(image):
            return f"Invalid image file: {image}"
        return True

# ========== Image Filter with Dialog ==========

class ImageFilter:
    """Interactive image filter with popup dialog for user selection."""
    
    def __init__(self):
        self.temp_dir = folder_paths.get_temp_directory()
        self.prefix_append = "_filter_" + ''.join(random.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(5))
        self.type = "temp"
        self.compress_level = 1

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "timeout": ("INT", {"default": 60, "min": 1, "max": 9999999}),
                "on_timeout": (["send all", "send first", "send last", "send none"],),
            },
            "optional": {
                "latent": ("LATENT",),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO"
            },
        }

    RETURN_TYPES = ("IMAGE", "LATENT")
    RETURN_NAMES = ("image", "latent")
    FUNCTION = "filter_images"
    OUTPUT_NODE = False

    CATEGORY = "A1rSpace/Image"
    DESCRIPTION = "Filter images with a popup dialog. User selects which images to pass through."

    def filter_images(self, timeout, on_timeout, unique_id, prompt=None, extra_pnginfo=None, image=None, latent=None):
        if image is None:
            empty_image = torch.zeros((1, 64, 64, 3))
            empty_latent = latent if latent is not None else {"samples": torch.zeros((1, 4, 8, 8))}
            return (empty_image, empty_latent)
        
        # Save to temp directory
        full_temp_folder, temp_filename, temp_counter, temp_subfolder, _ = folder_paths.get_save_image_path(
            "filter" + self.prefix_append, self.temp_dir, image[0].shape[1], image[0].shape[0]
        )
        
        preview_results = []
        for batch_number, img_tensor in enumerate(image):
            i = 255. * img_tensor.cpu().numpy()
            img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
            
            temp_file = f"{temp_filename}_{temp_counter:05}_.png"
            img.save(os.path.join(full_temp_folder, temp_file), compress_level=self.compress_level)
            
            preview_results.append({
                "filename": temp_file,
                "subfolder": temp_subfolder,
                "type": "temp",
                "batch_index": batch_number
            })
            temp_counter += 1
        
        # Send request to frontend and wait for user decision
        from server import PromptServer
        from comfy.model_management import throw_exception_if_processing_interrupted, InterruptProcessingException
        
        filter_id = str(uuid.uuid4())
        
        PromptServer.instance.send_sync("a1rspace-filter-request", {
            "node_id": str(unique_id),
            "filter_id": filter_id,
            "images": preview_results,
            "timeout": timeout,
            "on_timeout": on_timeout
        })
        
        # Wait for user response (requires a1r_api support)
        try:
            from ...a1r_api import _filter_decisions
        except (ImportError, ValueError):
            try:
                from ..a1r_api import _filter_decisions
            except (ImportError, ValueError):
                # Fallback if API not available
                _filter_decisions = {}
        
        _filter_decisions[filter_id] = None
        
        end_time = time.time() + timeout
        while time.time() < end_time:
            throw_exception_if_processing_interrupted()
            
            decision = _filter_decisions.get(filter_id)
            if decision is not None:
                break
            
            remaining = int(end_time - time.time())
            if remaining > 0:
                PromptServer.instance.send_sync("a1rspace-filter-tick", {
                    "filter_id": filter_id,
                    "remaining": remaining
                })
            
            time.sleep(0.5)
        
        user_decision = _filter_decisions.get(filter_id)
        if filter_id in _filter_decisions:
            del _filter_decisions[filter_id]
        
        # Process decision
        if user_decision == "cancel":
            raise InterruptProcessingException()
        
        # Handle send or timeout
        if on_timeout == "send all":
            return (image, latent)
        elif on_timeout == "send first":
            output_image = image[0:1]
            output_latent = {"samples": latent['samples'][0:1]} if latent is not None else None
            return (output_image, output_latent)
        elif on_timeout == "send last":
            output_image = image[-1:]
            output_latent = {"samples": latent['samples'][-1:]} if latent is not None else None
            return (output_image, output_latent)
        else:  # send none
            raise InterruptProcessingException()

# ========== Advanced Image Saver ==========

class SaveImage:
    """Advanced image saving and preview node with auto-naming capabilities."""
    
    def __init__(self):
        self.output_dir = folder_paths.get_output_directory()
        self.temp_dir = folder_paths.get_temp_directory()
        self.compress_level = 4
        self.prefix_append = "_temp_" + ''.join(random.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(5))
        self.type = "temp"
        self.name_generator = TextSaveFileName()

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("IMAGE",),
                "filename_prefix": ("STRING", {"default": "ComfyUI"}),
                "enable_save": ("BOOLEAN", {"default": True}),
                "embedding_workflow": ("BOOLEAN", {"default": True}),
                "path_prefix": ("BOOLEAN", {"default": True}),
                "date_suffix": ("BOOLEAN", {"default": True}),
                "time_suffix": ("BOOLEAN", {"default": True}),
            },
            "hidden": {
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO",
                "unique_id": "UNIQUE_ID"
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "save_image"
    OUTPUT_NODE = True

    CATEGORY = "A1rSpace/Image"
    DESCRIPTION = "Advanced image saver with preview. Supports both basic and advanced naming options."

    def save_image(self, image, filename_prefix, enable_save,
                   embedding_workflow=True, path_prefix=True, date_suffix=True, time_suffix=True,
                   prompt=None, extra_pnginfo=None, unique_id=None):
        
        final_prefix = filename_prefix
        
        # Advanced naming
        if filename_prefix and filename_prefix.strip():
            name_result = self.name_generator.save_file_name(
                name=filename_prefix,
                path_prefix=path_prefix,
                date_suffix=date_suffix,
                time_suffix=time_suffix
            )
            final_prefix = name_result[0] if isinstance(name_result, tuple) else name_result
        else:
            final_prefix = "ComfyUI"
        
        # Metadata
        metadata = None
        try:
            from comfy.cli_args import args
            disable_metadata = args.disable_metadata
        except:
            disable_metadata = False
        
        if not disable_metadata and embedding_workflow:
            metadata = PngInfo()
            if prompt:
                metadata.add_text("prompt", json.dumps(prompt))
            if extra_pnginfo:
                for x in extra_pnginfo:
                    metadata.add_text(x, json.dumps(extra_pnginfo[x]))
        
        results = []
        
        if enable_save:
            # Save to output
            full_output_folder, filename, counter, subfolder, _ = folder_paths.get_save_image_path(
                final_prefix, self.output_dir, image[0].shape[1], image[0].shape[0]
            )
            
            for batch_number, img_tensor in enumerate(image):
                i = 255. * img_tensor.cpu().numpy()
                img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
                
                output_file = f"{filename}_{counter:05}_.png"
                img.save(os.path.join(full_output_folder, output_file), pnginfo=metadata, compress_level=self.compress_level)
                
                results.append({
                    "filename": output_file,
                    "subfolder": subfolder,
                    "type": "output",
                    "batch_index": batch_number
                })
                counter += 1
        else:
            # Save to temp for preview only
            full_temp_folder, temp_filename, temp_counter, temp_subfolder, _ = folder_paths.get_save_image_path(
                final_prefix + self.prefix_append, self.temp_dir, image[0].shape[1], image[0].shape[0]
            )
            
            for batch_number, img_tensor in enumerate(image):
                i = 255. * img_tensor.cpu().numpy()
                img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
                
                temp_file = f"{temp_filename}_{temp_counter:05}_.png"
                img.save(os.path.join(full_temp_folder, temp_file), pnginfo=metadata, compress_level=1)
                
                results.append({
                    "filename": temp_file,
                    "subfolder": temp_subfolder,
                    "type": "temp",
                    "batch_index": batch_number
                })
                temp_counter += 1
        
        return {"ui": {"images": results}}

# Exported mappings
IMAGE_CLASS_MAPPINGS = {
    "A1r Load Image": LoadImage,
    "A1r Image Filter": ImageFilter,
    "A1r Save Image": SaveImage,
}

IMAGE_DISPLAY_NAME_MAPPINGS = {
    "A1r Load Image": "Load Image",
    "A1r Image Filter": "Image Filter",
    "A1r Save Image": "Save Image",
}
