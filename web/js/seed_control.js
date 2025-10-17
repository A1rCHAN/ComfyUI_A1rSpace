import { app } from "../../../scripts/app.js";

// Seed 控制（精简）：仅保留 “Manual Random” 按钮
// - 点击后：生成 64 位随机种子，写回 seed，强制将“生成后控制”切为 fixed，并可选触发一次运行
app.registerExtension({
    name: "A1rSpace.Seed_Control",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        const names = ["Seed_Control", "A1r Seed Control", "Seed Control"]; // 映射兼容
        if (!names.includes(nodeData.name)) return;

        // 查找 widget by name
        const byName = (node, name) => node.widgets?.find(w => w?.name === name);

        // 生成 0..2^64-1 随机整数（优先加密）
        function randomU64() {
            try {
                if (globalThis.crypto?.getRandomValues) {
                    const buf = new Uint32Array(2);
                    globalThis.crypto.getRandomValues(buf);
                    const hi = BigInt(buf[0]);
                    const lo = BigInt(buf[1]);
                    return ((hi << 32n) | lo).toString();
                }
            } catch {}
            const hi = Math.floor(Math.random() * 0x100000000);
            const lo = Math.floor(Math.random() * 0x100000000);
            return (BigInt(hi) << 32n | BigInt(lo)).toString();
        }

        // 将 “生成后控制” 切为 fixed（优先把枚举控件的值设为字符串 'fixed'，避免显示索引 0）
        function setControlAfterGenerateFixed(node) {
            try {
                const ws = Array.isArray(node.widgets) ? node.widgets : [];
                const ctrl = ws.find(w => {
                    if (!w?.options) return false;
                    const nm = (w.name || '').toLowerCase();
                    if (nm.includes('control') && nm.includes('generate')) return true;
                    if ([
                        'control_after_generate',
                        'after_generate',
                        'seed_behavior',
                        'seed_behaviour',
                    ].includes(nm)) return true;
                    const vals = w.options.values;
                    return Array.isArray(vals) && vals.map(x => String(x).toLowerCase()).includes('fixed');
                });
                if (ctrl) {
                    const vals = (ctrl.options?.values || []).map(x => String(x));
                    const idx = vals.findIndex(v => v.toLowerCase() === 'fixed');
                    const target = idx >= 0 ? vals[idx] : 'fixed';
                    ctrl.value = target; // 设为字符串，避免 0
                    try { ctrl.callback?.call(node, target, ctrl, node); } catch {}
                    return true;
                }

                // 后备：seed 控件上的已知属性
                const seedWidget = ws.find(w => w?.name === 'seed');
                if (seedWidget) {
                    if (seedWidget.options) {
                        if (typeof seedWidget.options.control_after_generate !== 'undefined') {
                            seedWidget.options.control_after_generate = 'fixed';
                            return true;
                        }
                        if (typeof seedWidget.options.after_generate !== 'undefined') {
                            seedWidget.options.after_generate = 'fixed';
                            return true;
                        }
                    }
                    if (typeof seedWidget.after_generate !== 'undefined') {
                        seedWidget.after_generate = 'fixed';
                        return true;
                    }
                }
            } catch {}
            return false;
        }

        // 生命周期：创建/载入/加入图时注入按钮
        const origOnCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function() {
            origOnCreated?.apply(this, arguments);
            const init = () => {
                if (!Array.isArray(this.widgets)) return void requestAnimationFrame(init);
                ensureManualRandom.call(this);
            };
            init();
        };

        const origOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function() {
            const r = origOnConfigure?.apply(this, arguments);
            try { this.onNodeCreated?.(); } catch {}
            return r;
        };

        const origOnAdded = nodeType.prototype.onAdded;
        nodeType.prototype.onAdded = function() {
            const r = origOnAdded?.apply(this, arguments);
            try { this.onNodeCreated?.(); } catch {}
            return r;
        };

        // 创建按钮（放在 seed 控件后）：Manual Random
        function ensureManualRandom() {
            const seedW = byName(this, 'seed');
            if (!seedW) return;
            if (this.__a1r_manualRandomBtn) return this.__a1r_manualRandomBtn;

            const manualBtn = this.addWidget?.('button', 'Manual Random', null, async () => {
                const n = Number(randomU64());
                if (!Number.isFinite(n)) return;
                seedW.value = n;
                try { seedW.callback?.call(this, n, seedW, this); } catch {}
                setControlAfterGenerateFixed(this);
                this.setDirtyCanvas?.(true, true);
                this.graph?.setDirtyCanvas?.(true, true);
                try {
                    // 给 UI 状态一点时间提交，避免 "execution_start before prompt"
                    await new Promise(r => setTimeout(r, 120));
                    await new Promise(r => requestAnimationFrame(() => r()));
                    if (typeof app?.queuePrompt === 'function') {
                        await app.queuePrompt();
                    } else if (typeof app?.runWorkflow === 'function') {
                        await app.runWorkflow();
                    } else if (typeof this?.graph?.queuePrompt === 'function') {
                        await this.graph.queuePrompt();
                    }
                } catch {}
            });

            const seedIndex = this.widgets.indexOf(seedW);
            if (seedIndex >= 0) {
                const curIndex = this.widgets.indexOf(manualBtn);
                if (curIndex > -1) this.widgets.splice(curIndex, 1);
                this.widgets.splice(seedIndex + 1, 0, manualBtn);
            }
            if (manualBtn) manualBtn.serialize = false;
            this.__a1r_manualRandomBtn = manualBtn;
            return manualBtn;
        }
    }
});
