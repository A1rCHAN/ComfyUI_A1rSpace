import { app } from "/scripts/app.js";

/* 
 * Add the "Folded Slot" attribute to the nodes under A1rSpace:
 * - When folding: Only the first input/output is displayed, and the rest are hidden. 
 *   All input/output names are uniformly set to a single space (to avoid overlapping and placeholder exceptions);
 *   No additional shading is drawn.
 * - When expanding: Restore all inputs/outputs to their original names (corresponding one by one).
 * - When folding, the height of the nodes is allowed to be reduced
 *   (the height is decreased according to the number of hidden slots without modifying the structure or connection slots).
 */

const BLACKLIST = [
    // List node types that should not have this feature applied
];


app.registerExtension({
    name: "A1rSpace.CollapseSlots.All",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {

        // if (!nodeData?.category || !String(nodeData.category).startsWith("A1rSpace")) return;
        if (BLACKLIST.includes(nodeData.name)) return;


        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        const origOnDrawForeground = nodeType.prototype.onDrawForeground;
        const origOnDrawBackground = nodeType.prototype.onDrawBackground;
        const origOnSerialize = nodeType.prototype.onSerialize;

        function isCollapsed(node) {
            return !!node._a1r_collapsed;
        }

        function updateSlotsVisibility(node) {
            try {
                const collapse = isCollapsed(node);
                
                // Handle Outputs
                if (node.outputs && node.outputs.length > 1) {
                    // Save original labels
                    if (!node._a1r_orig_output_labels) {
                        node._a1r_orig_output_labels = node.outputs.map(o => (o && typeof o.label === "string") ? o.label : "");
                    }
                    
                    for (let i = 0; i < node.outputs.length; i++) {
                        const out = node.outputs[i];
                        if (!out) continue;

                        // Just set hidden, label
                        out.hidden = collapse ? (i > 0) : false;
                        
                        // Set label for display only
                        if (collapse) {
                            if (Object.prototype.hasOwnProperty.call(out, 'label')) {
                                out.label = " ";
                            }
                        } else if (node._a1r_orig_output_labels) {
                            if (Object.prototype.hasOwnProperty.call(out, 'label')) {
                                out.label = node._a1r_orig_output_labels[i] || "";
                            }
                        }
                    }
                }

                // Handle Inputs
                if (node.inputs && node.inputs.length > 1) {
                    // Save original labels
                    if (!node._a1r_orig_input_labels) {
                        node._a1r_orig_input_labels = node.inputs.map(i => (i && typeof i.label === "string") ? i.label : "");
                    }
                    
                    for (let i = 0; i < node.inputs.length; i++) {
                        const inp = node.inputs[i];
                        if (!inp) continue;

                        // Just set hidden, label
                        inp.hidden = collapse ? (i > 0) : false;
                        
                        // Set label for display only
                        if (collapse) {
                            if (Object.prototype.hasOwnProperty.call(inp, 'label')) {
                                inp.label = " ";
                            }
                        } else if (node._a1r_orig_input_labels) {
                            if (Object.prototype.hasOwnProperty.call(inp, 'label')) {
                                inp.label = node._a1r_orig_input_labels[i] || "";
                            }
                        }
                    }
                }

            } catch (e) {
                console.warn("[A1rSpace] updateSlotsVisibility failed:", e);
            }
        }

        // Helper to safely get width from size (handles Array and Float32Array)
        function getWidth(size) {
            if (size && size.length > 0 && typeof size[0] === 'number') return size[0];
            return undefined;
        }

        // Determine whether the node size is being manually adjusted ( LiteGraph canvas )
        function isManualResizing(node) {
            try { return !!(app && app.canvas && app.canvas.resizing_node === node); } catch { return false; }
        }

        // Get preferred width (prefer user-set width, fallback to current node width)
        function getPreferredWidth(node) {
            if (typeof node.__a1r_user_width === 'number' && node.__a1r_user_width > 0) return node.__a1r_user_width;
            const w = getWidth(node.size);
            if (typeof w === 'number' && w > 0) return w;
            return undefined;
        }

        nodeType.prototype.onNodeCreated = function () {
            if (origOnNodeCreated) origOnNodeCreated.apply(this, arguments);
            
            if (typeof this._a1r_collapsed === "undefined") this._a1r_collapsed = false;

            // Initialize configuration flag to prevent intercepting connections during node creation and configuration
            this.__a1r_configuring = true;

            // Record current width as default user width during initialization
            try {
                const w = getWidth(this.size);
                if (typeof w === 'number' && w > 0) {
                    this.__a1r_user_width = w;
                }
            } catch {}

            updateSlotsVisibility(this);
            this.setDirtyCanvas(true, true);
            
            // Delay clearing the configuration flag (when creating a new node)
            const self = this;
            setTimeout(() => { self.__a1r_configuring = false; }, 100);

            const origOnConfigure = this.onConfigure;
            this.onConfigure = function (info) {
                // Reset the configuration flag to prevent connection recovery from being intercepted during workflow loading
                this.__a1r_configuring = true;
                
                if (origOnConfigure) origOnConfigure.apply(this, arguments);
                
                if (info._a1r_collapsed !== undefined) {
                    this._a1r_collapsed = info._a1r_collapsed;
                }
                
                // Use a longer latency (200ms) to ensure that all connections have been fully restored
                const self = this;
                setTimeout(() => {
                    try {
                        updateSlotsVisibility(self);
                        self.setDirtyCanvas(true, true);
                    } catch (e) {
                        console.warn("[A1rSpace] delayed updateSlotsVisibility failed:", e);
                    }
                }, 50);
                
                setTimeout(() => {
                    self.__a1r_configuring = false;
                }, 200);
            };

            // Update visibility and refresh the canvas when attributes change
            const origOnPropertyChanged = this.onPropertyChanged;
            this.onPropertyChanged = function (name, value) {
                // Record the width before the change to prevent upstream processes from altering it
                const widthBefore = getWidth(this.size);
                if (typeof widthBefore === 'number' && widthBefore > 0) {
                    this.__a1r_user_width = widthBefore;
                }
                const res = origOnPropertyChanged ? origOnPropertyChanged.apply(this, arguments) : undefined;
                return res;
            };

            // Serialize collapsed state
            this.onSerialize = function(o) {
                if (origOnSerialize) origOnSerialize.apply(this, arguments);
                o._a1r_collapsed = this._a1r_collapsed;
            };

        };

        // Keep the original background drawing
        nodeType.prototype.onDrawBackground = function (ctx) {
            if (origOnDrawBackground) origOnDrawBackground.apply(this, arguments);
        };

        nodeType.prototype.onDrawForeground = function (ctx) {
            if (origOnDrawForeground) origOnDrawForeground.apply(this, arguments);
            // To prevent attribute updates from being reflected in the drawing phase in some cases, reassert the visibility rules every frame
            try { updateSlotsVisibility(this); } catch {}
            // When manually dragging to adjust size, record user width preference
            try {
                if (isManualResizing(this)) {
                    const w = getWidth(this.size);
                    if (typeof w === 'number' && w > 0) {
                        this.__a1r_user_width = w;
                    }
                }
            } catch {}
        };

        // When folding, allow nodes to shrink: 
        // Temporarily forge only one output/input and hand it over to the original algorithm to calculate the precise height (then immediately resume) to avoid a blank bottom
        if (!nodeType.prototype._a1r_orig_computeSize && typeof nodeType.prototype.computeSize === 'function') {
            const origComputeSize = nodeType.prototype.computeSize;
            nodeType.prototype._a1r_orig_computeSize = origComputeSize; 
            nodeType.prototype.computeSize = function(out) { 
                // Always use the current width as the standard to avoid computeSize rewriting the width of this.size through the out reference 
                const curW = getWidth(this.size);
                const curH = (this.size && this.size.length > 1) ? this.size[1] : undefined;
                const outLocal = [curW ?? 0, curH ?? 0];

                if (isCollapsed(this)) {
                    const hasManyOutputs = Array.isArray(this.outputs) && this.outputs.length > 1;
                    const hasManyInputs = Array.isArray(this.inputs) && this.inputs.length > 1;
                    
                    if (hasManyOutputs || hasManyInputs) {
                        const backupOutputs = this.outputs;
                        const backupInputs = this.inputs;
                        try {
                            if (hasManyOutputs) this.outputs = [backupOutputs[0]];
                            if (hasManyInputs) this.inputs = [backupInputs[0]];
                            
                            const s = origComputeSize.call(this, outLocal); 
                            // Use calculated width (minimum) instead of forcing current width to allow manual shrinking
                            const w = (s && s.length > 0) ? s[0] : (curW ?? 0); 
                            const h = Math.max(40, s && s.length > 1 ? s[1] : (curH ?? 0)); 
                            return [w, h];
                        } finally { 
                            if (hasManyOutputs) this.outputs = backupOutputs;
                            if (hasManyInputs) this.inputs = backupInputs;
                        } 
                    }
                }

                const s = origComputeSize.call(this, outLocal); 
                // Use calculated width (minimum) instead of forcing current width to allow manual shrinking
                const w = (s && s.length > 0) ? s[0] : (curW ?? 0); 
                const h = s && s.length > 1 ? s[1] : (curH ?? 0); 
                return [w, h]; 
            }; 
        }

        // Right-click menu adds "Collapse slots" switch (prototype level, correct signature: canvas, options)
        if (!nodeType.prototype._a1r_orig_getExtraMenuOptions) {
            const origGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
            nodeType.prototype._a1r_orig_getExtraMenuOptions = origGetExtraMenuOptions;
            nodeType.prototype.getExtraMenuOptions = function(canvas, options) {
                if (origGetExtraMenuOptions) origGetExtraMenuOptions.apply(this, arguments);
                options = options || [];
                
                const node = this; // Capture node instance
                const collapsed = isCollapsed(node);
                
                options.push({
                    content: collapsed ? "Expand slots" : "Collapse slots",
                    callback: () => {
                        try {
                            // Record the current width once before switching
                            const widthBefore = getWidth(node.size);
                            if (typeof widthBefore === 'number' && widthBefore > 0) node.__a1r_user_width = widthBefore;
                            node._a1r_collapsed = !collapsed;
                            updateSlotsVisibility(node);
                            if (typeof node.computeSize === 'function' && typeof node.setSize === 'function') {
                                const s = node.computeSize(node.size);
                                if (s && s.length >= 2) {
                                    const wWanted = (typeof node.__a1r_user_width === 'number') ? node.__a1r_user_width : getPreferredWidth(node);
                                    const currentW = getWidth(node.size);
                                    node.setSize([typeof wWanted === 'number' ? wWanted : (typeof currentW === 'number' ? currentW : s[0]), s[1]]);
                                    if (typeof requestAnimationFrame === 'function') {
                                        requestAnimationFrame(() => {
                                            try {
                                                const w2 = (typeof node.__a1r_user_width === 'number') ? node.__a1r_user_width : getPreferredWidth(node);
                                                const curW2 = getWidth(node.size);
                                                if (node.size) node.setSize([typeof w2 === 'number' ? w2 : (typeof curW2 === 'number' ? curW2 : node.size[0]), node.size[1]]);
                                            } catch {}
                                        });
                                    }
                                }
                            }
                            node.setDirtyCanvas(true, true);
                            app.graph.setDirtyCanvas(true, true); // Force refresh the entire graph to ensure connection lines are redrawn
                        } catch (e) {
                            console.warn('[A1rSpace] context toggle failed:', e);
                        }
                    }
                });
            };
        }

        // Wrap setSize to record user preferred width when manually adjusting (without changing original behavior)
        if (!nodeType.prototype._a1r_orig_setSize && typeof nodeType.prototype.setSize === 'function') {
            const origSetSize = nodeType.prototype.setSize;
            nodeType.prototype._a1r_orig_setSize = origSetSize;
            nodeType.prototype.setSize = function(size) {
                // Compatible with passing [w,h] or (w,h)
                let w = undefined, h = undefined;
                if (Array.isArray(size) || (size && size.length >= 2)) { w = size[0]; h = size[1]; }
                else if (arguments.length >= 2) { w = arguments[0]; h = arguments[1]; }

                const ret = origSetSize.apply(this, arguments);
                try {
                    if (isManualResizing(this) && typeof w === 'number' && w > 0) {
                        this.__a1r_user_width = w;
                    }
                } catch {}
                return ret;
            };
        }

        // When folding, only the position of the "draw endpoint" is redirected:
        // By overriding getConnectionPos (only mapping coordinates to slot 0 when is_input=false and slot>0),
        // a pure visual effect of "multiple lines starting from one point" is achieved; it does not modify getOutputPos or any outputs/link structure,
        // so that after uncollapsing, the connection positions will naturally restore.
        if (!nodeType.prototype._a1r_orig_getConnectionPos && typeof nodeType.prototype.getConnectionPos === 'function') {
            const origGetConnectionPos = nodeType.prototype.getConnectionPos;
            nodeType.prototype._a1r_orig_getConnectionPos = origGetConnectionPos;
            nodeType.prototype.getConnectionPos = function(is_input, slot) {
                try {
                    if (isCollapsed(this)) {
                        if (!is_input && this.outputs && this.outputs.length > 1 && slot > 0) {
                            // 仅在折叠时重定向额外输出的绘制坐标到 slot 0
                            return origGetConnectionPos.call(this, false, 0);
                        }
                        if (is_input && this.inputs && this.inputs.length > 1 && slot > 0) {
                            // 仅在折叠时重定向额外输入的绘制坐标到 slot 0
                            return origGetConnectionPos.call(this, true, 0);
                        }
                    }
                } catch {}
                return origGetConnectionPos.apply(this, arguments);
            };
        }
        if (!nodeType.prototype._a1r_orig_getOutputPos && typeof nodeType.prototype.getOutputPos === 'function') {
            const origGetOutputPos = nodeType.prototype.getOutputPos;
            nodeType.prototype._a1r_orig_getOutputPos = origGetOutputPos;
            nodeType.prototype.getOutputPos = function(slot) {
                try {
                    if (isCollapsed(this) && this.outputs && this.outputs.length > 1 && slot > 0) {
                        return origGetOutputPos.call(this, 0);
                    }
                } catch {}
                return origGetOutputPos.apply(this, arguments);
            };
        }
        if (!nodeType.prototype._a1r_orig_getInputPos && typeof nodeType.prototype.getInputPos === 'function') {
            const origGetInputPos = nodeType.prototype.getInputPos;
            nodeType.prototype._a1r_orig_getInputPos = origGetInputPos;
            nodeType.prototype.getInputPos = function(slot) {
                try {
                    if (isCollapsed(this) && this.inputs && this.inputs.length > 1 && slot > 0) {
                        return origGetInputPos.call(this, 0);
                    }
                } catch {}
                return origGetInputPos.apply(this, arguments);
            };
        }

        // Note: Removed the logic to prevent new connections in collapsed state
        // Reason: This logic interferes with connection recovery when loading workflows
        // Users can still create connections in collapsed state, but visually all connections originate from the first output point
        // This is a purely visual effect and does not affect the actual connection logic
    }
});