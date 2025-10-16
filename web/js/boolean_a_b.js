import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "A1rSpace.Boolean_A_B",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "A1r Boolean A B") return;

        const originalCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            originalCreated?.apply(this, arguments);
            if (this._a1r_bab_bound) return; // 防重复

            const bind = () => {
                if (!Array.isArray(this.widgets)) {
                    requestAnimationFrame(bind);
                    return;
                }
                const widgetA = this.widgets.find((w) => w.name === "enable_a");
                const widgetB = this.widgets.find((w) => w.name === "enable_b");
                if (!(widgetA && widgetB)) return; // 无部件则放弃

                this._a1r_bab_bound = true;
                const originalCallbackA = widgetA.callback;
                const originalCallbackB = widgetB.callback;

                widgetA.callback = (value) => {
                    originalCallbackA?.call(this, value, widgetA, this);
                    widgetA.value = value;
                    if (value === false) {
                        widgetB.value = false;
                    }
                    this.setDirtyCanvas?.(true, true);
                    this.graph?.setDirtyCanvas?.(true, true);
                };

                widgetB.callback = (value) => {
                    originalCallbackB?.call(this, value, widgetB, this);
                    if (widgetA.value === false && value === true) {
                        widgetA.value = true;
                        widgetB.value = true;
                    } else {
                        widgetB.value = value;
                    }
                    this.setDirtyCanvas?.(true, true);
                    this.graph?.setDirtyCanvas?.(true, true);
                };

                // 初始化值
                if (widgetA.value === undefined || widgetB.value === undefined) {
                    widgetA.value = true;
                    widgetB.value = false;
                    this.setDirtyCanvas?.(true, true);
                    this.graph?.setDirtyCanvas?.(true, true);
                }
            };
            bind();
        };
    }
});