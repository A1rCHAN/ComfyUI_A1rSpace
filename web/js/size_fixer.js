import { app } from "/scripts/app.js";

/*
 * A1rSpace Node Size Fixer
 * 
 * Manages and protects node sizes for A1r custom nodes:
 * - Applies default sizes on node creation
 * - Enforces minimum size constraints
 * - Preserves user-modified sizes across saves/loads
 * - Prevents unwanted size resets
 */

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_SIZE = {
    // config nodes
    "A1r KSampler Config": [230, 330],
    "A1r KSampler Config Values": [230, 200],
    "A1r LoRA Config": [210, 230],
    "A1r LoRA Config Advance": [300, 120],
    "A1r ControlNet Config": [210, 280],
    "A1r Widget Collector": [220, 30],

    // switch nodes
    "A1r Latent Encode Transform": [240, 150],
    "A1r VAE Decode Transform": [210, 110],
    "A1r Image Upscale Transform": [240, 150],
    "A1r Latent Upscale Transform": [240, 150],

    // text nodes
    "A1r Text Box": [400, 200],
    "A1r Text Merge": [220, 280],
    "A1r Text Translate Merge with Clip Encode": [220, 470],

    // utils nodes
    "A1r Size Canvas": [270, 340],
};

const MIN_SIZE = {
    // control nodes
    "A1r Widget Collector": [200, 30],
    "A1r Node Mode Collector": [200, 30],
    "A1r Node Mode Console": [200, 30],
    "A1r Mode Relay": [150, 30],
    "A1r Mode Inverter": [150, 30],
    "A1r Seed Control": [210, 110],

    // text nodes
    "A1r Text Show": [210, 90],
    
    // utils nodes
    "A1r Custom Slider": [210, 30],
    "A1r Custom Boolean": [210, 30],
};

const FALLBACK_SIZE = [200, 100];
const GRAPH_READY_TIMEOUT = 5000; // 最大等待时间

// ============================================================================
// Debug Configuration
// ============================================================================

const DEBUG = false; // Set to true to enable debug logging

// ============================================================================
// Utility Functions
// ============================================================================

const Logger = {
    _enabled: DEBUG,
    
    enable() {
        this._enabled = true;
    },
    
    disable() {
        this._enabled = false;
    },
    
    debug(...args) {
        if (this._enabled || (typeof window !== 'undefined' && window._A1R_DEBUG)) {
            console.debug('[A1rSpace][SizeFixer]', ...args);
        }
    },
    
    warn(...args) {
        if (this._enabled || (typeof window !== 'undefined' && window._A1R_DEBUG)) {
            console.warn('[A1rSpace][SizeFixer]', ...args);
        }
    },
    
    error(...args) {
        console.error('[A1rSpace][SizeFixer]', ...args);
    }
};

