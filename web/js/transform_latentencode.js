import { app } from "/scripts/app.js";

app.registerExtension({
    name: "A1r.LatentEncodeTransform",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        const NODE_WHITELIST = [
            "A1r Latent Encode Transform"
        ];

        if (!NODE_WHITELIST.includes(nodeData.name)) return;

        // 保存/恢复 hook：序列化和 configure（反序列化）
        const origOnSerialize = nodeType.prototype.onSerialize;
        nodeType.prototype.onSerialize = function(info) {
            if (origOnSerialize) origOnSerialize.apply(this, arguments);

            try {
                // Capture current relevant widget values for robust restore
                const modeWidget = this.widgets?.find(w => w.name === "mode");
                const widthWidget = this.widgets?.find(w => w.name === "width");
                const heightWidget = this.widgets?.find(w => w.name === "height");
                const batchSizeWidget = this.widgets?.find(w => w.name === "batch_size");

                info._a1r_latent_encode = info._a1r_latent_encode || {};
                if (modeWidget) info._a1r_latent_encode.mode = modeWidget.value;
                if (widthWidget) info._a1r_latent_encode.width = widthWidget.value;
                if (heightWidget) info._a1r_latent_encode.height = heightWidget.value;
                if (batchSizeWidget) info._a1r_latent_encode.batch_size = batchSizeWidget.value;
            } catch (e) {
                // ignore
            }
        };

        const origConfigure = nodeType.prototype.configure;
        nodeType.prototype.configure = function(cfg) {
            // Store widgets_values for use in onConfigure within the instance
            this._a1r_savedWidgets = cfg?.widgets_values;
            return origConfigure ? origConfigure.apply(this, arguments) : undefined;
        };

        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const result = originalOnNodeCreated?.apply(this, arguments);

            // 获取相关小部件
            const modeWidget = this.widgets?.find(w => w.name === "mode");
            const widthWidget = this.widgets?.find(w => w.name === "width");
            const heightWidget = this.widgets?.find(w => w.name === "height");
            const batchSizeWidget = this.widgets?.find(w => w.name === "batch_size");

            // 辅助：设置小部件为只读/可写
            const setWidgetReadonly = (widget, readonly) => {
                if (!widget) return;

                if (readonly) {
                    widget.disabled = true;
                    widget.options = widget.options || {};
                    widget.options.disabled = true;
                } else {
                    widget.disabled = false;
                    if (widget.options) {
                        widget.options.disabled = false;
                    }
                }
            };

            // 根据 mode 更新只读状态
            const updateReadonly = (mode) => {
                // 当 mode 为 'image to image' 时，width/height/batch_size 只读
                if (mode === 'image to image') {
                    setWidgetReadonly(widthWidget, true);
                    setWidgetReadonly(heightWidget, true);
                    setWidgetReadonly(batchSizeWidget, true);
                } else {
                    // 'text to image'：都可编辑
                    setWidgetReadonly(widthWidget, false);
                    setWidgetReadonly(heightWidget, false);
                    setWidgetReadonly(batchSizeWidget, false);
                }

                // 强制刷新节点布局与画布
                try {
                    this.setSize?.(this.computeSize?.());
                    this.setDirtyCanvas?.(true, true);
                } catch (e) {
                    // ignore
                }
            };

            // 在 onConfigure 时重新应用（例如重载/恢复状态）
            const originalOnConfigure = this.onConfigure;
            this.onConfigure = function() {
                const r = originalOnConfigure?.apply(this, arguments);
                updateReadonly(modeWidget?.value);
                return r;
            };

            if (modeWidget) {
                const originalCallback = modeWidget.callback;
                modeWidget.callback = function(value) {
                    if (originalCallback) originalCallback.apply(this, arguments);
                    updateReadonly(value);
                };

                // 初始化一次
                updateReadonly(modeWidget.value);
            } else {
                // 如果没有 mode 小部件，仍对控件做默认处理
                updateReadonly(null);
            }

            return result;
        };
    }
});