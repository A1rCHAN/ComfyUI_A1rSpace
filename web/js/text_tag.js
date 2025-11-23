import { app } from "/scripts/app.js";

// Register extension for TextTagBox node
app.registerExtension({
    name: "A1rSpace.TextTagBox",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "A1r Text Tag Box") {
            // Store original onNodeCreated
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            
            nodeType.prototype.onNodeCreated = function() {
                const result = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                
                // Get widgets
                const modelWidget = this.widgets.find(w => w.name === "model");
                const charThresholdWidget = this.widgets.find(w => w.name === "character_threshold");
                
                // Function to update widget states based on model
                const updateWidgetStates = () => {
                    const isJoyTag = modelWidget.value === "JoyTag";
                    
                    if (charThresholdWidget) {
                        // Make character_threshold readonly when JoyTag is selected
                        charThresholdWidget.disabled = isJoyTag;
                        charThresholdWidget.options = charThresholdWidget.options || {};
                        charThresholdWidget.options.disabled = isJoyTag;
                    }
                };
                
                // Initial state update
                if (modelWidget) {
                    updateWidgetStates();
                    
                    // Update states when model changes
                    const originalCallback = modelWidget.callback;
                    modelWidget.callback = function() {
                        if (originalCallback) {
                            originalCallback.apply(this, arguments);
                        }
                        updateWidgetStates();
                    };

                    // Override mouse interaction to show custom menu with submenus
                    modelWidget.mouse = function(event, pos, node) {
                        if (event.type == "mousedown") {
                            const values = this.options.values;
                            const menuOptions = [];
                            const wd14Options = [];
                            
                            values.forEach(v => {
                                if (v.startsWith("WD14/")) {
                                    wd14Options.push({
                                        content: v.split("/")[1],
                                        value: v,
                                        callback: () => {
                                            this.value = v;
                                            if (this.callback) this.callback(v);
                                            app.graph.setDirtyCanvas(true, true);
                                        }
                                    });
                                } else {
                                    menuOptions.push({
                                        content: v,
                                        value: v,
                                        callback: () => {
                                            this.value = v;
                                            if (this.callback) this.callback(v);
                                            app.graph.setDirtyCanvas(true, true);
                                        }
                                    });
                                }
                            });
                            
                            if (wd14Options.length > 0) {
                                menuOptions.push({
                                    content: "WD14",
                                    submenu: {
                                        options: wd14Options
                                    }
                                });
                            }
                            
                            new LiteGraph.ContextMenu(menuOptions, {
                                event: event,
                                parentMenu: null,
                                node: node
                            });
                            
                            return true; // Event handled
                        }
                        return false;
                    };
                }
                
                // Hide replace_underscore and trailing_comma widgets but keep them functional
                const hideWidget = (w) => {
                    if (w) {
                        w.computeSize = () => [0, -4]; // Collapse space
                        w.type = "hidden"; // Hint for some custom UIs
                        w.visible = false; // Custom flag
                        // Override draw to do nothing
                        w.draw = function() {}; 
                    }
                };

                const replaceUnderscoreWidget = this.widgets.find(w => w.name === "replace_underscore");
                const trailingCommaWidget = this.widgets.find(w => w.name === "trailing_comma");
                
                hideWidget(replaceUnderscoreWidget);
                hideWidget(trailingCommaWidget);

                // Add context menu options for replace_underscore and trailing_comma
                const originalGetExtraMenuOptions = this.getExtraMenuOptions;
                this.getExtraMenuOptions = function(canvas, options) {
                    if (originalGetExtraMenuOptions) {
                        originalGetExtraMenuOptions.apply(this, arguments);
                    }
                    
                    // Get current values from widgets
                    const replaceUnderscore = replaceUnderscoreWidget ? replaceUnderscoreWidget.value : true;
                    const trailingComma = trailingCommaWidget ? trailingCommaWidget.value : false;
                    
                    options.unshift(
                        {
                            content: "Tag Formatting",
                            submenu: {
                                options: [
                                    {
                                        content: replaceUnderscore ? "Apply Underscore" : "Replace Underscore",
                                        callback: () => {
                                            if (replaceUnderscoreWidget) {
                                                replaceUnderscoreWidget.value = !replaceUnderscore;
                                                if (this.onResize) {
                                                    this.onResize(this.size);
                                                }
                                                app.graph.setDirtyCanvas(true, true);
                                            }
                                        }
                                    },
                                    {
                                        content: trailingComma ? "Without Comma" : "Trailing Comma",
                                        callback: () => {
                                            if (trailingCommaWidget) {
                                                trailingCommaWidget.value = !trailingComma;
                                                if (this.onResize) {
                                                    this.onResize(this.size);
                                                }
                                                app.graph.setDirtyCanvas(true, true);
                                            }
                                        }
                                    }
                                ]
                            }
                        },
                        null // separator
                    );
                };
                
                return result;
            };
        }
    }
});