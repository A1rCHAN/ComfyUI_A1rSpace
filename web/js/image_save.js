import { app } from "/scripts/app.js";

app.registerExtension({
    name: "A1rSpace.SaveImagePro",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "A1r Save Image") {
            
            // 节点创建时的初始化
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const result = onNodeCreated?.apply(this, arguments);

                // 隐藏配置用的 widgets
                const hiddenWidgets = ["embedding_workflow", "path_prefix", "date_suffix", "time_suffix"];
                hiddenWidgets.forEach(wName => {
                    const w = this.widgets?.find(w => w.name === wName);
                    if (w) {
                        w.computeSize = () => [0, -4];
                        w.type = "hidden";
                        w.visible = false;
                        w.draw = function() {}; 
                        // 确保有默认值
                        if (w.value === undefined) w.value = true;
                    }
                });

                // 强制重新计算尺寸以去除底部空白
                setTimeout(() => {
                    if (this.onResize) {
                        this.onResize(this.size);
                    }
                    this.setSize(this.computeSize());
                }, 0);

                return result;
            };
            
            // 拦截执行结果 - 显示预览和状态
            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function (message) {
                // 调用原始方法 (会显示 ComfyUI 原生预览)
                const result = onExecuted?.apply(this, arguments);
                
                // 根据 enable_save 控件决定显示的状态
                const enableSaveWidget = this.widgets?.find(w => w.name === "enable_save");
                let status_text = "";
                let status_color = "";

                const enableSave = enableSaveWidget?.value ?? true;
                if (enableSave) {
                    status_text = "✓ Saved";
                    status_color = "#4CAF50"; // 绿色
                } else {
                    status_text = "⊘ Not Saved";
                    status_color = "#FF9800"; // 橙色
                }
                
                // 在节点上显示状态标记
                this._a1r_status_text = status_text;
                this._a1r_status_color = status_color;
                
                // 触发重绘
                if (this.graph && this.graph.canvas) {
                    this.graph.canvas.setDirty(true, true);
                }
                
                return result;
            };
            
            // 自定义绘制 - 在节点标题栏右侧显示状态
            const onDrawForeground = nodeType.prototype.onDrawForeground;
            nodeType.prototype.onDrawForeground = function (ctx) {
                const result = onDrawForeground?.apply(this, arguments);
                
                if (this.flags.collapsed) return result;

                if (this._a1r_status_text) {
                    const text = this._a1r_status_text;
                    const color = this._a1r_status_color || "#2196F3";
                    
                    // 绘制状态标记 (在节点标题栏内，右侧位置)
                    ctx.save();
                    
                    // 使用小字体
                    ctx.font = "10px Arial";
                    const textWidth = ctx.measureText(text).width;
                    
                    // 绘制在标题栏内右侧
                    const padding = 6;
                    const bgWidth = textWidth + padding * 2;
                    const bgHeight = 18;
                    const titleHeight = LiteGraph.NODE_TITLE_HEIGHT || 30;
                    const x = this.size[0] - bgWidth - 5;  // 距离右边5px
                    const y = -titleHeight + 3;  // 标题栏内，距离顶部3px
                    
                    // 半透明背景
                    ctx.fillStyle = color + "DD";
                    ctx.beginPath();
                    ctx.roundRect(x, y, bgWidth, bgHeight, 3);
                    ctx.fill();
                    
                    // 绘制文字
                    ctx.fillStyle = "#FFFFFF";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(text, x + bgWidth / 2, y + bgHeight / 2);
                    
                    ctx.restore();
                }
                
                return result;
            };
            
            // 提供右键菜单选项
            const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
            nodeType.prototype.getExtraMenuOptions = function (_, options) {
                if (getExtraMenuOptions) {
                    getExtraMenuOptions.apply(this, arguments);
                }

                // Helper to get/set widget value
                const getVal = (name) => this.widgets?.find(w => w.name === name)?.value ?? true;
                const setVal = (name, val) => {
                    const w = this.widgets?.find(w => w.name === name);
                    if (w) {
                        w.value = val;
                        app.graph.setDirtyCanvas(true);
                    }
                };

                // 添加保存设置菜单
                options.push({
                    content: "Save Settings",
                    submenu: {
                        options: [
                            {
                                content: getVal("embedding_workflow") ? "Embedding Workflow" : "Without Workflow",
                                callback: () => setVal("embedding_workflow", !getVal("embedding_workflow"))
                            },
                            {
                                content: getVal("path_prefix") ? "Apply Path Prefix" : "Without Path",
                                callback: () => setVal("path_prefix", !getVal("path_prefix"))
                            },
                            {
                                content: getVal("date_suffix") ? "Date Suffix" : "Without Date",
                                callback: () => setVal("date_suffix", !getVal("date_suffix"))
                            },
                            {
                                content: getVal("time_suffix") ? "Time Suffix" : "Without Time",
                                callback: () => setVal("time_suffix", !getVal("time_suffix"))
                            }
                        ]
                    }
                });
            };
        }
    }
});

// 添加自定义样式
const style = document.createElement("style");
style.textContent = `
    .a1r-menu-hint {
        color: #777 !important;
        font-style: italic !important;
        padding: 4px 12px !important;
    }
`;
document.head.appendChild(style);