import { app } from "/scripts/app.js";

// ==================== 基础工具函数 ====================

/**
 * 判断坐标是否在边界内
 */
function isInBounds(pos, bounds) {
    if (!bounds || bounds.length < 2) return false;
    const [x, width] = bounds;
    return pos[0] >= x && pos[0] <= x + width;
}

/**
 * 绘制圆角矩形
 */
function drawRoundedRect(ctx, x, y, width, height, radius, fill = true, stroke = false) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

/**
 * 绘制只对左右侧圆角的矩形（可选择仅左侧或右侧圆角）
 */
function drawRoundedRectSides(ctx, x, y, width, height, radius, roundLeft, roundRight, fill = true, stroke = false) {
    const r = Math.max(0, radius);
    ctx.beginPath();

    // start at top-left
    if (roundLeft) ctx.moveTo(x + r, y); else ctx.moveTo(x, y);

    // top edge to top-right
    if (roundRight) ctx.lineTo(x + width - r, y); else ctx.lineTo(x + width, y);

    // top-right corner
    if (roundRight) ctx.arcTo(x + width, y, x + width, y + r, r);

    // right edge
    if (roundRight) ctx.lineTo(x + width, y + height - r); else ctx.lineTo(x + width, y + height);

    // bottom-right corner
    if (roundRight) ctx.arcTo(x + width, y + height, x + width - r, y + height, r);

    // bottom edge to bottom-left
    if (roundLeft) ctx.lineTo(x + r, y + height); else ctx.lineTo(x, y + height);

    // bottom-left corner
    if (roundLeft) ctx.arcTo(x, y + height, x, y + height - r, r);

    // left edge up to top-left
    if (roundLeft) ctx.lineTo(x, y + r); else ctx.lineTo(x, y);

    // top-left corner
    if (roundLeft) ctx.arcTo(x, y, x + r, y, r);

    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

/**
 * 绘制开关并返回边界
 */
function drawTogglePart(ctx, { posX, posY, height, value, centerY = null }) {
    const width = 26;
    const toggleHeight = 14;
    let y;
    if (centerY !== null && typeof centerY === 'number') {
        // 根据 centerY 居中绘制 toggle
        y = Math.round(centerY - toggleHeight / 2);
    } else {
        y = posY + (height - toggleHeight) / 2;
    }

    // 背景
    ctx.fillStyle = value ? "#4CAF50" : "#555";
    drawRoundedRect(ctx, posX, y, width, toggleHeight, 7);

    // 滑块
    const knobX = value ? posX + width - 11 : posX + 2;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(knobX + 5, y + 7, 5, 0, Math.PI * 2);
    ctx.fill();

    return [posX, width];
}

/**
 * 绘制数字调节器部件并返回各部分边界
 */
function drawNumberWidgetPart(ctx, { 
    posX, 
    posY, 
    height, 
    value, 
    enabled = true,
    disableDecrease = false,
    disableIncrease = false,
    centerY = null
}) {
    const totalWidth = 65;
    const arrowWidth = 15;
    const valueWidth = totalWidth - arrowWidth * 2;
    
    const startX = posX - totalWidth;

    // 调整：内层矩形向内收窄一点，使视觉元素垂直居中
    const innerH = height - 6;
    let innerY;
    if (centerY !== null && typeof centerY === 'number') {
        innerY = Math.round(centerY - innerH / 2);
    } else {
        innerY = posY + 3;
    }
    const midY = innerY + innerH / 2;

    // 背景（圆角矩形）
    ctx.fillStyle = enabled ? "#383838" : "#2a2a2a";
    ctx.strokeStyle = enabled ? "#555" : "#333";
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, startX, innerY, totalWidth, innerH, 6, true, true);

    // 左箭头 - 与整体圆角矩形对齐，使用内层 y/height
    const leftDisabled = !enabled || disableDecrease;
    ctx.fillStyle = leftDisabled ? "#333" : "#666";
    // 左侧圆角与外层保持一致（左侧圆角，右侧方角）
    drawRoundedRectSides(ctx, startX, innerY, arrowWidth, innerH, 6, true, false, true, false);
    ctx.fillStyle = leftDisabled ? "#555" : "#ccc";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("◀", startX + arrowWidth / 2, midY);

    // 数值区域 - 填充在内层矩形内部，垂直居中
    ctx.fillStyle = enabled ? "#404040" : "#2a2a2a";
    ctx.fillRect(startX + arrowWidth, innerY, valueWidth, innerH);
    ctx.fillStyle = enabled ? "#fff" : "#777";
    ctx.font = "11px monospace";
    ctx.fillText(value.toFixed(2), startX + arrowWidth + valueWidth / 2, midY);

    // 右箭头 - 与内层右侧对齐
    const rightDisabled = !enabled || disableIncrease;
    ctx.fillStyle = rightDisabled ? "#333" : "#666";
    drawRoundedRectSides(ctx, startX + totalWidth - arrowWidth, innerY, arrowWidth, innerH, 6, false, true, true, false);
    ctx.fillStyle = rightDisabled ? "#555" : "#ccc";
    ctx.font = "11px Arial";
    ctx.fillText("▶", startX + totalWidth - arrowWidth / 2, midY);
    
    return [
        [startX, arrowWidth],
        [startX + arrowWidth, valueWidth],
        [startX + totalWidth - arrowWidth, arrowWidth],
    ];
}

