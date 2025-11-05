import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

// 从后端获取预设配置
let size_list = null;
let default_config = null;

// 获取配置
async function loadConfig() {
    try {
        const response = await api.fetchApi("/a1rspace/canvas_config");
        const config = await response.json();
        size_list = config.size_list;
        default_config = config.default_config;
    } catch (error) {
        size_list = {
            "Custom": [1024, 1024],
            "Square 1024": [1024, 1024],
        };
        default_config = {
            canvas_max: 2048,
            canvas_min: 512,
            canvas_step: 128,
        };
    }
}

app.registerExtension({
    name: "A1rSpace.SizeCanvas",
    
    async setup() {
        await loadConfig();
    },
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "A1r Size Canvas") {
            
            const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = async function () {
                const result = originalOnNodeCreated?.apply(this, arguments);

                if (!size_list) {
                    await loadConfig();
                }
                
                const node = this;
                
                // 布局常量
                const MARGIN_SIDE = 15;
                const MARGIN_BOTTOM = 5; // 信息文本到节点底部的距离
                const CANVAS_PADDING = 10;
                const MIN_CANVAS_SIZE = 180; // canvas 最小尺寸
                
                // 固定位置常量
                const TITLE_HEIGHT = LiteGraph.NODE_TITLE_HEIGHT || 30;
                const WIDGET_HEIGHT = LiteGraph.NODE_WIDGET_HEIGHT || 20;
                const PRESET_CANVAS_GAP = 25; // preset 到 canvas 的间距
                const CANVAS_INFO_GAP = 5; // canvas 到信息文本的间距
                const INFO_TEXT_HEIGHT = 15; // 信息文本高度
                
                // 计算最小节点高度
                const MIN_NODE_HEIGHT = TITLE_HEIGHT + WIDGET_HEIGHT + PRESET_CANVAS_GAP + 
                                        MIN_CANVAS_SIZE + CANVAS_INFO_GAP + INFO_TEXT_HEIGHT + MARGIN_BOTTOM;
                
                // 添加节点属性
                this.addProperty("canvas_max", default_config.canvas_max, "number");
                this.addProperty("canvas_min", default_config.canvas_min, "number");
                this.addProperty("canvas_step", default_config.canvas_step, "number");
                
                // 找到 widgets
                let widthWidget = this.widgets.find(w => w.name === "width");
                let heightWidget = this.widgets.find(w => w.name === "height");
                let presetWidget = this.widgets.find(w => w.name === "preset");
                
                // 隐藏 width 和 height
                const hideWidget = (widget) => {
                    if (!widget) return;
                    
                    widget.type = "hidden";
                    widget.computeSize = () => [0, -4];
                    widget.hidden = true;

                    if (typeof widget.serialize !== "function") {
                        widget.serializeValue = () => widget.value;
                    }
                };

                if (widthWidget) hideWidget(widthWidget);
                if (heightWidget) hideWidget(heightWidget);

                const removeInputByNames = (names) => {
                    if (!Array.isArray(this.inputs)) return;
                    for (let i = this.inputs.length - 1; i >= 0; i--) {
                        const inp = this.inputs[i];
                        if (inp && names.includes(inp.name)) {
                            this.removeInput?.(i);
                        }
                    }
                };
                removeInputByNames(["width", "height"]);

                const originalOnConfigure = this.onConfigure;
                this.onConfigure = function() {
                    const r = originalOnConfigure?.apply(this, arguments);
                    removeInputByNames(["width", "height"]);
                    return r;
                };

                // 重写 onResize 以限制最小高度
                const originalOnResize = this.onResize;
                this.onResize = function(size) {
                    // 限制最小高度
                    if (size[1] < MIN_NODE_HEIGHT) {
                        size[1] = MIN_NODE_HEIGHT;
                    }
                    
                    if (originalOnResize) {
                        originalOnResize.apply(this, [size]);
                    }
                    
                    cachedGridImage = null;
                    cachedGridConfig = null;
                    this.setDirtyCanvas(true, false);
                };

                // 交互状态
                let isDragging = false;
                
                // 缓存：避免重复计算
                let cachedGridImage = null;
                let cachedGridConfig = null;
                
                // 获取配置值
                function getCanvasMax() {
                    return node.properties.canvas_max || default_config.canvas_max;
                }
                
                function getCanvasMin() {
                    return node.properties.canvas_min || default_config.canvas_min;
                }
                
                function getCanvasStep() {
                    return node.properties.canvas_step || default_config.canvas_step;
                }
                
                // 画板区域计算
                function getCanvasArea() {
                    const nodeWidth = node.size[0];
                    const nodeHeight = node.size[1];
                    
                    // 确保节点高度不小于最小值
                    if (nodeHeight < MIN_NODE_HEIGHT) {
                        node.size[1] = MIN_NODE_HEIGHT;
                    }
                    
                    // 固定的画板起始位置：标题 + preset widget + 间距
                    const canvasStartY = TITLE_HEIGHT + WIDGET_HEIGHT + PRESET_CANVAS_GAP;
                    
                    // 信息文本固定在底部往上5px
                    const infoY = nodeHeight - MARGIN_BOTTOM;
                    
                    // canvas 可用高度 = 从 canvas 起始位置到信息文本位置，减去间距
                    const maxCanvasHeight = infoY - canvasStartY - CANVAS_INFO_GAP - INFO_TEXT_HEIGHT;
                    
                    // 计算可用宽度
                    const availableWidth = nodeWidth - MARGIN_SIDE * 2;
                    
                    // canvas 尺寸主要基于宽度（保持正相关）
                    let canvasSize = Math.max(MIN_CANVAS_SIZE, availableWidth);
                    
                    // 限制：不能超过可用高度
                    if (canvasSize > maxCanvasHeight) {
                        canvasSize = Math.max(MIN_CANVAS_SIZE, maxCanvasHeight);
                    }
                    
                    // 水平居中
                    const canvasX = MARGIN_SIDE + (availableWidth - canvasSize) / 2;
                    const canvasY = canvasStartY;
                    
                    return { canvasX, canvasY, canvasSize };
                }
                
                // 创建网格缓存
                function createGridCache(size, canvasMax, canvasStep) {
                    const padding = CANVAS_PADDING;
                    const drawSize = size - padding * 2;
                    const scale = drawSize / canvasMax;
                    
                    const cacheCanvas = document.createElement('canvas');
                    cacheCanvas.width = size;
                    cacheCanvas.height = size;
                    const ctx = cacheCanvas.getContext('2d');
                    
                    // 背景
                    ctx.fillStyle = "#1a1a1a";
                    ctx.fillRect(0, 0, size, size);
                    
                    const originX = padding;
                    const originY = size - padding;
                    
                    // 普通网格线
                    ctx.strokeStyle = "rgba(200,200,200,0.15)";
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    
                    for (let x = 0; x <= canvasMax; x += canvasStep) {
                        const px = originX + x * scale;
                        if (px >= padding && px <= padding + drawSize) {
                            ctx.moveTo(px, padding);
                            ctx.lineTo(px, originY);
                        }
                    }
                    
                    for (let y = 0; y <= canvasMax; y += canvasStep) {
                        const py = originY - y * scale;
                        if (py >= padding && py <= originY) {
                            ctx.moveTo(padding, py);
                            ctx.lineTo(padding + drawSize, py);
                        }
                    }
                    
                    ctx.stroke();
                    
                    // 512 边界线
                    ctx.strokeStyle = "rgba(200, 200, 200, 0.16)";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    
                    for (let x = 0; x <= canvasMax; x += 512) {
                        const px = originX + x * scale;
                        if (px >= padding && px <= padding + drawSize) {
                            ctx.moveTo(px, padding);
                            ctx.lineTo(px, originY);
                        }
                    }
                    
                    for (let y = 0; y <= canvasMax; y += 512) {
                        const py = originY - y * scale;
                        if (py >= padding && py <= originY) {
                            ctx.moveTo(padding, py);
                            ctx.lineTo(padding + drawSize, py);
                        }
                    }
                    
                    ctx.stroke();
                    
                    // 外边框
                    ctx.strokeStyle = "#333";
                    ctx.lineWidth = 1;
                    ctx.strokeRect(padding, padding, drawSize, drawSize);
                    
                    return cacheCanvas;
                }
                
                // 使用 onDrawForeground 绘制 canvas 画板
                this.onDrawForeground = function(ctx) {
                    // 保存 canvas 上下文状态，防止修改影响到 LiteGraph 的默认绘制
                    ctx.save();
                    if (this.flags.collapsed) { ctx.restore(); return; }
                    
                    const area = getCanvasArea();
                    const { canvasX, canvasY, canvasSize } = area;
                    
                    if (canvasSize <= 0) { ctx.restore(); return; }
                    
                    const canvasMax = getCanvasMax();
                    const canvasMin = getCanvasMin();
                    const canvasStep = getCanvasStep();
                    
                    // 检查是否需要重新生成网格缓存
                    const gridConfigKey = `${canvasSize}_${canvasMax}_${canvasStep}`;
                    if (cachedGridConfig !== gridConfigKey) {
                        cachedGridImage = createGridCache(canvasSize, canvasMax, canvasStep);
                        cachedGridConfig = gridConfigKey;
                    }
                    
                    // 绘制缓存的网格
                    ctx.drawImage(cachedGridImage, canvasX, canvasY);
                    
                    // 绘制动态内容（矩形和文字）
                    const currentWidth = widthWidget.value;
                    const currentHeight = heightWidget.value;
                    
                    const padding = CANVAS_PADDING;
                    const drawSize = canvasSize - padding * 2;
                    const originX = canvasX + padding;
                    const originY = canvasY + canvasSize - padding;
                    const scale = drawSize / canvasMax;
                    
                    const rectWidth = Math.min(currentWidth * scale, drawSize);
                    const rectHeight = Math.min(currentHeight * scale, drawSize);
                    const rectX = originX;
                    const rectY = originY - rectHeight;
                    
                    // 填充
                    ctx.fillStyle = "rgba(200, 200, 200, 0.25)";
                    ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
                    
                    // 边框
                    ctx.strokeStyle = "#bababaff";
                    ctx.lineWidth = 2;
                    ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
                    
                    // 控制点
                    const handleSize = 12;
                    ctx.fillStyle = "#bababaff";
                    ctx.fillRect(
                        rectX + rectWidth - handleSize / 2,
                        rectY - handleSize / 2,
                        handleSize,
                        handleSize
                    );
                    
                    // 尺寸文字
                    const text = `${currentWidth} × ${currentHeight}`;
                    const textX = rectX + rectWidth / 2;
                    const textY = rectY + rectHeight / 2;
                    
                    ctx.font = "bold 16px Arial";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    
                    // 文字描边
                    ctx.strokeStyle = "#000000";
                    ctx.lineWidth = 3;
                    ctx.strokeText(text, textX, textY);
                    
                    ctx.fillStyle = "#ffffff";
                    ctx.fillText(text, textX, textY);
                    
                    // 底部信息 - 固定在节点底边往上5px
                    const infoY = this.size[1] - MARGIN_BOTTOM;
                    ctx.save();
                    ctx.font = "11px Arial";
                    ctx.fillStyle = "#aaa";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "bottom"; // 使用 bottom 基线
                    ctx.fillText(
                        `Range: ${canvasMin}-${canvasMax} | Step: ${canvasStep}`,
                        this.size[0] / 2,
                        infoY
                    );
                    ctx.restore();

                    // 恢复上下文状态
                    ctx.restore();
                };
                
                // 节流函数
                let updateTimeout = null;
                function throttledUpdate() {
                    if (updateTimeout) return;
                    updateTimeout = setTimeout(() => {
                        node.setDirtyCanvas(true, false);
                        updateTimeout = null;
                    }, 16);
                }
                
                // 更新尺寸
                function updateSize(e, pos) {
                    const canvasMax = getCanvasMax();
                    const canvasMin = getCanvasMin();
                    const canvasStep = getCanvasStep();
                    
                    const area = getCanvasArea();
                    const { canvasX, canvasY, canvasSize } = area;
                    
                    const padding = CANVAS_PADDING;
                    const drawSize = canvasSize - padding * 2;
                    const originX = padding;
                    const originY = canvasSize - padding;
                    const scale = drawSize / canvasMax;
                    
                    const mouseX = pos[0] - canvasX;
                    const mouseY = pos[1] - canvasY;
                    
                    let newWidth = (mouseX - originX) / scale;
                    let newHeight = (originY - mouseY) / scale;
                    
                    const shouldSnap = !e.shiftKey;
                    if (shouldSnap) {
                        newWidth = Math.round(newWidth / canvasStep) * canvasStep;
                        newHeight = Math.round(newHeight / canvasStep) * canvasStep;
                    }
                    
                    newWidth = Math.max(canvasMin, Math.min(canvasMax, newWidth));
                    newHeight = Math.max(canvasMin, Math.min(canvasMax, newHeight));
                    
                    widthWidget.value = newWidth;
                    heightWidget.value = newHeight;
                    
                    if (presetWidget) {
                        presetWidget.value = "Custom";
                    }
                    
                    throttledUpdate();
                }
                
                // 鼠标事件
                this.onMouseDown = function(e, pos, canvas) {
                    const area = getCanvasArea();
                    const { canvasX, canvasY, canvasSize } = area;
                    
                    if (pos[0] < canvasX || pos[0] > canvasX + canvasSize) return false;
                    if (pos[1] < canvasY || pos[1] > canvasY + canvasSize) return false;
                    
                    isDragging = true;
                    this.capture = true;

                    if (canvas && canvas.pointerLock) {
                        canvas.pointer.captured_node = this;
                    }
                    
                    updateSize(e, pos);
                    return true;
                };
                
                this.onMouseMove = function(e, pos, canvas) {
                    if (!isDragging) return;

                    if (canvas && canvas.pointer && !canvas.pointer.isDown) {
                        this.onMouseUp(e, pos, canvas);
                        return;
                    }

                    updateSize(e, pos);
                };
                
                this.onMouseUp = function(e, pos, canvas) {
                    if (!isDragging) return;

                    isDragging = false;
                    this.capture = false;

                    if (canvas && canvas.pointer && canvas.pointer.captured_node === this) {
                        canvas.pointer.captured_node = null;
                    }
                };
                
                // 监听预设变化
                if (presetWidget) {
                    const originalCallback = presetWidget.callback;
                    presetWidget.callback = function(value) {
                        if (originalCallback) {
                            originalCallback.apply(this, arguments);
                        }
                        
                        if (value in size_list && value !== "Custom") {
                            const [w, h] = size_list[value];
                            widthWidget.value = w;
                            heightWidget.value = h;
                            node.setDirtyCanvas(true, false);
                        }
                    };
                }
                
                // 监听属性变化
                const originalOnPropertyChanged = this.onPropertyChanged;
                this.onPropertyChanged = function(property, value) {
                    if (originalOnPropertyChanged) {
                        originalOnPropertyChanged.apply(this, arguments);
                    }
                    
                    if (property === "canvas_max" || property === "canvas_min" || property === "canvas_step") {
                        const canvasMax = getCanvasMax();
                        const canvasMin = getCanvasMin();
                        
                        widthWidget.value = Math.max(canvasMin, Math.min(canvasMax, widthWidget.value));
                        heightWidget.value = Math.max(canvasMin, Math.min(canvasMax, heightWidget.value));
                        
                        cachedGridImage = null;
                        cachedGridConfig = null;
                        
                        this.setDirtyCanvas(true, false);
                    }
                };
                
                return result;
            };
        }
    },
});