const SizeHelper = {
    _defaultSizeCache: new Map(),
    
    /**
     * 检查是否为 A1r 节点
     */
    isA1rNode(nodeName) {
        return nodeName && typeof nodeName === 'string' && nodeName.startsWith("A1r");
    },
    
    /**
     * 确保 size 是可修改的普通数组
     */
    ensureSizeArray(size) {
        if (!size || typeof size !== 'object' || size.length !== 2) {
            return [...FALLBACK_SIZE];
        }
        
        // 如果是 TypedArray，转换为普通数组
        if (!Array.isArray(size)) {
            return [Number(size[0]) || FALLBACK_SIZE[0], Number(size[1]) || FALLBACK_SIZE[1]];
        }
        
        return [Number(size[0]) || FALLBACK_SIZE[0], Number(size[1]) || FALLBACK_SIZE[1]];
    },
    
    /**
     * 获取节点的最小尺寸
     */
    getMinSize(nodeName) {
        const minSize = MIN_SIZE[nodeName];
        return minSize ? [minSize[0], minSize[1]] : [0, 0];
    },
    
    /**
     * 应用最小尺寸限制
     */
    applyMinSizeConstraints(size, nodeName) {
        const [minW, minH] = this.getMinSize(nodeName);
        const validSize = this.ensureSizeArray(size);
        
        return [
            Math.max(validSize[0], minW),
            Math.max(validSize[1], minH)
        ];
    },
    
    /**
     * 获取节点的默认尺寸（带缓存）
     */
    getDefaultSize(nodeNameOrNode) {
        if (!nodeNameOrNode) return null;
        
        // 如果传入的是节点对象
        if (typeof nodeNameOrNode === 'object') {
            const node = nodeNameOrNode;
            const tryKeys = [node.type, node.name, node.title];
            
            for (const key of tryKeys) {
                if (key && DEFAULT_SIZE[key]) {
                    return [...DEFAULT_SIZE[key]];
                }
            }
            
            // 使用缓存进行模糊匹配
            const cacheKey = node.type || node.name || '';
            if (this._defaultSizeCache.has(cacheKey)) {
                const cached = this._defaultSizeCache.get(cacheKey);
                return cached ? [...cached] : null;
            }
            
            // 大小写不敏感匹配
            const nodeTypeLower = cacheKey.toLowerCase();
            for (const key in DEFAULT_SIZE) {
                if (key.toLowerCase() === nodeTypeLower) {
                    const size = DEFAULT_SIZE[key];
                    this._defaultSizeCache.set(cacheKey, size);
                    return [...size];
                }
            }
            
            this._defaultSizeCache.set(cacheKey, null);
            return null;
        }
        
        // 如果传入的是字符串
        const nodeName = nodeNameOrNode;
        const size = DEFAULT_SIZE[nodeName];
        return size ? [...size] : null;
    },
    
    /**
     * 注册新的默认尺寸
     */
    registerDefaultSize(nodeName, size) {
        if (!nodeName || !size || size.length !== 2) {
            Logger.warn('Invalid size registration:', nodeName, size);
            return false;
        }
        
        if (!DEFAULT_SIZE[nodeName]) {
            DEFAULT_SIZE[nodeName] = [Number(size[0]), Number(size[1])];
            Logger.debug('Registered default size:', nodeName, DEFAULT_SIZE[nodeName]);
            return true;
        }
        
        return false;
    },
    
    /**
     * 检查是否有默认尺寸定义
     */
    hasDefaultSize(nodeName) {
        return DEFAULT_SIZE.hasOwnProperty(nodeName);
    },
    
    /**
     * 统一更新节点尺寸
     */
    updateNodeSize(node, width, height, options = {}) {
        const {
            userModified = undefined,
            nodeName = node.type || node.name,
            applyMin = true
        } = options;
        
        // 初始化元数据
        if (!node._a1r_size_data) {
            node._a1r_size_data = {
                userModified: false,
                lastWidth: null,
                lastHeight: null
            };
        }
        
        // 应用最小尺寸限制
        let finalSize = [Number(width), Number(height)];
        if (applyMin) {
            finalSize = this.applyMinSizeConstraints(finalSize, nodeName);
        }
        
        // 更新尺寸
        node.size = finalSize;
        node._a1r_size_data.lastWidth = finalSize[0];
        node._a1r_size_data.lastHeight = finalSize[1];
        
        // 更新用户修改标记
        if (userModified !== undefined) {
            node._a1r_size_data.userModified = userModified;
        }
        
        Logger.debug('Size updated:', nodeName, 
            `${finalSize[0]}x${finalSize[1]}`, 
            'userModified:', node._a1r_size_data.userModified);
        
        return finalSize;
    },
    
    /**
     * 初始化节点的尺寸元数据
     */
    initSizeMetadata(node) {
        if (!node._a1r_size_data) {
            node._a1r_size_data = {
                userModified: false,
                lastWidth: null,
                lastHeight: null
            };
        }
        return node._a1r_size_data;
    }
};

