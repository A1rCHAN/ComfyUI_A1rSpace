// Enforce dependency: when ckpt_separate (B) is enabled, ensure lora_separate (A) is also enabled.
import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "A1rSpace.Ab_Checkpoint_Mutex",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // Match by class name and mapping/display names to be robust
        const names = [
            "Ab_Checkpoint",
            "A1r Ab Checkpoint",
            "A&B Checkpoint",
        ];
        if (!names.includes(nodeData.name)) return;

        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            originalOnNodeCreated?.apply(this, arguments);
            if (this.__a1r_abckpt_mutex_bound) return; // avoid duplicate binding

            const bind = () => {
                if (!Array.isArray(this.widgets)) {
                    requestAnimationFrame(bind);
                    return;
                }
                const widgetA = this.widgets.find((w) => w.name === "lora_separate");
                const widgetB = this.widgets.find((w) => w.name === "ckpt_separate");
                if (!(widgetA && widgetB)) return;

                this.__a1r_abckpt_mutex_bound = true;

                const originalCallbackA = widgetA.callback;
                const originalCallbackB = widgetB.callback;

                widgetA.callback = (value) => {
                    // A changes do not affect B
                    originalCallbackA?.call(this, value, widgetA, this);
                    this.setDirtyCanvas?.(true, true);
                    this.graph?.setDirtyCanvas?.(true, true);
                };
                widgetB.callback = (value) => {
                    originalCallbackB?.call(this, value, widgetB, this);
                    // If enabling B while A is false, enable A as well
                    if (widgetB.value === true && widgetA.value === false) {
                        widgetA.value = true;
                    }
                    // Disabling B does not change A
                    this.setDirtyCanvas?.(true, true);
                    this.graph?.setDirtyCanvas?.(true, true);
                };

                // initialize: if B is true while A is false, enable A
                if (widgetB.value === true && widgetA.value === false) {
                    widgetA.value = true;
                }
                this.setDirtyCanvas?.(true, true);
                this.graph?.setDirtyCanvas?.(true, true);
            };
            bind();
        };
    },
});
