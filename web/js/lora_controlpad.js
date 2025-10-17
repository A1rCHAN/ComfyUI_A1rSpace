import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "A1rSpace.LoRA.ControlPad",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "A1r LoRA ControlPad") return;

        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            originalOnNodeCreated?.apply(this, arguments);
            if (this._a1r_lora_cp_bound) return;

            const bind = () => {
                if (!Array.isArray(this.widgets)) {
                    requestAnimationFrame(bind);
                    return;
                }
                const widgetAll = this.widgets.find((w) => w.name === "toggle_all");
                const widget1 = this.widgets.find((w) => w.name === "lora_1");
                const widget2 = this.widgets.find((w) => w.name === "lora_2");
                const widget3 = this.widgets.find((w) => w.name === "lora_3");
                const widget4 = this.widgets.find((w) => w.name === "lora_4");
                const widget5 = this.widgets.find((w) => w.name === "lora_5");
                const widget6 = this.widgets.find((w) => w.name === "lora_6");
                const allLoraWidgets = [widget1, widget2, widget3, widget4, widget5, widget6];
                if (!(widgetAll && allLoraWidgets.every(w => !!w))) return;

                this._a1r_lora_cp_bound = true;

                const updateAllLoras = (value) => {
                    allLoraWidgets.forEach(widget => { widget.value = value; });
                    this.setDirtyCanvas?.(true, true);
                    this.graph?.setDirtyCanvas?.(true, true);
                };

                const checkAndUpdateToggleAll = () => {
                    const anyEnabled = allLoraWidgets.some(widget => widget.value === true);
                    const allDisabled = allLoraWidgets.every(widget => widget.value === false);
                    if (anyEnabled && widgetAll.value === false) {
                        widgetAll.value = true;
                        this.setDirtyCanvas?.(true, true);
                        this.graph?.setDirtyCanvas?.(true, true);
                    } else if (allDisabled && widgetAll.value === true) {
                        widgetAll.value = false;
                        this.setDirtyCanvas?.(true, true);
                        this.graph?.setDirtyCanvas?.(true, true);
                    }
                };

                const originalAllCallback = widgetAll.callback;
                widgetAll.callback = (value) => {
                    originalAllCallback?.call(this, value, widgetAll, this);
                    if (value === true) {
                        updateAllLoras(true);
                    } else if (value === false) {
                        updateAllLoras(false);
                    }
                };

                allLoraWidgets.forEach(widget => {
                    const originalCallback = widget.callback;
                    widget.callback = (value) => {
                        originalCallback?.call(this, value, widget, this);
                        checkAndUpdateToggleAll();
                        this.setDirtyCanvas?.(true, true);
                        this.graph?.setDirtyCanvas?.(true, true);
                    };
                });

                if (widgetAll.value === true && !allLoraWidgets.every(w => w.value === true)) {
                    updateAllLoras(true);
                }
                checkAndUpdateToggleAll();
            };
            bind();
        };
    }
});