/**
 * 裁剪字符串使其适应宽度
 */
function fitString(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) {
        return text;
    }
    let result = text;
    while (ctx.measureText(result + "...").width > maxWidth && result.length > 0) {
        result = result.substring(0, result.length - 1);
    }
    return result + "...";
}

// ==================== 基础 Widget 类 ====================

class BaseCustomWidget {
    constructor(name) {
        this.name = name;
        this.type = "custom";
        this.hitAreas = {};
        this.options = { serialize: false };
    }
    
    computeSize(width) {
        return [width - 20, 24];
    }
    
    isInBounds(pos, bounds) {
        return isInBounds(pos, bounds);
    }
    
    mouse(event, pos, node) {
        if (event.type === "pointerdown") {
            return this.onMouseDown(event, pos, node);
        }
        return false;
    }
    
    onMouseDown(event, pos, node) {
        for (const [key, area] of Object.entries(this.hitAreas)) {
            if (this.isInBounds(pos, area.bounds)) {
                if (area.disabled) {
                    return false;
                }
                if (area.onDown) {
                    return area.onDown.call(this, event, pos, node);
                }
            }
        }
        return false;
    }
    
    draw(ctx, node, widget_width, y, height) {
        // 子类实现
    }
}

// ==================== LoRA Entry Widget ====================

class LoRAEntryWidget extends BaseCustomWidget {
    constructor(name) {
        super(name);
        
        // 存储数据 - 默认状态为开启
        this.data = {
            enabled: true,
            lora: "None",
            strength: 1.0
        };
        
        // 定义所有可交互区域
        this.hitAreas = {
            enable: { bounds: [0, 0], onDown: this.onToggleClick, disabled: false },
            lora: { bounds: [0, 0], onDown: this.onLoraClick, disabled: false },
            strengthDec: { bounds: [0, 0], onDown: this.onStrengthDec, disabled: false },
            strengthVal: { bounds: [0, 0], onDown: this.onStrengthInput, disabled: false },
            strengthInc: { bounds: [0, 0], onDown: this.onStrengthInc, disabled: false },
        };
        
        this.lastEvent = null;
    }
    
    onMouseDown(event, pos, node) {
        this.lastEvent = event;
        
        for (const [key, area] of Object.entries(this.hitAreas)) {
            if (this.isInBounds(pos, area.bounds)) {
                if (area.disabled) {
                    return false;
                }
                if (area.onDown) {
                    return area.onDown.call(this, event, pos, node);
                }
            }
        }
        return false;
    }
    
