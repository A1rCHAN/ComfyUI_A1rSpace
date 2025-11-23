import { app } from "/scripts/app.js";
import { ComfyWidgets } from "/scripts/widgets.js";

/*
 * Display entered text with Read-Only type, have a clipboard copy button.
 */
app.registerExtension({
    name: "A1rSpace.TextShow",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "A1r Text Show") return;

        // ====== Copy Tool functions ======

        /*
         * Copy text to clipboard.
         * @param {string} text - The text to copy.
         * @returns {boolean} - True if the text was copied successfully, false otherwise.
         */

        const copyToClipboard = async (text) => {
            // Use Clipboard API.
            try {
                if (navigator?.clipboard?.writeText) {
                    await navigator.clipboard.writeText(text ?? "");
                    return true;
                }
            } catch {}

            // Compatibility solution.
            try {
                const ta = document.createElement('textarea');
                ta.value = text ?? "";
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(ta);
                return ok;
            } catch {
                return false;
            }
        };

        /*
         * Create 'copy to clipboard' button.
         * @param {HTMLElement} host - The host element to attach the button to.
         * @param {Function} copyHandler - The function to handle the copy action.
         * @returns {HTMLButtonElement} - The created button element.
         */
        const createCopyButton = (host, copyHandler) => {
            // Ensure the container position.
            if (getComputedStyle(host).position === 'static') {
                host.style.position = 'relative';
            }

            // Create the button.
            const copyBtn = document.createElement('button');
            copyBtn.textContent = 'copy to clipboard';
            copyBtn.title = 'Copy to clipboard';
            copyBtn.style.position = 'absolute';
            copyBtn.style.left = '1px';
            copyBtn.style.right = '1px';
            copyBtn.style.bottom = '1px';
            copyBtn.style.width = 'auto';
            copyBtn.style.height = '28px';
            copyBtn.style.boxSizing = 'border-box';

            copyBtn.style.fontSize = '12px';
            copyBtn.style.lineHeight = '28px';
            copyBtn.style.border = 'none';
            copyBtn.style.borderTop = '1px solid #333';
            copyBtn.style.borderRadius = '0 0 4px 4px';
            copyBtn.style.marginTop = '0';

            copyBtn.style.background = '#222';
            copyBtn.style.color = '#ccc';
            copyBtn.style.textAlign = 'center';

            copyBtn.style.cursor = 'pointer';
            copyBtn.style.userSelect = 'none';
            copyBtn.style.pointerEvents = 'auto';
            copyBtn.style.zIndex = 10;

            // MouseEvents
            copyBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (await copyHandler()) {
                    copyBtn.textContent = 'copied successfully';
                } else {
                    copyBtn.textContent = 'failed to copy';
                }
                setTimeout(() => { copyBtn.textContent = 'copy to clipboard'; }, 700);
            });

            host.appendChild(copyBtn);
            return copyBtn;
        };

        /*
         * Ensure the text display widget exists, create if not.
         */
        const ensureDisplayWidget = function() {
            if (!Array.isArray(this.widgets)) this.widgets = [];

            if (this._a1r_textWidget) return this._a1r_textWidget;

            // Create a Read-Only string display control.
            const created = ComfyWidgets.STRING(this, "text_display", ["STRING", { multiline: true }], app);
            const w = created?.widget;
            if (!w) return null;

            // Set styles
            if (w.inputEl) {
                // Make it read-only but allow interaction (scrolling/selection)
                w.inputEl.readOnly = true;
                // w.inputEl.style.opacity = 0.85;
                // w.inputEl.style.pointerEvents = "none";
                // w.inputEl.style.userSelect = "none";

                if (getComputedStyle(w.inputEl).position === 'static') {
                    w.inputEl.style.position = 'relative';
                }

                // Avoid buttons blocking the text.
                try {
                    // Reserve space for the button at the bottom
                    w.inputEl.style.height = '100%';
                    w.inputEl.style.boxSizing = 'border-box';
                    const pb = parseInt(getComputedStyle(w.inputEl).paddingBottom || '0', 10) || 0;
                    w.inputEl.style.paddingBottom = (pb + 30) + 'px';
                } catch {}

                // Add copy button.
                const host = w.inputEl.parentElement || w.inputEl;
                if (host && !w._a1r_copyBtnIn) {
                    const copyHandler = async () => await copyToClipboard(w.value ?? "");
                    const copyBtn = createCopyButton(host, copyHandler);
                    w._a1r_copyBtnIn = copyBtn;

                    // Check the visibility of the button and adjust its position.
                    setTimeout(() => {
                        try {
                            const rect = copyBtn.getBoundingClientRect();
                            const visible = rect && rect.width > 0 && rect.height > 0 && getComputedStyle(copyBtn).visibility !== 'hidden';
                            if (!visible) {
                                const container = host.parentElement || host;
                                if (container) {
                                    if (getComputedStyle(container).position === 'static') {
                                        container.style.position = 'relative';
                                    }
                                    copyBtn.style.right = '4px';
                                    copyBtn.style.bottom = '4px';
                                    copyBtn.style.zIndex = 50;
                                    container.appendChild(copyBtn);
                                }
                            }
                        } catch {}
                    }, 0);
                }
            }
            
            // Initialize the text values.
            w.value = "";
            this._a1r_textWidget = w;

            // Adjust node size.
            requestAnimationFrame(() => {
                const defaultSize = [210, 90];
                if (!this.size || this.size[0] < 210 || this.size[1] < 90) {
                    this.size = [...defaultSize];

                    if (this._a1r_size_data) {
                        this._a1r_size_data.lastWidth = defaultSize[0];
                        this._a1r_size_data.lastHeight = defaultSize[1];
                    }
                }
                this.setDirtyCanvas?.(true, true);
            });

            return this._a1r_textWidget;
        };

        /*
         * Set text and update node size.
         */
        const setText = function(text) {
            const w = ensureDisplayWidget.call(this);
            if (!w) return;

            // Handle text content.
            const lines = Array.isArray(text) ? text : [text];
            const content = lines.filter(v => v != null).map(v => String(v)).join("\n");
            w.value = content;

            // Adjust and refresh node size.
            requestAnimationFrame(() => {
                const size = this.computeSize?.();
                if (size && this.onResize) this.onResize(size);
                this.setDirtyCanvas?.(true, true);
                this.graph?.setDirtyCanvas?.(true, true);
            });
        };

        // ====== Lifecycle hooks ======

        // Create and initialize the text widget.
        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function() {
            // Default size.
            if (!this.size) {
                this.size = [210, 90];
            }

            const result = originalOnNodeCreated?.apply(this, arguments);

            ensureDisplayWidget.call(this);

            return result;
        };

        // Update the displayed text on execution.
        const originalOnExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function(message) {
            originalOnExecuted?.apply(this, arguments);
            try {
                setText.call(this, message?.text);
            } catch (err) {
                console.warn("[A1rSpace: Text Show] Error updating text:", err);
            }
        };

        // Save deserialized data for later.
        const originalConfigure = nodeType.prototype.configure;
        nodeType.prototype.configure = function() {
            const cfg = arguments[0];
            this._a1r_savedValues = cfg?.widgets_values;
            return originalConfigure?.apply(this, arguments);
        };

        // Load cached widgets values.
        const originalOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function() {
            originalOnConfigure?.apply(this, arguments);

            // Handle saved text values.
            const values = this._a1r_savedValues;
            if (Array.isArray(values) && values.length > 0) {
                setTimeout(() => setText.call(this, values), 0);
            } else {
                ensureDisplayWidget.call(this);
            }
            // Ensure the display widget exists.
            requestAnimationFrame(() => ensureDisplayWidget.call(this));
        };


        // Right click menu to copy text.
        /*
        const origMenu = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function(_, options) {
            origMenu?.apply(this, arguments);

            options.push({
                content: 'Copy text',
                callback: async () => {
                    const w = this._a1r_textWidget; 
                    if (!w) return;
                    await copyToClipboard(w.value ?? '');
                }
            });
        };
        */
    }
});