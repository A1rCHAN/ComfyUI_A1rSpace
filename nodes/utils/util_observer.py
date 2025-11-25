import latent_preview
import torch
import comfy.utils
import server
from protocol import BinaryEventTypes

class LatentObserver:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ()
    FUNCTION = "observe_latents"
    OUTPUT_NODE = True

    CATEGORY = "A1rSpace/Utils"

    def observe_latents(self):
        return ()

# Apply patch at module level to ensure it runs when the node is loaded
if not hasattr(latent_preview, "_original_prepare_callback"):
    latent_preview._original_prepare_callback = latent_preview.prepare_callback

    def my_prepare_callback(model, steps, x0_output_dict=None):
        # 尝试获取默认的 previewer
        previewer = latent_preview.get_previewer(model.load_device, model.model.latent_format)
        
        # 标记是否是强制开启的预览
        forced_preview = False

        # 如果没有获取到 (例如全局设置为 NoPreviews)，强制使用 Latent2RGB
        if previewer is None:
            latent_format = model.model.latent_format
            if getattr(latent_format, "latent_rgb_factors", None) is not None:
                bias = getattr(latent_format, "latent_rgb_factors_bias", None)
                previewer = latent_preview.Latent2RGBPreviewer(latent_format.latent_rgb_factors, bias)
                forced_preview = True

        pbar = comfy.utils.ProgressBar(steps)

        def callback(step, x0, x, total_steps):
            if x0_output_dict is not None:
                x0_output_dict["x0"] = x0

            preview_tuple = None
            if previewer:
                try:
                    preview_tuple = previewer.decode_latent_to_preview_image("JPEG", x0)
                except Exception:
                    pass
            
            # 如果是强制开启的预览，不要发送给标准进度条（避免影响全局设置）
            if forced_preview:
                pbar.update_absolute(step + 1, total_steps, None)
            else:
                pbar.update_absolute(step + 1, total_steps, preview_tuple)

            # 额外发送给 LatentObserver 节点
            if preview_tuple:
                try:
                    s = server.PromptServer.instance
                    # 遍历当前运行的任务
                    # currently_running 是 {task_id: (number, prompt_id, prompt, extra_data, outputs_to_execute)}
                    for task in s.prompt_queue.currently_running.values():
                        prompt_id = task[1]
                        prompt = task[2]
                        extra_data = task[3]
                        client_id = extra_data.get("client_id")

                        if not client_id:
                            continue

                        # 查找所有 LatentObserver 节点
                        for node_id, node_data in prompt.items():
                            if node_data.get("class_type") == "A1r Latent Observer":
                                metadata = {
                                    "node_id": node_id,
                                    "prompt_id": prompt_id,
                                    "display_node_id": node_id,
                                    "real_node_id": node_id,
                                }
                                s.send_sync(
                                    BinaryEventTypes.PREVIEW_IMAGE_WITH_METADATA,
                                    (preview_tuple, metadata),
                                    client_id
                                )
                except Exception as e:
                    print(f"LatentObserver Error: {e}")

        return callback

    latent_preview.prepare_callback = my_prepare_callback

UTIL_OB_CLASS_MAPPINGS = {
    "A1r Latent Observer": LatentObserver,
}

UTIL_OB_DISPLAY_NAME_MAPPINGS = {
    "A1r Latent Observer": "Latent Observer",
}