    draw(ctx, node, widget_width, y, H) {
        const margin = 8;
        const rowHeight = 24;
        const enableWidth = 35;
        const strengthWidth = 65;
        const spacing = 4;
        const innerPadding = 5; // 内边距：条目与黑色背景之间
        
        // 从自身数据读取
        const enabled = Boolean(this.data.enabled);
        const loraName = String(this.data.lora || "None");
        let strength = parseFloat(this.data.strength);
        if (isNaN(strength)) {
            strength = 1.0;
            this.data.strength = 1.0;
        }
        
        // 计算禁用状态，范围为 [-10, 10]
        const minStrength = -10;
        const maxStrength = 10;
        const disableDecrease = strength <= minStrength;
        const disableIncrease = strength >= maxStrength;
        
        // 更新 hitAreas 的禁用状态
        this.hitAreas.lora.disabled = !enabled;
        this.hitAreas.strengthDec.disabled = !enabled || disableDecrease;
        this.hitAreas.strengthVal.disabled = !enabled;
        this.hitAreas.strengthInc.disabled = !enabled || disableIncrease;
        
        ctx.save();

        // ===== 1. 先定义所有需要的变量 =====
        let contentX = margin + innerPadding;
        let contentWidth = widget_width - margin * 2 - innerPadding * 2;
        let posX = contentX;
        
        const innerTop = y + 4;
        const innerH = rowHeight - 8; // 保证上/下内边距均为 4px
        const centerY = innerTop + innerH / 2;

        // ===== 2. 如果是第一个条目，绘制黑色背景框 =====
        let firstLoRAWidget = null;
        if (node.widgets) {
            for (let i = 0; i < node.widgets.length; i++) {
                if (node.widgets[i] instanceof LoRAEntryWidget) {
                    firstLoRAWidget = node.widgets[i];
                    break;
                }
            }
        }

        const isFirst = firstLoRAWidget === this;
        if (isFirst && node.loraEntries && node.loraEntries.length > 0) {
            const num = node.loraEntries.length;
            const gap = 4;
            const topPad = 5;
            const bottomPad = 5;
            
            // 简化：直接使用当前 widget 的 y 坐标作为起点
            const top = innerTop - topPad;
            const bgHeight = (num - 1) * (rowHeight + gap) + innerH + topPad + bottomPad;
            
            ctx.fillStyle = "#2a2a2a";
            ctx.strokeStyle = "#222";
            ctx.lineWidth = 1;
            drawRoundedRect(ctx, margin, top, widget_width - margin * 2, bgHeight, 6, true, true);
        }

        // ===== 3. 绘制当前条目的内容 =====
        
        // 3.1 绘制开关 — 对齐到名称选择框的垂直中心
        this.hitAreas.enable.bounds = drawTogglePart(ctx, {
            posX: posX + 3,
            posY: y,
            height: rowHeight,
            value: enabled,
            centerY: centerY
        });
        posX += enableWidth + spacing;
        
        // 3.2 绘制 LoRA 选择器
        const loraWidth = contentWidth - enableWidth - strengthWidth - spacing * 2;
        const loraX = posX;

        ctx.fillStyle = enabled ? "#383838" : "#2a2a2a";
        ctx.strokeStyle = enabled ? "#555" : "#333";
        ctx.lineWidth = 1;
        drawRoundedRect(ctx, loraX, innerTop, loraWidth, innerH, 6, true, true);
        
        ctx.fillStyle = enabled ? "#fff" : "#555";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        const maxTextWidth = loraWidth - 25;
        const displayName = fitString(ctx, loraName, maxTextWidth);
        ctx.fillText(displayName, loraX + 6, centerY);

        ctx.fillStyle = enabled ? "#999" : "#444";
        ctx.textAlign = "center";
        ctx.font = "10px Arial";
        ctx.fillText("▼", loraX + loraWidth - 12, centerY);
        
        this.hitAreas.lora.bounds = [loraX, loraWidth];
        posX += loraWidth + spacing;
        
        // 3.3 绘制强度调节器 — 使用相同的 centerY 以垂直对齐
        const [decBounds, valBounds, incBounds] = drawNumberWidgetPart(ctx, {
            posX: contentX + contentWidth,
            posY: y,
            height: rowHeight,
            value: strength,
            enabled: enabled,
            disableDecrease: disableDecrease,
            disableIncrease: disableIncrease,
            centerY: centerY
        });
        
        this.hitAreas.strengthDec.bounds = decBounds;
        this.hitAreas.strengthVal.bounds = valBounds;
        this.hitAreas.strengthInc.bounds = incBounds;
        
        ctx.restore();
    }
    
    // ==================== 交互回调函数 ====================
    
    onToggleClick(event, pos, node) {
        this.data.enabled = !this.data.enabled;
        node.syncToBackend();
        node.setDirtyCanvas(true, true);
        return true;
    }
    
    onLoraClick(event, pos, node) {
        const loraWidget = node.widgets.find(w => w.name === `lora_name_1`);
        if (loraWidget && loraWidget.options?.values) {
            new LiteGraph.ContextMenu(loraWidget.options.values, {
                event: event,
                callback: (value) => {
                    this.data.lora = value;
                    node.syncToBackend();
                    node.setDirtyCanvas(true, true);
                },
                title: "Select LoRA"
            });
        }
        return true;
    }
    
    onStrengthDec(event, pos, node) {
        const current = parseFloat(this.data.strength) || 1.0;
        const newValue = Math.max(-10, parseFloat((current - 0.05).toFixed(2)));
        
        if (newValue !== current) {
            this.data.strength = newValue;
            node.syncToBackend();
            node.setDirtyCanvas(true, true);
        }
        return true;
    }
    
    onStrengthInc(event, pos, node) {
        const current = parseFloat(this.data.strength) || 1.0;
        const newValue = Math.min(10, parseFloat((current + 0.05).toFixed(2)));
        
        if (newValue !== current) {
            this.data.strength = newValue;
            node.syncToBackend();
            node.setDirtyCanvas(true, true);
        }
        return true;
    }
    
    onStrengthInput(event, pos, node) {
        const current = parseFloat(this.data.strength) || 1.0;
        
        const canvas = app.canvas;
        if (canvas && canvas.prompt) {
            canvas.prompt(
                "Strength", 
                current, 
                (value) => {
                    const parsedValue = parseFloat(value);
                    if (!isNaN(parsedValue)) {
                        this.data.strength = Math.max(-10, Math.min(10, parseFloat(parsedValue.toFixed(2))));
                        node.syncToBackend();
                        node.setDirtyCanvas(true, true);
                    }
                },
                this.lastEvent || event
            );
        } else {
            const input = prompt("Enter strength value (-10 to 10):", current.toFixed(2));
            if (input !== null) {
                const value = parseFloat(input);
                if (!isNaN(value)) {
                    this.data.strength = Math.max(-10, Math.min(10, parseFloat(value.toFixed(2))));
                    node.syncToBackend();
                    node.setDirtyCanvas(true, true);
                }
            }
        }
        return true;
    }
}

