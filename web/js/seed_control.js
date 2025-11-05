import { app } from "/scripts/app.js";

app.registerExtension({
    name: "A1rSpace.SeedControlRewrite",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "A1r Seed Control") return;

        /**
         * 更新种子历史记录
         * @param {number} seedValue - 要记录的种子值
         */
        nodeType.prototype.updateSeedHistory = function(seedValue) {
            if (this.seedHistory.length === 0 || this.seedHistory[0] !== seedValue) {
                this.seedHistory.unshift(seedValue);
                
                if (this.seedHistory.length > this.maxHistoryLength) {
                    this.seedHistory.pop();
                }

                

                if (this.seedHistory.length >= 2) {
                    this.buttonStates.right.isAtEnd = false;
                    
                }
            }
        };

        /**
         * 交换历史记录顺序
         */
        nodeType.prototype.swapSeedHistory = function() {
            if (this.seedHistory.length >= 2) {
                const temp = this.seedHistory[0];
                this.seedHistory[0] = this.seedHistory[1];
                this.seedHistory[1] = temp;
                
                
            }
        };

        /**
         * 生成新的随机种子（带锁定保护）
         */
        nodeType.prototype.generateRandomSeed = function() {
            const seedWidget = this.widgets.find((w) => w.name === "seed");
            if (seedWidget) {
                const randomSeed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
                
                
                
                // 关键：在设置值之前先锁定
                this.lockedSeed = randomSeed;
                this.isRestoring = false;
                
                // 设置新种子值（此时已被保护，不会被其他值覆盖）
                seedWidget.value = randomSeed;
                
                // 手动更新历史记录
                this.updateSeedHistory(randomSeed);
                
                // 手动触发callback
                if (seedWidget.callback) {
                    const tempRestoring = this.isRestoring;
                    this.isRestoring = true;
                    seedWidget.callback(randomSeed);
                    this.isRestoring = tempRestoring;
                }
                
                return randomSeed;
            }
            return null;
        };

        /**
         * 队列prompt并注入正确的seed值
         */
        nodeType.prototype.queuePromptWithSeed = async function(targetSeed) {
            // 生成唯一的操作ID
            const operationId = Date.now() + Math.random();
            this.currentOperationId = operationId;
            
            
            
            // 设置强制seed值
            this.forcedSeed = targetSeed;
            this.isExecuting = true;
            
            try {
                await app.queuePrompt(0, 1);
                
                
                // 延迟清除标志 - 只有当前操作是最新操作时才清除
                setTimeout(() => {
                    // 检查这是否仍然是最新的操作
                    if (this.currentOperationId === operationId) {
                        this.forcedSeed = null;
                        this.isExecuting = false;
                        this.lockedSeed = null; // 只有最新操作才能解锁
                        
                    } else {
                        
                    }
                }, 2000);
                
            } catch(err) {
                
                // 发生错误时，只有当前操作才清除标志
                if (this.currentOperationId === operationId) {
                    this.forcedSeed = null;
                    this.isExecuting = false;
                    this.lockedSeed = null;
                }
            }
        };

        /**
         * 检查节点是否应该显示按钮
         */
        nodeType.prototype.shouldShowButtons = function() {
            // 检查节点是否被折叠
            if (this.flags && this.flags.collapsed) {
                return false;
            }
            
            // 检查节点高度是否足够
            if (!this.size || this.size[1] < 100) {
                return false;
            }
            
            return true;
        };

        /**
         * 获取当前的控制模式
         */
        nodeType.prototype.getControlMode = function() {
            const controlWidget = this.widgets.find((w) => w.name === "control_after_generate");
            return controlWidget ? controlWidget.value : "fixed";
        };

        /**
         * 获取当前的种子值
         */
        nodeType.prototype.getCurrentSeed = function() {
            const seedWidget = this.widgets.find((w) => w.name === "seed");
            return seedWidget ? seedWidget.value : 0;
        };

        /**
         * 节点创建时的初始化
         */
        nodeType.prototype.onNodeCreated = function () {
            // 初始化种子历史记录相关变量
            this.seedHistory = [];
            this.maxHistoryLength = 2;
            
            // 标记是否正在恢复历史
            this.isRestoring = false;
            
            // 标记是否正在执行生图
            this.isExecuting = false;
            
            // 强制使用的seed值（用于注入prompt）
            this.forcedSeed = null;
            
            // 锁定的seed值（用于阻止UI闪烁）
            this.lockedSeed = null;
            
            // 当前操作ID（用于防止旧操作清除新操作的锁定）
            this.currentOperationId = null;
            
            // 按钮冷却保护（防止快速连续点击）
            this.buttonCooldown = {
                left: false,   // Manual random按钮冷却状态
                right: false,  // Pull last seed按钮冷却状态
            };
            
            // 标记是否正在处理control_after_generate的变化
            this.isHandlingControlChange = false;

            // 按钮状态
            this.buttonStates = {
                left: { pressed: false, pressTime: 0 },
                right: { pressed: false, pressTime: 0, isAtEnd: true },
            };

            // 监听seed widget的变化
            const seedWidget = this.widgets.find((w) => w.name === "seed");
            if (seedWidget) {
                // 记录节点创建时的初始种子值
                if (seedWidget.value !== undefined) {
                    this.updateSeedHistory(seedWidget.value);
                }
                
                // 保存widget原始的callback函数
                const originalCallback = seedWidget.callback;
                
                // 重写seed widget的value属性，添加setter拦截
                let internalValue = seedWidget.value;
                
                Object.defineProperty(seedWidget, 'value', {
                    get: function() {
                        return internalValue;
                    },
                    set: function(v) {
                        // 如果有lockedSeed，只允许设置为lockedSeed
                        if (this.node.lockedSeed !== null && v !== this.node.lockedSeed) {
                        
                            return; // 完全阻止设置，避免闪烁
                        }
                        
                        // 在 fixed 模式下，如果正在执行队列，阻止种子变化
                        const controlWidget = this.node.widgets.find((w) => w.name === "control_after_generate");
                        if (controlWidget && controlWidget.value === "fixed" && !this.node.isRestoring) {
                            // 只有在手动操作时才允许改变
                            if (!this.node.isExecuting && this.node.forcedSeed === null && v !== internalValue) {
                                
                                return;
                            }
                        }

                        
                        internalValue = v;
                        
                        // 触发UI更新
                        if (this.node && this.node.graph) {
                            this.node.graph.setDirtyCanvas(true);
                        }
                    },
                    configurable: true
                });
                
                /**
                 * 重写seed widget的callback
                 */
                seedWidget.callback = (value) => {
                    
                    
                    // 如果有lockedSeed且值不匹配，忽略callback
                    if (this.lockedSeed !== null && value !== this.lockedSeed) {
                        
                        return;
                    }
                    
                    // 执行期间忽略所有callback
                    if (this.isExecuting) {
                        
                        if (originalCallback) {
                            originalCallback.call(seedWidget, value);
                        }
                        return;
                    }
                    
                    // 只有不是在恢复历史记录时才记录新值
                    if (!this.isRestoring) {
                        this.updateSeedHistory(value);
                    }
                    
                    // 调用原始的callback
                    if (originalCallback) {
                        originalCallback.call(seedWidget, value);
                    }
                };
            }

            // 监听control_after_generate widget的变化
            const controlWidget = this.widgets.find((w) => w.name === "control_after_generate");
            if (controlWidget) {
                const originalControlCallback = controlWidget.callback;
                
                controlWidget.callback = (value) => {
                    
                    
                    if (this.isHandlingControlChange) {
                        if (originalControlCallback) {
                            originalControlCallback.call(controlWidget, value);
                        }
                        return;
                    }

                    this.isHandlingControlChange = true;

                    if (value === "randomize") {
                        
                        
                        // 重置所有状态
                        this.isRestoring = false;
                        this.isExecuting = false;
                        this.forcedSeed = null;
                        this.lockedSeed = null;
                        this.currentOperationId = null;
                        
                        this.generateRandomSeed();
                        
                        if (this.seedHistory.length >= 2) {
                            this.buttonStates.right.isAtEnd = false;
                            
                        }
                    } else if (value === "fixed") {
                        
                        
                        // 在切换到 fixed 模式时，锁定当前种子
                        const seedWidget = this.widgets.find((w) => w.name === "seed");
                        if (seedWidget) {
                            const currentSeed = seedWidget.value;
                            
                            // 更新历史记录
                            if (!this.isRestoring) {
                                this.updateSeedHistory(currentSeed);
                            }
                        }
                    }

                    if (originalControlCallback) {
                        originalControlCallback.call(controlWidget, value);
                    }

                    this.isHandlingControlChange = false;
                };
            }
        };

        /**
         * 重写序列化方法
         */
        const onSerialize = nodeType.prototype.onSerialize;
        nodeType.prototype.onSerialize = function(info) {
            if (onSerialize) {
                onSerialize.call(this, info);
            }
            
            info.seedHistory = this.seedHistory || [];
            info.buttonStates = this.buttonStates;
        };

        /**
         * 计算按钮的位置和尺寸
         */
        const btnH = 20;
        const btnSpacing = 10; // 按钮间距
        const btnPadding = 15; // 按钮边距
        
        function getButtonPos(node) {
            const nodeW = node.size ? node.size[0] : 300;
            const nodeH = node.size ? node.size[1] : 100;
            
            // 计算按钮宽度（两个按钮平分空间，留出间距）
            const btnW = Math.max(80, (nodeW - btnPadding * 2 - btnSpacing) / 2);
            
            // 默认Y位置
            let y = 60;
            
            // 根据最后一个widget的位置计算Y坐标
            if (node?.widgets?.length > 0) {
                const lastWidget = node.widgets[node.widgets.length - 1];
                if (lastWidget.last_y !== undefined) {
                    // 使用 last_y（实际渲染位置）
                    y = lastWidget.last_y + (lastWidget.computeSize?.(nodeW)[1] || 30) + 5;
                } else {
                    // 降级使用 y 属性
                    y = (lastWidget.y || 60) + (lastWidget.computeSize?.(nodeW)[1] || 30) + 5;
                }
            }
            
            // 确保按钮不会超出节点底部（留出底部边距）
            const maxY = nodeH - btnH - 10;
            y = Math.min(y, maxY);
            
            const xLeft = btnPadding;
            const xRight = btnPadding + btnW + btnSpacing;
            
            return {
                xLeft,
                xRight,
                y,
                w: btnW,
                h: btnH,
            };
        }

        /**
         * 绘制单个按钮
         */
        function drawButton(ctx, x, y, w, h, text, isPressed, isDisabled, isCooldown) {
            ctx.save();

            // 阴影效果
            if (isCooldown || isDisabled) {
                ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
                ctx.shadowBlur = 2;
                ctx.shadowOffsetY = 1;
            } else if (isPressed) {
                ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
                ctx.shadowBlur = 4;
                ctx.shadowOffsetY = 1;
            } else {
                ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
                ctx.shadowBlur = 8;
                ctx.shadowOffsetY = 3;
            }

            ctx.globalAlpha = 0.95;
            
            // 按钮背景色
            if (isDisabled || isCooldown) {
                ctx.fillStyle = isDisabled ? "#666666" : "#555555";
            } else {
                ctx.fillStyle = isPressed ? "#444444" : "#222222";
            }
            
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, 8);
            ctx.fill();

            // 高光效果（仅在正常状态下）
            if (!isPressed && !isDisabled && !isCooldown) {
                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;

                const gradient = ctx.createLinearGradient(x, y, x, y + h / 2);
                gradient.addColorStop(0, "rgba(255, 255, 255, 0.05)");
                gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.roundRect(x, y, w, h / 2, [8, 8, 0, 0]);
                ctx.fill();
            }

            ctx.restore();

            // 绘制文字
            ctx.save();
            ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
            ctx.shadowBlur = 3;
            ctx.shadowOffsetY = 1;
            ctx.font = "11px Inter, Arial, sans-serif";
            ctx.fillStyle = (isDisabled || isCooldown) ? "#999999" : "#ffffff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            const textOffsetY = isPressed ? 1 : 0;
            ctx.fillText(text, x + w / 2, y + h / 2 + textOffsetY);
            ctx.restore();
        }

        /**
         * 绘制按钮
         */
        nodeType.prototype.onDrawForeground = function (ctx) {
            // 检查是否应该显示按钮
            if (!this.shouldShowButtons()) {
                return;
            }
            
            const pos = getButtonPos(this);
            const currentTime = Date.now();

            // 重置按钮按下状态（超时后）
            const resetButtonState = (button) => {
                if (button.pressed && currentTime - button.pressTime > 150) {
                    button.pressed = false;
                }
            };
            resetButtonState(this.buttonStates.left);
            resetButtonState(this.buttonStates.right);

            // 绘制 "Manual random" 按钮
            drawButton(
                ctx,
                pos.xLeft,
                pos.y,
                pos.w,
                pos.h,
                "Manual random",
                this.buttonStates.left.pressed,
                false,
                this.buttonCooldown.left
            );

            // 绘制 "Pull last seed" 按钮
            const pullDisabled = this.seedHistory.length < 2 || this.buttonStates.right.isAtEnd;
            drawButton(
                ctx,
                pos.xRight,
                pos.y,
                pos.w,
                pos.h,
                "Pull last seed",
                this.buttonStates.right.pressed,
                pullDisabled,
                this.buttonCooldown.right
            );
        };

        /**
         * 处理鼠标点击事件
         */
        nodeType.prototype.onMouseDown = function(e, mousePos, graphcanvas) {
            // 检查是否应该响应按钮点击
            if (!this.shouldShowButtons()) {
                return false;
            }
            
            const btnPos = getButtonPos(this);
            const btnW = btnPos.w;
            const btnH = btnPos.h;

            // "Manual random" 按钮
            if (mousePos[0] >= btnPos.xLeft && mousePos[0] <= btnPos.xLeft + btnW &&
                mousePos[1] >= btnPos.y && mousePos[1] <= btnPos.y + btnH) {
                
                // 检查冷却状态
                if (this.buttonCooldown.left) {
                
                    return true;
                }
                
                
                
                // 立即进入冷却期
                this.buttonCooldown.left = true;
                
                
                this.buttonStates.left.pressed = true;
                this.buttonStates.left.pressTime = Date.now();

                this.isRestoring = false;

                // 设置control_after_generate为fixed
                const controlWidget = this.widgets.find((w) => w.name === "control_after_generate");
                if (controlWidget) {
                    controlWidget.value = "fixed";
                }

                // 生成新的随机种子（内部会先锁定再设置值）
                const newSeed = this.generateRandomSeed();
                
                if (newSeed !== null) {
                    // 延迟触发队列，确保锁定已生效
                    setTimeout(() => {
                        this.queuePromptWithSeed(newSeed).finally(() => {
                            // 操作完成后延迟解除冷却
                            setTimeout(() => {
                                this.buttonCooldown.left = false;
                                    
                            }, 500);
                        });
                    }, 50);
                } else {
                    // 如果生成失败，立即解除冷却
                    this.buttonCooldown.left = false;
                }

                return true;
            }

            // "Pull last seed" 按钮
            if (mousePos[0] >= btnPos.xRight && mousePos[0] <= btnPos.xRight + btnW &&
                mousePos[1] >= btnPos.y && mousePos[1] <= btnPos.y + btnH) {
                
                // 检查冷却状态
                if (this.buttonCooldown.right) {
                    
                    return true;
                }
                
                if (this.seedHistory.length >= 2 && !this.buttonStates.right.isAtEnd) {
                    
                    
                    
                    // 立即进入冷却期
                    this.buttonCooldown.right = true;
                    
                    
                    // 设置control_after_generate为fixed
                    const controlWidget = this.widgets.find((w) => w.name === "control_after_generate");
                    if (controlWidget) {
                        controlWidget.value = "fixed";
                    }

                    const seedWidget = this.widgets.find((w) => w.name === "seed");
                    if (seedWidget) {
                        const lastSeed = this.seedHistory[1];
                        
                        

                        this.isRestoring = true;
                        
                        // 先锁定目标值
                        this.lockedSeed = lastSeed;

                        // 恢复种子值
                        seedWidget.value = lastSeed;
                        
                        // 交换历史记录顺序
                        this.swapSeedHistory();

                        // 标记已到达历史末端
                        this.buttonStates.right.isAtEnd = true;
                        this.buttonStates.right.pressed = true;
                        this.buttonStates.right.pressTime = Date.now();

                        // 重置恢复标志
                        setTimeout(() => {
                            this.isRestoring = false;
                        }, 100);

                        // 延迟触发队列
                        setTimeout(() => {
                            this.queuePromptWithSeed(lastSeed).finally(() => {
                                // 操作完成后延迟解除冷却
                                setTimeout(() => {
                                    this.buttonCooldown.right = false;
                                    
                                }, 500);
                            });
                        }, 50);
                    } else {
                        // 如果没有seedWidget，解除冷却
                        this.buttonCooldown.right = false;
                    }
                }

                return true;
            }

            return false;
        };

        /**
         * 反序列化
         */
        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function(info) {
            if (onConfigure) {
                onConfigure.call(this, info);
            }
            
            if (info.seedHistory) {
                this.seedHistory = info.seedHistory;
            } else {
                this.seedHistory = [];
                const seedWidget = this.widgets.find((w) => w.name === "seed");
                if (seedWidget && seedWidget.value !== undefined) {
                    this.updateSeedHistory(seedWidget.value);
                }
            }
            
            if (info.buttonStates) {
                this.buttonStates = info.buttonStates;
                this.buttonStates.left.pressed = false;
                this.buttonStates.right.pressed = false;
            }
            
            if (this.buttonStates && this.seedHistory) {
                this.buttonStates.right.isAtEnd = this.seedHistory.length < 2;
            }
        };
    },
    
    /**
     * 在app级别设置，拦截graphToPrompt来注入seed
     */
    async setup() {
        const originalGraphToPrompt = app.graphToPrompt;
        
        app.graphToPrompt = async function() {
            const prompt = await originalGraphToPrompt.call(app);
            
            // 遍历所有节点，找到需要注入seed的节点
            for (const node of app.graph._nodes) {
                if (node.type === "A1r Seed Control") {
                    const nodeId = node.id;
                    if (prompt.output && prompt.output[nodeId]) {
                        // 优先使用 forcedSeed（来自按钮操作）
                        if (node.forcedSeed !== null) {
                            prompt.output[nodeId].inputs.seed = node.forcedSeed;
                            
                        } 
                        // 如果是 fixed 模式，强制使用当前种子值
                        else if (node.getControlMode() === "fixed") {
                            const currentSeed = node.getCurrentSeed();
                            prompt.output[nodeId].inputs.seed = currentSeed;
                            
                        }
                    }
                }
            }
            
            return prompt;
        };
    }
});