// ============================================================================
// Lifecycle Wrappers
// ============================================================================

const LifecycleWrappers = {
    /**
     * 包装 onNodeCreated - 设置初始尺寸
     */
    wrapOnNodeCreated(nodeType, nodeData, originalMethod) {
        nodeType.prototype.onNodeCreated = function() {
            Logger.debug('onNodeCreated:', nodeData.name);
            
            // 初始化元数据
            SizeHelper.initSizeMetadata(this);
            
            // 优先使用预定义的默认尺寸
            const defaultSize = SizeHelper.getDefaultSize(nodeData.name);
            if (defaultSize) {
                SizeHelper.updateNodeSize(this, defaultSize[0], defaultSize[1], {
                    userModified: false,
                    nodeName: nodeData.name
                });
            } else if (this.size && this.size.length === 2) {
                // 如果没有预定义，使用当前尺寸并注册
                const currentSize = SizeHelper.ensureSizeArray(this.size);
                this._a1r_size_data.lastWidth = currentSize[0];
                this._a1r_size_data.lastHeight = currentSize[1];
                
                // 注册为默认尺寸
                SizeHelper.registerDefaultSize(nodeData.name, currentSize);
            }
            
            // 调用原始方法
            const result = originalMethod ? originalMethod.apply(this, arguments) : undefined;
            
            // 原始方法可能修改了尺寸，再次确保使用默认尺寸
            if (defaultSize) {
                SizeHelper.updateNodeSize(this, defaultSize[0], defaultSize[1], {
                    userModified: false,
                    nodeName: nodeData.name
                });
            }
            
            return result;
        };
    },
    
    /**
     * 包装 onConfigure - 从保存的数据恢复尺寸
     */
    wrapOnConfigure(nodeType, nodeData, originalMethod) {
        nodeType.prototype.onConfigure = function(info) {
            Logger.debug('[Size Fixer] onConfigure START:', nodeData.name,
                'has metadata=', !!info.a1r_metadata?.size_data,
                'userModified from file=', info.a1r_metadata?.size_data?.userModified,
                'size from file=', info.size);
            
            // 保存当前状态
            const prevUserModified = this._a1r_size_data?.userModified;
            const prevSize = this.size ? SizeHelper.ensureSizeArray(this.size) : null;
            
            // 调用原始方法
            const result = originalMethod ? originalMethod.apply(this, arguments) : undefined;
            
            // 初始化元数据
            SizeHelper.initSizeMetadata(this);
            
            // 从序列化数据恢复元数据
            if (info && info.a1r_metadata && info.a1r_metadata.size_data) {
                const savedData = info.a1r_metadata.size_data;
                this._a1r_size_data.userModified = !!savedData.userModified;
                this._a1r_size_data.lastWidth = savedData.lastWidth;
                this._a1r_size_data.lastHeight = savedData.lastHeight;
                
                Logger.debug('[Size Fixer] Restored metadata:', savedData);
            }
            
            // 确定最终尺寸
            let finalSize = null;
            
            // 1. 优先使用保存的尺寸（如果用户修改过）
            if (info && info.size && Array.isArray(info.size)) {
                finalSize = SizeHelper.applyMinSizeConstraints(info.size, nodeData.name);
                
                // 如果有明确的用户修改标记
                if (info.a1r_metadata && info.a1r_metadata.size_data && 
                    info.a1r_metadata.size_data.userModified) {
                    this._a1r_size_data.userModified = true;
                }
            }
            // 2. 使用之前的状态（如果标记为用户修改）
            else if (prevUserModified && prevSize) {
                finalSize = SizeHelper.applyMinSizeConstraints(prevSize, nodeData.name);
                this._a1r_size_data.userModified = true;
            }
            // 3. 使用默认尺寸
            else {
                const defaultSize = SizeHelper.getDefaultSize(nodeData.name);
                if (defaultSize) {
                    finalSize = defaultSize;
                    this._a1r_size_data.userModified = false;
                }
            }
            
            // 应用最终尺寸
            if (finalSize) {
                SizeHelper.updateNodeSize(this, finalSize[0], finalSize[1], {
                    nodeName: nodeData.name,
                    applyMin: true
                });
                Logger.debug('[Size Fixer] Applied final size:', finalSize,
                    'userModified=', this._a1r_size_data.userModified);
            }
            
            Logger.debug('[Size Fixer] onConfigure END:', nodeData.name,
                'final size=', this.size,
                'userModified=', this._a1r_size_data.userModified);
            
            return result;
        };
    },
    
    /**
     * 包装 onResize - 区分用户操作和程序操作
     */
    wrapOnResize(nodeType, nodeData, originalMethod) {
        nodeType.prototype.onResize = function(size) {
            const result = originalMethod ? originalMethod.apply(this, arguments) : undefined;
            
            const isProgrammatic = !!this._a1r_programmatic_resize;
            Logger.debug('[Size Fixer] onResize:', nodeData.name, 
                'new size=', size,
                'programmatic=', isProgrammatic,
                'will set userModified=', !isProgrammatic);
            
            SizeHelper.initSizeMetadata(this);
            
            if (this.size) {
                const finalSize = SizeHelper.applyMinSizeConstraints(this.size, nodeData.name);
                
                // 只有非程序化的 resize 才标记为用户修改
                const isUserModified = !this._a1r_programmatic_resize;
                
                SizeHelper.updateNodeSize(this, finalSize[0], finalSize[1], {
                    userModified: isUserModified,
                    nodeName: nodeData.name
                });
                
                Logger.debug('[Size Fixer] onResize complete:', 
                    'userModified=', this._a1r_size_data.userModified,
                    'final size=', this.size);
            }
            
            return result;
        };
    },
    
    /**
     * 包装 onSerialize - 保存尺寸数据
     */
    wrapOnSerialize(nodeType, nodeData, originalMethod) {
        nodeType.prototype.onSerialize = function(info) {
            const result = originalMethod ? originalMethod.apply(this, arguments) : undefined;
            
            try {
                // 初始化元数据容器
                if (!info.a1r_metadata) {
                    info.a1r_metadata = {};
                }
                
                // 确保 _a1r_size_data 存在
                SizeHelper.initSizeMetadata(this);
                
                // 保存当前实际尺寸
                if (this.size && (Array.isArray(this.size) || 
                    (typeof this.size === 'object' && this.size.length === 2))) {
                    const w = Number(this.size[0]) || 0;
                    const h = Number(this.size[1]) || 0;
                    info.size = [w, h];
                    
                    // 同步到元数据
                    this._a1r_size_data.lastWidth = w;
                    this._a1r_size_data.lastHeight = h;
                } else if (this._a1r_size_data.lastWidth && this._a1r_size_data.lastHeight) {
                    // 回退到元数据中的尺寸
                    info.size = [this._a1r_size_data.lastWidth, this._a1r_size_data.lastHeight];
                }
                
                // 保存完整的元数据
                info.a1r_metadata.size_data = {
                    userModified: !!this._a1r_size_data.userModified,
                    lastWidth: this._a1r_size_data.lastWidth,
                    lastHeight: this._a1r_size_data.lastHeight
                };
                
                Logger.debug('[Size Fixer] onSerialize:', nodeData.name, 
                    'size:', info.size, 
                    'userModified:', info.a1r_metadata.size_data.userModified,
                    'metadata:', info.a1r_metadata.size_data);
                
            } catch (e) {
                Logger.error('Serialization failed:', nodeData.name, e);
            }
            
            return result;
        };
    }
};

