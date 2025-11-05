import { app } from "/scripts/app.js";

let activeModeCollector = null;
let activeModeConsole = null;

window.A1rNodeModeCollectorBlacklist = [
    "A1r Widget Collector",
    "A1r Node Mode Collector",
    "A1r Node Mode Console",
    "A1r Node Mode Relay",
    "A1r Node Mode Inverter",
];

function isNodeBlacklisted(node) {
    try {
        const list = window.A1rNodeModeCollectorBlacklist || [];
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
        return false;
    }
}

app.registerExtension({
    name: "A1r.NodeModeCollector",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // ==================== A1r Node Mode Collector ====================
        if (nodeData.name === "A1r Node Mode Collector") {
            
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                const r = onNodeCreated?.apply(this, arguments);
                
                this.collectedNodes = new Map();
                this.serialize_widgets = true;
                this.isActive = false;
                this.defaultDisabledMode = 4;
                this.widgets_start_y = 30;
                
                if (window.A1rSpace_SizeFixer && !window.A1rSpace_SizeFixer.hasDefaultSize("A1r Node Mode Collector")) {
                    window.A1rSpace_SizeFixer.registerDefaultSize("A1r Node Mode Collector", [320, 60]);
                }
                
                return r;
            };
            
            nodeType.prototype.updateAllWidgetsFromTrigger = function(triggerValue) {
                this.collectedNodes.forEach((collection) => {
                    if (collection.toggleWidget) {
                        collection.toggleWidget.value = triggerValue;
                        
                        if (!this.isActive) {
                            if (collection.isGroup) {
                                this.updateGroupMode(collection);
                            } else {
                                this.updateNodeMode(collection);
                            }
                        }
                    }
                });
                
                app.canvas.setDirty(true);
            };

            nodeType.prototype.checkTriggerInput = function() {
                if (!this.inputs || !this.inputs[0] || !this.inputs[0].link) {
                    return;
                }

                const link = app.graph.links[this.inputs[0].link];
                if (!link) return;

                const sourceNode = app.graph.getNodeById(link.origin_id);
                if (!sourceNode) return;

                let triggerValue = true;

                if (sourceNode.type === "A1r Node Mode Console") {
                    if (sourceNode.collectedNode && sourceNode.collectedNode.toggleWidget) {
                        triggerValue = Boolean(sourceNode.collectedNode.toggleWidget.value);
                    }
                }

                else if (sourceNode.type === "A1r Node Mode Relay") {
                    triggerValue = this.getRelayInputValue(sourceNode);
                }

                else if (sourceNode.type === "A1r Node Mode Inverter") {
                    triggerValue = !this.getInverterInputValue(sourceNode);
                }

                if (this._lastTriggerValue !== triggerValue) {
                    this._lastTriggerValue = triggerValue;
                    this.updateAllWidgetsFromTrigger(triggerValue);
                }
            };

            nodeType.prototype.getRelayInputValue = function(relayNode) {
                if (!relayNode.inputs || !relayNode.inputs[0] || !relayNode.inputs[0].link) {
                    return true;
                }

                const link = app.graph.links[relayNode.inputs[0].link];
                if (!link) return true;

                const sourceNode = app.graph.getNodeById(link.origin_id);
                if (!sourceNode) return true;

                if (sourceNode.type === "A1r Node Mode Console") {
                    if (sourceNode.collectedNode && sourceNode.collectedNode.toggleWidget) {
                        return Boolean(sourceNode.collectedNode.toggleWidget.value);
                    }
                    return true;
                } else if (sourceNode.type === "A1r Node Mode Relay") {
                    return this.getRelayInputValue(sourceNode);
                } else if (sourceNode.type === "A1r Node Mode Inverter") {
                    return !this.getInverterInputValue(sourceNode);
                }

                return true;
            };
            
            nodeType.prototype.getInverterInputValue = function(inverterNode) {
                if (!inverterNode.inputs || !inverterNode.inputs[0] || !inverterNode.inputs[0].link) {
                    return true;
                }

                const link = app.graph.links[inverterNode.inputs[0].link];
                if (!link) return true;

                const sourceNode = app.graph.getNodeById(link.origin_id);
                if (!sourceNode) return true;

                if (sourceNode.type === "A1r Node Mode Console") {
                    if (sourceNode.collectedNode && sourceNode.collectedNode.toggleWidget) {
                        return Boolean(sourceNode.collectedNode.toggleWidget.value);
                    }
                    return true;
                } else if (sourceNode.type === "A1r Node Mode Relay") {
                    return this.getRelayInputValue(sourceNode);
                } else if (sourceNode.type === "A1r Node Mode Inverter") {
                    return !this.getInverterInputValue(sourceNode);
                }

                return true;
            };
            
            nodeType.prototype.truncateWidgetName = function(ctx, fullName, maxWidth) {
                const fullWidth = ctx.measureText(fullName).width;
                
                if (fullWidth <= maxWidth) {
                    return fullName;
                }
                
                const ellipsis = "...";
                const ellipsisWidth = ctx.measureText(ellipsis).width;
                const availableWidth = maxWidth - ellipsisWidth;
                
                let left = 0;
                let right = fullName.length;
                let bestLength = 0;
                
                while (left <= right) {
                    const mid = Math.floor((left + right) / 2);
                    const testText = fullName.substring(0, mid);
                    const testWidth = ctx.measureText(testText).width;
                    
                    if (testWidth <= availableWidth) {
                        bestLength = mid;
                        left = mid + 1;
                    } else {
                        right = mid - 1;
                    }
                }
                
                return fullName.substring(0, bestLength) + ellipsis;
            };
            
            nodeType.prototype.updateWidgetDisplayNames = function(ctx) {
                if (!this.widgets || this.widgets.length === 0) return;
                
                const maxWidth = this.size[0] - 10 - 10 - 60 - 10;
                
                this.widgets.forEach((widget) => {
                    const collection = Array.from(this.collectedNodes.values()).find(c => c.toggleWidget === widget);
                    if (collection) {
                        let fullName;
                        
                        if (collection.isGroup) {
                            const groupId = this.getGroupId(collection.targetGroup);
                            fullName = "📁 " + (collection.targetGroup.title || collection.targetGroup._title || `Group ${groupId}`);
                        } else {
                            fullName = "🔷 " + (collection.targetNode.title || collection.targetNode.type);
                        }
                        
                        widget._fullName = fullName;
                        widget.name = this.truncateWidgetName(ctx, fullName, maxWidth);
                    }
                });
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
                
                options.push(null);
                
                options.push({
                    content: "Default Disabled Mode",
                    has_submenu: true,
                    submenu: {
                        options: [
                            {
                                content: `${this.defaultDisabledMode === 2 ? "✓ " : "　"}Mute (Skip execution)`,
                                callback: () => {
                                    this.defaultDisabledMode = 2;
                                    this.updateAllCollectionDisabledMode(2);
                                    app.canvas.setDirty(true);
                                }
                            },
                            {
                                content: `${this.defaultDisabledMode === 4 ? "✓ " : "　"}Bypass (Pass through)`,
                                callback: () => {
                                    this.defaultDisabledMode = 4;
                                    this.updateAllCollectionDisabledMode(4);
                                    app.canvas.setDirty(true);
                                }
                            },
                            null,
                            {
                                content: "ℹ️ Mode Explanation",
                                disabled: true
                            },
                            {
                                content: "• Mute: Skip execution, no output",
                                disabled: true
                            },
                            {
                                content: "• Bypass: Direct input → output",
                                disabled: true
                            }
                        ]
                    }
                });
                
                if (this.collectedNodes.size > 1) {
                    const moveOptions = [];
                    
                    this.widgets.forEach((widget, index) => {
                        const collection = Array.from(this.collectedNodes.values()).find(c => c.toggleWidget === widget);
                        if (collection) {
                            const itemName = collection.isGroup 
                                ? (collection.targetGroup.title || collection.targetGroup._title || `Group ${this.getGroupId(collection.targetGroup)}`)
                                : (collection.targetNode.title || collection.targetNode.type);
                            
                            const displayName = collection.isGroup ? `📁 ${itemName}` : `🔷 ${itemName}`;
                            
                            moveOptions.push({
                                content: displayName,
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
                            content: "Reorder Items",
                            has_submenu: true,
                            submenu: {
                                options: moveOptions
                            }
                        });
                    }
                }
                
                if (this.collectedNodes.size > 0) {
                    options.push(null);
                    
                    const removeOptions = [];
                    this.collectedNodes.forEach((collection, id) => {
                        const displayName = collection.isGroup
                            ? `📁 ${collection.targetGroup.title || collection.targetGroup._title || `Group ${this.getGroupId(collection.targetGroup)}`}`
                            : `🔷 ${collection.targetNode.title || collection.targetNode.type}`;
                        
                        removeOptions.push({
                            content: displayName,
                            callback: () => {
                                if (collection.isGroup) {
                                    this.removeGroupFromPanel(id);
                                } else {
                                    this.removeNodeFromPanel(id);
                                }
                            }
                        });
                    });
                    
                    options.push({
                        content: "Remove Item",
                        has_submenu: true,
                        submenu: {
                            options: removeOptions
                        }
                    });
                    
                    options.push({
                        content: "Clear All Items",
                        callback: () => {
                            this.clearAllNodes();
                        }
                    });
                }
            };
            
            nodeType.prototype.getGroupId = function(group) {
                return group._group_id || group.id || group._id || 0;
            };
            
            nodeType.prototype.updateAllCollectionDisabledMode = function(newMode) {
                this.collectedNodes.forEach((collection) => {
                    collection.disabledMode = newMode;
                    
                    if (!this.isActive && collection.toggleWidget && !collection.toggleWidget.value) {
                        if (collection.isGroup) {
                            this.updateGroupMode(collection);
                        } else {
                            this.updateNodeMode(collection);
                        }
                    }
                });
            };
            
            nodeType.prototype.activate = function() {
                if (activeModeCollector && activeModeCollector !== this) {
                    activeModeCollector.deactivate();
                }
                
                activeModeCollector = this;
                this.isActive = true;
                this.setWidgetsReadonly(true);
                app.canvas.setDirty(true);
            };
            
            nodeType.prototype.deactivate = function() {
                if (activeModeCollector === this) {
                    activeModeCollector = null;
                }
                this.isActive = false;
                this.setWidgetsReadonly(false);
                app.canvas.setDirty(true);
            };
            
            nodeType.prototype.setWidgetsReadonly = function(readonly) {
                this.collectedNodes.forEach((collection) => {
                    if (collection.toggleWidget) {
                        collection.toggleWidget.disabled = readonly;
                        if (collection.toggleWidget.options) {
                            collection.toggleWidget.options.disabled = readonly;
                        }
                    }
                });
            };
            
            nodeType.prototype.applyAllNodeModes = function() {
                this.collectedNodes.forEach((collection) => {
                    if (collection.isGroup) {
                        this.updateGroupMode(collection);
                    } else {
                        this.updateNodeMode(collection);
                    }
                });
            };
            
            nodeType.prototype.restoreAllNodeModes = function() {
                this.collectedNodes.forEach((collection) => {
                    if (collection.isGroup) {
                        const nodesInGroup = this.getNodesInGroup(collection.targetGroup);
                        nodesInGroup.forEach(node => {
                            node.mode = 0;
                        });
                    } else if (collection.targetNode) {
                        collection.targetNode.mode = 0;
                    }
                });
            };
            
            nodeType.prototype.updateNodeMode = function(collection) {
                if (!collection || !collection.targetNode) return;
                
                const isEnabled = Boolean(collection.toggleWidget?.value);
                
                if (isEnabled) {
                    collection.targetNode.mode = 0;
                } else {
                    const disabledMode = collection.disabledMode || this.defaultDisabledMode;
                    collection.targetNode.mode = disabledMode;
                }
                
                app.canvas.setDirty(true);
            };
            
            nodeType.prototype.getNodesInGroup = function(group) {
                if (!group || !app.graph) return [];
                
                if (group._nodes && Array.isArray(group._nodes) && group._nodes.length > 0) {
                    return group._nodes.filter(node => app.graph._nodes.includes(node));
                }
                
                if (typeof group.recomputeInsideNodes === 'function') {
                    group.recomputeInsideNodes();
                    if (group._nodes && Array.isArray(group._nodes)) {
                        return group._nodes.filter(node => app.graph._nodes.includes(node));
                    }
                }
                
                if (!app.graph._nodes) return [];
                
                const nodes = [];
                const groupLeft = group._pos[0];
                const groupTop = group._pos[1];
                const groupRight = groupLeft + group._size[0];
                const groupBottom = groupTop + group._size[1];
                
                for (const node of app.graph._nodes) {
                    const nodeCenterX = node.pos[0] + node.size[0] * 0.5;
                    const nodeCenterY = node.pos[1] + node.size[1] * 0.5;
                    
                    if (nodeCenterX >= groupLeft &&
                        nodeCenterX <= groupRight &&
                        nodeCenterY >= groupTop &&
                        nodeCenterY <= groupBottom) {
                        nodes.push(node);
                    }
                }
                
                return nodes;
            };
            
            nodeType.prototype.updateGroupMode = function(collection) {
                if (!collection || !collection.targetGroup) return;
                
                const isEnabled = Boolean(collection.toggleWidget?.value);
                const targetMode = isEnabled ? 0 : (collection.disabledMode || this.defaultDisabledMode);
                
                const nodesInGroup = this.getNodesInGroup(collection.targetGroup);
                
                nodesInGroup.forEach(node => {
                    node.mode = targetMode;
                });
                
                app.canvas.setDirty(true);
            };
            
            nodeType.prototype.addGroupToPanel = function(targetGroup) {
                if (!targetGroup) return;
                
                const groupId = this.getGroupId(targetGroup);
                if (groupId === null || groupId === undefined) return;
                
                const groupUniqueKey = "group_" + groupId;
                this.cleanupInvalidNodes();
                if (this.collectedNodes.has(groupUniqueKey)) return;
                
                const toggleWidget = this.createToggleWidgetForGroup(targetGroup, groupUniqueKey);
                
                if (toggleWidget) {
                    this.collectedNodes.set(groupUniqueKey, {
                        targetGroup: targetGroup,
                        toggleWidget: toggleWidget,
                        disabledMode: this.defaultDisabledMode,
                        groupId: groupId,
                        uniqueKey: groupUniqueKey,
                        isGroup: true
                    });
                    
                    this.setupGroupNameWatcher(targetGroup, groupUniqueKey);
                    
                    if (!this.isActive) {
                        this.updateGroupMode(this.collectedNodes.get(groupUniqueKey));
                    }
                    
                    if (this.isActive && toggleWidget) {
                        toggleWidget.disabled = true;
                        if (toggleWidget.options) {
                            toggleWidget.options.disabled = true;
                        }
                    }
                    
                    app.canvas.setDirty(true);
                }
            };
            
            nodeType.prototype.setupGroupNameWatcher = function(group, groupUniqueKey) {
                if (!group._originalTitle) {
                    group._originalTitle = group.title || group._title;
                }
                
                const self = this;
                let internalTitle = group.title || group._title || '';
                
                try {
                    Object.defineProperty(group, 'title', {
                        get: function() {
                            return internalTitle;
                        },
                        set: function(newTitle) {
                            internalTitle = newTitle;
                            self.updateGroupWidgetName(groupUniqueKey, newTitle);
                        },
                        configurable: true
                    });
                } catch (e) {}
            };
            
            nodeType.prototype.setupNodeNameWatcher = function(node, nodeId) {
                const self = this;
                const originalOnPropertyChanged = node.onPropertyChanged;
                
                node.onPropertyChanged = function(property, value) {
                    if (originalOnPropertyChanged) {
                        originalOnPropertyChanged.call(this, property, value);
                    }
                    
                    if (property === "title") {
                        self.updateNodeWidgetName(nodeId, value);
                    }
                };
            };
            
            nodeType.prototype.updateGroupWidgetName = function(groupUniqueKey, newName) {
                const collection = this.collectedNodes.get(groupUniqueKey);
                if (collection && collection.toggleWidget) {
                    const groupId = this.getGroupId(collection.targetGroup);
                    const displayName = "📁 " + (newName || `Group ${groupId}`);
                    collection.toggleWidget._fullName = displayName;
                    app.canvas.setDirty(true);
                }
            };
            
            nodeType.prototype.updateNodeWidgetName = function(nodeId, newName) {
                const collection = this.collectedNodes.get(nodeId);
                if (collection && collection.toggleWidget) {
                    const displayName = "🔷 " + (newName || collection.targetNode.type);
                    collection.toggleWidget._fullName = displayName;
                    app.canvas.setDirty(true);
                }
            };
            
            nodeType.prototype.createToggleWidgetForGroup = function(group, groupUniqueKey) {
                const groupId = this.getGroupId(group);
                const groupName = "📁 " + (group.title || group._title || `Group ${groupId}`);
                
                const toggleCallback = (value) => {
                    const collection = this.collectedNodes.get(groupUniqueKey);
                    if (collection && !this.isActive) {
                        this.updateGroupMode(collection);
                    }
                };
                
                try {
                    const toggleWidget = this.addWidget("toggle", groupName, true, toggleCallback);
                    if (toggleWidget) {
                        toggleWidget._groupUniqueKey = groupUniqueKey;
                        toggleWidget._fullName = groupName;
                    }
                    return toggleWidget;
                } catch (error) {
                    return null;
                }
            };
            
            nodeType.prototype.removeGroupFromPanel = function(id) {
                const collection = this.collectedNodes.get(id);
                if (!collection) return;
                
                const widgetIdx = this.widgets.indexOf(collection.toggleWidget);
                if (widgetIdx !== -1) {
                    this.widgets.splice(widgetIdx, 1);
                }
                
                if (collection.targetGroup) {
                    const nodesInGroup = this.getNodesInGroup(collection.targetGroup);
                    nodesInGroup.forEach(node => {
                        node.mode = 0;
                    });
                }
                
                this.collectedNodes.delete(id);
                app.canvas.setDirty(true);
            };
            
            const onDrawForeground = nodeType.prototype.onDrawForeground;
            nodeType.prototype.onDrawForeground = function(ctx) {
                if (!this._cleanupCounter) this._cleanupCounter = 0;
                this._cleanupCounter++;
                
                if (this._cleanupCounter >= 60) {
                    this._cleanupCounter = 0;
                    this.cleanupInvalidNodes();
                }

                this.checkTriggerInput();

                if (onDrawForeground) {
                    onDrawForeground.call(this, ctx);
                }
                
                if (this.isActive && !this.flags.collapsed) {
                    ctx.save();
                    ctx.fillStyle = "#00ff00";
                    ctx.fillRect(0, 0, this.size[0], 3);
                    ctx.restore();
                }
                
                if (this.widgets && app.canvas.node_over === this) {
                    const mouse = app.canvas.graph_mouse;
                    if (mouse) {
                        for (const widget of this.widgets) {
                            if (widget._fullName && widget.name !== widget._fullName) {
                                const widgetY = widget.y || 0;
                                const widgetHeight = widget.computeSize ? widget.computeSize()[1] : 20;
                                
                                const localMouse = [
                                    mouse[0] - this.pos[0],
                                    mouse[1] - this.pos[1]
                                ];
                                
                                if (localMouse[1] >= widgetY && localMouse[1] <= widgetY + widgetHeight) {
                                    ctx.save();
                                    ctx.font = "12px Arial";
                                    const tooltipPadding = 8;
                                    const tooltipWidth = ctx.measureText(widget._fullName).width + tooltipPadding * 2;
                                    const tooltipHeight = 22;
                                    let tooltipX = mouse[0] + 15;
                                    let tooltipY = mouse[1] - 30;
                                    
                                    if (tooltipX + tooltipWidth > app.canvas.canvas.width) {
                                        tooltipX = mouse[0] - tooltipWidth - 15;
                                    }
                                    if (tooltipY < 0) {
                                        tooltipY = mouse[1] + 15;
                                    }
                                    
                                    ctx.fillStyle = "rgba(30, 30, 30, 0.95)";
                                    ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
                                    
                                    ctx.strokeStyle = "#555";
                                    ctx.lineWidth = 1;
                                    ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
                                    
                                    ctx.fillStyle = "#fff";
                                    ctx.textAlign = "left";
                                    ctx.textBaseline = "middle";
                                    ctx.fillText(widget._fullName, tooltipX + tooltipPadding, tooltipY + tooltipHeight / 2);
                                    ctx.restore();
                                    
                                    break;
                                }
                            }
                        }
                    }
                }
            };
            
            const onDrawBackground = nodeType.prototype.onDrawBackground;
            nodeType.prototype.onDrawBackground = function(ctx) {
                if (onDrawBackground) {
                    onDrawBackground.call(this, ctx);
                }
                
                const startY = 55;

                if (this.widgets && this.widgets.length > 0) {
                    this.updateWidgetDisplayNames(ctx);
                    
                    this.widgets.forEach((widget, i) => {
                        const widgetHeight = widget.computeSize ? widget.computeSize()[1] : 20;
                        const offsetY = i * (widgetHeight + 4);
                        widget.y = startY + offsetY;
                    });
                }
            };
            
            nodeType.prototype.addNodeToPanel = function(targetNode) {
                const nodeId = String(targetNode.id);
                
                this.cleanupInvalidNodes();
                if (this.collectedNodes.has(nodeId)) return;
                
                const toggleWidget = this.createToggleWidget(targetNode, nodeId);
                
                if (toggleWidget) {
                    this.collectedNodes.set(nodeId, {
                        targetNode: targetNode,
                        toggleWidget: toggleWidget,
                        disabledMode: this.defaultDisabledMode,
                        nodeId: nodeId,
                        isGroup: false
                    });
                    
                    this.setupNodeNameWatcher(targetNode, nodeId);
                    
                    if (!this.isActive) {
                        this.updateNodeMode(this.collectedNodes.get(nodeId));
                    }
                    
                    if (this.isActive && toggleWidget) {
                        toggleWidget.disabled = true;
                        if (toggleWidget.options) {
                            toggleWidget.options.disabled = true;
                        }
                    }
                    
                    app.canvas.setDirty(true);
                }
            };
            
            nodeType.prototype.createToggleWidget = function(targetNode, nodeId) {
                const nodeName = "🔷 " + (targetNode.title || targetNode.type);
                
                const toggleCallback = (value) => {
                    const collection = this.collectedNodes.get(nodeId);
                    if (collection && !this.isActive) {
                        this.updateNodeMode(collection);
                    }
                };
                
                try {
                    const toggleWidget = this.addWidget("toggle", nodeName, true, toggleCallback);
                    if (toggleWidget) {
                        toggleWidget._nodeId = nodeId;
                        toggleWidget._fullName = nodeName;
                    }
                    return toggleWidget;
                } catch (error) {
                    return null;
                }
            };
            
            nodeType.prototype.removeNodeFromPanel = function(id) {
                const collection = this.collectedNodes.get(id);
                if (!collection) return;
                
                const widgetIdx = this.widgets.indexOf(collection.toggleWidget);
                if (widgetIdx !== -1) {
                    this.widgets.splice(widgetIdx, 1);
                }
                
                if (collection.targetNode) {
                    collection.targetNode.mode = 0;
                }
                
                this.collectedNodes.delete(id);
                app.canvas.setDirty(true);
            };
            
            nodeType.prototype.clearAllNodes = function() {
                const ids = Array.from(this.collectedNodes.keys());
                ids.forEach(id => {
                    const collection = this.collectedNodes.get(id);
                    if (collection?.isGroup) {
                        this.removeGroupFromPanel(id);
                    } else {
                        this.removeNodeFromPanel(id);
                    }
                });
            };
            
            nodeType.prototype.cleanupInvalidNodes = function() {
                const invalidIds = [];
                
                const existingGroupKeys = new Set();
                if (app.graph._groups) {
                    app.graph._groups.forEach(group => {
                        const groupId = this.getGroupId(group);
                        if (groupId !== null && groupId !== undefined) {
                            existingGroupKeys.add("group_" + groupId);
                        }
                    });
                }
                
                const existingNodes = new Set(app.graph._nodes || []);
                
                for (const [id, collection] of this.collectedNodes.entries()) {
                    if (collection.isGroup) {
                        if (!existingGroupKeys.has(id)) {
                            invalidIds.push(id);
                        }
                    } else {
                        if (!existingNodes.has(collection.targetNode)) {
                            invalidIds.push(id);
                        }
                    }
                }
                
                invalidIds.forEach(id => {
                    const collection = this.collectedNodes.get(id);
                    if (collection?.isGroup) {
                        this.removeGroupFromPanel(id);
                    } else {
                        this.removeNodeFromPanel(id);
                    }
                });
            };
            
            const onSerialize = nodeType.prototype.onSerialize;
            nodeType.prototype.onSerialize = function(o) {
                const r = onSerialize?.apply(this, arguments);
                
                o.collected_nodes = [];
                o.collected_groups = [];
                
                this.collectedNodes.forEach((collection) => {
                    if (!collection.toggleWidget) return;
                    
                    const saveData = {
                        value: collection.toggleWidget.value,
                        disabledMode: collection.disabledMode || this.defaultDisabledMode
                    };
                    
                    if (collection.isGroup) {
                        saveData.groupId = collection.groupId;
                        o.collected_groups.push(saveData);
                    } else {
                        saveData.nodeId = collection.nodeId;
                        o.collected_nodes.push(saveData);
                    }
                });
                
                o.isActive = this.isActive;
                o.defaultDisabledMode = this.defaultDisabledMode;
                
                return r;
            };
            
            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function(o) {
                const r = onConfigure?.apply(this, arguments);
                
                if (o.defaultDisabledMode !== undefined) {
                    this.defaultDisabledMode = o.defaultDisabledMode;
                }
                
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        this.restoreFromConfig(o);
                    }, 100);
                });
                
                return r;
            };
            
            nodeType.prototype.restoreFromConfig = function(o) {
                if (o.collected_nodes?.length > 0) {
                    o.collected_nodes.forEach(savedNode => {
                        const targetNode = app.graph.getNodeById(savedNode.nodeId);
                        if (targetNode && !isNodeBlacklisted(targetNode)) {
                            this.addNodeToPanel(targetNode);
                            
                            const collection = this.collectedNodes.get(String(savedNode.nodeId));
                            if (collection) {
                                collection.toggleWidget.value = savedNode.value;
                                collection.disabledMode = savedNode.disabledMode || this.defaultDisabledMode;
                            }
                        }
                    });
                }
                
                if (o.collected_groups?.length > 0) {
                    o.collected_groups.forEach(savedGroup => {
                        const targetGroup = app.graph._groups?.find(g => {
                            const gid = this.getGroupId(g);
                            return gid === savedGroup.groupId;
                        });
                        
                        if (targetGroup) {
                            this.addGroupToPanel(targetGroup);
                            
                            const collectionKey = "group_" + savedGroup.groupId;
                            const collection = this.collectedNodes.get(collectionKey);
                            if (collection) {
                                collection.toggleWidget.value = savedGroup.value;
                                collection.disabledMode = savedGroup.disabledMode || this.defaultDisabledMode;
                            }
                        }
                    });
                }
                
                if (o.isActive) {
                    this.activate();
                } else {
                    this.applyAllNodeModes();
                }
            };
        }
        
        // ==================== A1r Node Mode Console（重写为动态widget版本） ====================
        if (nodeData.name === "A1r Node Mode Console") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                const r = onNodeCreated?.apply(this, arguments);
                
                this.collectedNode = null;
                this.collectedWidgets = new Map(); // 用于存储添加的其他节点的小部件
                this.serialize_widgets = true;
                this.defaultDisabledMode = 4;
                this.isActive = false;
                this.widgets_start_y = 30;
                
                // 移除所有默认widget（后端会创建一个trigger widget）
                // 我们稍后会根据收集的节点/组重命名它
                
                if (window.A1rSpace_SizeFixer && !window.A1rSpace_SizeFixer.hasDefaultSize("A1r Node Mode Console")) {
                    window.A1rSpace_SizeFixer.registerDefaultSize("A1r Node Mode Console", [280, 80]);
                }
                
                return r;
            };
            
            // 复用 Collector 的方法
            nodeType.prototype.getGroupId = function(group) {
                return group._group_id || group.id || group._id || 0;
            };
            
            nodeType.prototype.getNodesInGroup = function(group) {
                if (!group || !app.graph) return [];
                
                if (group._nodes && Array.isArray(group._nodes) && group._nodes.length > 0) {
                    return group._nodes.filter(node => app.graph._nodes.includes(node));
                }
                
                if (typeof group.recomputeInsideNodes === 'function') {
                    group.recomputeInsideNodes();
                    if (group._nodes && Array.isArray(group._nodes)) {
                        return group._nodes.filter(node => app.graph._nodes.includes(node));
                    }
                }
                
                if (!app.graph._nodes) return [];
                
                const nodes = [];
                const groupLeft = group._pos[0];
                const groupTop = group._pos[1];
                const groupRight = groupLeft + group._size[0];
                const groupBottom = groupTop + group._size[1];
                
                for (const node of app.graph._nodes) {
                    const nodeCenterX = node.pos[0] + node.size[0] * 0.5;
                    const nodeCenterY = node.pos[1] + node.size[1] * 0.5;
                    
                    if (nodeCenterX >= groupLeft &&
                        nodeCenterX <= groupRight &&
                        nodeCenterY >= groupTop &&
                        nodeCenterY <= groupBottom) {
                        nodes.push(node);
                    }
                }
                
                return nodes;
            };
            
            nodeType.prototype.updateNodeMode = function() {
                if (!this.collectedNode || !this.collectedNode.targetNode) return;
                
                const isEnabled = Boolean(this.collectedNode.toggleWidget?.value);
                
                if (isEnabled) {
                    this.collectedNode.targetNode.mode = 0;
                } else {
                    this.collectedNode.targetNode.mode = this.defaultDisabledMode;
                }
                
                app.canvas.setDirty(true);
            };
            
            nodeType.prototype.updateGroupMode = function() {
                if (!this.collectedNode || !this.collectedNode.targetGroup) return;
                
                const isEnabled = Boolean(this.collectedNode.toggleWidget?.value);
                const targetMode = isEnabled ? 0 : this.defaultDisabledMode;
                
                const nodesInGroup = this.getNodesInGroup(this.collectedNode.targetGroup);
                
                nodesInGroup.forEach(node => {
                    node.mode = targetMode;
                });
                
                app.canvas.setDirty(true);
            };
            
            // 设置节点名称监听（单独提取出来）
            nodeType.prototype.setupNodeNameWatcherForConsole = function(targetNode, valueWidget) {
                const self = this;
                const originalOnPropertyChanged = targetNode.onPropertyChanged;
                
                targetNode.onPropertyChanged = function(property, value) {
                    if (originalOnPropertyChanged) {
                        originalOnPropertyChanged.call(this, property, value);
                    }
                    
                    if (property === "title" && valueWidget) {
                        const newName = "🔷 " + (value || targetNode.type);
                        valueWidget.name = newName;
                        valueWidget._fullName = newName;
                        // 强制更新节点大小
                        if (self.computeSize) {
                            self.size = self.computeSize();
                        }
                        app.canvas.setDirty(true);
                    }
                };
            };
            
            nodeType.prototype.addNodeToConsole = function(targetNode, widgetName = null) {
                // 如果没有指定 widgetName，则添加整个节点
                if (!widgetName) {
                    // 最多只能添加1个节点/组
                    if (this.collectedNode) return;
                    
                    const nodeId = String(targetNode.id);
                    const nodeName = "🔷 " + (targetNode.title || targetNode.type);
                    
                    // 动态创建 toggle widget
                    const toggleCallback = (value) => {
                        this.updateNodeMode();
                    };
                    
                    let valueWidget;
                    try {
                        valueWidget = this.addWidget("toggle", nodeName, true, toggleCallback);
                        if (valueWidget) {
                            valueWidget._fullName = nodeName;
                        }
                    } catch (error) {
                        console.error("Failed to create toggle widget:", error);
                        return;
                    }
                    
                    if (!valueWidget) return;
                    
                    this.collectedNode = {
                        targetNode: targetNode,
                        toggleWidget: valueWidget,
                        nodeId: nodeId,
                        isGroup: false
                    };
                    
                    // 设置名称监听
                    this.setupNodeNameWatcherForConsole(targetNode, valueWidget);
                    
                    if (this.isActive) {
                        valueWidget.disabled = true;
                        if (valueWidget.options) {
                            valueWidget.options.disabled = true;
                        }
                    }
                    
                    this.updateNodeMode();
                } else {
                    // 添加指定的小部件
                    this.addWidgetToConsole(targetNode, widgetName);
                }
                
                app.canvas.setDirty(true);
            };
            
            nodeType.prototype.addGroupToConsole = function(targetGroup) {
                // 最多只能添加1个
                if (this.collectedNode) return;
                
                const groupId = this.getGroupId(targetGroup);
                const groupName = "📁 " + (targetGroup.title || targetGroup._title || `Group ${groupId}`);
                
                // 动态创建 toggle widget
                const toggleCallback = (value) => {
                    this.updateGroupMode();
                };
                
                let valueWidget;
                try {
                    valueWidget = this.addWidget("toggle", groupName, true, toggleCallback);
                    if (valueWidget) {
                        valueWidget._fullName = groupName;
                    }
                } catch (error) {
                    console.error("Failed to create toggle widget:", error);
                    return;
                }
                
                if (!valueWidget) return;
                
                this.collectedNode = {
                    targetGroup: targetGroup,
                    toggleWidget: valueWidget,
                    groupId: groupId,
                    isGroup: true
                };
                
                // 设置Group名称监听
                this.setupGroupNameWatcherForConsole(targetGroup, valueWidget);
                
                if (this.isActive) {
                    valueWidget.disabled = true;
                    if (valueWidget.options) {
                        valueWidget.options.disabled = true;
                    }
                }
                
                this.updateGroupMode();
                app.canvas.setDirty(true);
            };
            
            // 设置Group名称监听（单独提取出来）
            nodeType.prototype.setupGroupNameWatcherForConsole = function(targetGroup, valueWidget) {
                const self = this;
                const groupId = this.getGroupId(targetGroup);
                let internalTitle = targetGroup.title || targetGroup._title || '';
                
                try {
                    Object.defineProperty(targetGroup, 'title', {
                        get: function() {
                            return internalTitle;
                        },
                        set: function(newTitle) {
                            internalTitle = newTitle;
                            if (valueWidget) {
                                const newName = "📁 " + (newTitle || `Group ${groupId}`);
                                valueWidget.name = newName;
                                valueWidget._fullName = newName;
                                // 强制更新节点大小
                                if (self.computeSize) {
                                    self.size = self.computeSize();
                                }
                                app.canvas.setDirty(true);
                            }
                        },
                        configurable: true
                    });
                } catch (e) {}
            };
            
            // 添加其他节点的小部件到Console
            nodeType.prototype.addWidgetToConsole = function(targetNode, widgetName) {
                if (!targetNode || !widgetName) return;
                
                const targetWidget = targetNode.widgets?.find(w => w.name === widgetName);
                if (!targetWidget) return;
                
                const widgetKey = `${targetNode.id}_${widgetName}`;
                if (this.collectedWidgets.has(widgetKey)) return;
                
                const displayName = `${targetNode.title || targetNode.type}.${widgetName}`;
                
                // 根据原始小部件类型创建镜像小部件
                let mirrorWidget;
                try {
                    if (targetWidget.type === "toggle" || targetWidget.type === "boolean") {
                        mirrorWidget = this.addWidget("toggle", displayName, targetWidget.value, (v) => {
                            targetWidget.value = v;
                            if (targetWidget.callback) {
                                targetWidget.callback(v);
                            }
                            app.canvas.setDirty(true);
                        });
                    } else if (targetWidget.type === "number") {
                        mirrorWidget = this.addWidget("number", displayName, targetWidget.value, (v) => {
                            targetWidget.value = v;
                            if (targetWidget.callback) {
                                targetWidget.callback(v);
                            }
                            app.canvas.setDirty(true);
                        }, targetWidget.options || {});
                    } else if (targetWidget.type === "combo") {
                        mirrorWidget = this.addWidget("combo", displayName, targetWidget.value, (v) => {
                            targetWidget.value = v;
                            if (targetWidget.callback) {
                                targetWidget.callback(v);
                            }
                            app.canvas.setDirty(true);
                        }, { values: targetWidget.options?.values || [] });
                    } else if (targetWidget.type === "text" || targetWidget.type === "string") {
                        mirrorWidget = this.addWidget("text", displayName, targetWidget.value, (v) => {
                            targetWidget.value = v;
                            if (targetWidget.callback) {
                                targetWidget.callback(v);
                            }
                            app.canvas.setDirty(true);
                        }, targetWidget.options || {});
                    } else {
                        // 其他类型暂不支持
                        return;
                    }
                    
                    if (mirrorWidget) {
                        mirrorWidget._fullName = displayName;
                        mirrorWidget._targetNode = targetNode;
                        mirrorWidget._targetWidgetName = widgetName;
                        
                        this.collectedWidgets.set(widgetKey, {
                            targetNode: targetNode,
                            targetWidget: targetWidget,
                            mirrorWidget: mirrorWidget,
                            widgetKey: widgetKey
                        });
                        
                        // 监听原始小部件的变化并同步到镜像
                        const originalCallback = targetWidget.callback;
                        targetWidget.callback = (v) => {
                            if (originalCallback) originalCallback(v);
                            if (mirrorWidget && mirrorWidget.value !== v) {
                                mirrorWidget.value = v;
                                app.canvas.setDirty(true);
                            }
                        };
                        
                        // 设置节点名称监听
                        this.setupWidgetNodeNameWatcher(targetNode, mirrorWidget, widgetName);
                        
                        if (this.isActive) {
                            mirrorWidget.disabled = true;
                            if (mirrorWidget.options) {
                                mirrorWidget.options.disabled = true;
                            }
                        }
                    }
                } catch (error) {
                    console.error("Failed to add widget to console:", error);
                }
                
                app.canvas.setDirty(true);
            };
            
            // 为添加的小部件设置节点名称监听
            nodeType.prototype.setupWidgetNodeNameWatcher = function(targetNode, mirrorWidget, widgetName) {
                const self = this;
                const originalOnPropertyChanged = targetNode.onPropertyChanged;
                
                targetNode.onPropertyChanged = function(property, value) {
                    if (originalOnPropertyChanged) {
                        originalOnPropertyChanged.call(this, property, value);
                    }
                    
                    if (property === "title" && mirrorWidget) {
                        const newName = `${value || targetNode.type}.${widgetName}`;
                        mirrorWidget.name = newName;
                        mirrorWidget._fullName = newName;
                        // 强制更新节点大小
                        if (self.computeSize) {
                            self.size = self.computeSize();
                        }
                        app.canvas.setDirty(true);
                    }
                };
            };
            
            // 移除添加的小部件
            nodeType.prototype.removeWidgetFromConsole = function(widgetKey) {
                const collection = this.collectedWidgets.get(widgetKey);
                if (!collection) return;
                
                const widgetIdx = this.widgets.indexOf(collection.mirrorWidget);
                if (widgetIdx !== -1) {
                    this.widgets.splice(widgetIdx, 1);
                }
                
                this.collectedWidgets.delete(widgetKey);
                app.canvas.setDirty(true);
            };
            
            // 激活面板
            nodeType.prototype.activate = function() {
                if (activeModeConsole && activeModeConsole !== this) {
                    activeModeConsole.deactivate();
                }
                
                activeModeConsole = this;
                this.isActive = true;
                this.setWidgetsReadonly(true);
                app.canvas.setDirty(true);
            };
            
            // 停用面板
            nodeType.prototype.deactivate = function() {
                if (activeModeConsole === this) {
                    activeModeConsole = null;
                }
                this.isActive = false;
                this.setWidgetsReadonly(false);
                app.canvas.setDirty(true);
            };
            
            // 设置小部件只读状态
            nodeType.prototype.setWidgetsReadonly = function(readonly) {
                // 设置 trigger widget 只读
                if (this.collectedNode && this.collectedNode.toggleWidget) {
                    this.collectedNode.toggleWidget.disabled = readonly;
                    if (this.collectedNode.toggleWidget.options) {
                        this.collectedNode.toggleWidget.options.disabled = readonly;
                    }
                }
                
                // 设置所有添加的小部件只读
                this.collectedWidgets.forEach((collection) => {
                    if (collection.mirrorWidget) {
                        collection.mirrorWidget.disabled = readonly;
                        if (collection.mirrorWidget.options) {
                            collection.mirrorWidget.options.disabled = readonly;
                        }
                    }
                });
            };
            
            nodeType.prototype.removeFromConsole = function() {
                if (this.collectedNode) {
                    // 恢复节点/组模式
                    if (this.collectedNode.isGroup) {
                        const nodesInGroup = this.getNodesInGroup(this.collectedNode.targetGroup);
                        nodesInGroup.forEach(node => {
                            node.mode = 0;
                        });
                    } else if (this.collectedNode.targetNode) {
                        this.collectedNode.targetNode.mode = 0;
                    }
                    
                    // 移除动态创建的 toggle widget
                    if (this.collectedNode.toggleWidget) {
                        const widgetIdx = this.widgets.indexOf(this.collectedNode.toggleWidget);
                        if (widgetIdx !== -1) {
                            this.widgets.splice(widgetIdx, 1);
                        }
                    }
                    
                    this.collectedNode = null;
                    
                    app.canvas.setDirty(true);
                }
            };
            
            const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
            nodeType.prototype.getExtraMenuOptions = function(canvas, options) {
                getExtraMenuOptions?.apply(this, arguments);
                
                // 激活/停用面板选项
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
                
                options.push(null);
                
                options.push({
                    content: "Default Disabled Mode",
                    has_submenu: true,
                    submenu: {
                        options: [
                            {
                                content: `${this.defaultDisabledMode === 2 ? "✓ " : "　"}Mute (Skip execution)`,
                                callback: () => {
                                    this.defaultDisabledMode = 2;
                                    if (this.collectedNode) {
                                        if (this.collectedNode.isGroup) {
                                            this.updateGroupMode();
                                        } else {
                                            this.updateNodeMode();
                                        }
                                    }
                                    app.canvas.setDirty(true);
                                }
                            },
                            {
                                content: `${this.defaultDisabledMode === 4 ? "✓ " : "　"}Bypass (Pass through)`,
                                callback: () => {
                                    this.defaultDisabledMode = 4;
                                    if (this.collectedNode) {
                                        if (this.collectedNode.isGroup) {
                                            this.updateGroupMode();
                                        } else {
                                            this.updateNodeMode();
                                        }
                                    }
                                    app.canvas.setDirty(true);
                                }
                            }
                        ]
                    }
                });
                
                if (this.collectedNode) {
                    options.push(null);
                    
                    const displayName = this.collectedNode.isGroup
                        ? `📁 ${this.collectedNode.targetGroup.title || this.collectedNode.targetGroup._title || `Group ${this.collectedNode.groupId}`}`
                        : `🔷 ${this.collectedNode.targetNode.title || this.collectedNode.targetNode.type}`;
                    
                    options.push({
                        content: `Remove: ${displayName}`,
                        callback: () => {
                            this.removeFromConsole();
                        }
                    });
                }
                
                // 添加重排序小部件的选项
                if (this.collectedWidgets.size > 1) {
                    options.push(null);
                    
                    const moveOptions = [];
                    
                    this.widgets.forEach((widget, index) => {
                        // 跳过主 toggle widget（如果存在）
                        if (this.collectedNode && widget === this.collectedNode.toggleWidget) {
                            return;
                        }
                        
                        const collection = Array.from(this.collectedWidgets.values()).find(c => c.mirrorWidget === widget);
                        if (collection) {
                            const displayName = collection.mirrorWidget._fullName || collection.mirrorWidget.name;
                            
                            moveOptions.push({
                                content: displayName,
                                has_submenu: true,
                                submenu: {
                                    options: [
                                        {
                                            content: "Move Up",
                                            disabled: index === 0 || (index === 1 && this.collectedNode),
                                            callback: () => {
                                                const minIndex = this.collectedNode ? 1 : 0;
                                                if (index > minIndex) {
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
                                            disabled: index === 0 || (index === 1 && this.collectedNode),
                                            callback: () => {
                                                this.widgets.splice(index, 1);
                                                const insertIndex = this.collectedNode ? 1 : 0;
                                                this.widgets.splice(insertIndex, 0, widget);
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
                
                // 添加移除小部件的选项
                if (this.collectedWidgets.size > 0) {
                    if (this.collectedWidgets.size <= 1) {
                        options.push(null);
                    }
                    
                    const removeWidgetOptions = [];
                    this.collectedWidgets.forEach((collection, widgetKey) => {
                        const displayName = collection.mirrorWidget._fullName || collection.mirrorWidget.name;
                        
                        removeWidgetOptions.push({
                            content: displayName,
                            callback: () => {
                                this.removeWidgetFromConsole(widgetKey);
                            }
                        });
                    });
                    
                    options.push({
                        content: "Remove Widget",
                        has_submenu: true,
                        submenu: {
                            options: removeWidgetOptions
                        }
                    });
                }
            };
            
            const onSerialize = nodeType.prototype.onSerialize;
            nodeType.prototype.onSerialize = function(o) {
                const r = onSerialize?.apply(this, arguments);
                
                if (this.collectedNode) {
                    if (this.collectedNode.isGroup) {
                        o.collected_group = {
                            groupId: this.collectedNode.groupId,
                            value: this.collectedNode.toggleWidget?.value || true
                        };
                    } else {
                        o.collected_node = {
                            nodeId: this.collectedNode.nodeId,
                            value: this.collectedNode.toggleWidget?.value || true
                        };
                    }
                }
                
                // 保存添加的小部件
                if (this.collectedWidgets.size > 0) {
                    o.collected_widgets = [];
                    this.collectedWidgets.forEach((collection, widgetKey) => {
                        o.collected_widgets.push({
                            nodeId: collection.targetNode.id,
                            widgetName: collection.targetWidget.name,
                            value: collection.mirrorWidget.value
                        });
                    });
                }
                
                o.defaultDisabledMode = this.defaultDisabledMode;
                o.isActive = this.isActive;
                
                return r;
            };
            
            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function(o) {
                const r = onConfigure?.apply(this, arguments);
                
                if (o.defaultDisabledMode !== undefined) {
                    this.defaultDisabledMode = o.defaultDisabledMode;
                }
                
                setTimeout(() => {
                    if (o.collected_node) {
                        const targetNode = app.graph.getNodeById(o.collected_node.nodeId);
                        if (targetNode && !isNodeBlacklisted(targetNode)) {
                            this.addNodeToConsole(targetNode);
                            if (this.collectedNode && this.collectedNode.toggleWidget) {
                                this.collectedNode.toggleWidget.value = o.collected_node.value;
                            }
                        }
                    } else if (o.collected_group) {
                        const targetGroup = app.graph._groups?.find(g => {
                            const gid = this.getGroupId(g);
                            return gid === o.collected_group.groupId;
                        });
                        
                        if (targetGroup) {
                            this.addGroupToConsole(targetGroup);
                            if (this.collectedNode && this.collectedNode.toggleWidget) {
                                this.collectedNode.toggleWidget.value = o.collected_group.value;
                            }
                        }
                    }
                    
                    // 恢复添加的小部件
                    if (o.collected_widgets && Array.isArray(o.collected_widgets)) {
                        o.collected_widgets.forEach(savedWidget => {
                            const targetNode = app.graph.getNodeById(savedWidget.nodeId);
                            if (targetNode) {
                                this.addWidgetToConsole(targetNode, savedWidget.widgetName);
                                
                                const widgetKey = `${savedWidget.nodeId}_${savedWidget.widgetName}`;
                                const collection = this.collectedWidgets.get(widgetKey);
                                if (collection && collection.mirrorWidget) {
                                    collection.mirrorWidget.value = savedWidget.value;
                                }
                            }
                        });
                    }
                    
                    // 恢复激活状态
                    if (o.isActive) {
                        this.activate();
                    }
                }, 500);
                
                return r;
            };
            
            // 绘制激活状态的绿条
            const onDrawForeground = nodeType.prototype.onDrawForeground;
            nodeType.prototype.onDrawForeground = function(ctx) {
                if (onDrawForeground) {
                    onDrawForeground.call(this, ctx);
                }
                
                if (this.isActive && !this.flags.collapsed) {
                    ctx.save();
                    ctx.fillStyle = "#00ff00";
                    ctx.fillRect(0, 0, this.size[0], 3);
                    ctx.restore();
                }
            };
        }
        
        // ==================== A1r Node Mode Relay ====================
        if (nodeData.name === "A1r Node Mode Relay") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                const r = onNodeCreated?.apply(this, arguments);
                
                if (window.A1rSpace_SizeFixer && !window.A1rSpace_SizeFixer.hasDefaultSize("A1r Node Mode Relay")) {
                    window.A1rSpace_SizeFixer.registerDefaultSize("A1r Node Mode Relay", [200, 50]);
                }
                
                return r;
            };
        }
        
        // ==================== A1r Node Mode Inverter ====================
        if (nodeData.name === "A1r Node Mode Inverter") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                const r = onNodeCreated?.apply(this, arguments);
                
                if (window.A1rSpace_SizeFixer && !window.A1rSpace_SizeFixer.hasDefaultSize("A1r Node Mode Inverter")) {
                    window.A1rSpace_SizeFixer.registerDefaultSize("A1r Node Mode Inverter", [200, 50]);
                }
                
                return r;
            };
        }
    },
    
    // ==================== 为其他节点添加右键菜单 ====================
    async nodeCreated(node) {
        const originalGetExtraMenuOptions = node.getExtraMenuOptions;
        node.getExtraMenuOptions = function(canvas, options) {
            originalGetExtraMenuOptions?.call(this, canvas, options);
            
            if (isNodeBlacklisted(node)) {
                return;
            }
            
            if (activeModeCollector) {
                const isAlreadyAdded = activeModeCollector.collectedNodes.has(String(node.id));
                
                options.push(null);
                options.push({
                    content: isAlreadyAdded ? "✓ Added to Mode Panel" : "Add Node to Mode Panel",
                    disabled: isAlreadyAdded,
                    callback: () => {
                        if (activeModeCollector && !isAlreadyAdded) {
                            activeModeCollector.addNodeToPanel(node);
                        }
                    }
                });
            }
            
            // Mode Console 相关选项（仅在激活时显示）
            if (activeModeConsole) {
                options.push(null);
                
                const consoleName = activeModeConsole.title || "Mode Console";
                const isNodeAdded = activeModeConsole.collectedNode?.targetNode === node;
                
                // 添加整个节点的选项
                options.push({
                    content: isNodeAdded ? "✓ Node Added to Console" : "Add Node to Console",
                    disabled: isNodeAdded || activeModeConsole.collectedNode !== null,
                    callback: () => {
                        if (!isNodeAdded) {
                            activeModeConsole.addNodeToConsole(node);
                        }
                    }
                });
                
                // 添加小部件的选项
                if (node.widgets && node.widgets.length > 0) {
                    const widgetOptions = node.widgets.map(widget => {
                        const widgetKey = `${node.id}_${widget.name}`;
                        const isWidgetAdded = activeModeConsole.collectedWidgets.has(widgetKey);
                        
                        return {
                            content: isWidgetAdded ? `✓ ${widget.name}` : widget.name,
                            disabled: isWidgetAdded,
                            callback: () => {
                                if (!isWidgetAdded) {
                                    activeModeConsole.addWidgetToConsole(node, widget.name);
                                }
                            }
                        };
                    });
                    
                    options.push({
                        content: "Add Widget to Console",
                        has_submenu: true,
                        submenu: {
                            options: widgetOptions
                        }
                    });
                }
            }
        };
    },
    
    // ==================== 为Group添加右键菜单 ====================
    async setup() {
        const originalGetCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
        LGraphCanvas.prototype.getCanvasMenuOptions = function() {
            const options = originalGetCanvasMenuOptions?.apply(this, arguments) || [];
            const canvas = app.canvas;
            
            if (!canvas?.graph?._groups?.length) {
                return options;
            }
            
            const mouse = canvas.graph_mouse;
            if (!mouse) return options;
            
            let targetGroup = null;
            
            for (let i = canvas.graph._groups.length - 1; i >= 0; i--) {
                const group = canvas.graph._groups[i];
                
                if (mouse[0] >= group._pos[0] &&
                    mouse[1] >= group._pos[1] &&
                    mouse[0] <= group._pos[0] + group._size[0] &&
                    mouse[1] <= group._pos[1] + group._size[1]) {
                    targetGroup = group;
                    break;
                }
            }
            
            if (targetGroup) {
                const getGroupId = (group) => group._group_id || group.id || group._id || 0;
                const groupId = getGroupId(targetGroup);
                const groupUniqueKey = "group_" + groupId;
                
                if (activeModeCollector) {
                    const isAlreadyAdded = activeModeCollector.collectedNodes.has(groupUniqueKey);
                    
                    options.push(null);
                    options.push({
                        content: isAlreadyAdded ? "✓ Group Added to Mode Panel" : "Add Group to Mode Panel",
                        disabled: isAlreadyAdded,
                        callback: () => {
                            if (!isAlreadyAdded) {
                                activeModeCollector.addGroupToPanel(targetGroup);
                            }
                        }
                    });
                }
                
                // Mode Console 相关选项（仅在激活时显示）
                if (activeModeConsole) {
                    const isGroupAdded = activeModeConsole.collectedNode?.targetGroup === targetGroup;
                    
                    options.push({
                        content: isGroupAdded ? "✓ Group Added to Console" : "Add Group to Console",
                        disabled: isGroupAdded || activeModeConsole.collectedNode !== null,
                        callback: () => {
                            if (!isGroupAdded) {
                                activeModeConsole.addGroupToConsole(targetGroup);
                            }
                        }
                    });
                }
            }
            
            return options;
        };
    }
});