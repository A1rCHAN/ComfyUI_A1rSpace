// Boolean_to_Int: configure custom true/false integer outputs via right-click Properties
import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "A1rSpace.Boolean_to_Int.Properties",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        const names = [
            "Boolean_to_Int",
            "A1r Boolean to Int",
            "Boolean to Int",
        ];
        if (!names.includes(nodeData.name)) return;

        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        const originalOnPropertyChanged = nodeType.prototype.onPropertyChanged;
        const originalOnConfigure = nodeType.prototype.onConfigure;

        nodeType.prototype.onNodeCreated = function () {
            originalOnNodeCreated?.apply(this, arguments);
            if (this.__a1r_b2i_props_bound) return;

            const bind = () => {
                if (!Array.isArray(this.widgets)) {
                    requestAnimationFrame(bind);
                    return;
                }
                const wTrue = this.widgets.find((w) => w.name === "true_value");
                const wFalse = this.widgets.find((w) => w.name === "false_value");
                const wBool = this.widgets.find((w) => w.name === "input_bool");
                if (!(wTrue && wFalse)) return;

                this.__a1r_b2i_props_bound = true;

                // Hide INT widgets from main UI and make them read-only
                const hideWidget = (w) => {
                    if (!w) return;
                    w.read_only = true;
                    w.hidden = true;
                    w.computeSize = () => [0, -4];
                    w.draw = () => {};
                };
                hideWidget(wTrue);
                hideWidget(wFalse);

                // Ensure properties exist and sync from widgets initially
                this.properties = this.properties || {};
                if (typeof this.properties.true_value !== "number") {
                    this.properties.true_value = Number(wTrue.value ?? 1) || 1;
                }
                if (typeof this.properties.false_value !== "number") {
                    this.properties.false_value = Number(wFalse.value ?? 0) || 0;
                }

                // Labels for the visual switch
                if (typeof this.properties.true_label !== "string") {
                    this.properties.true_label = "True";
                }
                if (typeof this.properties.false_label !== "string") {
                    this.properties.false_label = "False";
                }

                // Keep widgets in sync with properties at init
                wTrue.value = this.properties.true_value;
                wFalse.value = this.properties.false_value;

                // Also ensure widget callbacks update properties if changed programmatically
                const origTrueCb = wTrue.callback;
                const origFalseCb = wFalse.callback;
                wTrue.callback = (v) => {
                    origTrueCb?.call(this, v, wTrue, this);
                    const nv = Number(wTrue.value);
                    if (!Number.isNaN(nv)) this.properties.true_value = nv;
                };
                wFalse.callback = (v) => {
                    origFalseCb?.call(this, v, wFalse, this);
                    const nv = Number(wFalse.value);
                    if (!Number.isNaN(nv)) this.properties.false_value = nv;
                };

                // Remove input sockets for INT widgets to avoid line connections
                const removeInputsByNames = (names) => {
                    if (!Array.isArray(this.inputs)) return;
                    // iterate backwards to avoid index shift on removal
                    for (let i = this.inputs.length - 1; i >= 0; i--) {
                        const inp = this.inputs[i];
                        if (inp && names.includes(inp.name)) {
                            try { this.disconnectInput?.(i); } catch {}
                            try { this.removeInput?.(i); } catch {}
                        }
                    }
                    this.setDirtyCanvas?.(true, true);
                    this.graph?.setDirtyCanvas?.(true, true);
                };
                removeInputsByNames(["true_value", "false_value"]);

                // Custom UI for input_bool: draw a left-right switch with labels
                if (wBool) {
                    const origBoolCb = wBool.callback;
                    wBool.label = ""; // hide default label text
                    // allow user interaction
                    wBool.disabled = false;
                    wBool.read_only = false;
                    // remember last value to detect external updates
                    this.__a1r_b2i_prevBool = !!wBool.value;
                    // watcher to refresh UI when value changes programmatically
                    const watch = () => {
                        if (!this.widgets || !this.graph) return; // node disposed
                        const cur = !!wBool.value;
                        if (this.__a1r_b2i_prevBool !== cur) {
                            this.__a1r_b2i_prevBool = cur;
                            this.setDirtyCanvas?.(true, true);
                            this.graph?.setDirtyCanvas?.(true, true);
                        }
                        requestAnimationFrame(watch);
                    };
                    requestAnimationFrame(watch);
                    // make sure our widget has a decent height
                    wBool.computeSize = (width) => [width ?? 180, 32];
                    wBool.draw = (ctx, node, widgetWidth, y, H) => {
                        const width = widgetWidth ?? 180;
                        const height = H ?? 28;
                        const padX = 10;
                        const trackW = Math.max(60, width - padX * 2); // responsive width
                        const trackH = 20;
                        const left = (width - trackW) / 2; // center horizontally
                        const top = y + (height - trackH) / 2; // center vertically within widget area
                        const right = left + trackW;
                        const bottom = top + trackH;
                        const cy = top + trackH / 2;
                        const r = trackH / 2;
                        // background
                        ctx.save();
                        ctx.translate(0, 0);
                        // track
                        ctx.beginPath();
                        // same color regardless of state
                        ctx.fillStyle = "#666";
                        // rounded rect
                        const rr = r;
                        ctx.moveTo(left + rr, top);
                        ctx.arcTo(right, top, right, bottom, rr);
                        ctx.arcTo(right, bottom, left, bottom, rr);
                        ctx.arcTo(left, bottom, left, top, rr);
                        ctx.arcTo(left, top, right, top, rr);
                        ctx.closePath();
                        ctx.fill();

                        // knob
                        const knobR = r - 2;
                        const knobCx = wBool.value ? (right - rr) : (left + rr);
                        ctx.beginPath();
                        ctx.fillStyle = "#eee";
                        ctx.arc(knobCx, cy, knobR, 0, Math.PI * 2);
                        ctx.fill();

                        // single centered label for current state
                        ctx.font = "12px sans-serif";
                        ctx.textBaseline = "middle";
                        ctx.textAlign = "center";
                        const label = wBool.value
                            ? String(this.properties.true_label ?? "True")
                            : String(this.properties.false_label ?? "False");
                        ctx.fillStyle = "#ffffff";
                        ctx.fillText(label, (left + right) / 2, cy);
                        ctx.restore();
                    };
                    // Ensure canvas updates when toggled
                    wBool.callback = (v) => {
                        this.__a1r_b2i_prevBool = !!wBool.value;
                        origBoolCb?.call(this, wBool.value, wBool, this);
                        this.setDirtyCanvas?.(true, true);
                        this.graph?.setDirtyCanvas?.(true, true);
                    };

                    // Allow click anywhere on the track to toggle
                    wBool.mouse = (event, pos) => {
                        if (event && (event.type === "mousedown" || event.type === "pointerdown" || event.type === "click")) {
                            wBool.value = !wBool.value;
                            wBool.callback?.(wBool.value);
                            return true; // consume event
                        }
                        return false;
                    };
                }
            };
            bind();
        };
        // On configure (graph load), ensure INT inputs stay removed
        nodeType.prototype.onConfigure = function () {
            const r = originalOnConfigure?.apply(this, arguments);
            if (Array.isArray(this.inputs)) {
                // remove any resurrected int inputs
                for (let i = this.inputs.length - 1; i >= 0; i--) {
                    const inp = this.inputs[i];
                    if (inp && (inp.name === "true_value" || inp.name === "false_value")) {
                        try { this.disconnectInput?.(i); } catch {}
                        try { this.removeInput?.(i); } catch {}
                    }
                }
                this.setDirtyCanvas?.(true, true);
                this.graph?.setDirtyCanvas?.(true, true);
            }
            return r;
        };

        // When user edits Properties, reflect into hidden widgets so backend gets correct inputs
        nodeType.prototype.onPropertyChanged = function (name, value) {
            const r = originalOnPropertyChanged?.apply(this, arguments);
            if (!Array.isArray(this.widgets)) return r;
            if (name === "true_value") {
                const w = this.widgets.find((w) => w.name === "true_value");
                const nv = Number(value);
                if (w && !Number.isNaN(nv)) w.value = nv;
            } else if (name === "false_value") {
                const w = this.widgets.find((w) => w.name === "false_value");
                const nv = Number(value);
                if (w && !Number.isNaN(nv)) w.value = nv;
            } else if (name === "true_label" || name === "false_label") {
                // just trigger redraw
            }
            this.setDirtyCanvas?.(true, true);
            this.graph?.setDirtyCanvas?.(true, true);
            return r;
        };
    },
});