// ============================================================================
// Graph Load Handler
// ============================================================================

const GraphLoadHandler = {
    /**
     * 等待图形完全加载
     */
    async waitForGraphReady(timeout = GRAPH_READY_TIMEOUT) {
        const startTime = Date.now();
        
        return new Promise((resolve, reject) => {
            const check = () => {
                // 检查是否超时
                if (Date.now() - startTime > timeout) {
                    Logger.warn('Graph ready timeout, proceeding anyway');
                    resolve();
                    return;
                }
                
                // 检查图形是否就绪
                if (!app.graph || !app.graph.nodes || app.graph.nodes.length === 0) {
                    requestAnimationFrame(check);
                    return;
                }
                
                // 额外等待一帧确保所有节点都已渲染
                requestAnimationFrame(() => {
                    Logger.debug('Graph ready with', app.graph.nodes.length, 'nodes');
                    resolve();
                });
            };
            
            check();
        });
    },
    
    /**
     * 修复单个节点的尺寸
     */
    fixNodeSize(node) {
        if (!SizeHelper.isA1rNode(node.type)) {
            return;
        }
        
        Logger.debug('Fixing node:', node.type);
        
        // 迁移旧的元数据（从 node.size 到 node._a1r_size_data）
        this.migrateOldMetadata(node);
        
        // 初始化元数据
        SizeHelper.initSizeMetadata(node);
        
        // 如果节点没有有效尺寸且未被用户修改，应用默认尺寸
        if ((!node.size || node.size.length !== 2) && !node._a1r_size_data.userModified) {
            const defaultSize = SizeHelper.getDefaultSize(node);
            if (defaultSize) {
                SizeHelper.updateNodeSize(node, defaultSize[0], defaultSize[1], {
                    userModified: false,
                    nodeName: node.type
                });
            }
        }
        
        // 从元数据恢复尺寸
        if (node._a1r_size_data.lastWidth && node._a1r_size_data.lastHeight) {
            SizeHelper.updateNodeSize(
                node, 
                node._a1r_size_data.lastWidth, 
                node._a1r_size_data.lastHeight,
                {
                    nodeName: node.type,
                    applyMin: true
                }
            );
        }
        
        // 处理 updateNodeSize 方法
        this.handleUpdateNodeSize(node);
        
        // 标记需要重绘
        node.setDirtyCanvas(true, true);
    },
    
    /**
     * 迁移旧的元数据格式
     */
    migrateOldMetadata(node) {
        if (node && node.size && typeof node.size === 'object') {
            try {
                const s = node.size;
                const props = {};
                
                if (s.userModified !== undefined) props.userModified = !!s.userModified;
                if (s.lastWidth !== undefined) props.lastWidth = Number(s.lastWidth) || null;
                if (s.lastHeight !== undefined) props.lastHeight = Number(s.lastHeight) || null;
                
                if (Object.keys(props).length > 0) {
                    node._a1r_size_data = Object.assign({}, node._a1r_size_data || {}, props);
                    
                    // 清理旧属性
                    try { delete s.userModified; } catch (e) {}
                    try { delete s.lastWidth; } catch (e) {}
                    try { delete s.lastHeight; } catch (e) {}
                    
                    Logger.debug('Migrated old metadata for', node.type);
                }
            } catch (err) {
                Logger.warn('Failed to migrate metadata for', node.type, err);
            }
        }
    },
    
    /**
     * 处理节点的 updateNodeSize 方法
     */
    handleUpdateNodeSize(node) {
        if (typeof node.updateNodeSize !== 'function') {
            return;
        }
        
        try {
            const userModified = !!node._a1r_size_data.userModified;
            
            // 只对未被用户修改的节点调用 updateNodeSize
            if (!userModified) {
                // 标记为程序化 resize，避免触发 userModified
                node._a1r_programmatic_resize = true;
                
                try {
                    node.updateNodeSize();
                } catch (e) {
                    Logger.warn('updateNodeSize failed for', node.type, e);
                } finally {
                    delete node._a1r_programmatic_resize;
                }
                
                // 保存重新计算的尺寸
                if (node.size && node.size.length === 2) {
                    node._a1r_size_data.lastWidth = node.size[0];
                    node._a1r_size_data.lastHeight = node.size[1];
                    
                    // 检查是否与默认尺寸相同
                    const defaultSize = SizeHelper.getDefaultSize(node);
                    if (defaultSize && 
                        node.size[0] === defaultSize[0] && 
                        node.size[1] === defaultSize[1]) {
                        node._a1r_size_data.userModified = false;
                    }
                }
            } else {
                // 用户修改过的节点，恢复保存的尺寸
                if (node._a1r_size_data.lastWidth && node._a1r_size_data.lastHeight) {
                    node.size = [
                        node._a1r_size_data.lastWidth,
                        node._a1r_size_data.lastHeight
                    ];
                }
            }
        } catch (err) {
            Logger.error('Failed to handle updateNodeSize for', node.type, err);
        }
    },
    
    /**
     * 修复所有节点的尺寸
     */
    async fixAllNodeSizes() {
        await this.waitForGraphReady();
        
        if (!app.graph || !app.graph.nodes) {
            Logger.warn('No graph or nodes found');
            return;
        }
        
        Logger.debug('Fixing sizes for', app.graph.nodes.length, 'nodes');
        
        for (const node of app.graph.nodes) {
            try {
                this.fixNodeSize(node);
            } catch (e) {
                Logger.error('Failed to fix node size:', node.type, e);
            }
        }
        
        Logger.debug('Size fixing complete');
    }
};

