import { app } from "../../../scripts/app.js";

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

                console.log('[Seed History Updated]', this.seedHistory);

                if (this.seedHistory.length >= 2) {
                    this.buttonStates.right.isAtEnd = false;
                    console.log('[Pull last seed] Button enabled');
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
                
                console.log('[Seed History Swapped]', this.seedHistory);
            }
        };

        /**
         * 生成新的随机种子（带锁定保护）
         */
        nodeType.prototype.generateRandomSeed = function() {
            const seedWidget = this.widgets.find((w) => w.name === "seed");
            if (seedWidget) {
                const randomSeed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
                
                console.log('[Random Seed Generated]', randomSeed);
                
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
            
            console.log('[Queue With Seed] Target:', targetSeed, 'OperationID:', operationId);
            
            // 设置强制seed值
            this.forcedSeed = targetSeed;
            this.isExecuting = true;
            
            try {
                await app.queuePrompt(0, 1);
                console.log('[Queue With Seed] Queued successfully, OperationID:', operationId);
                
                // 延迟清除标志 - 只有当前操作是最新操作时才清除
                setTimeout(() => {
                    // 检查这是否仍然是最新的操作
                    if (this.currentOperationId === operationId) {
                        this.forcedSeed = null;
                        this.isExecuting = false;
                        this.lockedSeed = null; // 只有最新操作才能解锁
                        console.log('[Queue With Seed] Flags cleared for OperationID:', operationId);
                    } else {
                        console.log('[Queue With Seed] Skipped clearing flags for old OperationID:', operationId, 'Current:', this.currentOperationId);
                    }
                }, 2000);
                
            } catch(err) {
                console.error('[Queue With Seed] Error:', err);
                // 发生错误时，只有当前操作才清除标志
                if (this.currentOperationId === operationId) {
                    this.forcedSeed = null;
                    this.isExecuting = false;
                    this.lockedSeed = null;
                }
            }
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
                const originalDescriptor = Object.getOwnPropertyDescriptor(seedWidget, 'value');
                let internalValue = seedWidget.value;
                
                Object.defineProperty(seedWidget, 'value', {
                    get: function() {
                        return internalValue;
                    },
                    set: function(v) {
                        // 如果有lockedSeed，只允许设置为lockedSeed
                        if (this.node.lockedSeed !== null && v !== this.node.lockedSeed) {
                            console.log('[Seed Setter] Blocked change from', internalValue, 'to', v, '(locked to', this.node.lockedSeed, ')');
                            return; // 完全阻止设置，避免闪烁
                        }
                        
                        console.log('[Seed Setter] Setting value to', v);
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
                    console.log('[Seed Callback]', value, 'isRestoring:', this.isRestoring, 'isExecuting:', this.isExecuting, 'lockedSeed:', this.lockedSeed);
                    
                    // 如果有lockedSeed且值不匹配，忽略callback
                    if (this.lockedSeed !== null && value !== this.lockedSeed) {
                        console.log('[Seed Callback] Blocked (locked)');
                        return;
                    }
                    
                    // 执行期间忽略所有callback
                    if (this.isExecuting) {
                        console.log('[Seed Callback] Ignored during execution');
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
                    console.log('[Control After Generate Changed]', value);
                    
                    if (this.isHandlingControlChange) {
                        if (originalControlCallback) {
                            originalControlCallback.call(controlWidget, value);
                        }
                        return;
                    }

                    this.isHandlingControlChange = true;

                    if (value === "randomize") {
                        console.log('[Switching to Randomize Mode] Generating new seed...');
                        
                        // 重置所有状态
                        this.isRestoring = false;
                        this.isExecuting = false;
                        this.forcedSeed = null;
                        this.lockedSeed = null;
                        this.currentOperationId = null;
                        
                        this.generateRandomSeed();
                        
                        if (this.seedHistory.length >= 2) {
                            this.buttonStates.right.isAtEnd = false;
                            console.log('[Pull last seed] Button re-enabled after randomize');
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
        function getButtonPos(node) {
            let nodeW = node.size ? node.size[0] : 300;
            let btnW = Math.max(80, (nodeW - 40) / 2);
            let y = 60;
            let xLeft = 15;
            let xRight = nodeW - btnW - 15;
            
            if (node?.widgets?.length > 0) {
                const lastWidget = node.widgets[node.widgets.length - 1];
                y = lastWidget.y + (lastWidget.size ?? 30);
            }
            
            return {
                xLeft,
                xRight,
                y,
                w: btnW,
            };
        }

        /**
         * 绘制按钮
         */
        nodeType.prototype.onDrawForeground = function (ctx) {
            const pos = getButtonPos(this);
            const btnW = pos.w;
            const currentTime = Date.now();

            const resetButtonState = (button) => {
                if (button.pressed && currentTime - button.pressTime > 150) {
                    button.pressed = false;
                }
            };
            resetButtonState(this.buttonStates.left);
            resetButtonState(this.buttonStates.right);

            // 绘制 "Manual random" 按钮
            ctx.save();

            // enhance shadow effect
            if (this.buttonCooldown.left) {
                ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
                ctx.shadowBlur = 2;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 1;
            } else if (this.buttonStates.left.pressed) {
                ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 1;
            } else {
                ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 3;
            }

            ctx.globalAlpha = 0.95;
            
            // 如果在冷却期，显示为禁用状态
            if (this.buttonCooldown.left) {
                ctx.fillStyle = "#555555ff"; // 冷却期颜色
            } else {
                ctx.fillStyle = this.buttonStates.left.pressed ? "#444444ff" : "#222222ff";
            }
            
            ctx.beginPath();
            ctx.roundRect(pos.xLeft, pos.y, btnW, btnH, 8);
            ctx.fill();

            // enhance highlight effect
            if (!this.buttonCooldown.left.pressed && !this.buttonCooldown.left) {
                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;

                const gradient = ctx.createLinearGradient(pos.xLeft, pos.y, pos.xLeft, pos.y + btnH / 2);
                gradient.addColorStop(0, "rgba(255, 255, 255, 0.05)");
                gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.roundRect(pos.xLeft, pos.y, btnW, btnH / 2, [8, 8, 0, 0]);
                ctx.fill();
            }

            ctx.restore();

            // text
            ctx.save();
            ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 1;
            ctx.font = "11px Inter, Arial, sans-serif";
            ctx.fillStyle = this.buttonCooldown.left ? "#999999ff" : "#fff"; // 冷却期文字颜色稍暗
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // track button state
            const textOffsetY = this.buttonStates.left.pressed ? 1 : 0;
            ctx.fillText("Manual random", pos.xLeft + btnW/2, pos.y + btnH/2 + textOffsetY);
            ctx.restore();

            /*
             *绘制 "Pull last seed" 按钮
             */
            ctx.save();

            // enhance shadow effect
            if (this.buttonCooldown.right) {
                ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
                ctx.shadowBlur = 2;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 1;
            } else if (this.buttonStates.right.pressed) {
                ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 1;
            } else {
                ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 3;
            }

            ctx.globalAlpha = 0.95;
            
            // 检查是否应该禁用
            const pullDisabled = this.seedHistory.length < 2 || this.buttonStates.right.isAtEnd || this.buttonCooldown.right;
            
            if (pullDisabled) {
                ctx.fillStyle = "#666666ff";
            } else {
                ctx.fillStyle = this.buttonStates.right.pressed ? "#444444ff" : "#222222ff";
            }
            
            ctx.beginPath();
            ctx.roundRect(pos.xRight, pos.y, btnW, btnH, 8);
            ctx.fill();

            // enhance highlight effect
            if (!this.buttonStates.right.pressed && !pullDisabled) {
                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;

                const gradient = ctx.createLinearGradient(pos.xRight, pos.y, pos.xRight, pos.y + btnH / 2);
                gradient.addColorStop(0, "rgba(255, 255, 255, 0.05)");
                gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.roundRect(pos.xRight, pos.y, btnW, btnH / 2, [8, 8, 0, 0]);
                ctx.fill();
            }

            ctx.restore();

            // text
            ctx.save();
            ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 1;
            ctx.font = "11px Inter, Arial, sans-serif";
            ctx.fillStyle = pullDisabled ? "#999999ff" : "#fff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // track button state
            const textOffsetYRight = this.buttonStates.right.pressed ? 1 : 0;
            ctx.fillText("Pull last seed", pos.xRight + btnW/2, pos.y + btnH/2 + textOffsetYRight);
            ctx.restore();
        };

        /**
         * 处理鼠标点击事件
         */
        nodeType.prototype.onMouseDown = function(e, mousePos, graphcanvas) {
            const btnPos = getButtonPos(this);
            const btnW = btnPos.w;

            // "Manual random" 按钮
            if (mousePos[0] >= btnPos.xLeft && mousePos[0] <= btnPos.xLeft+btnW &&
                mousePos[1] >= btnPos.y && mousePos[1] <= btnPos.y+btnH) {
                
                // 检查冷却状态
                if (this.buttonCooldown.left) {
                    console.log('[Manual Random] Button is in cooldown, ignoring click');
                    return true;
                }
                
                console.log('[Manual Random] Button clicked');
                
                // 立即进入冷却期
                this.buttonCooldown.left = true;
                console.log('[Manual Random] Button cooldown activated');
                
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
                                console.log('[Manual Random] Button cooldown released');
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
            if (mousePos[0] >= btnPos.xRight && mousePos[0] <= btnPos.xRight+btnW &&
                mousePos[1] >= btnPos.y && mousePos[1] <= btnPos.y+btnH) {
                
                // 检查冷却状态
                if (this.buttonCooldown.right) {
                    console.log('[Pull Last Seed] Button is in cooldown, ignoring click');
                    return true;
                }
                
                if (this.seedHistory.length >= 2 && !this.buttonStates.right.isAtEnd) {
                    
                    console.log('[Pull Last Seed] Button clicked, history:', this.seedHistory);
                    
                    // 立即进入冷却期
                    this.buttonCooldown.right = true;
                    console.log('[Pull Last Seed] Button cooldown activated');
                    
                    // 设置control_after_generate为fixed
                    const controlWidget = this.widgets.find((w) => w.name === "control_after_generate");
                    if (controlWidget) {
                        controlWidget.value = "fixed";
                    }

                    const seedWidget = this.widgets.find((w) => w.name === "seed");
                    if (seedWidget) {
                        const lastSeed = this.seedHistory[1];
                        
                        console.log('[Pull Last Seed] Restoring to:', lastSeed);

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
                                    console.log('[Pull Last Seed] Button cooldown released');
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
                if (node.type === "A1r Seed Control" && node.forcedSeed !== null) {
                    const nodeId = node.id;
                    if (prompt.output && prompt.output[nodeId]) {
                        prompt.output[nodeId].inputs.seed = node.forcedSeed;
                        console.log('[GraphToPrompt] Injected seed', node.forcedSeed, 'for node', nodeId);
                    }
                }
            }
            
            return prompt;
        };
    }
});