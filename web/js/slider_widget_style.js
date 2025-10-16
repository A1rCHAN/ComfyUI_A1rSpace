import { app } from "../../../scripts/app.js";
import { $el } from "../../../scripts/ui.js";

/*
 * Global slider widget style adjustments for whitelisted nodes.
 */

app.registerExtension({
    name: "A1rSpace.SliderWidgetStyle",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // * Whitelist *
        const NODE_WHITELIST = [
            "A1r KSampler Config",
            "A1r KSampler Config Values",
            "A1r KSampler Config Values Lite",

            "A1r LoRA Config",

            "A1r ControlNet Config",
        ];

        if (!NODE_WHITELIST.includes(nodeData.name)) return;

        const onA1rNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const result = onA1rNodeCreated ? onA1rNodeCreated.apply(this, arguments) : undefined;

            // Collection to store all slider states and cleanup handlers
            const sliderStates = [];
            const eventHandlers = [];

            // Find all numeric widgets
            const numericWidgets = this.widgets?.filter(w => 
                (w.type === "number" || w.type === "slider") &&
                w.options && 
                typeof w.options.min === "number" && 
                typeof w.options.max === "number"
            ) || [];

            // Hide original numeric widgets completely
            numericWidgets.forEach(widget => {
                // Mark as converted widget to prevent ComfyUI from rendering it
                Object.defineProperty(widget, "type", {
                    get: () => "converted-widget",
                    set: () => {},
                });
                
                // Set size to zero to remove from layout
                widget.computeSize = () => [0, -4];
                
                // Hide the widget element if it exists
                widget.hidden = true;
            });
            


            // Create a slider for each numeric widget
            numericWidgets.forEach((widget, index) => {
                const state = {
                    widget: widget,
                    isDragging: false,
                    currentPos: 0,
                    targetPos: 0,
                    animationFrameId: null
                };

                // Get widget configuration from backend (will be updated later)
                let min = widget.options.min ?? 0;
                let max = widget.options.max ?? 100;
                let step = widget.step ?? widget.options.step ?? 1;
                let range = max - min;

                // Fix: ComfyUI sometimes multiplies step by 10 for sliders
                // Detect and correct this by checking if step makes sense for the range
                
                // Try dividing by 10 and check if it results in reasonable step count
                const candidateStep = step / 10;
                const stepsWithOriginal = range / step;
                const stepsWithCandidate = range / candidateStep;
                
                // If original step gives too few steps (< 10), and candidate gives reasonable amount (>= 10)
                // then the step was likely multiplied by 10
                if (stepsWithOriginal < 10 && stepsWithCandidate >= 10 && candidateStep > 0) {
                    step = candidateStep;
                }

                // Initialize position based on current value
                if (range > 0) {
                    state.currentPos = state.targetPos = ((widget.value - min) / range) * 100;
                }

                // Create container for label + slider
                const container = $el("div", {
                    style: {
                        width: "100%",
                        marginBottom: "8px",
                        padding: "4px 0"
                    }
                });

                // Create label
                const label = $el("div", {
                    style: {
                        fontSize: "11px",
                        color: "#aaa",
                        marginBottom: "4px",
                        display: "flex",
                        justifyContent: "space-between"
                    }
                });

                const labelName = $el("span", {
                    textContent: widget.name,
                    style: { fontWeight: "500" }
                });

                // Calculate appropriate decimal places based on step
                const decimals = step < 1 ? Math.max(2, String(step).split('.')[1]?.length || 2) : 0;

                const labelValue = $el("span", {
                    textContent: widget.value.toFixed(decimals),
                    style: { color: "#fff" }
                });

                label.appendChild(labelName);
                label.appendChild(labelValue);

                // Create track
                const track = $el("div", {
                    style: {
                        width: "100%",
                        height: "6px",
                        background: "#222222ff",
                        borderRadius: "3px",
                        position: "relative",
                        cursor: "pointer",
                        boxShadow: "inset 0 2px 3px rgba(0, 0, 0, 0.45), inset 0 -1px 1px rgba(255, 255, 255, 0.05)",
                    }
                });

                // Create scale marks (10 divisions inside track)
                const scaleContainer = $el("div", {
                    style: {
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                        top: "0",
                        left: "0",
                        pointerEvents: "none", // Don't interfere with track clicks
                    }
                });

                // Create 9 tick marks (10%, 20%, ..., 90%), excluding 0% and 100%
                for (let i = 1; i <= 9; i++) {
                    const position = i * 10; // 10, 20, 30, ..., 90
                    const isMajor = i === 5; // Major tick at 50%
                    
                    const tick = $el("div", {
                        style: {
                            position: "absolute",
                            left: position + "%",
                            top: "50%",
                            transform: "translate(-50%, -50%)",
                            width: "1px",
                            height: isMajor ? "4px" : "3px",
                            background: isMajor ? "#666" : "#555",
                            opacity: isMajor ? "0.5" : "0.35",
                        }
                    });
                    scaleContainer.appendChild(tick);
                }

                track.appendChild(scaleContainer);

                // Create thumb
                const thumb = $el("div", {
                    style: {
                        width: "16px",
                        height: "16px",
                        background: "#aaaaaaff",
                        borderRadius: "50%",
                        position: "absolute",
                        top: "50%",
                        left: state.currentPos + "%",
                        transform: "translate(-50%, -50%)",
                        cursor: "grab",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                        transition: "left 0.1s ease-out, transform 0.1s ease",
                        zIndex: "10", // Ensure thumb is above scale marks
                    }
                });

                track.appendChild(thumb);
                container.appendChild(label);
                container.appendChild(track);

                // Animation function
                const animate = () => {
                    const diff = state.targetPos - state.currentPos;
                    if (Math.abs(diff) > 0.5) {
                        state.currentPos += diff * 0.5;
                        thumb.style.left = state.currentPos + "%";
                        state.animationFrameId = requestAnimationFrame(animate);
                    } else {
                        state.currentPos = state.targetPos;
                        thumb.style.left = state.currentPos + "%";
                        if (state.animationFrameId) {
                            cancelAnimationFrame(state.animationFrameId);
                            state.animationFrameId = null;
                        }
                    }
                };

                // Update value from position
                const setValueFromEvent = (clientX, isShiftKey = false) => {
                    const rect = track.getBoundingClientRect();
                    let offsetX = clientX - rect.left;
                    offsetX = Math.max(0, Math.min(rect.width, offsetX));
                    state.targetPos = (offsetX / rect.width) * 100;

                    if (state.animationFrameId) {
                        cancelAnimationFrame(state.animationFrameId);
                    }
                    state.animationFrameId = requestAnimationFrame(animate);

                    // Calculate value with step snapping
                    let rawValue = (state.targetPos / 100) * range + min;
                    
                    // Determine step based on Shift key (fine adjustment)
                    let activeStep = step;
                    if (isShiftKey) {
                        if (step < 1) {
                            // Float step: divide by 5 for fine adjustment
                            activeStep = step / 5;
                            // Ensure minimum step of 0.01 for fine adjustment
                            activeStep = Math.max(0.01, activeStep);
                        } else if (step > 1) {
                            // Integer step > 1: use step of 1 with Shift
                            activeStep = 1;
                        }
                        // step === 1: keep as 1 (no change)
                    }
                    
                    // Apply step snapping: round to nearest step
                    const stepCount = Math.round((rawValue - min) / activeStep);
                    let newValue = min + stepCount * activeStep;
                    
                    // Clamp to bounds and fix floating point precision
                    newValue = Math.min(max, Math.max(min, newValue));
                    
                    // Fix floating point precision issues
                    const decimals = activeStep < 1 ? Math.max(2, String(activeStep).split('.')[1]?.length || 2) : 0;
                    widget.value = parseFloat(newValue.toFixed(decimals));

                    // Update label with appropriate precision
                    labelValue.textContent = widget.value.toFixed(decimals);

                    if (widget.callback) {
                        widget.callback(widget.value);
                    }

                    this.setDirtyCanvas(true, false);
                };

                // Event handlers
                const handleMouseMove = (e) => {
                    if (!state.isDragging) return;
                    setValueFromEvent(e.clientX, e.shiftKey);
                };

                const handleMouseUp = (e) => {
                    if (state.isDragging) {
                        state.isDragging = false;
                        thumb.style.cursor = "grab";
                        thumb.style.transform = "translate(-50%, -50%) scale(1)";
                    }
                };

                const handleTouchMove = (e) => {
                    if (!state.isDragging) return;
                    // Touch events don't have shiftKey, use stored state from touchstart
                    setValueFromEvent(e.touches[0].clientX, state.shiftPressed || false);
                    e.preventDefault();
                };

                const handleTouchEnd = (e) => {
                    if (state.isDragging) {
                        state.isDragging = false;
                        thumb.style.transform = "translate(-50%, -50%) scale(1)";
                    }
                };

                const handleMouseDown = (e) => {
                    state.isDragging = true;
                    thumb.style.cursor = "grabbing";
                    thumb.style.transform = "translate(-50%, -50%) scale(1.2)";
                    setValueFromEvent(e.clientX, e.shiftKey);
                    e.preventDefault();
                };

                const handleTouchStart = (e) => {
                    state.isDragging = true;
                    state.shiftPressed = false; // Touch devices typically don't have shift
                    thumb.style.transform = "translate(-50%, -50%) scale(1.2)";
                    setValueFromEvent(e.touches[0].clientX);
                    e.preventDefault();
                };

                // Attach events
                track.addEventListener("mousedown", handleMouseDown);
                track.addEventListener("touchstart", handleTouchStart);
                document.addEventListener("mousemove", handleMouseMove);
                document.addEventListener("mouseup", handleMouseUp);
                document.addEventListener("touchmove", handleTouchMove);
                document.addEventListener("touchend", handleTouchEnd);

                // Add DOM widget
                this.addDOMWidget(`slider_${widget.name}`, "slider", container, {
                    getValue() {
                        return widget.value;
                    },
                    setValue(v) {
                        widget.value = v;
                        const currentDecimals = step < 1 ? Math.max(2, String(step).split('.')[1]?.length || 2) : 0;
                        labelValue.textContent = v.toFixed(currentDecimals);
                        // Update thumb position
                        const newPos = ((v - min) / range) * 100;
                        state.currentPos = state.targetPos = newPos;
                        thumb.style.left = newPos + "%";
                    }
                });

                // Listen for range updates from LoRA Config
                const rangeUpdateHandler = (event) => {
                    if (event.detail.nodeId === this.id && event.detail.widgetName === widget.name) {
                        const newRange = event.detail.range;
                        
                        // Update local range variables
                        min = newRange.min;
                        max = newRange.max;
                        step = newRange.step;
                        range = max - min;

                        // Clamp current value to new range
                        widget.value = Math.max(min, Math.min(max, widget.value));

                        // Update label
                        const newDecimals = step < 1 ? Math.max(2, String(step).split('.')[1]?.length || 2) : 0;
                        labelValue.textContent = widget.value.toFixed(newDecimals);

                        // Update thumb position
                        const newPos = range > 0 ? ((widget.value - min) / range) * 100 : 0;
                        state.currentPos = state.targetPos = newPos;
                        thumb.style.left = newPos + "%";
                    }
                };

                document.addEventListener('a1r-widget-range-update', rangeUpdateHandler);
                
                // Store handler for cleanup
                eventHandlers.push({
                    handleMouseMove,
                    handleMouseUp,
                    handleTouchMove,
                    handleTouchEnd,
                    rangeUpdateHandler
                });

                sliderStates.push(state);
            });

            // Cleanup on node removal
            const originalOnRemoved = this.onRemoved;
            this.onRemoved = () => {
                // Cancel all animations
                sliderStates.forEach(state => {
                    if (state.animationFrameId) {
                        cancelAnimationFrame(state.animationFrameId);
                    }
                });

                // Remove all event listeners
                eventHandlers.forEach(handlers => {
                    document.removeEventListener("mousemove", handlers.handleMouseMove);
                    document.removeEventListener("mouseup", handlers.handleMouseUp);
                    document.removeEventListener("touchmove", handlers.handleTouchMove);
                    document.removeEventListener("touchend", handlers.handleTouchEnd);
                    
                    if (handlers.rangeUpdateHandler) {
                        document.removeEventListener('a1r-widget-range-update', handlers.rangeUpdateHandler);
                    }
                });

                if (originalOnRemoved) {
                    originalOnRemoved.apply(this, arguments);
                }
            };

            const sliderCount = numericWidgets.length;
            const baseHeight = 35;
            const sliderHeight = 32;
            const margin = 8;
            const totalHeight = baseHeight + sliderCount * (sliderHeight + margin) + 20;

            if (window.A1rSpace_SizeFixer && window.A1rSpace_SizeFixer.registerDefaultSize) {
                if (!window.A1rSpace_SizeFixer.hasDefaultSize || !window.A1rSpace_SizeFixer.hasDefaultSize(nodeData.name)) {
                    window.A1rSpace_SizeFixer.registerDefaultSize(nodeData.name, [LiteGraph.NODE_WIDTH, totalHeight]);
                }
            }

            if (!this._a1r_size_data?.userModified && (!this.size || (this.size[1] < totalHeight * 0.8))) {
                this.size = [LiteGraph.NODE_WIDTH, totalHeight];
            }

            return result;
        };
    }
});