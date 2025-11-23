# type: ignore
"""
API routes for A1rSpace ComfyUI extension.

Provides endpoints for canvas configuration, image filtering, and user decision handling.
"""
import os
import shutil
import time
import traceback
from typing import Dict, List, Tuple
import json

from aiohttp import web
from PIL import Image, PngImagePlugin

import folder_paths
import server

# Storage for Image Filter node user decisions
_filter_decisions: Dict[str, str] = {}

@server.PromptServer.instance.routes.get("/a1rspace/canvas_config")
async def get_canvas_config(request):
	"""
	Get canvas configuration including size list and default settings.
	
	Returns:
		JSON response with size_list and default_config, or error if failed.
	"""
	try:
		from .nodes.config import NumericConfig
		
		size_list = NumericConfig.size_list()
		default_config = NumericConfig.default_config()
		
		size_list_with_custom = {"Custom": (1024, 1024)}
		size_list_with_custom.update(size_list)
		
		return web.json_response({
			"size_list": {k: list(v) for k, v in size_list_with_custom.items()},
			"default_config": default_config
		})
	except Exception as e:
		return web.json_response({"error": str(e)}, status=500)

def _save_image_with_metadata(
	temp_file: str, 
	output_path: str, 
	compress_level: int = 4
) -> None:
	"""
	Save image from temp file to output path preserving metadata.
	
	Args:
		temp_file: Path to temporary source file
		output_path: Destination path for saved image
		compress_level: PNG compression level (0-9)
	"""
	with Image.open(temp_file) as img:
		png_info = PngImagePlugin.PngInfo()
		for k, v in img.info.items():
			if isinstance(k, str) and isinstance(v, str):
				png_info.add_text(k, v)
		img.save(output_path, pnginfo=png_info, compress_level=compress_level)


def _get_image_dimensions(image_path: str) -> Tuple[int, int]:
	"""
	Get image dimensions without keeping file handle open.
	
	Args:
		image_path: Path to image file
		
	Returns:
		Tuple of (width, height)
	"""
	with Image.open(image_path) as img:
		return img.size