// ==================== Add Button Widget (custom rounded button) ====================
class AddButtonWidget extends BaseCustomWidget {
    constructor(name) {
        super(name);
        this.options = { serialize: false };
    }

    computeSize(width) {
        return [width - 20, 24];
    }

    onMouseDown(event, pos, node) {
        if (event.type !== 'pointerdown') return false;
        if (node.loraEntries && node.loraEntries.length >= (node.maxEntries || 6)) {
            return false;
        }
        try {
            node.addLoRAEntry();
        } catch (err) {
            console.warn('AddButtonWidget: failed to add entry', err);
        }
        return true;
    }

    draw(ctx, node, widget_width, y, height) {
        const margin = 8;
        const radius = 6;
        const bw = node.size ? node.size[0] : widget_width + 20;
        const x = margin;
        const w = bw - margin * 2;
        const h = 24;
        const top = y + 3;

        const isFull = node.loraEntries && node.loraEntries.length >= (node.maxEntries || 6);

        ctx.fillStyle = isFull ? '#333' : '#2a2a2a';
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        drawRoundedRect(ctx, x, top, w, h, radius, true, true);

        ctx.fillStyle = isFull ? '#888' : '#fff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const txt = isFull ? ` ` : '➕ Add LoRA';
        ctx.fillText(txt, x + w / 2, top + h / 2);
    }
}

// ==================== Master Toggle Widget (三态总控开关) ====================
class MasterToggleWidget extends BaseCustomWidget {
    constructor(name) {
        super(name);
        this.options = { serialize: false };
    }

    computeSize(width) {
        return [width - 20, 24];
    }

    onMouseDown(event, pos, node) {
        if (event.type !== 'pointerdown') return false;

        // 检查是否点击了右侧的 Add 按钮区域
        try {
            const margin = 8;
            const innerPadding = 5;
            const enableWidth = 35;
            const spacing = 4;
            const nodeWidth = node.size ? node.size[0] : 300;
            const contentX = margin + innerPadding;
            const contentWidth = Math.max(0, nodeWidth - margin * 2 - innerPadding * 2);
            const addLeft = contentX + enableWidth + spacing;
            const addRight = contentX + contentWidth;

            if (pos[0] >= addLeft && pos[0] <= addRight) {
                if (node.loraEntries && node.loraEntries.length >= (node.maxEntries || 6)) {
                    return false;
                }
                try {
                    node.addLoRAEntry();
                } catch (err) {
                    console.warn('MasterToggle: failed to add LoRA', err);
                }
                node.syncToBackend();
                node.setDirtyCanvas(true, true);
                return true;
            }
        } catch (e) {
            // ignore and continue to toggle logic
        }

        // 计算当前状态
        node.initLoRAData?.();
        const total = (node.loraEntries || []).length;
        if (total === 0) return false;
        
        let enabledCount = 0;
        for (let i = 0; i < total; i++) {
            const e = node.loraEntries[i];
            if (e && e.widget && Boolean(e.widget.data && e.widget.data.enabled)) enabledCount++;
        }
        
        // 限制点击检测到开关滑槽区域
        const margin = 8;
        const innerPadding = 5;
        const contentX = margin + innerPadding;
        const togglePosX = contentX + 3;
        const toggleWidth = 26;

        if (!pos || typeof pos[0] !== 'number') return false;

        if (pos[0] < togglePosX || pos[0] > (togglePosX + toggleWidth)) {
            return false;
        }

        // 当为部分开启（mixed）时，左半边点击关闭全部，右半边点击打开全部
        if (enabledCount > 0 && enabledCount < total) {
            const toggleMid = togglePosX + toggleWidth / 2;
            if (pos[0] < toggleMid) {
                for (let i = 0; i < total; i++) {
                    const e = node.loraEntries[i];
                    if (e && e.widget) e.widget.data.enabled = false;
                }
            } else {
                for (let i = 0; i < total; i++) {
                    const e = node.loraEntries[i];
                    if (e && e.widget) e.widget.data.enabled = true;
                }
            }
            node.syncToBackend();
            node.setDirtyCanvas(true, true);
            return true;
        }

        // 当全部开或全部关时，切换为相反状态
        const newVal = !(enabledCount === total && total > 0);
        for (let i = 0; i < total; i++) {
            const e = node.loraEntries[i];
            if (e && e.widget) e.widget.data.enabled = newVal;
        }
        node.syncToBackend();
        node.setDirtyCanvas(true, true);
        return true;
    }

