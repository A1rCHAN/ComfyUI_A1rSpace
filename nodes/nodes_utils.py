# type: ignore
"""
Utility nodes for ComfyUI A1rSpace extension.

This module provides various utility nodes including boolean operations, 
math operations, image filtering, and save/preview functionality.
"""
import os
import random
import folder_paths
from PIL import Image
from PIL.PngImagePlugin import PngInfo
import numpy as np
import json
import torch

class IntToBoolean:
    """
    Convert an integer value to boolean (0 = False, non-zero = True).
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "input_int": ("INT", {"default": 0, "min": -0xffffffffffffffff, "max": 0xffffffffffffffff, "step": 1}),
            }
        }

    RETURN_TYPES = ("BOOLEAN",)
    FUNCTION = "IntToBoolean"

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Convert an integer to a boolean value."

    def IntToBoolean(self, input_int):
        return (input_int != 0,)

class SimpleBoolean:
    """
    Simple boolean pass-through node for workflow control.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "enable": ("BOOLEAN", {"default": True}),
            }
        }

    RETURN_TYPES = ("BOOLEAN",)
    FUNCTION = "pass_through"

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "A simple boolean pass-through node."

    def pass_through(self, enable):
        return (enable,)

class Boolean_AB:
    """
    Boolean toggle ensuring at least one is always enabled (mutual exclusion).
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "enable_a": ("BOOLEAN", {"default": True}),
                "enable_b": ("BOOLEAN", {"default": False}),
            }
        }
    RETURN_TYPES = ("BOOLEAN", "BOOLEAN",)
    RETURN_NAMES = ("boolean_a", "boolean_b")
    FUNCTION = "boolean_ab"

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Boolean toggle with always one behavior."

    def boolean_ab(self, enable_a, enable_b):
        if not enable_a and not enable_b:
            enable_a = True
        elif enable_a and enable_b:
            enable_b = False
        return (enable_a, enable_b)

class Boolean_A_B:
    """
    Boolean toggle with A as main control (A auto-enables when B is enabled).
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "enable_a": ("BOOLEAN", {"default": True}),
                "enable_b": ("BOOLEAN", {"default": False}),
            }
        }
    RETURN_TYPES = ("BOOLEAN", "BOOLEAN",)
    RETURN_NAMES = ("boolean_a", "boolean_b")
    FUNCTION = "boolean_a_b"

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Boolean toggle with one main behavior."

    def boolean_a_b(self, enable_a, enable_b):
        if (not enable_a) and enable_b:
            enable_a = True
        return (enable_a, enable_b)

class MathInt:
    """
    Perform basic arithmetic operations on two integer values.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "a": ("INT", {"default": 0, "min": -0xffffffffffffffff, "max": 0xffffffffffffffff, "step": 1}),
                "b": ("INT", {"default": 0, "min": -0xffffffffffffffff, "max": 0xffffffffffffffff, "step": 1}),
                "operation": (["add", "subtract", "multiply", "divide", "modulo", "power"],),
            },
        }

    RETURN_TYPES = ("INT",)
    FUNCTION = "int_math_operation"

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Perform basic arithmetic operations (add, subtract, multiply, divide, modulo, power) on two integers."

    def int_math_operation(self, a, b, operation):
        if operation == "add":
            result = a + b
        elif operation == "subtract":
            result = a - b
        elif operation == "multiply":
            result = a * b
        elif operation == "divide":
            result = a // b if b != 0 else 0
        elif operation == "modulo":
            result = a % b if b != 0 else 0
        elif operation == "power":
            result = a ** b
        return (result,)

class MathLogicGate:
    """
    Perform logical operations (AND, OR, NOT) on boolean inputs.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "a": ("BOOLEAN",),
                "b": ("BOOLEAN",),
                "operation": (["AND", "OR", "NOT"], {"default": "AND"}),
            },
        }

    RETURN_TYPES = ("BOOLEAN", "INT")
    FUNCTION = "logic_gate"

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Perform logical operations on two boolean inputs."

    def logic_gate(self, a, b, operation):
        if operation == "AND":
            result = a and b
        elif operation == "OR":
            result = a or b
        elif operation == "NOT":
            result = not a

        int_value = 1 if result else 0

        return (result, int_value)

