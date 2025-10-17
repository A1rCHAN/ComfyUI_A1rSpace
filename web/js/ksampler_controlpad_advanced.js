import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "A1rSpace.KSampler_ControlPad_Advanced",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        const names = [
            "KSampler_ControlPad_Advanced", // Python 类名
            "A1r KSampler ControlPad Advanced", // 映射键
            "KSampler Control Pad Advanced" // 显示名
        ];
        if (names.includes(nodeData.name)) {
            
            const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
            
            nodeType.prototype.onNodeCreated = function () {
                if (originalOnNodeCreated) originalOnNodeCreated.apply(this, arguments);

                const init = () => {
                    if (!Array.isArray(this.widgets) || this.widgets.length === 0) {
                        requestAnimationFrame(init);
                        return;
                    }

                    const getW = (n) => this.widgets.find(w => w.name === n);
                    const setW = (n, v) => { const w = getW(n); if (w && w.value !== v) w.value = v; };
                    const getV = (n) => { const w = getW(n); return w ? !!w.value : false; };

                    const applyRules = (changed, newVal) => {
                        if (this.__updating_rules) return; // guard
                        this.__updating_rules = true;

                        let image = getV('image_detailer');
                        let gen = getV('generate_ksampler');
                        let latent = getV('latent_upscale');
                        let face = getV('face_detailer');
                        let hand = getV('hand_detailer');
                        let debug = getV('debug_detailer');

                        const ensureMutual = () => {
                            if (image && gen) {
                                if (changed === 'image_detailer') gen = false; else image = false;
                            }
                            if (!image && !gen) {
                                // 至少保持一个为真，优先 generate_ksampler
                                gen = true;
                            }
                        };

                        switch (changed) {
                            case 'image_detailer':
                                if (newVal) {
                                    image = true; gen = false; debug = true;
                                    // 关闭其他
                                    latent = false; face = false; hand = false;
                                } else {
                                    image = false;
                                    if (!gen) gen = true; // 保证至少一个
                                }
                                break;
                            case 'generate_ksampler':
                                if (newVal) {
                                    gen = true; image = false; debug = false; // 切到 generate 时关闭 debug
                                } else {
                                    if (!image) gen = true; // 不允许两者都关
                                }
                                break;
                            case 'latent_upscale':
                                if (newVal) {
                                    if (image) {
                                        // 触发互斥：转到 generate 模式并清空其他
                                        image = false; gen = true; debug = false; face = false; hand = false;
                                    } else {
                                        latent = true;
                                    }
                                } else {
                                    latent = false;
                                }
                                break;
                            case 'face_detailer':
                                face = !!newVal;
                                if (image && face) debug = false; // 互斥
                                break;
                            case 'hand_detailer':
                                hand = !!newVal;
                                if (image && hand) debug = false; // 互斥
                                break;
                            case 'debug_detailer':
                                debug = !!newVal;
                                if (image && debug) { face = false; hand = false; }
                                if (gen && debug) {
                                    // 在 generate 打开时打开 debug => 切换到 image 模式
                                    image = true; gen = false; 
                                    // image 规则：关闭其他
                                    latent = false; face = false; hand = false;
                                }
                                break;
                        }

                        ensureMutual();

                        // 写回
                        setW('image_detailer', image);
                        setW('generate_ksampler', gen);
                        setW('latent_upscale', latent);
                        setW('face_detailer', face);
                        setW('hand_detailer', hand);
                        setW('debug_detailer', debug);

                        // UI 禁用：image 打开时禁止操作 latent_upscale
                        const latentW = getW('latent_upscale');
                        if (latentW) latentW.disabled = !!image;

                        this.setDirtyCanvas?.(true, true);
                        this.__updating_rules = false;
                    };

                    // 绑定回调（避免重复绑定）
                    if (!this.__a1r_bound) {
                        const bind = (name) => {
                            const w = getW(name);
                            if (!w) return;
                            const orig = w.callback;
                            w.callback = (val) => {
                                orig?.apply(this, [val, w, this]);
                                applyRules(name, val);
                            };
                        };

                        ['image_detailer','generate_ksampler','latent_upscale','face_detailer','hand_detailer','debug_detailer']
                            .forEach(bind);
                        this.__a1r_bound = true;
                    }

                    // 初始化：先按 image 规则处理一次，再校正互斥
                    applyRules('image_detailer', getV('image_detailer'));
                    applyRules('generate_ksampler', getV('generate_ksampler'));

                    // 兜底：首次渲染后再执行一次，避免某些主题延迟写值
                    setTimeout(() => {
                        applyRules('image_detailer', getV('image_detailer'));
                    }, 0);
                };

                init();
            };

            // 载入配置时兜底一次
            const origOnConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function() {
                const r = origOnConfigure?.apply(this, arguments);
                try {
                    if (Array.isArray(this.widgets) && this.widgets.length) {
                        const getW = (n) => this.widgets.find(w => w.name === n);
                        const getV = (n) => { const w = getW(n); return w ? !!w.value : false; };
                        // 若未绑定，绑定一次
                        if (!this.__a1r_bound) {
                            const ensureSetup = () => {
                                if (!Array.isArray(this.widgets) || this.widgets.length === 0) {
                                    return void requestAnimationFrame(ensureSetup);
                                }
                                // 触发 onNodeCreated 中的流程
                                this.__a1r_bound = false; // ensure binding
                                // 直接模拟一次初始化绑定
                                const getW2 = (n) => this.widgets.find(w => w.name === n);
                                const setW2 = (n, v) => { const w = getW2(n); if (w && w.value !== v) w.value = v; };
                                const getV2 = (n) => { const w = getW2(n); return w ? !!w.value : false; };
                                const latentW = getW2('latent_upscale');
                                if (latentW) latentW.disabled = !!getV2('image_detailer');
                                ['image_detailer','generate_ksampler','latent_upscale','face_detailer','hand_detailer','debug_detailer'].forEach(name => {
                                    const w = getW2(name);
                                    if (!w) return;
                                    const orig = w.callback;
                                    w.callback = (val) => {
                                        orig?.apply(this, [val, w, this]);
                                        // 简约规则：任一点击后，触发一次 onNodeCreated 的初始化逻辑
                                        this.__a1r_bound = false;
                                        this.onNodeCreated?.();
                                    };
                                });
                                this.__a1r_bound = true;
                                // 再次运行初始化规则
                                this.onNodeCreated?.();
                            };
                            ensureSetup();
                        }
                        // 若 image 为真，确保禁用 latent 并互斥
                        if (getV('image_detailer')) {
                            const latentW = getW('latent_upscale');
                            if (latentW) latentW.disabled = true;
                            // 简单纠正 generate 互斥
                            const genW = getW('generate_ksampler');
                            if (genW && genW.value) genW.value = false;
                        }
                    }
                } catch {}
                this.setDirtyCanvas?.(true, true);
                return r;
            };

            // 已存在场景：当节点被加入图时也确保绑定
            const origOnAdded = nodeType.prototype.onAdded;
            nodeType.prototype.onAdded = function() {
                const r = origOnAdded?.apply(this, arguments);
                if (!this.__a1r_bound) {
                    this.onNodeCreated?.();
                }
                return r;
            };
        }
    }
});