// TODO: Implement the custom logic for the BOOLEAN_AB node. update boolean buttom.
import { app } from "/scripts/app.js";

app.registerExtension({
    name: "A1rSpace.Boolean_AB",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        const names = [
            "Boolean_AB",            // 类名
            "A1r Boolean AB",        // 映射键
            "Boolean A&B"            // 显示名
        ];
        if (!names.includes(nodeData.name)) return;

        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            originalOnNodeCreated?.apply(this, arguments);
            if (this.__a1r_bab_alwaysone) return; // 防重复

            const bind = () => {
                if (!Array.isArray(this.widgets)) {
                    requestAnimationFrame(bind);
                    return;
                }
                const widgetA = this.widgets.find((w) => w.name === "enable_a");
                const widgetB = this.widgets.find((w) => w.name === "enable_b");
                if (!(widgetA && widgetB)) return;

                this.__a1r_bab_alwaysone = true;

                const updateWidgets = (changedWidget, otherWidget) => {
                    if (changedWidget.value === true) {
                        otherWidget.value = false;
                    } else if (changedWidget.value === false) {
                        if (otherWidget.value === false) {
                            changedWidget.value = true; // 保证至少一个为 true
                        }
                    }
                    this.setDirtyCanvas?.(true, true);
                    this.graph?.setDirtyCanvas?.(true, true);
                };

                const originalCallbackA = widgetA.callback;
                const originalCallbackB = widgetB.callback;

                widgetA.callback = (value) => {
                    originalCallbackA?.call(this, value, widgetA, this);
                    updateWidgets(widgetA, widgetB);
                };
                widgetB.callback = (value) => {
                    originalCallbackB?.call(this, value, widgetB, this);
                    updateWidgets(widgetB, widgetA);
                };

                // 初始化：若都 false，设 A=true；若都 true，设 B=false
                if (!widgetA.value && !widgetB.value) {
                    widgetA.value = true;
                } else if (widgetA.value && widgetB.value) {
                    widgetB.value = false;
                }
                this.setDirtyCanvas?.(true, true);
                this.graph?.setDirtyCanvas?.(true, true);
            };
            bind();
        };
    }
});