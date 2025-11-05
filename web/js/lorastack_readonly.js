import { app } from "/scripts/app.js";

app.registerExtension({
    name: "A1rSpace.LoRA.SixLoader",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        const nodeNameList = [
            "A1r Six LoRA Loader",
            "A1r Six LoRA Loader 2P",
            "A1r Six LoRA Loader Separate",
        ];
        if (!nodeNameList.includes(nodeData.name)) return;

        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const result = originalOnNodeCreated?.apply(this, arguments);
            
            if (this._a1r_six_loader_bound) return result;
            this._a1r_six_loader_bound = true;

            // 初始化：查找所有相关 widgets
            const initWidgets = () => {
                if (!Array.isArray(this.widgets)) {
                    requestAnimationFrame(initWidgets);
                    return;
                }

                // 找到所有 6 个 LoRA 槽位的 widgets
                const loraSlots = [];
                for (let i = 1; i <= 6; i++) {
                    const slot = {
                        enable: this.widgets.find(w => w.name === `enable_lora_${i}`),
                        name: this.widgets.find(w => w.name === `lora_name_${i}`),
                        modelStrength: this.widgets.find(w => w.name === `model_strength_${i}`),
                        clipStrength: this.widgets.find(w => w.name === `clip_strength_${i}`),
                    };
                    if (slot.enable) {
                        loraSlots.push(slot);
                    }
                }

                if (loraSlots.length === 0) {
                    requestAnimationFrame(initWidgets);
                    return;
                }

                // 保存引用
                this._a1r_slots = loraSlots;

                // 检测 lora_stack 连接状态并禁用 widgets
                this.checkStackConnection = () => {
                    let hasStackConnection = false;
                    
                    // 检查 lora_stack 输入是否有连接
                    if (Array.isArray(this.inputs)) {
                        const stackInput = this.inputs.find(inp => inp.name === "lora_stack");
                        if (stackInput && stackInput.link != null) {
                            hasStackConnection = true;
                        }
                    }

                    // 根据连接状态设置 widgets 的只读属性
                    this._a1r_slots.forEach(slot => {
                        [slot.enable, slot.name, slot.modelStrength, slot.clipStrength].forEach(w => {
                            if (w) {
                                if (hasStackConnection) {
                                    // 禁用（只读）
                                    w.disabled = true;
                                    w.options = w.options || {};
                                    w.options.disabled = true;
                                } else {
                                    // 启用
                                    w.disabled = false;
                                    if (w.options) {
                                        w.options.disabled = false;
                                    }
                                }
                            }
                        });
                    });

                    return hasStackConnection;
                };

                // 初始检查连接状态
                this.checkStackConnection();
            };

            initWidgets();

            return result;
        };

        // 监听连接变化
        const originalOnConnectionsChange = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function(type, index, connected, link_info) {
            const result = originalOnConnectionsChange?.apply(this, arguments);
            
            // 当输入连接变化时，重新检查状态
            if (type === LiteGraph.INPUT) {
                setTimeout(() => {
                    this.checkStackConnection?.();
                    this.setDirtyCanvas?.(true, true);
                }, 10);
            }
            
            return result;
        };
    }
});