    draw(ctx, node, widget_width, y, height) {
        const margin = 8;
        const innerPadding = 5;
        const contentX = margin + innerPadding;
        const posX = contentX + 3;

        const rowHeight = 24;
        let centerY = y + rowHeight / 2;

        // 计算状态
        node.initLoRAData?.();
        const total = (node.loraEntries || []).length;
        let enabledCount = 0;
        for (let i = 0; i < total; i++) {
            const e = node.loraEntries[i];
            if (e && e.widget && Boolean(e.widget.data && e.widget.data.enabled)) enabledCount++;
        }
        const isAllOn = total > 0 && enabledCount === total;
        const isAllOff = enabledCount === 0;
        const isMixed = !isAllOn && !isAllOff;

        // 绘制三态开关
        const toggleWidth = 26;
        const toggleH = 14;
        const yToggle = Math.round(centerY - toggleH / 2);

        if (isMixed) {
            ctx.fillStyle = "#777";
            drawRoundedRect(ctx, posX, yToggle, toggleWidth, toggleH, 7);
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(posX + toggleWidth / 2, yToggle + toggleH / 2, 5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            drawTogglePart(ctx, { posX: posX, posY: y, height: rowHeight, value: !!isAllOn, centerY: centerY });
        }

        // 绘制右侧的 Add 按钮
        try {
            const addBtnHeight = 24;
            const enableWidth = 35;
            const spacing = 4;
            const contentWidth = Math.max(0, widget_width - margin * 2 - innerPadding * 2);
            const addLeft = contentX + enableWidth + spacing;
            const addRight = contentX + contentWidth;
            const addX = addLeft;
            const addBtnWidth = Math.max(48, addRight - addLeft);
            const addY = y + Math.round((rowHeight - addBtnHeight) / 2);

            const isFull = node.loraEntries && node.loraEntries.length >= (node.maxEntries || 6);

            ctx.fillStyle = isFull ? '#333' : '#2a2a2a';
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1;
            drawRoundedRect(ctx, addX, addY, addBtnWidth, addBtnHeight, 6, true, true);

            ctx.fillStyle = isFull ? '#888' : '#fff';
            ctx.font = '13px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const txt = isFull ? ` ` : '➕ Add LoRA';
            ctx.fillText(txt, addX + addBtnWidth / 2, addY + addBtnHeight / 2);
        } catch (err) {
            // ignore drawing errors
        }

        this._lastWidth = widget_width - 20;
    }
}

// ==================== ComfyUI 扩展注册 ====================

app.registerExtension({
    name: "A1rSpace.LoRAConfigAdvance",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "A1r LoRA Config Advance") return;

        // ==================== 添加节点方法到原型 ====================
        
        nodeType.prototype.initLoRAData = function() {
            if (!this.loraEntries) {
                this.loraEntries = [];
            }
            if (this.maxEntries === undefined) {
                this.maxEntries = 6;
            }
        };
        
        nodeType.prototype.syncToBackend = function() {
            this.initLoRAData();
            
            for (let i = 1; i <= this.maxEntries; i++) {
                const enableWidget = this.widgets.find(w => w.name === `enable_${i}`);
                const loraWidget = this.widgets.find(w => w.name === `lora_name_${i}`);
                const strengthWidget = this.widgets.find(w => w.name === `strength_${i}`);
                
                if (enableWidget) enableWidget.value = false;
                if (loraWidget) loraWidget.value = "None";
                if (strengthWidget) strengthWidget.value = 1.0;
            }
            
            this.loraEntries.forEach((entry, visualIndex) => {
                const backendIndex = visualIndex + 1;
                
                if (backendIndex <= this.maxEntries && entry.widget) {
                    const enableWidget = this.widgets.find(w => w.name === `enable_${backendIndex}`);
                    const loraWidget = this.widgets.find(w => w.name === `lora_name_${backendIndex}`);
                    const strengthWidget = this.widgets.find(w => w.name === `strength_${backendIndex}`);
                    
                    if (enableWidget) enableWidget.value = entry.widget.data.enabled;
                    if (loraWidget) loraWidget.value = entry.widget.data.lora;
                    if (strengthWidget) strengthWidget.value = entry.widget.data.strength;
                }
            });
        };
        
        nodeType.prototype.loadFromBackend = function() {
            this.initLoRAData();
            this.clearAllLoRAEntries();
            
            for (let i = 1; i <= this.maxEntries; i++) {
                const enableWidget = this.widgets.find(w => w.name === `enable_${i}`);
                const loraWidget = this.widgets.find(w => w.name === `lora_name_${i}`);
                const strengthWidget = this.widgets.find(w => w.name === `strength_${i}`);
                
                if (enableWidget?.value || (loraWidget?.value && loraWidget.value !== "None")) {
                    const widget = new LoRAEntryWidget(`lora_entry_${this.loraEntries.length}`);
                    widget.data = {
                        enabled: Boolean(enableWidget?.value),
                        lora: String(loraWidget?.value || "None"),
                        strength: parseFloat(strengthWidget?.value) || 1.0
                    };
                    
                    const masterIndex = this.widgets.indexOf(this.masterToggle);
                    const insertIndex = masterIndex !== -1 ? masterIndex + 1 : this.widgets.length;
                    this.widgets.splice(insertIndex, 0, widget);
                    
                    this.loraEntries.push({ widget });
                }
            }
            
            this.updateNodeSize();
        };
        
        nodeType.prototype.addLoRAEntry = function() {
            const arg = arguments[0];
            const suppressSync = (typeof arg === 'object' && arg?.suppressSync) || (arg === true);

            this.initLoRAData();

            if (this.loraEntries.length >= this.maxEntries) return;

            const widget = new LoRAEntryWidget(`lora_entry_${this.loraEntries.length}`);

            let insertIndex = -1;

            for (let i = this.widgets.length - 1; i >= 0; i--) {
                if (this.widgets[i] instanceof LoRAEntryWidget) {
                    insertIndex = i + 1;
                    break;
                }
            }

            if (insertIndex === -1) {
                const masterIndex = this.widgets.indexOf(this.masterToggle);
                insertIndex = masterIndex !== -1 ? masterIndex + 1 : this.widgets.length;
            }
            
            this.widgets.splice(insertIndex, 0, widget);

            this.loraEntries.push({ widget });

            if (!suppressSync) {
                this.syncToBackend();
            }

            if (!this._a1r_size_data || !this._a1r_size_data.userModified) {
                this.updateNodeSize();
            }

            return widget;
        };
        
        nodeType.prototype.removeLoRAEntry = function(visualIndex) {
            this.initLoRAData();
            
            if (visualIndex < 0 || visualIndex >= this.loraEntries.length) return;
            
            const entry = this.loraEntries[visualIndex];
            
            if (entry.widget) {
                const widgetIndex = this.widgets.indexOf(entry.widget);
                if (widgetIndex !== -1) {
                    this.widgets.splice(widgetIndex, 1);
                }
            }
            
            this.loraEntries.splice(visualIndex, 1);
            
            this.syncToBackend();
            
            if (!this._a1r_size_data || !this._a1r_size_data.userModified) {
                this.updateNodeSize();
            }
        };
        
        nodeType.prototype.updateNodeSize = function() {
            this.initLoRAData();

            if (!this._a1r_size_data) {
                this._a1r_size_data = {
                    userModified: false,
                    lastWidth: null,
                    lastHeight: null,
                };
            }

            if (!this.size || !Array.isArray(this.size) || this.size.length < 2) {
                this.size = [300, 90];
            }

            if (!this.size[0] || this.size[0] < 200) {
                this.size[0] = 300;
            }

            const nodeWidth = this.size[0];
            let totalHeight = LiteGraph.NODE_TITLE_HEIGHT || 30;

            if (Array.isArray(this.widgets)) {
                for (let i = 0; i < this.widgets.length; i++) {
                    const w = this.widgets[i];
                    try {
                        const size = (typeof w.computeSize === 'function') ? w.computeSize(nodeWidth) : [nodeWidth - 20, 24];
                        const h = (Array.isArray(size) && size.length >= 2) ? size[1] : 24;
                        totalHeight += h;

                        let foundNextVisible = false;
                        for (let j = i + 1; j < this.widgets.length; j++) {
                            const nextW = this.widgets[j];
                            try {
                                const nextSize = (typeof nextW.computeSize === 'function') ? nextW.computeSize(nodeWidth) : [nodeWidth - 20, 24];
                                const nh = (Array.isArray(nextSize) && nextSize.length >= 2) ? nextSize[1] : 24;
                                if (nh > 0) {
                                    foundNextVisible = true;
                                    break;
                                }
                            } catch (err) {
                                // ignore
                            }
                        }
                        if (foundNextVisible) totalHeight += 4;
                    } catch (err) {
                        totalHeight += 24;
                    }
                }
                
                if (this.loraEntries && this.loraEntries.length > 0) {
                    totalHeight += 5 + 5;
                }
            }
            
            const baseBottomPadding = 4;
            const extraBetweenEntriesAndAddButton = (this.loraEntries && this.loraEntries.length > 0) ? 4 : 0;
            const bottomPadding = baseBottomPadding + extraBetweenEntriesAndAddButton;
            const extraGrowthPadding = 4;
            totalHeight += bottomPadding + extraGrowthPadding;

            if (!this._a1r_size_data.userModified) {
                this.size[1] = totalHeight;
                this._a1r_size_data.lastHeight = totalHeight;
            } else {
                const minHeight = 90;
                if (this.size[1] < minHeight) {
                    this.size[1] = minHeight;
                }
            }
            
            this._a1r_size_data.lastWidth = this.size[0];

            this.setDirtyCanvas(true, true);
        };
        
        nodeType.prototype.clearAllLoRAEntries = function() {
            this.initLoRAData();
            
            while (this.loraEntries.length > 0) {
                const entry = this.loraEntries[0];
                if (entry && entry.widget) {
                    const widgetIndex = this.widgets.indexOf(entry.widget);
                    if (widgetIndex !== -1) {
                        this.widgets.splice(widgetIndex, 1);
                    }
                }
                this.loraEntries.shift();
            }
        };
        
        // ==================== onNodeCreated ====================
        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            // Migrate legacy size metadata (if stored as an object) and ensure
            // a sensible default size is present before the original onNodeCreated
            // runs so the original initialization can rely on the node size.
            try {
                if (this && this.size && typeof this.size === 'object') {
                    const s = this.size;
                    const migrate = {};
                    if (s.userModified !== undefined) migrate.userModified = !!s.userModified;
                    if (s.lastWidth !== undefined) migrate.lastWidth = Number(s.lastWidth) || null;
                    if (s.lastHeight !== undefined) migrate.lastHeight = Number(s.lastHeight) || null;
                    if (!this._a1r_size_data) this._a1r_size_data = {};
                    if (Object.keys(migrate).length > 0) {
                        this._a1r_size_data = Object.assign({}, this._a1r_size_data, migrate);
                        try { delete s.userModified; } catch (e) {}
                        try { delete s.lastWidth; } catch (e) {}
                        try { delete s.lastHeight; } catch (e) {}
                    }
                }
            } catch (err) {
                // ignore
            }

            if (!this._a1r_size_data) {
                this._a1r_size_data = {
                    userModified: false,
                    lastWidth: 300,
                    lastHeight: 120,
                };
            }

            if (!this.size || !Array.isArray(this.size) || this.size.length < 2) {
                this.size = [
                    this._a1r_size_data.lastWidth || 300,
                    this._a1r_size_data.lastHeight || 120
                ];
            }

            const result = originalOnNodeCreated?.apply(this, arguments);

            this.initLoRAData();

            const hideWidget = (widget) => {
                if (!widget) return;

                widget.type = "hidden";
                widget.computeSize = () => [0, -4];
                widget.hidden = true;

                if (typeof widget.serialize !== "function") {
                    widget.serializeValue = () => widget.value;
                }
            };

            const removeInputByNames = (names) => {
                if (!Array.isArray(this.inputs)) return;
                for (let idx = this.inputs.length - 1; idx >= 0; idx--) {
                    const inp = this.inputs[idx];
                    if (inp && names.includes(inp.name)) {
                        this.removeInput?.(idx);
                    }
                }
            };

            for (let i = 1; i <= 6; i++) {
                const enableWidget = this.widgets?.find(w => w.name === `enable_${i}`);
                const loraWidget = this.widgets?.find(w => w.name === `lora_name_${i}`);
                const strengthWidget = this.widgets?.find(w => w.name === `strength_${i}`);

                if (enableWidget) hideWidget(enableWidget);
                if (loraWidget) hideWidget(loraWidget);
                if (strengthWidget) hideWidget(strengthWidget);

                removeInputByNames([`enable_${i}`, `lora_name_${i}`, `strength_${i}`]);
            }

            const originalConfigure = this.onConfigure;
            this.onConfigure = function () {
                const r = originalConfigure?.apply(this, arguments);
                for (let j = 1; j <= 6; j++) {
                    removeInputByNames([`enable_${j}`, `lora_name_${j}`, `strength_${j}`]);
                }
                return r;
            };
            
            this.masterToggle = new MasterToggleWidget("master_toggle");
            this.addCustomWidget(this.masterToggle);

            this.addButton = new AddButtonWidget("add_lora_button");

            if (!this.loraEntries || this.loraEntries.length === 0) {
                try {
                    this.addLoRAEntry({ suppressSync: true });
                } catch (err) {
                    console.warn('A1r.LoRAConfigAdvance: failed to add default entry on create', err);
                }
            }
            
            this.updateNodeSize();

            setTimeout(() => {
                try {
                    this.updateNodeSize();
                } catch (err) {
                    console.warn('A1r.LoRAConfigAdvance: updateNodeSize failed on create', err);
                }
                if (!this._a1r_size_data) this._a1r_size_data = {};
                this._a1r_size_data.lastWidth = this.size[0];
                this._a1r_size_data.lastHeight = this.size[1];
                this._a1r_size_data.userModified = false;
                this.setDirtyCanvas(true, true);
            }, 10);
            
            return result;
        };
        