@server.PromptServer.instance.routes.post("/a1rspace/filter_save")
async def filter_save(request):
	"""
	Save filtered images: Copy temporary files to output directory.
	
	Preserves image metadata and uses configurable compression.
	"""
	try:
		data = await request.json()
		node_id = data.get("node_id")
		filter_data = data.get("filter_data")
		
		output_dir = filter_data.get("output_dir")
		filename_prefix = filter_data.get("filename_prefix", "A1rSpace")
		temp_files = filter_data.get("temp_files", [])
		compress_level = filter_data.get("compress_level", 4)
		
		if not temp_files:
			return web.json_response({"success": False, "error": "No temp files"}, status=400)
		
		# Get dimensions from first image
		width, height = _get_image_dimensions(temp_files[0])
		
		# Get output path
		full_output_folder, filename, counter, subfolder, _ = folder_paths.get_save_image_path(
			filename_prefix, output_dir, width, height
		)
		
		saved_images = []
		
		# Copy all files to output directory (preserve temp files for preview)
		for temp_file in temp_files:
			if os.path.exists(temp_file):
				output_file = f"{filename}_{counter:05}_.png"
				output_path = os.path.join(full_output_folder, output_file)
				
				try:
					_save_image_with_metadata(temp_file, output_path, compress_level)
					
					saved_images.append({
						"filename": output_file,
						"subfolder": subfolder,
						"type": "output"
					})
					counter += 1
					
				except Exception as e:
					traceback.print_exc()
		
		return web.json_response({
			"success": True, 
			"saved_count": len(saved_images),
			"saved_images": saved_images
		})
		
	except Exception as e:
		traceback.print_exc()
		return web.json_response({"error": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/a1rspace/filter_ignore")
async def filter_ignore(request):
	"""
	Ignore filtered images: No action taken.
	
	Note: Temp files are not deleted as ComfyUI automatically manages them
	when OUTPUT_NODE=False, allowing multiple workflow runs.
	"""
	try:
		data = await request.json()
		node_id = data.get("node_id")
		filter_data = data.get("filter_data")
		temp_files = filter_data.get("temp_files", [])
		
		return web.json_response({"success": True})
		
	except Exception as e:
		traceback.print_exc()
		return web.json_response({"error": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/a1rspace/filter_decision")
async def filter_decision(request):
	"""
	Handle Image Filter node user decision.
	
	Stores user decision for backend blocking wait (inspired by cg-image-filter).
	"""
	try:
		data = await request.json()
		filter_id = data.get("filter_id")
		decision = data.get("decision", "cancel")
		
		# Store decision for backend retrieval
		_filter_decisions[filter_id] = decision
		
		return web.json_response({
			"success": True, 
			"decision": decision
		})
		
	except Exception as e:
		traceback.print_exc()
		return web.json_response({"error": str(e)}, status=500)

def _select_files_by_behavior(temp_files: List[str], behavior: str) -> List[str]:
	"""
	Select files to save based on behavior setting.
	
	Args:
		temp_files: List of temporary file paths
		behavior: One of "save all", "save first", "save last", or "none save"
		
	Returns:
		List of selected file paths to save
	"""
	if behavior == "save all":
		return temp_files
	elif behavior == "save first":
		return temp_files[:1] if temp_files else []
	elif behavior == "save last":
		return temp_files[-1:] if temp_files else []
	else:  # "none save"
		return []


def _safe_remove_files(file_paths: List[str], max_retries: int = 3, delay: float = 0.1) -> None:
	"""
	Safely remove files with retry logic to handle file locks.
	
	Args:
		file_paths: List of file paths to remove
		max_retries: Maximum number of retry attempts
		delay: Delay in seconds between retries
	"""
	time.sleep(delay)  # Initial delay to release file handles
	
	for file_path in file_paths:
		if not os.path.exists(file_path):
			continue
			
		for attempt in range(max_retries):
			try:
				os.remove(file_path)
				break
			except Exception as e:
				if attempt < max_retries - 1:
					time.sleep(delay)


@server.PromptServer.instance.routes.post("/a1rspace/filter_timeout")
async def filter_timeout(request):
	"""
	Handle filter timeout with automatic save behavior.
	
	Saves files based on behavior setting and cleans up remaining temp files.
	"""
	try:
		data = await request.json()
		node_id = data.get("node_id")
		behavior = data.get("behavior", "save all")
		filter_data = data.get("filter_data")
		
		temp_files = filter_data.get("temp_files", [])
		
		# Select files to save based on behavior
		files_to_save = _select_files_by_behavior(temp_files, behavior)
		
		# Save selected files
		if files_to_save and filter_data.get("enable_save"):
			output_dir = filter_data.get("output_dir")
			filename_prefix = filter_data.get("filename_prefix", "A1rSpace")
			
			# Get image dimensions
			width, height = _get_image_dimensions(files_to_save[0])
			
			full_output_folder, filename, counter, subfolder, _ = folder_paths.get_save_image_path(
				filename_prefix, output_dir, width, height
			)
			
			# Move selected files to output
			for temp_file in files_to_save:
				if os.path.exists(temp_file):
					output_file = f"{filename}_{counter:05}_.png"
					output_path = os.path.join(full_output_folder, output_file)
					try:
						shutil.move(temp_file, output_path)
						counter += 1
					except Exception:
						pass
		
		# Clean up remaining temp files with retry logic
		_safe_remove_files(temp_files)
		
		return web.json_response({"success": True})
		
	except Exception as e:
		traceback.print_exc()
		return web.json_response({"error": str(e)}, status=500)

@server.PromptServer.instance.routes.get("/a1rspace/api_config")
async def get_api_config(request):
    """
    Get API configuration.
    """
    try:
        from .nodes.common.config_loader import load_config
        config = load_config()
        return web.json_response(config)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/a1rspace/api_config")
async def save_api_config(request):
    """
    Save API configuration.
    """
    try:
        data = await request.json()
        
        # Validate data structure if needed, but for now just save it
        # We expect Baidu and DeepSeek keys
        
        from .nodes.common.config_loader import _config_path
        
        if _config_path and os.path.exists(_config_path):
             with open(_config_path, "w", encoding='utf-8') as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
        else:
             # If _config_path is not set (load_config not called yet), calculate it
             plugin_base_path = os.path.abspath(os.path.join(os.path.dirname(__file__)))
             config_path = os.path.join(plugin_base_path, "config.json")
             with open(config_path, "w", encoding='utf-8') as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
        
        # Reload config cache
        from .nodes.common.config_loader import reload_config
        reload_config()
        
        return web.json_response({"success": True})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)
