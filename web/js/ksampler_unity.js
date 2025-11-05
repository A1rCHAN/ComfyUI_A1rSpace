import { app } from "/scripts/app.js";

app.registerExtension({
    name: "A1r.UnityKSampler",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "A1r Unity KSampler") return;

        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const result = originalOnNodeCreated?.apply(this, arguments);

            // 获取小部件
            const modeWidget = this.widgets?.find(w => w.name === "mode");
            const denoiseWidget = this.widgets?.find(w => w.name === "denoise");

            if (!modeWidget) return result;

            // 移除输入端口
            const removeInputByNames = (names) => {
                if (!Array.isArray(this.inputs)) return;
                for (let i = this.inputs.length - 1; i >= 0; i--) {
                    const inp = this.inputs[i];
                    if (inp && names.includes(inp.name)) {
                        this.removeInput?.(i);
                    }
                }
            };

            // 添加输入槽（required 样式 - 实心圆点）
            const addInput = (node, inputName, inputType) => {
                // 检查是否已存在
                const existing = node.inputs?.find(i => i.name === inputName);
                if (existing) {
                    // 如果已存在，确保类型和样式正确
                    existing.type = inputType;
                    existing.shape = LiteGraph.CIRCLE_SHAPE; // required 输入使用 CIRCLE_SHAPE（实心圆）
                    return;
                }
                
                // 添加新的输入槽
                const inputIndex = node.addInput(inputName, inputType);
                
                // 设置为 required 样式（实心圆点）
                if (inputIndex !== undefined && node.inputs && node.inputs[inputIndex]) {
                    node.inputs[inputIndex].shape = LiteGraph.CIRCLE_SHAPE;
                }
            };

            // 设置小部件为只读
            const setWidgetReadonly = (widget, readonly) => {
                if (!widget) return;
                
                if (readonly) {
                    // 禁用（只读）
                    widget.disabled = true;
                    widget.options = widget.options || {};
                    widget.options.disabled = true;
                } else {
                    // 启用
                    widget.disabled = false;
                    if (widget.options) {
                        widget.options.disabled = false;
                    }
                }
            };

            // 根据模式更新输入端口和只读状态
            const updateVisibility = (mode) => {
                if (mode === "text to image") {
                    // Text to Image: 需要 pixels, vae, width, height, batch_size
                    removeInputByNames(["latent", "upscale_by", "upscale_method"]);
                    addInput(this, "pixels", "IMAGE");
                    addInput(this, "vae", "VAE");
                    addInput(this, "width", "INT");
                    addInput(this, "height", "INT");
                    addInput(this, "batch_size", "INT");
                    
                    // denoise 设为只读（固定为 1.0）
                    setWidgetReadonly(denoiseWidget, true);
                    
                } else if (mode === "image to image") {
                    // Image to Image: 需要 pixels, vae, width, height, batch_size
                    removeInputByNames(["latent", "upscale_by", "upscale_method"]);
                    addInput(this, "pixels", "IMAGE");
                    addInput(this, "vae", "VAE");
                    addInput(this, "width", "INT");
                    addInput(this, "height", "INT");
                    addInput(this, "batch_size", "INT");
                    
                    // denoise 可编辑
                    setWidgetReadonly(denoiseWidget, false);
                    
                } else if (mode === "latent upscale") {
                    // Latent Upscale: 需要 latent, upscale_by, upscale_method (不需要 batch_size)
                    removeInputByNames(["pixels", "vae", "width", "height", "batch_size"]);
                    addInput(this, "latent", "LATENT");
                    addInput(this, "upscale_method", "UPSCALEMETHOD");
                    addInput(this, "upscale_by", "FLOAT");
                    
                    // denoise 可编辑
                    setWidgetReadonly(denoiseWidget, false);
                }

                // 触发节点重新计算尺寸和重绘
                this.setSize(this.computeSize());
                this.setDirtyCanvas(true, true);
            };

            // 在 onConfigure 时重新应用可见性设置
            const originalOnConfigure = this.onConfigure;
            this.onConfigure = function() {
                const r = originalOnConfigure?.apply(this, arguments);
                
                // 重新应用当前模式的可见性设置
                updateVisibility(modeWidget.value);
                
                return r;
            };

            // 监听模式变化
            const originalCallback = modeWidget.callback;
            modeWidget.callback = function(value) {
                if (originalCallback) {
                    originalCallback.apply(this, arguments);
                }
                updateVisibility(value);
            };

            updateVisibility(modeWidget.value);

            return result;
        };
    }
});