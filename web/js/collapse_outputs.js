import { app } from "../../../scripts/app.js";

// 为 A1rSpace 下的节点添加“折叠输出”属性：
// - 折叠时：仅显示第一个输出，其余输出隐藏；所有输出名称统一设为一个空格（避免重叠与占位异常）；不额外绘制遮盖
// - 展开时：恢复所有输出与其原始名称（逐一对应）
// - 折叠时允许节点高度缩小（按隐藏输出数量减少高度，且不修改 outputs 结构或连接槽位）
app.registerExtension({
    name: "A1rSpace.CollapseOutputs.All",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (!nodeData?.category || !String(nodeData.category).startsWith("A1rSpace")) return;

        const PROP = "collapse_outputs";

        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        const origOnDrawForeground = nodeType.prototype.onDrawForeground;
        const origOnDrawBackground = nodeType.prototype.onDrawBackground;

        function isCollapsed(node) {
            const v = node?.properties?.[PROP];
            return v === true || v === 1 || v === "true";
        }

        function updateOutputsVisibility(node) {
            try {
                if (!node.outputs || node.outputs.length <= 1) return;
                const collapse = isCollapsed(node);
                if (!node._a1r_orig_output_names) {
                    node._a1r_orig_output_names = node.outputs.map(o => (o && typeof o.name === "string") ? o.name : "");
                }
                if (!node._a1r_orig_output_labels) {
                    node._a1r_orig_output_labels = node.outputs.map(o => (o && typeof o.label === "string") ? o.label : "");
                }
                for (let i = 0; i < node.outputs.length; i++) {
                    const out = node.outputs[i];
                    if (!out) continue;
                    // 折叠时：仅第一个输出点可见，但所有输出名称都设置为单个空格
                    out.hidden = collapse ? (i > 0) : false;
                    if (collapse) {
                        out.name = " "; // 单个空格，防止文本重叠与绘制残留
                        if (Object.prototype.hasOwnProperty.call(out, 'label')) out.label = " ";
                    } else if (node._a1r_orig_output_names) {
                        out.name = node._a1r_orig_output_names[i] || "";
                        if (node._a1r_orig_output_labels && Object.prototype.hasOwnProperty.call(out, 'label')) {
                            out.label = node._a1r_orig_output_labels[i] || "";
                        }
                    }
                }
            } catch (e) {
                console.warn("[A1rSpace] updateOutputsVisibility failed:", e);
            }
        }

        // 判断是否正在手动调整节点尺寸（来自 LiteGraph 画布）
        function isManualResizing(node) {
            try { return !!(app && app.canvas && app.canvas.resizing_node === node); } catch { return false; }
        }

        // 获取偏好的宽度（优先用户手动设置的宽度），否则回退为当前节点宽度
        function getPreferredWidth(node) {
            if (typeof node.__a1r_user_width === 'number' && node.__a1r_user_width > 0) return node.__a1r_user_width;
            if (Array.isArray(node.size) && typeof node.size[0] === 'number' && node.size[0] > 0) return node.size[0];
            return undefined;
        }

        nodeType.prototype.onNodeCreated = function () {
            if (origOnNodeCreated) origOnNodeCreated.apply(this, arguments);
            try {
                if (typeof this.addProperty === "function") {
                    if (!this.properties || !Object.prototype.hasOwnProperty.call(this.properties, PROP)) {
                        this.addProperty(PROP, false, "boolean");
                    }
                }
            } catch (e) {
                console.warn("[A1rSpace] addProperty not available:", e);
            }
            this.properties = this.properties || {};
            if (typeof this.properties[PROP] === "undefined") this.properties[PROP] = false;

            // 初始化时记录一次当前宽度作为默认用户宽度
            try {
                if (Array.isArray(this.size) && typeof this.size[0] === 'number' && this.size[0] > 0) {
                    this.__a1r_user_width = this.size[0];
                }
            } catch {}

            updateOutputsVisibility(this);
            this.setDirtyCanvas(true, true);

            // 反序列化保障
            const origOnConfigure = this.onConfigure;
            this.onConfigure = function () {
                if (origOnConfigure) origOnConfigure.apply(this, arguments);
                this.properties = this.properties || {};
                if (typeof this.properties[PROP] === "undefined") this.properties[PROP] = false;
                updateOutputsVisibility(this);
                this.setDirtyCanvas(true, true);
            };

            // 属性变化时更新可见性并刷新画布
            const origOnPropertyChanged = this.onPropertyChanged;
            this.onPropertyChanged = function (name, value) {
                // 先记录切换前的宽度，防止上游处理流程改变宽度
                const widthBefore = Array.isArray(this.size) && typeof this.size[0] === 'number' ? this.size[0] : undefined;
                if (typeof widthBefore === 'number' && widthBefore > 0) {
                    this.__a1r_user_width = widthBefore;
                }
                const res = origOnPropertyChanged ? origOnPropertyChanged.apply(this, arguments) : undefined;
                if (name === PROP) {
                    updateOutputsVisibility(this);
                    // 强制刷新与尺寸更新（仅调整高度，保持宽度不变）
                    try {
                        if (typeof this.computeSize === 'function') {
                            const s = this.computeSize(this.size);
                            if (Array.isArray(s) && typeof this.setSize === 'function') {
                                const wWanted = (typeof this.__a1r_user_width === 'number') ? this.__a1r_user_width : getPreferredWidth(this);
                                this.setSize([typeof wWanted === 'number' ? wWanted : (Array.isArray(this.size) ? this.size[0] : s[0]), s[1]]);
                                // 再次异步应用一次以抵消外部流程后续覆盖
                                if (typeof requestAnimationFrame === 'function') {
                                    const self = this;
                                    requestAnimationFrame(() => {
                                        try {
                                            const w2 = (typeof self.__a1r_user_width === 'number') ? self.__a1r_user_width : getPreferredWidth(self);
                                            if (Array.isArray(self.size)) self.setSize([typeof w2 === 'number' ? w2 : self.size[0], self.size[1]]);
                                        } catch {}
                                    });
                                }
                            }
                        }
                    } catch {}
                    this.setDirtyCanvas(true, true);
                }
                return res;
            };

        };

        // 保持原始背景绘制
        nodeType.prototype.onDrawBackground = function (ctx) {
            if (origOnDrawBackground) origOnDrawBackground.apply(this, arguments);
        };

        nodeType.prototype.onDrawForeground = function (ctx) {
            if (origOnDrawForeground) origOnDrawForeground.apply(this, arguments);
            // 为防止某些情况下属性更新未及时体现在绘制阶段，这里每帧重申一次可见性规则
            try { updateOutputsVisibility(this); } catch {}
            // 手动拖拽调整尺寸时，记录用户宽度偏好
            try {
                if (isManualResizing(this) && Array.isArray(this.size) && typeof this.size[0] === 'number' && this.size[0] > 0) {
                    this.__a1r_user_width = this.size[0];
                }
            } catch {}
        };

        // 折叠时允许节点缩小：临时伪造仅一个输出，交给原始算法计算精确高度（随后立刻恢复），避免底部空白
        if (!nodeType.prototype._a1r_orig_computeSize && typeof nodeType.prototype.computeSize === 'function') {
            const origComputeSize = nodeType.prototype.computeSize;
            nodeType.prototype._a1r_orig_computeSize = origComputeSize; 
            nodeType.prototype.computeSize = function(out) { 
                // 始终以当前宽度为准，避免 computeSize 通过 out 引用改写 this.size 宽度 
                const curW = Array.isArray(this.size) && typeof this.size[0] === 'number' ? this.size[0] : undefined; 
                const curH = Array.isArray(this.size) && typeof this.size[1] === 'number' ? this.size[1] : undefined; 
                const outLocal = [curW ?? 0, curH ?? 0]; // 传入克隆，防止原实现改写 this.size 引用 

                if (isCollapsed(this) && Array.isArray(this.outputs) && this.outputs.length > 1) { 
                    const backup = this.outputs; 
                    try { 
                        this.outputs = [backup[0]]; 
                        const s = origComputeSize.call(this, outLocal); 
                        const w = (typeof curW === 'number') ? curW : (Array.isArray(s) ? s[0] : 0); 
                        const h = Math.max(40, Array.isArray(s) ? s[1] : (curH ?? 0)); 
                        return [w, h]; // 只应用高度变化 
                    } finally { 
                        this.outputs = backup; 
                    } 
                } 

                const s = origComputeSize.call(this, outLocal); 
                const w = (typeof curW === 'number') ? curW : (Array.isArray(s) ? s[0] : 0); 
                const h = Array.isArray(s) ? s[1] : (curH ?? 0); 
                return [w, h]; // 非折叠也仅沿用当前宽度 
            }; 
        }

        /* 如果节点在运行期新增输出，保持当前折叠策略
        if (!nodeType.prototype._a1r_orig_addOutput && typeof nodeType.prototype.addOutput === 'function') {
            const origAddOutput = nodeType.prototype.addOutput;
            nodeType.prototype._a1r_orig_addOutput = origAddOutput;
            nodeType.prototype.addOutput = function(name, type, extra_info) {
                const res = origAddOutput.call(this, name, type, extra_info);
                try {
                    updateOutputsVisibility(this);
                    this.setDirtyCanvas(true, true);
                } catch {}
                return res;
            };
        }
        */

        // 右键菜单增加“折叠输出”开关（原型级，正确签名：canvas, options）
        if (!nodeType.prototype._a1r_orig_getExtraMenuOptions) {
            const origGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
            nodeType.prototype._a1r_orig_getExtraMenuOptions = origGetExtraMenuOptions;
            nodeType.prototype.getExtraMenuOptions = function(canvas, options) {
                if (origGetExtraMenuOptions) origGetExtraMenuOptions.apply(this, arguments);
                options = options || [];
                
                const node = this; // 捕获节点实例
                const collapsed = isCollapsed(node);
                
                options.push({
                    content: (collapsed ? "✔ " : "") + "Collapse outputs",
                    callback: () => {
                        try {
                            // 切换前记录一次当前宽度
                            const widthBefore = Array.isArray(node.size) && typeof node.size[0] === 'number' ? node.size[0] : undefined;
                            if (typeof widthBefore === 'number' && widthBefore > 0) node.__a1r_user_width = widthBefore;
                            node.properties[PROP] = !collapsed;
                            updateOutputsVisibility(node);
                            if (typeof node.computeSize === 'function' && typeof node.setSize === 'function') {
                                const s = node.computeSize(node.size);
                                if (Array.isArray(s)) {
                                    const wWanted = (typeof node.__a1r_user_width === 'number') ? node.__a1r_user_width : getPreferredWidth(node);
                                    node.setSize([typeof wWanted === 'number' ? wWanted : (Array.isArray(node.size) ? node.size[0] : s[0]), s[1]]);
                                    if (typeof requestAnimationFrame === 'function') {
                                        requestAnimationFrame(() => {
                                            try {
                                                const w2 = (typeof node.__a1r_user_width === 'number') ? node.__a1r_user_width : getPreferredWidth(node);
                                                if (Array.isArray(node.size)) node.setSize([typeof w2 === 'number' ? w2 : node.size[0], node.size[1]]);
                                            } catch {}
                                        });
                                    }
                                }
                            }
                            node.setDirtyCanvas(true, true);
                            app.graph.setDirtyCanvas(true, true); // 强制刷新整个图，确保连接线也重绘
                        } catch (e) {
                            console.warn('[A1rSpace] context toggle failed:', e);
                        }
                    }
                });
            };
        }

        // 包装 setSize 以在用户手动调整时记录其期望宽度（不改变原行为）
        if (!nodeType.prototype._a1r_orig_setSize && typeof nodeType.prototype.setSize === 'function') {
            const origSetSize = nodeType.prototype.setSize;
            nodeType.prototype._a1r_orig_setSize = origSetSize;
            nodeType.prototype.setSize = function(size) {
                // 兼容传入 [w,h] 或 (w,h) 的情况
                let w = undefined, h = undefined;
                if (Array.isArray(size)) { w = size[0]; h = size[1]; }
                else if (arguments.length >= 2) { w = arguments[0]; h = arguments[1]; }

                const ret = origSetSize.apply(this, arguments);
                try {
                    if (isManualResizing(this) && typeof w === 'number' && w > 0) {
                        this.__a1r_user_width = w;
                    }
                } catch {}
                return ret;
            };
        }

        // 折叠时仅进行“绘制端点”的位置重定向：
        // 通过覆盖 getConnectionPos（仅在 is_input=false、slot>0 时把坐标映射为 slot 0），
        // 实现“多条线从一个点出发”的纯视觉效果；不修改 getOutputPos 与任何 outputs/link 结构，
        // 因此取消折叠后会自然恢复各自的连线位置。
        if (!nodeType.prototype._a1r_orig_getConnectionPos && typeof nodeType.prototype.getConnectionPos === 'function') {
            const origGetConnectionPos = nodeType.prototype.getConnectionPos;
            nodeType.prototype._a1r_orig_getConnectionPos = origGetConnectionPos;
            nodeType.prototype.getConnectionPos = function(is_input, slot) {
                try {
                    if (!is_input && isCollapsed(this) && this.outputs && this.outputs.length > 1 && slot > 0) {
                        // 仅在折叠时重定向额外输出的绘制坐标到 slot 0
                        return origGetConnectionPos.call(this, false, 0);
                    }
                } catch {}
                return origGetConnectionPos.apply(this, arguments);
            };
        }
        if (!nodeType.prototype._a1r_orig_getOutputPos && typeof nodeType.prototype.getOutputPos === 'function') {
            const origGetOutputPos = nodeType.prototype.getOutputPos;
            nodeType.prototype._a1r_orig_getOutputPos = origGetOutputPos;
            nodeType.prototype.getOutputPos = function(slot) {
                try {
                    if (isCollapsed(this) && this.outputs && this.outputs.length > 1 && slot > 0) {
                        return origGetOutputPos.call(this, 0);
                    }
                } catch {}
                return origGetOutputPos.apply(this, arguments);
            };
        }

        // 防止误操作：折叠状态下，拒绝新增从该节点发出的连接（保持现有连接不变，展开后再操作）
        if (!nodeType.prototype._a1r_orig_onConnectionsChange) {
            const origOnConnectionsChange = nodeType.prototype.onConnectionsChange;
            nodeType.prototype._a1r_orig_onConnectionsChange = origOnConnectionsChange;
            nodeType.prototype.onConnectionsChange = function(type, slot, is_connected, link_info, input_slot) {
                if (origOnConnectionsChange) origOnConnectionsChange.apply(this, arguments);
                try {
                    if (!is_connected) return; // 只拦截新增
                    if (!isCollapsed(this)) return;
                    if (!link_info || !this.graph) return;
                    // 确认是从本节点的输出发出的连接
                    const isFromThisOutput = (link_info.origin_id === this.id);
                    if (!isFromThisOutput) return;
                    // 如果有多个输出且处于折叠，则撤销这次新连线，避免误操作
                    if (Array.isArray(this.outputs) && this.outputs.length > 1) {
                        try { this.graph.removeLink(link_info.id); } catch {}
                        console.warn('[A1rSpace] Collapsed: blocked creating new outgoing link to avoid misoperation. Expand node first.');
                        // 触发一次重绘
                        this.setDirtyCanvas(true, true);
                        if (app && app.graph && typeof app.graph.setDirtyCanvas === 'function') {
                            app.graph.setDirtyCanvas(true, true);
                        }
                    }
                } catch {}
            };
        }
    }
});