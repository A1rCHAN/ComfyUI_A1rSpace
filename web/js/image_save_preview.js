import { app } from "/scripts/app.js";

/**
 * A1r Save Preview Image 节点扩展
 * 职责: 根据 behavior 参数(来自 Image Filter 节点)或 enable_save 决定是否保存图片
 * 
 * 工作流程:
 * 1. 根据 `enable_save` 决定是否保存并在节点上显示状态。
 *    - enable_save = true → 保存并预览
 *    - enable_save = false → 仅预览不保存
 */

app.registerExtension({
    name: "A1rSpace.SavePreviewImage",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "A1r Save Preview Image") {
            
            // 节点创建时的初始化
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const result = onNodeCreated?.apply(this, arguments);
                return result;
            };
            
            // 拦截执行结果 - 显示预览
            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function (message) {
                // 调用原始方法 (会显示 ComfyUI 原生预览)
                const result = onExecuted?.apply(this, arguments);
                
                // 仅根据 enable_save 控件决定是否保存并显示状态
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
                
                // status logged for debugging removed
                
                return result;
            };
            
            // 自定义绘制 - 在节点标题栏右侧显示状态（不遮挡内容）
            const onDrawForeground = nodeType.prototype.onDrawForeground;
            nodeType.prototype.onDrawForeground = function (ctx) {
                const result = onDrawForeground?.apply(this, arguments);
                
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
            
            // 监听输入连接变化 — 保持原始连接回调行为，不再处理已移除的 behavior 输入
            const onConnectionsChange = nodeType.prototype.onConnectionsChange;
            nodeType.prototype.onConnectionsChange = function (type, index, connected, link_info) {
                const result = onConnectionsChange?.apply(this, arguments);
                return result;
            };
        }
    }
});