class SavePreviewImage:
    """
    Save images to output directory or preview them temporarily based on enable_save flag.
    """
    
    def __init__(self):
        self.output_dir = folder_paths.get_output_directory()
        self.temp_dir = folder_paths.get_temp_directory()
        self.compress_level = 4
        self.prefix_append = "_temp_" + ''.join(random.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(5))
        self.type = "temp"

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("IMAGE", {"tooltip": "The images to save and preview."}),
                "filename_prefix": ("STRING", {"default": "ComfyUI", "tooltip": "The prefix for the file to save."}),
                "enable_save": ("BOOLEAN", {"default": True, "tooltip": "If enabled, images will be saved to output directory."})
            },
            "hidden": {
                "prompt": "PROMPT", 
                "extra_pnginfo": "EXTRA_PNGINFO",
                "unique_id": "UNIQUE_ID"
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "save_preview_image"
    OUTPUT_NODE = True

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Save and preview images. Works standalone or after Image Filter node."

    def save_preview_image(self, image, filename_prefix="ComfyUI", enable_save=True, prompt=None, extra_pnginfo=None, unique_id=None):
        should_save = enable_save
        
        # 准备 metadata
        metadata = None
        try:
            from comfy.cli_args import args
            disable_metadata = args.disable_metadata
        except:
            disable_metadata = False
            
        if not disable_metadata:
            metadata = PngInfo()
            if prompt is not None:
                metadata.add_text("prompt", json.dumps(prompt))
            if extra_pnginfo is not None:
                for x in extra_pnginfo:
                    metadata.add_text(x, json.dumps(extra_pnginfo[x]))
        
        results = []
        
        if should_save:
            # 保存到输出目录
            full_output_folder, filename, counter, subfolder, _ = folder_paths.get_save_image_path(
                filename_prefix, 
                self.output_dir, 
                image[0].shape[1], 
                image[0].shape[0]
            )
            
            for (batch_number, img_tensor) in enumerate(image):
                i = 255. * img_tensor.cpu().numpy()
                img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
                
                output_file = f"{filename}_{counter:05}_.png"
                output_path = os.path.join(full_output_folder, output_file)
                
                img.save(output_path, pnginfo=metadata, compress_level=self.compress_level)
                
                results.append({
                    "filename": output_file,
                    "subfolder": subfolder,
                    "type": "output",
                    "batch_index": batch_number
                })
                counter += 1
        else:
            # 只保存到临时目录用于预览
            full_temp_folder, temp_filename, temp_counter, temp_subfolder, _ = folder_paths.get_save_image_path(
                filename_prefix + self.prefix_append, 
                self.temp_dir, 
                image[0].shape[1], 
                image[0].shape[0]
            )
            
            for (batch_number, img_tensor) in enumerate(image):
                i = 255. * img_tensor.cpu().numpy()
                img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
                
                temp_file = f"{temp_filename}_{temp_counter:05}_.png"
                temp_path = os.path.join(full_temp_folder, temp_file)
                
                img.save(temp_path, pnginfo=metadata, compress_level=1)
                
                results.append({
                    "filename": temp_file,
                    "subfolder": temp_subfolder,
                    "type": "temp",
                    "batch_index": batch_number
                })
                temp_counter += 1
        
        # 返回结果: 显示预览
        return {"ui": {"images": results}}

class ImageFilter:
    """
    Interactive image filter with popup dialog for user selection before passing images through.
    """
    
    def __init__(self):
        self.temp_dir = folder_paths.get_temp_directory()
        self.prefix_append = "_filter_" + ''.join(random.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(5))
        self.type = "temp"
        self.compress_level = 1  # Fast compression for preview only

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE", {"tooltip": "Optional images to filter"}),
                "timeout": ("INT", {"default": 60, "min": 1, "max": 9999999, "tooltip": "Timeout in seconds."}),
                "on_timeout": (["send all", "send first", "send last", "send none"], {"tooltip": "Action when timeout occurs for batch images."}),
            },
            "optional": {
                "latent": ("LATENT", {"tooltip": "Optional latents to pass through"}),
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

    CATEGORY = "A1rSpace/Utils"
    DESCRIPTION = "Filter images with a popup dialog. User selects which images to pass through."

    def filter_images(self, timeout, on_timeout, unique_id, prompt=None, extra_pnginfo=None, image=None, latent=None):
        # 如果没有图片输入,直接返回空数据
        if image is None:
            empty_image = torch.zeros((1, 64, 64, 3))
            empty_latent = latent if latent is not None else {"samples": torch.zeros((1, 4, 8, 8))}
            return (empty_image, empty_latent)
        
        # 保存到临时目录
        full_temp_folder, temp_filename, temp_counter, temp_subfolder, _ = folder_paths.get_save_image_path(
            "filter" + self.prefix_append, 
            self.temp_dir, 
            image[0].shape[1], 
            image[0].shape[0]
        )
        
        preview_results = []
        temp_file_paths = []
        
        for (batch_number, img_tensor) in enumerate(image):
            i = 255. * img_tensor.cpu().numpy()
            img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
            
            temp_file = f"{temp_filename}_{temp_counter:05}_.png"
            temp_path = os.path.join(full_temp_folder, temp_file)
            
            img.save(temp_path, compress_level=self.compress_level)
            
            preview_results.append({
                "filename": temp_file,
                "subfolder": temp_subfolder,
                "type": "temp",
                "batch_index": batch_number
            })
            
            temp_file_paths.append(temp_path)
            temp_counter += 1
        
        # 使用阻塞等待机制
        from server import PromptServer
        from comfy.model_management import throw_exception_if_processing_interrupted
        import time
        import uuid
        
        # 生成唯一标识符
        filter_id = str(uuid.uuid4())
        
        # 发送请求到前端
        PromptServer.instance.send_sync("a1rspace-filter-request", {
            "node_id": str(unique_id),
            "filter_id": filter_id,
            "images": preview_results,
            "timeout": timeout,
            "on_timeout": on_timeout
        })
        
        # 阻塞等待用户响应
        from ..a1r_api import _filter_decisions
        _filter_decisions[filter_id] = None
        
        end_time = time.time() + timeout
        while time.time() < end_time:
            throw_exception_if_processing_interrupted()
            
            # 检查是否有决策
            decision = _filter_decisions.get(filter_id)
            if decision is not None:
                break
            
            # 发送心跳
            remaining = int(end_time - time.time())
            if remaining > 0:
                PromptServer.instance.send_sync("a1rspace-filter-tick", {
                    "filter_id": filter_id,
                    "remaining": remaining
                })
            
            time.sleep(0.5)
        
        # 获取最终决策
        user_decision = _filter_decisions.get(filter_id)
        
        # 清除决策
        del _filter_decisions[filter_id]
        
        # 根据决策返回结果
        from comfy.model_management import InterruptProcessingException
        
        if user_decision == "cancel":
            # 用户点击 Cancel，中断处理
            raise InterruptProcessingException()
        elif user_decision == "send":
            # 用户点击 Send，根据 on_timeout 参数决定发送哪些图片
            if on_timeout == "send all":
                output_latent = latent if latent is not None else None
                return (image, output_latent)
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
        else:
            # 超时，也根据 on_timeout 参数处理
            
            if on_timeout == "send all":
                output_latent = latent if latent is not None else None
                return (image, output_latent)
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

UTILS_CLASS_MAPPINGS = {
    "A1r Int to Boolean": IntToBoolean,
    "A1r Simple Boolean": SimpleBoolean,
    "A1r Boolean AB": Boolean_AB,
    "A1r Boolean A B": Boolean_A_B,
    "A1r Math Int": MathInt,
    "A1r Math Logic Gate": MathLogicGate,
    "A1r Save Preview Image": SavePreviewImage,
    "A1r Image Filter": ImageFilter,
}

UTILS_DISPLAY_NAME_MAPPINGS = {
    "A1r Int to Boolean": "Int to Boolean",
    "A1r Simple Boolean": "Simple Boolean",
    "A1r Boolean AB": "Boolean A&B",
    "A1r Boolean A B": "Boolean A|B",
    "A1r Math Int": "Math Int",
    "A1r Math Logic Gate": "Math LogicGate",
    "A1r Save Preview Image": "Save/Preview Image",
    "A1r Image Filter": "Image Filter",
}