        // ==================== configure (cache serialized widget values) ====================
        const originalConfigure = nodeType.prototype.configure;
        nodeType.prototype.configure = function(cfg) {
            this._a1r_savedWidgetValues = cfg?.widgets_values;
            return originalConfigure?.apply(this, arguments);
        };
        
        // ==================== onMouseDown ====================
        const onMouseDown = nodeType.prototype.onMouseDown;
        nodeType.prototype.onMouseDown = function(event, pos, graphCanvas) {
            if (this.widgets) {
                for (let i = 0; i < this.widgets.length; i++) {
                    const widget = this.widgets[i];
                    
                    if (widget instanceof BaseCustomWidget && widget.mouse) {
                        const [width, height] = widget.computeSize(this.size[0]);
                        
                        let y = LiteGraph.NODE_TITLE_HEIGHT;
                        for (let j = 0; j < i; j++) {
                            const [w, h] = this.widgets[j].computeSize?.(this.size[0]) || [0, 0];
                            if (h > 0) y += h + 4;
                        }
                        
                        const localPos = [pos[0], pos[1] - y];
                        
                        if (localPos[0] >= 0 && localPos[0] <= width &&
                            localPos[1] >= 0 && localPos[1] <= height) {
                            if (widget.mouse(event, localPos, this)) {
                                return true;
                            }
                        }
                    }
                }
            }
            
            return onMouseDown?.apply(this, arguments);
        };
        
