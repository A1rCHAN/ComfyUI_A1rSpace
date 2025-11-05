import { app } from "/scripts/app.js";

let activeCollector = null;

// Source-only blacklist for nodes that should NOT show the "Add Widget to Panel" menu.
// To block a node, add its canonical `type` or `title` string here and commit the change.
// Example: "A1r LoRA ControlPad Advanced"
window.A1rWidgetCollectorBlacklist = [
    "A1r KSampler Config",
    "A1r KSampler Config Values",
    "A1r LoRA Config",
    "A1r LoRA Config Advance",
    "A1r ControlNet Config",
];

function isNodeBlacklisted(node) {
    try {
        const list = window.A1rWidgetCollectorBlacklist || [];
        if (!Array.isArray(list) || list.length === 0) return false;

        const namesToCheck = [];
        if (node.type) namesToCheck.push(node.type);
        if (node.title) namesToCheck.push(node.title);
        if (node.name) namesToCheck.push(node.name);

        for (const n of namesToCheck) {
            if (list.includes(n)) return true;
        }
        return false;
    } catch (e) {
        console.error("[Widget Collector] blacklist check error:", e);
        return false;
    }
}

app.registerExtension({
    name: "A1r.WidgetCollector",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "A1r Widget Collector") {
            
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                const r = onNodeCreated?.apply(this, arguments);
                
                this.collectedWidgets = new Map();
                this.serialize_widgets = true;
                this.isActive = false;
                this.widgets_start_y = 15;
                
                if (window.A1rSpace_SizeFixer && !window.A1rSpace_SizeFixer.hasDefaultSize("A1r Widget Collector")) {
                    window.A1rSpace_SizeFixer.registerDefaultSize("A1r Widget Collector", [320, 60]);
                }
                
                return r;
            };
            
            const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
            nodeType.prototype.getExtraMenuOptions = function(canvas, options) {
                getExtraMenuOptions?.apply(this, arguments);
                
                if (this.isActive) {
                    options.push({
                        content: "Deactivate Panel",
                        callback: () => {
                            this.deactivate();
                        }
                    });
                } else {
                    options.push({
                        content: "Set as Active Panel",
                        callback: () => {
                            this.activate();
                        }
                    });
                }
                
                // Reorder Widgets - simplified
                if (this.collectedWidgets.size > 1) {
                    const moveOptions = [];
                    
                    this.widgets.forEach((widget, index) => {
                        const collection = Array.from(this.collectedWidgets.values()).find(c => c.mirrorWidget === widget);
                        if (collection) {
                            const widgetName = `${collection.targetNode.title || collection.targetNode.type}.${collection.targetWidget.name}`;
                            
                            moveOptions.push({
                                content: widgetName,
                                has_submenu: true,
                                submenu: {
                                    options: [
                                        {
                                            content: "Move Up",
                                            disabled: index === 0,
                                            callback: () => {
                                                if (index > 0) {
                                                    [this.widgets[index], this.widgets[index - 1]] = 
                                                    [this.widgets[index - 1], this.widgets[index]];
                                                    app.canvas.setDirty(true);
                                                }
                                            }
                                        },
                                        {
                                            content: "Move Down",
                                            disabled: index === this.widgets.length - 1,
                                            callback: () => {
                                                if (index < this.widgets.length - 1) {
                                                    [this.widgets[index], this.widgets[index + 1]] = 
                                                    [this.widgets[index + 1], this.widgets[index]];
                                                    app.canvas.setDirty(true);
                                                }
                                            }
                                        },
                                        {
                                            content: "Move to Top",
                                            disabled: index === 0,
                                            callback: () => {
                                                this.widgets.splice(index, 1);
                                                this.widgets.unshift(widget);
                                                app.canvas.setDirty(true);
                                            }
                                        },
                                        {
                                            content: "Move to Bottom",
                                            disabled: index === this.widgets.length - 1,
                                            callback: () => {
                                                this.widgets.splice(index, 1);
                                                this.widgets.push(widget);
                                                app.canvas.setDirty(true);
                                            }
                                        }
                                    ]
                                }
                            });
                        }
                    });
                    
                    if (moveOptions.length > 0) {
                        options.push({
                            content: "Reorder Widgets",
                            has_submenu: true,
                            submenu: {
                                options: moveOptions
                            }
                        });
                    }
                }
                
                if (this.collectedWidgets.size > 0) {
                    options.push(null);
                    
                    const removeOptions = [];
                    this.collectedWidgets.forEach((collection, widgetId) => {
                        const displayName = `${collection.targetNode.title || collection.targetNode.type}.${collection.targetWidget.name}`;
                        removeOptions.push({
                            content: displayName,
                            callback: () => {
                                this.removeWidgetFromPanel(widgetId);
                            }
                        });
                    });
                    
                    options.push({
                        content: "Remove Widget",
                        has_submenu: true,
                        callback: () => {},
                        submenu: {
                            options: removeOptions
                        }
                    });
                    
                    options.push({
                        content: "Clear All Widgets",
                        callback: () => {
                            this.clearAllWidgets();
                        }
                    });
                }
            };
            
            nodeType.prototype.activate = function() {
                if (activeCollector && activeCollector !== this) {
                    activeCollector.deactivate();
                }
                
                activeCollector = this;
                this.isActive = true;
                
                this.setWidgetsReadOnly(true);
                
                app.canvas.setDirty(true);
            };
            
            nodeType.prototype.deactivate = function() {
                if (activeCollector === this) {
                    activeCollector = null;
                }
                this.isActive = false;
                
                this.setWidgetsReadOnly(false);
                
                app.canvas.setDirty(true);
            };
            
            nodeType.prototype.setWidgetsReadOnly = function(readOnly) {
                this.collectedWidgets.forEach((collection) => {
                    if (collection.mirrorWidget) {
                        collection.mirrorWidget.disabled = readOnly;
                    }
                });
            };
            
            const onDrawForeground = nodeType.prototype.onDrawForeground;
            nodeType.prototype.onDrawForeground = function(ctx) {
                if (!this._cleanupCounter) this._cleanupCounter = 0;
                this._cleanupCounter++;
                
                if (this._cleanupCounter >= 60) {
                    this._cleanupCounter = 0;
                    this.cleanupInvalidConnections();
                }

                if (onDrawForeground) {
                    onDrawForeground.call(this, ctx);
                }
                
                // Only show green bar for active mode
                if (this.isActive && !this.flags.collapsed) {
                    ctx.save();
                    ctx.fillStyle = "#00ff00";
                    ctx.fillRect(0, 0, this.size[0], 3);
                    ctx.restore();
                }
            };
            
            const onDrawBackground = nodeType.prototype.onDrawBackground;
            nodeType.prototype.onDrawBackground = function(ctx) {
                if (onDrawBackground) {
                    onDrawBackground.call(this, ctx);
                }
                
                const startY = 55;

                if (this.widgets && this.widgets.length > 0) {
                    this.widgets.forEach((widget, i) => {
                        const widgetHeight = widget.computeSize ? widget.computeSize()[1] : 20;
                        const offsetY = i * (widgetHeight + 4);
                        widget.y = startY + offsetY;
                    });
                }
            };
            
            const onResize = nodeType.prototype.onResize;
            nodeType.prototype.onResize = function(size) {
                const r = onResize?.apply(this, arguments);
                this.updateToggleWidgetNames();
                return r;
            };
            
            nodeType.prototype.updateToggleWidgetNames = function() {
                if (!this.widgets) return;
                
                const nodeWidth = this.size[0];
                
                this.collectedWidgets.forEach((collection) => {
                    if (collection.mirrorWidget && collection.mirrorWidget.type === "toggle") {
                        const fullName = collection.mirrorWidget._fullName;
                        if (fullName) {
                            const reservedSpace = 70;
                            const availableWidth = nodeWidth - reservedSpace;
                            const maxChars = Math.floor(availableWidth / 7);
                            
                            if (fullName.length > maxChars) {
                                collection.mirrorWidget.name = fullName.substring(0, Math.max(3, maxChars - 3)) + "...";
                            } else {
                                collection.mirrorWidget.name = fullName;
                            }
                        }
                    }
                });
            };
            
            nodeType.prototype.addWidgetToPanel = function(targetNode, targetWidget) {
                const widgetId = `${targetNode.id}_${targetWidget.name}_${Date.now()}`;
                
                this.cleanupInvalidConnections();
                
                for (const [id, collection] of this.collectedWidgets.entries()) {
                    if (collection.targetWidget === targetWidget && collection.targetNode === targetNode) {
                        return;
                    }
                }
                
                const widgetInfo = this.getWidgetInfo(targetWidget);
                const mirrorWidget = this.createMirrorWidget(targetNode, targetWidget, widgetInfo, widgetId);
                
                if (mirrorWidget) {
                    this.collectedWidgets.set(widgetId, {
                        targetNode: targetNode,
                        targetWidget: targetWidget,
                        mirrorWidget: mirrorWidget,
                        widgetInfo: widgetInfo,
                        widgetId: widgetId
                    });
                    
                    app.canvas.setDirty(true);
                }
            };
            
            nodeType.prototype.cleanupInvalidConnections = function() {
                const invalidIds = [];
                
                for (const [widgetId, collection] of this.collectedWidgets.entries()) {
                    const nodeExists = app.graph._nodes.includes(collection.targetNode);
                    
                    if (!nodeExists) {
                        invalidIds.push(widgetId);
                    }
                }
                
                invalidIds.forEach(id => {
                    this.removeWidgetFromPanel(id, true);
                });
            };
            
            nodeType.prototype.getWidgetInfo = function(widget) {
                return {
                    name: widget.name,
                    type: widget.type || "text",
                    value: widget.value,
                    options: { ...widget.options } || {}
                };
            };
            
            nodeType.prototype.createMirrorWidget = function(targetNode, targetWidget, widgetInfo, widgetId) {
                const fullName = `${targetNode.title || targetNode.type}.${widgetInfo.name}`;
                
                let displayName = fullName;
                if (widgetInfo.type === "toggle") {
                    const nodeWidth = this.size[0];
                    const reservedSpace = 70;
                    const availableWidth = nodeWidth - reservedSpace;
                    const maxChars = Math.floor(availableWidth / 7);
                    
                    if (fullName.length > maxChars) {
                        displayName = fullName.substring(0, Math.max(3, maxChars - 3)) + "...";
                    }
                }
                
                const syncToTarget = (value) => {
                    targetWidget.value = value;
                    if (targetWidget.callback) {
                        targetWidget.callback(value);
                    }
                    if (targetNode.onWidgetChanged) {
                        targetNode.onWidgetChanged(targetWidget.name, value, null, targetWidget);
                    }
                    app.canvas.setDirty(true);
                };
                
                let mirrorWidget = null;
                
                try {
                    switch (widgetInfo.type) {
                        case "number":
                            mirrorWidget = this.addWidget("number", displayName, widgetInfo.value, syncToTarget, {
                                min: widgetInfo.options.min ?? -999999,
                                max: widgetInfo.options.max ?? 999999,
                                step: widgetInfo.options.step ?? 1,
                                precision: widgetInfo.options.precision ?? 0
                            });
                            break;
                        
                        case "combo":
                            mirrorWidget = this.addWidget("combo", displayName, widgetInfo.value, syncToTarget, {
                                values: widgetInfo.options.values || []
                            });
                            break;
                        
                        case "toggle":
                            mirrorWidget = this.addWidget("toggle", displayName, widgetInfo.value, syncToTarget);
                            
                            if (mirrorWidget) {
                                mirrorWidget._fullName = fullName;
                            }
                            break;
                        
                        case "slider":
                            mirrorWidget = this.addWidget("slider", displayName, widgetInfo.value, syncToTarget, {
                                min: widgetInfo.options.min ?? 0,
                                max: widgetInfo.options.max ?? 1,
                                step: widgetInfo.options.step ?? 0.01
                            });
                            break;
                        
                        default:
                            mirrorWidget = this.addWidget("text", displayName, widgetInfo.value, syncToTarget, {
                                multiline: widgetInfo.options.multiline || false
                            });
                            break;
                    }
                    
                    if (mirrorWidget) {
                        mirrorWidget._widgetId = widgetId;
                        
                        if (this.isActive) {
                            mirrorWidget.disabled = true;
                        }
                        
                        this.setupBidirectionalSync(mirrorWidget, targetWidget);
                    }
                    
                    return mirrorWidget;
                    
                } catch (error) {
                    console.error("[Widget Collector] Error creating mirror widget:", error);
                    return null;
                }
            };
            
            nodeType.prototype.setupBidirectionalSync = function(mirrorWidget, targetWidget) {
                const originalCallback = targetWidget.callback;
                targetWidget.callback = function(value) {
                    if (mirrorWidget.value !== value) {
                        const temp = mirrorWidget.callback;
                        mirrorWidget.callback = null;
                        mirrorWidget.value = value;
                        mirrorWidget.callback = temp;
                    }
                    if (originalCallback) {
                        originalCallback.call(targetWidget, value);
                    }
                };
            };
            
            nodeType.prototype.removeWidgetFromPanel = function(widgetId, silent = false) {
                const collection = this.collectedWidgets.get(widgetId);
                if (!collection) return;
                
                const mirrorIdx = this.widgets.indexOf(collection.mirrorWidget);
                if (mirrorIdx !== -1) {
                    this.widgets.splice(mirrorIdx, 1);
                }
                
                this.collectedWidgets.delete(widgetId);
                app.canvas.setDirty(true);
            };
            
            nodeType.prototype.clearAllWidgets = function() {
                const widgetIds = Array.from(this.collectedWidgets.keys());
                widgetIds.forEach(id => this.removeWidgetFromPanel(id, true));
            };
            
            const onSerialize = nodeType.prototype.onSerialize;
            nodeType.prototype.onSerialize = function(o) {
                const r = onSerialize?.apply(this, arguments);
                
                o.collected_widgets = [];
                
                if (this.widgets) {
                    this.widgets.forEach((widget) => {
                        this.collectedWidgets.forEach((collection, widgetId) => {
                            if (collection.mirrorWidget === widget) {
                                o.collected_widgets.push({
                                    targetNodeId: collection.targetNode.id,
                                    widgetName: collection.targetWidget.name,
                                    value: widget.value
                                });
                            }
                        });
                    });
                }
                
                o.isActive = this.isActive;
                
                return r;
            };
            
            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function(o) {
                const r = onConfigure?.apply(this, arguments);
                
                if (o.isActive) {
                    setTimeout(() => {
                        this.activate();
                    }, 100);
                }
                
                if (o.collected_widgets) {
                    setTimeout(() => {
                        o.collected_widgets.forEach(savedWidget => {
                            const targetNode = app.graph.getNodeById(savedWidget.targetNodeId);
                            if (targetNode) {
                                const targetWidget = targetNode.widgets?.find(w => w.name === savedWidget.widgetName);
                                if (targetWidget) {
                                    this.addWidgetToPanel(targetNode, targetWidget);
                                    
                                    for (const [id, collection] of this.collectedWidgets.entries()) {
                                        if (collection.targetWidget === targetWidget && 
                                            collection.targetNode === targetNode) {
                                            collection.mirrorWidget.value = savedWidget.value;
                                            break;
                                        }
                                    }
                                }
                            }
                        });
                    }, 500);
                }
                
                return r;
            };
        }
    },
    
    async nodeCreated(node) {
        if (!node.widgets) return;
        
        const originalGetExtraMenuOptions = node.getExtraMenuOptions;
        node.getExtraMenuOptions = function(canvas, options) {
            originalGetExtraMenuOptions?.call(this, canvas, options);
            
            if (node.type !== "A1r Widget Collector" && node.widgets && node.widgets.length > 0) {
                if (!activeCollector) {
                    return;
                }
                
                if (isNodeBlacklisted(node)) {
                    return;
                }

                const validWidgets = node.widgets.filter(w => w.type !== "button" && !w.hidden);

                if (validWidgets.length > 0) {
                    options.push(null);

                    options.push({
                        content: "Add Widget to Panel",
                        has_submenu: true,
                        callback: () => {},
                        submenu: {
                            options: validWidgets.map(widget => ({
                                content: widget.name,
                                callback: () => {
                                    if (activeCollector) {
                                        activeCollector.addWidgetToPanel(node, widget);
                                    }
                                }
                            }))
                        }
                    });
                }
            }
        };
    }
});