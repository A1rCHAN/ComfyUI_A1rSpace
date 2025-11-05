import { app } from "/scripts/app.js";

app.registerExtension({
    name: "A1r.VAEDecodeTransform",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "A1r VAE Decode Transform") return;

        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        const originalOnAdded = nodeType.prototype.onAdded;
        const originalOnConfigure = nodeType.prototype.onConfigure;

        nodeType.prototype.onNodeCreated = function () {
            const result = originalOnNodeCreated?.apply(this, arguments);

            // Add properties for Tiled mode parameters
            this.addProperty("tile_size", 512, "number");
            this.addProperty("overlap", 64, "number");
            this.addProperty("temporal_size", 64, "number");
            this.addProperty("temporal_overlap", 8, "number");

            // Get decode, tiled, and preview widgets
            const decodeWidget = this.widgets?.find(w => w.name === "decode");
            const tiledWidget = this.widgets?.find(w => w.name === "tiled");
            const previewWidget = this.widgets?.find(w => w.name === "preview");
            
            if (!decodeWidget || !tiledWidget || !previewWidget) return result;

            // Hide optional widgets
            const hideWidget = (widget) => {
                if (!widget) return;
                widget.type = "hidden";
                widget.computeSize = () => [0, -4];
                widget.hidden = true;
                if (typeof widget.serialize !== "function") {
                    widget.serializeValue = () => widget.value;
                }
            };

            // Find and hide optional widgets
            const tileSizeWidget = this.widgets?.find(w => w.name === "tile_size");
            const overlapWidget = this.widgets?.find(w => w.name === "overlap");
            const temporalSizeWidget = this.widgets?.find(w => w.name === "temporal_size");
            const temporalOverlapWidget = this.widgets?.find(w => w.name === "temporal_overlap");

            if (tileSizeWidget) hideWidget(tileSizeWidget);
            if (overlapWidget) hideWidget(overlapWidget);
            if (temporalSizeWidget) hideWidget(temporalSizeWidget);
            if (temporalOverlapWidget) hideWidget(temporalOverlapWidget);

            // Remove input ports for hidden widgets
            const removeInputByNames = (names) => {
                if (!Array.isArray(this.inputs)) return;
                for (let i = this.inputs.length - 1; i >= 0; i--) {
                    const inp = this.inputs[i];
                    if (inp && names.includes(inp.name)) {
                        this.removeInput?.(i);
                    }
                }
            };
            removeInputByNames(["tile_size", "overlap", "temporal_size", "temporal_overlap"]);

            // Setup widget interaction logic:
            // - decode: independent control
            // - tiled or preview: when either is enabled, decode must be enabled
            // - tiled and preview: independent of each other
            
            const updateDecodeState = () => {
                // If tiled or preview is enabled, decode must be enabled
                if (tiledWidget.value || previewWidget.value) {
                    decodeWidget.value = true;
                }
            };

            // Store original callback functions
            const originalDecodeCallback = decodeWidget.callback;
            const originalTiledCallback = tiledWidget.callback;
            const originalPreviewCallback = previewWidget.callback;

            // Override decode widget callback
            decodeWidget.callback = function(value) {
                // If decode is disabled, force disable tiled and preview
                if (!value) {
                    tiledWidget.value = false;
                    previewWidget.value = false;
                }
                
                if (originalDecodeCallback) {
                    originalDecodeCallback.call(this, value);
                }
            };

            // Override tiled widget callback
            tiledWidget.callback = function(value) {
                // If tiled is enabled, ensure decode is enabled
                if (value) {
                    decodeWidget.value = true;
                }
                
                if (originalTiledCallback) {
                    originalTiledCallback.call(this, value);
                }
            };

            // Override preview widget callback
            previewWidget.callback = function(value) {
                // If preview is enabled, ensure decode is enabled
                if (value) {
                    decodeWidget.value = true;
                }
                
                if (originalPreviewCallback) {
                    originalPreviewCallback.call(this, value);
                }
            };

            // Initial state check
            updateDecodeState();

            // Sync properties to widgets for backend calls
            const syncPropertiesToWidgets = () => {
                if (tileSizeWidget) tileSizeWidget.value = this.properties.tile_size;
                if (overlapWidget) overlapWidget.value = this.properties.overlap;
                if (temporalSizeWidget) temporalSizeWidget.value = this.properties.temporal_size;
                if (temporalOverlapWidget) temporalOverlapWidget.value = this.properties.temporal_overlap;
            };

            // Property change handler
            const originalOnPropertyChanged = this.onPropertyChanged;
            this.onPropertyChanged = function(propName, value) {
                if (originalOnPropertyChanged) {
                    originalOnPropertyChanged.call(this, propName, value);
                }

                // Sync properties to widgets
                syncPropertiesToWidgets();

                // Trigger redraw
                this.setDirtyCanvas?.(true, true);
            };

            // Initialize: sync properties
            syncPropertiesToWidgets();

            return result;
        };

        // Recalculate size after node is added
        nodeType.prototype.onAdded = function() {
            const r = originalOnAdded?.apply(this, arguments);
            
            // Recalculate node size to fit visible widgets
            if (typeof this.computeSize === 'function') {
                this.setSize(this.computeSize());
            }
            
            return r;
        };

        // Recalculate size and sync properties after configuration is loaded
        nodeType.prototype.onConfigure = function(info) {
            const r = originalOnConfigure?.apply(this, arguments);
            
            // Find widgets and sync properties
            const decodeWidget = this.widgets?.find(w => w.name === "decode");
            const tiledWidget = this.widgets?.find(w => w.name === "tiled");
            const previewWidget = this.widgets?.find(w => w.name === "preview");
            const tileSizeWidget = this.widgets?.find(w => w.name === "tile_size");
            const overlapWidget = this.widgets?.find(w => w.name === "overlap");
            const temporalSizeWidget = this.widgets?.find(w => w.name === "temporal_size");
            const temporalOverlapWidget = this.widgets?.find(w => w.name === "temporal_overlap");

            if (tileSizeWidget) tileSizeWidget.value = this.properties.tile_size;
            if (overlapWidget) overlapWidget.value = this.properties.overlap;
            if (temporalSizeWidget) temporalSizeWidget.value = this.properties.temporal_size;
            if (temporalOverlapWidget) temporalOverlapWidget.value = this.properties.temporal_overlap;
            
            // Validate state consistency after loading
            if (decodeWidget && tiledWidget && previewWidget) {
                // If tiled or preview is enabled, ensure decode is enabled
                if ((tiledWidget.value || previewWidget.value) && !decodeWidget.value) {
                    decodeWidget.value = true;
                }
            }
            
            // Recalculate node size
            if (typeof this.computeSize === 'function') {
                this.setSize(this.computeSize());
            }
            
            return r;
        };
    }
});