        // ==================== 右键菜单 ====================
        const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function(canvas, options) {
            const result = getExtraMenuOptions?.apply(this, arguments);
            
            this.initLoRAData();
            
            if (this.loraEntries && this.loraEntries.length > 0) {
                const removeItems = this.loraEntries.map((entry, visualIndex) => {
                    const loraName = entry.widget?.data?.lora || "None";
                    
                    return {
                        content: `LoRA ${visualIndex + 1}: ${loraName}`,
                        callback: () => {
                            this.removeLoRAEntry(visualIndex);
                        }
                    };
                });
                
                if (removeItems.length > 0) {
                    options.push({
                        content: "Remove LoRA",
                        has_submenu: true,
                        submenu: {
                            options: removeItems
                        }
                    });
                }
                
                if (this.loraEntries.length > 1) {
                    options.push({
                        content: "Clear All LoRAs",
                        callback: () => {
                            while (this.loraEntries.length > 0) {
                                this.removeLoRAEntry(0);
                            }
                        }
                    });
                }
            }
            
            return result;
        };
        
        // ==================== 序列化 ====================
        const onSerialize = nodeType.prototype.onSerialize;
        nodeType.prototype.onSerialize = function(o) {
            const result = onSerialize?.apply(this, arguments);
            this.syncToBackend();
            
            // 显式保存 LoRA 条目数据到序列化对象
            this.initLoRAData();
            o._a1r_lora_entries = [];
            
            this.loraEntries.forEach((entry) => {
                if (entry.widget && entry.widget.data) {
                    o._a1r_lora_entries.push({
                        enabled: entry.widget.data.enabled,
                        lora: entry.widget.data.lora,
                        strength: entry.widget.data.strength
                    });
                }
            });
            
            return result;
        };
        