// ============================================================================
// Global API
// ============================================================================

window.A1rSpace_SizeFixer = {
    registerDefaultSize(nodeName, size) {
        return SizeHelper.registerDefaultSize(nodeName, size);
    },
    
    hasDefaultSize(nodeName) {
        return SizeHelper.hasDefaultSize(nodeName);
    },
    
    getDefaultSize(nodeName) {
        return SizeHelper.getDefaultSize(nodeName);
    },
    
    enableDebug() {
        Logger.enable();
    },
    
    disableDebug() {
        Logger.disable();
    },
    
    // 手动触发尺寸修复
    fixNodeSize(node) {
        GraphLoadHandler.fixNodeSize(node);
    },
    
    fixAllNodes() {
        GraphLoadHandler.fixAllNodeSizes();
    }
};

// ============================================================================
// Extension Registration
// ============================================================================

app.registerExtension({
    name: "A1rSpace.NodeSizeFixer",
    
    async beforeRegisterNodeDef(nodeType, nodeData) {
        // 只处理 A1r 节点
        if (!SizeHelper.isA1rNode(nodeData.name)) {
            return;
        }
        
        // 防止重复包装
        if (nodeType.prototype._a1r_size_fixer_applied) {
            Logger.warn('Size fixer already applied to', nodeData.name);
            return;
        }
        
        Logger.debug('Applying size fixer to', nodeData.name);
        
        // 标记已包装
        nodeType.prototype._a1r_size_fixer_applied = true;
        
        // 保存原始方法
        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        const origOnConfigure = nodeType.prototype.onConfigure;
        const origOnResize = nodeType.prototype.onResize;
        const origOnSerialize = nodeType.prototype.onSerialize;
        
        // 包装生命周期方法
        LifecycleWrappers.wrapOnNodeCreated(nodeType, nodeData, origOnNodeCreated);
        LifecycleWrappers.wrapOnConfigure(nodeType, nodeData, origOnConfigure);
        LifecycleWrappers.wrapOnResize(nodeType, nodeData, origOnResize);
        LifecycleWrappers.wrapOnSerialize(nodeType, nodeData, origOnSerialize);
    },
    
    async afterGraphLoad() {
        Logger.debug('Graph loaded, fixing node sizes...');
        
        try {
            await GraphLoadHandler.fixAllNodeSizes();
        } catch (e) {
            Logger.error('Failed to fix node sizes after graph load:', e);
        }
    }
});

Logger.debug('A1rSpace Node Size Fixer loaded');