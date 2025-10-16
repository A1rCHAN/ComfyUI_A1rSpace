import { app } from "../../../scripts/app.js";

/*
 * LoRA Config dynamic range adjustment
 * Updates slider ranges when the "range" widget value changes
 */

// Range configurations matching backend FloatConfig
const RANGE_CONFIGS = {
    "mini": { min: -0.5, max: 0.5, step: 0.05 },
    "standard": { min: -1.0, max: 1.0, step: 0.05 },
    "extended": { min: -2.0, max: 2.0, step: 0.05 },
    "wide": { min: -3.0, max: 3.0, step: 0.05 },
    "large": { min: -4.0, max: 4.0, step: 0.05 }
};

app.registerExtension({
    name: "A1rSpace.LoRAConfig",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "A1r LoRA Config") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const result = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

            // Find widgets
            const rangeWidget = this.widgets?.find(w => w.name === "range");
            const modelStrengthWidget = this.widgets?.find(w => w.name === "model_strength");
            const clipStrengthWidget = this.widgets?.find(w => w.name === "clip_strength");

            if (!rangeWidget || !modelStrengthWidget || !clipStrengthWidget) {
                return result;
            }

            // Store original callback
            const originalRangeCallback = rangeWidget.callback;

            // Update range configuration
            const updateRange = (rangeName) => {
                const config = RANGE_CONFIGS[rangeName];
                if (!config) return;

                // Update model_strength widget
                modelStrengthWidget.options.min = config.min;
                modelStrengthWidget.options.max = config.max;
                modelStrengthWidget.options.step = config.step;
                
                // Clamp current value to new range
                modelStrengthWidget.value = Math.max(
                    config.min,
                    Math.min(config.max, modelStrengthWidget.value)
                );

                // Update clip_strength widget
                clipStrengthWidget.options.min = config.min;
                clipStrengthWidget.options.max = config.max;
                clipStrengthWidget.options.step = config.step;
                
                // Clamp current value to new range
                clipStrengthWidget.value = Math.max(
                    config.min,
                    Math.min(config.max, clipStrengthWidget.value)
                );

                // Trigger slider UI updates by dispatching custom event
                // The slider_widget_style.js will need to listen to this
                const event = new CustomEvent('a1r-widget-range-update', {
                    detail: {
                        nodeId: this.id,
                        widgetName: 'model_strength',
                        range: config
                    }
                });
                document.dispatchEvent(event);

                const event2 = new CustomEvent('a1r-widget-range-update', {
                    detail: {
                        nodeId: this.id,
                        widgetName: 'clip_strength',
                        range: config
                    }
                });
                document.dispatchEvent(event2);

                // Mark canvas as dirty to redraw
                this.setDirtyCanvas(true, false);
            };

            // Override range widget callback
            rangeWidget.callback = function (value) {
                updateRange(value);
                
                // Call original callback if exists
                if (originalRangeCallback) {
                    originalRangeCallback.apply(this, arguments);
                }
            };

            // Initialize with current range value
            updateRange(rangeWidget.value || "standard");

            return result;
        };
    }
});