        // ==================== 反序列化 ====================
        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function(o) {
            const result = onConfigure?.apply(this, arguments);
            
            const _saved = this._a1r_savedWidgetValues;
            setTimeout(() => {
                this.initLoRAData();

                // 优先从显式保存的 LoRA 条目数据恢复
                if (o._a1r_lora_entries && Array.isArray(o._a1r_lora_entries) && o._a1r_lora_entries.length > 0) {
                    this.clearAllLoRAEntries();
                    
                    o._a1r_lora_entries.forEach((entryData) => {
                        const widget = new LoRAEntryWidget(`lora_entry_${this.loraEntries.length}`);
                        widget.data = {
                            enabled: Boolean(entryData.enabled),
                            lora: String(entryData.lora || "None"),
                            strength: parseFloat(entryData.strength) || 1.0
                        };
                        
                        const masterIndex = this.widgets.indexOf(this.masterToggle);
                        const insertIndex = masterIndex !== -1 ? masterIndex + 1 + this.loraEntries.length : this.widgets.length;
                        this.widgets.splice(insertIndex, 0, widget);
                        
                        this.loraEntries.push({ widget });
                    });
                    
                    // 同步到后端 widgets
                    this.syncToBackend();
                } else {
                    // 降级方案：从后端 widgets 恢复（兼容旧版本保存的数据）
                    if (Array.isArray(_saved) && this.widgets) {
                        for (let i = 0; i < _saved.length && i < this.widgets.length; i++) {
                            try {
                                if (this.widgets[i]) this.widgets[i].value = _saved[i];
                            } catch (err) {
                                console.warn("A1r.LoRAConfigAdvance: failed to restore widget value", err);
                            }
                        }
                    }

                    this.loadFromBackend();
                }

                // 确保至少有一个条目
                if (!this.loraEntries || this.loraEntries.length === 0) {
                    this.addLoRAEntry();
                }

                const prevUserModified = this._a1r_size_data?.userModified;
                try {
                    this.updateNodeSize();
                    if (!this._a1r_size_data) this._a1r_size_data = {};
                    this._a1r_size_data.lastWidth = this.size[0];
                    this._a1r_size_data.lastHeight = this.size[1];
                } catch (err) {
                    console.warn('A1r.LoRAConfigAdvance: updateNodeSize failed during onConfigure', err);
                }
                if (prevUserModified) this._a1r_size_data.userModified = true;

                this.setDirtyCanvas(true, true);
            }, 150);
            
            return result;
        };
    }
});