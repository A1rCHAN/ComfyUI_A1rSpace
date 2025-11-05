import { app } from "/scripts/app.js";

// ==================== 配置常量 ====================

const DISABLE_MODES = {
    MUTE: { value: 2, label: "Mute (Skip execution)" },
    BYPASS: { value: 4, label: "Bypass (Pass through)" }
};

const DEFAULT_DISABLE_MODE = DISABLE_MODES.BYPASS.value;

// ==================== 通用函数 ====================

/**
 * 为节点的 enable widget 绑定 Mode 切换
 * @param {Object} node - LiteGraph 节点实例
 * @param {string} widgetName - enable widget 的名称
 */
function bindEnableToMode(node, widgetName = "enable") {
    const widget = node.widgets?.find(w => w.name === widgetName);
    if (!widget) return;

    // 初始化节点属性（用于存储用户设置）
    if (!node.properties) {
        node.properties = {};
    }
    
    // 如果没有设置，使用默认值
    if (node.properties.disable_mode === undefined) {
        node.properties.disable_mode = DEFAULT_DISABLE_MODE;
    }

    // 更新节点模式
    const updateMode = (value) => {
        if (value === false) {
            // 使用用户设置的 disable_mode
            node.mode = node.properties.disable_mode || DEFAULT_DISABLE_MODE;
        } else {
            // 启用时总是使用 Always (0)
            node.mode = 0;
        }
        
        node.setDirtyCanvas?.(true, true);
        if (app.graph) {
            app.graph.change();
        }
    };

    // 重写 widget callback
    const originalCallback = widget.callback;
    widget.callback = function(value) {
        if (originalCallback) {
            originalCallback.apply(this, arguments);
        }
        updateMode(value);
    }.bind(node);

    // 初始化
    updateMode(widget.value);
}

/**
 * 添加右键菜单选项
 * @param {Object} node - LiteGraph 节点实例
 */
function addDisableModeMenu(node) {
    // 保存原始的 getExtraMenuOptions
    const originalGetExtraMenuOptions = node.getExtraMenuOptions;
    
    node.getExtraMenuOptions = function(canvas, options) {
        // 调用原始方法
        const result = originalGetExtraMenuOptions?.apply(this, arguments);
        
        // 获取当前设置
        const currentMode = this.properties?.disable_mode || DEFAULT_DISABLE_MODE;
        
        // 添加分隔符
        options.push(null);
        
        // 添加设置菜单
        options.push({
            content: "Disable Mode Settings",
            has_submenu: true,
            submenu: {
                title: "When 'enable' is OFF, set node to:",
                options: [
                    {
                        content: `${currentMode === DISABLE_MODES.MUTE.value ? "✓ " : "　"}${DISABLE_MODES.MUTE.label}`,
                        callback: () => {
                            this.properties.disable_mode = DISABLE_MODES.MUTE.value;
                            
                            // 如果当前是 disabled 状态，立即更新 mode
                            const enableWidget = this.widgets?.find(w => w.name === "enable");
                            if (enableWidget && enableWidget.value === false) {
                                this.mode = DISABLE_MODES.MUTE.value;
                                this.setDirtyCanvas?.(true, true);
                            }
                        }
                    },
                    {
                        content: `${currentMode === DISABLE_MODES.BYPASS.value ? "✓ " : "　"}${DISABLE_MODES.BYPASS.label}`,
                        callback: () => {
                            this.properties.disable_mode = DISABLE_MODES.BYPASS.value;
                            
                            // 如果当前是 disabled 状态，立即更新 mode
                            const enableWidget = this.widgets?.find(w => w.name === "enable");
                            if (enableWidget && enableWidget.value === false) {
                                this.mode = DISABLE_MODES.BYPASS.value;
                                this.setDirtyCanvas?.(true, true);
                            }
                        }
                    },
                    null,  // 分隔符
                    {
                        content: "ℹ️ Mode Info",
                        disabled: true
                    },
                    {
                        content: "• Mute: Skip execution entirely",
                        disabled: true
                    },
                    {
                        content: "• Bypass: Pass input to output",
                        disabled: true
                    }
                ]
            }
        });
        
        return result;
    };
}

// ==================== 扩展注册 ====================

app.registerExtension({
    name: "A1rSpace.EnableToModeSwitch",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // 支持的节点列表
        const supportedNodes = [
        ];
        
        if (!supportedNodes.includes(nodeData.name)) return;

        // ==================== onNodeCreated ====================
        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const result = originalOnNodeCreated?.apply(this, arguments);
            
            // 绑定 enable widget 到 mode 切换
            bindEnableToMode(this);
            
            // 添加右键菜单
            addDisableModeMenu(this);
            
            return result;
        };

        // ==================== onConfigure ====================
        const originalOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function(info) {
            const result = originalOnConfigure?.apply(this, arguments);
            
            // 反序列化后，恢复 mode
            setTimeout(() => {
                const enableWidget = this.widgets?.find(w => w.name === "enable");
                if (enableWidget) {
                    const disableMode = this.properties?.disable_mode || DEFAULT_DISABLE_MODE;
                    
                    if (enableWidget.value === false) {
                        this.mode = disableMode;
                    } else {
                        this.mode = 0;
                    }
                    
                    this.setDirtyCanvas?.(true, true);
                }
            }, 10);
            
            return result;
        };

        // ==================== onSerialize ====================
        // 确保 properties 被正确序列化
        const originalOnSerialize = nodeType.prototype.onSerialize;
        nodeType.prototype.onSerialize = function(o) {
            const result = originalOnSerialize?.apply(this, arguments);
            
            // properties 会自动序列化，但我们确保 disable_mode 存在
            if (this.properties && this.properties.disable_mode === undefined) {
                this.properties.disable_mode = DEFAULT_DISABLE_MODE;
            }
            
            return result;
        };
    }
});