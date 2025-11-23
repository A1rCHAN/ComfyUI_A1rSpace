/**
 * Image Loader with Crop - ComfyUI Extension
 * Adds crop editor functionality to A1r Load Image node
 */

import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

app.registerExtension({
    name: "A1rSpace.ImageLoaderCrop",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "A1r Load Image") {
            // Store crop data on node
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                if (onNodeCreated) {
                    onNodeCreated.apply(this, arguments);
                }
                this.cropData = null;
                
                // Add hidden widget for crop_data
                const cropWidget = this.addWidget("text", "crop_data", "", function(v) {}, {
                    serialize: true
                });
                // Hide the widget properly
                cropWidget.type = "hidden";
                cropWidget.computeSize = () => [0, -4];
                cropWidget.hidden = true;
                if (typeof cropWidget.serialize !== "function") {
                    cropWidget.serializeValue = () => cropWidget.value;
                }

                // Hook into image widget to clear crop data when image changes
                const imageWidget = this.widgets?.find(w => w.name === "image");
                if (imageWidget) {
                    const originalCallback = imageWidget.callback;
                    const self = this;
                    imageWidget.callback = function(v) {
                        if (self.cropData && self.cropData.imageName !== v) {
                            self.cropData = null;
                            const cropWidget = self.widgets?.find(w => w.name === "crop_data");
                            if (cropWidget) {
                                cropWidget.value = "";
                            }
                        }
                        if (originalCallback) {
                            return originalCallback.apply(this, arguments);
                        }
                    };
                }
            };
            
            // Serialize crop data when saving workflow  
            const onSerialize = nodeType.prototype.onSerialize;
            nodeType.prototype.onSerialize = function(o) {
                if (onSerialize) {
                    onSerialize.apply(this, arguments);
                }
                // Save cropData for display overlay
                if (this.cropData) {
                    o.cropData = this.cropData;
                }
            };
            
            // Restore crop data when loading workflow
            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function(o) {
                if (onConfigure) {
                    onConfigure.apply(this, arguments);
                }
                // Restore cropData for display overlay
                if (o.cropData) {
                    this.cropData = o.cropData;
                }
            };
            
            // Add context menu option to open crop editor
            const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
            nodeType.prototype.getExtraMenuOptions = function(_, options) {
                // Call original function first
                if (getExtraMenuOptions) {
                    getExtraMenuOptions.apply(this, arguments);
                }
                
                // Add crop editor option
                options.push({
                    content: "Open in CropEditor | Crop Canvas",
                    callback: async () => {
                        await openCropEditor(this);
                    }
                });
                
                return options;
            };
        }
    }
});

/**
 * Open crop editor in a popup window
 */
async function openCropEditor(node) {
    // Get the image widget
    const imageWidget = node.widgets?.find(w => w.name === "image");
    if (!imageWidget || !imageWidget.value) {
        alert("Please select an image first");
        return;
    }
    
    const imageName = imageWidget.value;
    
    // Get image URL
    const imageUrl = api.apiURL(`/view?filename=${encodeURIComponent(imageName)}&type=input&subfolder=`);
    
    // Load image to get dimensions
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
        // Open crop editor in popup
        openCropEditorWindow(imageUrl, img.width, img.height, async (cropData) => {
            // Convert crop data to JSON string
            const cropDataJson = JSON.stringify(cropData);
            
            // Find the hidden crop_data widget and update it
            const cropWidget = node.widgets?.find(w => w.name === "crop_data");
            if (cropWidget) {
                cropWidget.value = cropDataJson;
            }
            
            // Store crop data for display overlay
            node.cropData = {
                x: cropData.x,
                y: cropData.y,
                width: cropData.width,
                height: cropData.height,
                original_width: img.width,
                original_height: img.height,
                imageName: imageName
            };
            
            // Generate preview with overlay and upload
            await generateAndUploadPreview(node, img, cropData);
            
            // Mark node as changed and redraw
            if (app.graph) {
                app.graph.setDirtyCanvas(true, true);
            }
        });
    };
    
    img.onerror = () => {
        alert("Failed to load image");
    };
    
    img.src = imageUrl;
}

/**
 * Open crop editor in a new window/dialog
 */
function openCropEditorWindow(imageUrl, width, height, callback) {
    // Create crop editor container
    const container = document.createElement('div');
    container.id = 'crop-editor-container';
    container.className = 'crop-editor-container';
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #1e1e1e;
        display: flex;
        flex-direction: column;
        z-index: 10000;
    `;
    
    // Create header
    const header = document.createElement('div');
    header.className = 'crop-editor-header';
    header.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        background: #2d2d2d;
        border-bottom: 1px solid #3d3d3d;
    `;
    
    const title = document.createElement('div');
    title.className = 'crop-editor-title';
    title.textContent = '裁剪图像';
    title.style.cssText = 'font-size: 16px; font-weight: 600; color: #ffffff;';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'crop-editor-close';
    closeBtn.textContent = '×';
    closeBtn.title = '关闭';
    closeBtn.style.cssText = `
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        color: #ffffff;
        font-size: 24px;
        cursor: pointer;
        border-radius: 4px;
    `;
    closeBtn.onclick = () => {
        document.body.removeChild(container);
    };
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Create content area
    const content = document.createElement('div');
    content.className = 'crop-editor-content';
    content.style.cssText = 'flex: 1; display: flex; overflow: hidden;';
    
    // Create canvas wrapper
    const canvasWrapper = document.createElement('div');
    canvasWrapper.className = 'crop-canvas-wrapper';
    canvasWrapper.style.cssText = `
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        background: #000;
        overflow: hidden;
    `;
    
    // Canvas container for proper positioning
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = 'position: relative; display: inline-block;';
    
    const canvas = document.createElement('canvas');
    canvas.id = 'crop-canvas';
    canvas.className = 'crop-canvas';
    canvas.style.cssText = 'display: block;';
    
    const overlay = document.createElement('div');
    overlay.id = 'crop-overlay';
    overlay.className = 'crop-overlay';
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
    `;
    
    const cropBox = document.createElement('div');
    cropBox.id = 'crop-box';
    cropBox.className = 'crop-box';
    cropBox.style.cssText = `
        position: absolute;
        pointer-events: all;
        cursor: move;
        user-select: none;
        border: 2px solid #fff;
    `;
    
    // Add resize handles
    const directions = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
    const cursors = {
        nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
        w: 'w-resize', e: 'e-resize',
        sw: 'sw-resize', s: 's-resize', se: 'se-resize'
    };
    
    directions.forEach(dir => {
        const handle = document.createElement('div');
        handle.className = `crop-handle crop-handle-${dir}`;
        handle.dataset.direction = dir;
        handle.style.cssText = `
            position: absolute;
            width: 12px;
            height: 12px;
            background: #fff;
            border: 2px solid #0078d4;
            border-radius: 50%;
            pointer-events: all;
            cursor: ${cursors[dir]};
        `;
        
        // Position handles
        if (dir.includes('n')) handle.style.top = '-6px';
        if (dir.includes('s')) handle.style.bottom = '-6px';
        if (dir.includes('w')) handle.style.left = '-6px';
        if (dir.includes('e')) handle.style.right = '-6px';
        if (dir === 'n' || dir === 's') {
            handle.style.left = '50%';
            handle.style.transform = 'translateX(-50%)';
        }
        if (dir === 'w' || dir === 'e') {
            handle.style.top = '50%';
            handle.style.transform = 'translateY(-50%)';
        }
        
        cropBox.appendChild(handle);
    });
    
    // Add crop info
    const cropInfo = document.createElement('div');
    cropInfo.className = 'crop-info';
    cropInfo.id = 'crop-info';
    cropInfo.style.cssText = `
        position: absolute;
        bottom: -30px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.7);
        color: #fff;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        white-space: nowrap;
        pointer-events: none;
    `;
    const cropDimensions = document.createElement('span');
    cropDimensions.id = 'crop-dimensions';
    cropDimensions.textContent = '0 × 0';
    cropInfo.appendChild(cropDimensions);
    cropBox.appendChild(cropInfo);
    
    overlay.appendChild(cropBox);
    canvasContainer.appendChild(canvas);
    canvasContainer.appendChild(overlay);
    canvasWrapper.appendChild(canvasContainer);
    
    // Create controls panel
    const controls = createControlsPanel(callback, container);
    
    content.appendChild(canvasWrapper);
    content.appendChild(controls);
    
    // Create footer
    const footer = document.createElement('div');
    footer.className = 'crop-editor-footer';
    footer.style.cssText = `
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 20px;
        background: #2d2d2d;
        border-top: 1px solid #3d3d3d;
    `;
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
        padding: 10px 20px;
        border: 1px solid #5d5d5d;
        border-radius: 4px;
        background: transparent;
        color: #ffffff;
        cursor: pointer;
        font-size: 14px;
    `;
    cancelBtn.onclick = () => {
        document.body.removeChild(container);
    };
    
    const applyBtn = document.createElement('button');
    applyBtn.id = 'crop-apply-btn';
    applyBtn.textContent = '应用裁剪';
    applyBtn.style.cssText = `
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        background: #0078d4;
        color: #ffffff;
        cursor: pointer;
        font-size: 14px;
    `;
    
    footer.appendChild(cancelBtn);
    footer.appendChild(applyBtn);
    
    // Assemble container
    container.appendChild(header);
    container.appendChild(content);
    container.appendChild(footer);
    
    document.body.appendChild(container);
    
    // Initialize crop editor logic
    initCropEditor(canvas, cropBox, imageUrl, width, height, applyBtn, callback, container);
}

function createControlsPanel(callback, container) {
    const controls = document.createElement('div');
    controls.className = 'crop-controls';
    controls.style.cssText = `
        width: 280px;
        min-width: 250px;
        max-width: 350px;
        background: #252525;
        border-left: 1px solid #3d3d3d;
        padding: 20px;
        overflow-y: auto;
        overflow-x: hidden;
        display: flex;
        flex-direction: column;
        gap: 20px;
    `;
    
    // Aspect ratio section
    const ratioSection = document.createElement('div');
    ratioSection.innerHTML = `
        <label style="font-size: 13px; font-weight: 600; color: #e0e0e0; display: block; margin-bottom: 10px;">纵横比</label>
        <div class="crop-ratio-buttons" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">
            <button class="crop-ratio-btn active" data-ratio="free">自由</button>
            <button class="crop-ratio-btn" data-ratio="1:1">1:1</button>
            <button class="crop-ratio-btn" data-ratio="4:3">4:3</button>
            <button class="crop-ratio-btn" data-ratio="3:4">3:4</button>
            <button class="crop-ratio-btn" data-ratio="16:9">16:9</button>
            <button class="crop-ratio-btn" data-ratio="9:16">9:16</button>
            <button class="crop-ratio-btn" data-ratio="3:2">3:2</button>
            <button class="crop-ratio-btn" data-ratio="2:3">2:3</button>
        </div>
    `;
    
    // Style ratio buttons
    ratioSection.querySelectorAll('.crop-ratio-btn').forEach(btn => {
        btn.style.cssText = `
            padding: 6px 8px;
            background: #2d2d2d;
            border: 1px solid #3d3d3d;
            color: #ffffff;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            white-space: nowrap;
            min-height: 32px;
        `;
    });
    
    // Input section
    const inputSection = document.createElement('div');
    inputSection.innerHTML = `
        <label style="font-size: 13px; font-weight: 600; color: #e0e0e0; display: block; margin-bottom: 10px;">裁剪区域</label>
        <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: grid; grid-template-columns: 20px 1fr 20px 1fr; gap: 6px; align-items: center;">
                <label style="font-size: 11px; color: #b0b0b0; text-align: right;">X</label>
                <input type="number" id="crop-x" min="0" value="0" style="padding: 4px 6px; background: #2d2d2d; border: 1px solid #3d3d3d; color: #ffffff; border-radius: 4px; font-size: 12px; width: 100%; pointer-events: auto;">
                <label style="font-size: 11px; color: #b0b0b0; text-align: right;">Y</label>
                <input type="number" id="crop-y" min="0" value="0" style="padding: 4px 6px; background: #2d2d2d; border: 1px solid #3d3d3d; color: #ffffff; border-radius: 4px; font-size: 12px; width: 100%; pointer-events: auto;">
            </div>
            <div style="display: grid; grid-template-columns: 20px 1fr 20px 1fr; gap: 6px; align-items: center;">
                <label style="font-size: 11px; color: #b0b0b0; text-align: right;">宽</label>
                <input type="number" id="crop-width" min="1" value="100" style="padding: 4px 6px; background: #2d2d2d; border: 1px solid #3d3d3d; color: #ffffff; border-radius: 4px; font-size: 12px; width: 100%; pointer-events: auto;">
                <label style="font-size: 11px; color: #b0b0b0; text-align: right;">高</label>
                <input type="number" id="crop-height" min="1" value="100" style="padding: 4px 6px; background: #2d2d2d; border: 1px solid #3d3d3d; color: #ffffff; border-radius: 4px; font-size: 12px; width: 100%; pointer-events: auto;">
            </div>
        </div>
    `;
    
    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.id = 'crop-reset-btn';
    resetBtn.textContent = '重置';
    resetBtn.style.cssText = `
        padding: 10px 20px;
        background: #2d2d2d;
        color: #ffffff;
        border: 1px solid #3d3d3d;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    `;
    
    controls.appendChild(ratioSection);
    controls.appendChild(inputSection);
    controls.appendChild(resetBtn);
    
    return controls;
}

function initCropEditor(canvas, cropBox, imageUrl, originalWidth, originalHeight, applyBtn, callback, container) {
    const ctx = canvas.getContext('2d');
    const image = new Image();
    image.crossOrigin = 'anonymous';
    
    let scale = 1;
    let cropData = { x: 0, y: 0, width: 100, height: 100 };
    let aspectRatio = null;
    let isDragging = false;
    let isResizing = false;
    let dragStart = { x: 0, y: 0 };
    let dragOffset = { x: 0, y: 0 };
    let resizeDirection = null;
    
    image.onload = () => {
        // Setup canvas - 使用真实容器的尺寸
        const canvasWrapperEl = canvas.parentElement.parentElement; // canvasWrapper是真实容器
        const maxWidth = canvasWrapperEl.clientWidth - 20; // 留出小边距
        const maxHeight = canvasWrapperEl.clientHeight - 20;
        
        // 计算缩放比例，让图像尽可能填满可用空间
        const scaleW = maxWidth / image.width;
        const scaleH = maxHeight / image.height;
        scale = Math.min(scaleW, scaleH); // 移除2倍限制,让图像自适应填满空间
        
        canvas.width = image.width * scale;
        canvas.height = image.height * scale;
        
        // 默认裁剪框覆盖整个图像
        cropData = {
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height
        };
        
        render();
        setupEventListeners();
    };
    
    image.src = imageUrl;
    
    function render() {
        // Clear and draw image
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        
        // Draw dimmed overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Clear crop area
        ctx.clearRect(cropData.x, cropData.y, cropData.width, cropData.height);
        
        // Redraw image in crop area
        ctx.drawImage(
            image,
            cropData.x / scale, cropData.y / scale,
            cropData.width / scale, cropData.height / scale,
            cropData.x, cropData.y,
            cropData.width, cropData.height
        );
        
        // Update overlay
        cropBox.style.left = cropData.x + 'px';
        cropBox.style.top = cropData.y + 'px';
        cropBox.style.width = cropData.width + 'px';
        cropBox.style.height = cropData.height + 'px';
        
        // Update dimensions
        const actualWidth = Math.round(cropData.width / scale);
        const actualHeight = Math.round(cropData.height / scale);
        document.getElementById('crop-dimensions').textContent = `${actualWidth} × ${actualHeight}`;
        
        // Update inputs
        document.getElementById('crop-x').value = Math.round(cropData.x / scale);
        document.getElementById('crop-y').value = Math.round(cropData.y / scale);
        document.getElementById('crop-width').value = actualWidth;
        document.getElementById('crop-height').value = actualHeight;
    }
    
    function setupEventListeners() {
        // 初始化时设置"自由"按钮为激活状态
        const freeBtn = document.querySelector('.crop-ratio-btn[data-ratio="free"]');
        if (freeBtn) {
            freeBtn.style.background = '#0078d4';
            freeBtn.style.borderColor = '#0078d4';
        }
        
        // Drag crop box
        cropBox.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('crop-handle')) return;
            isDragging = true;
            dragStart.x = e.clientX;
            dragStart.y = e.clientY;
            dragOffset.x = cropData.x;
            dragOffset.y = cropData.y;
            e.preventDefault();
        });
        
        // Resize handles
        cropBox.querySelectorAll('.crop-handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                resizeDirection = e.target.dataset.direction;
                dragStart.x = e.clientX;
                dragStart.y = e.clientY;
                dragOffset = { ...cropData };
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        // Mouse move
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - dragStart.x;
                const dy = e.clientY - dragStart.y;
                cropData.x = Math.max(0, Math.min(dragOffset.x + dx, canvas.width - cropData.width));
                cropData.y = Math.max(0, Math.min(dragOffset.y + dy, canvas.height - cropData.height));
                render();
            } else if (isResizing) {
                handleResize(e);
            }
        });
        
        // Mouse up
        document.addEventListener('mouseup', () => {
            isDragging = false;
            isResizing = false;
        });
        
        // Ratio buttons
        document.querySelectorAll('.crop-ratio-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.crop-ratio-btn').forEach(b => {
                    b.style.background = '#2d2d2d';
                    b.style.borderColor = '#3d3d3d';
                });
                e.target.style.background = '#0078d4';
                e.target.style.borderColor = '#0078d4';
                
                const ratio = e.target.dataset.ratio;
                if (ratio === 'free') {
                    aspectRatio = null;
                } else {
                    const [w, h] = ratio.split(':').map(Number);
                    aspectRatio = w / h;
                    cropData.height = cropData.width / aspectRatio;
                    constrainCropBox();
                    render();
                }
            });
        });
        
        // Input change handlers - 使用 change 事件而不是 input 事件
        // 这样可以让用户完整输入数字后再应用,避免输入过程中被约束打断
        ['crop-x', 'crop-y'].forEach(id => {
            const input = document.getElementById(id);
            input.addEventListener('change', () => {
                const x = parseInt(document.getElementById('crop-x').value) || 0;
                const y = parseInt(document.getElementById('crop-y').value) || 0;
                
                cropData.x = x * scale;
                cropData.y = y * scale;
                
                constrainCropBox();
                render();
            });
        });
        
        // 宽度输入框 - 如果有纵横比约束,自动调整高度
        document.getElementById('crop-width').addEventListener('change', (e) => {
            const width = parseInt(e.target.value) || 100;
            cropData.width = width * scale;
            
            if (aspectRatio !== null) {
                // 根据宽度和纵横比自动计算高度
                cropData.height = cropData.width / aspectRatio;
            }
            
            constrainCropBox();
            render();
        });
        
        // 高度输入框 - 如果有纵横比约束,自动调整宽度
        document.getElementById('crop-height').addEventListener('change', (e) => {
            const height = parseInt(e.target.value) || 100;
            cropData.height = height * scale;
            
            if (aspectRatio !== null) {
                // 根据高度和纵横比自动计算宽度
                cropData.width = cropData.height * aspectRatio;
            }
            
            constrainCropBox();
            render();
        });
        
        // Reset button
        document.getElementById('crop-reset-btn').addEventListener('click', () => {
            cropData = {
                x: 0,
                y: 0,
                width: canvas.width,
                height: canvas.height
            };
            aspectRatio = null;
            // 重置比例按钮样式
            document.querySelectorAll('.crop-ratio-btn').forEach(b => {
                b.style.background = '#2d2d2d';
                b.style.borderColor = '#3d3d3d';
            });
            document.querySelector('[data-ratio="free"]').style.background = '#0078d4';
            document.querySelector('[data-ratio="free"]').style.borderColor = '#0078d4';
            render();
        });
        
        // Apply button
        applyBtn.addEventListener('click', () => {
            const result = {
                x: Math.round(cropData.x / scale),
                y: Math.round(cropData.y / scale),
                width: Math.round(cropData.width / scale),
                height: Math.round(cropData.height / scale)
            };
            document.body.removeChild(container);
            if (callback) callback(result);
        });
    }
    
    function handleResize(e) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        
        let newBox = { ...dragOffset };
        
        switch (resizeDirection) {
            case 'se':
                newBox.width = dragOffset.width + dx;
                newBox.height = dragOffset.height + dy;
                if (aspectRatio) {
                    // 根据变化较大的维度调整
                    if (Math.abs(dx) > Math.abs(dy)) {
                        newBox.height = newBox.width / aspectRatio;
                    } else {
                        newBox.width = newBox.height * aspectRatio;
                    }
                }
                break;
            case 'sw':
                newBox.x = dragOffset.x + dx;
                newBox.width = dragOffset.width - dx;
                newBox.height = dragOffset.height + dy;
                if (aspectRatio) {
                    if (Math.abs(dx) > Math.abs(dy)) {
                        newBox.height = newBox.width / aspectRatio;
                    } else {
                        newBox.width = newBox.height * aspectRatio;
                        newBox.x = dragOffset.x + dragOffset.width - newBox.width;
                    }
                }
                break;
            case 'ne':
                newBox.y = dragOffset.y + dy;
                newBox.width = dragOffset.width + dx;
                newBox.height = dragOffset.height - dy;
                if (aspectRatio) {
                    if (Math.abs(dx) > Math.abs(dy)) {
                        newBox.height = newBox.width / aspectRatio;
                        newBox.y = dragOffset.y + dragOffset.height - newBox.height;
                    } else {
                        newBox.width = newBox.height * aspectRatio;
                    }
                }
                break;
            case 'nw':
                newBox.x = dragOffset.x + dx;
                newBox.y = dragOffset.y + dy;
                newBox.width = dragOffset.width - dx;
                newBox.height = dragOffset.height - dy;
                if (aspectRatio) {
                    if (Math.abs(dx) > Math.abs(dy)) {
                        newBox.height = newBox.width / aspectRatio;
                        newBox.y = dragOffset.y + dragOffset.height - newBox.height;
                    } else {
                        newBox.width = newBox.height * aspectRatio;
                        newBox.x = dragOffset.x + dragOffset.width - newBox.width;
                    }
                }
                break;
            case 'e':
                newBox.width = dragOffset.width + dx;
                if (aspectRatio) {
                    newBox.height = newBox.width / aspectRatio;
                    newBox.y = dragOffset.y + (dragOffset.height - newBox.height) / 2;
                }
                break;
            case 'w':
                newBox.x = dragOffset.x + dx;
                newBox.width = dragOffset.width - dx;
                if (aspectRatio) {
                    newBox.height = newBox.width / aspectRatio;
                    newBox.y = dragOffset.y + (dragOffset.height - newBox.height) / 2;
                }
                break;
            case 's':
                newBox.height = dragOffset.height + dy;
                if (aspectRatio) {
                    newBox.width = newBox.height * aspectRatio;
                    newBox.x = dragOffset.x + (dragOffset.width - newBox.width) / 2;
                }
                break;
            case 'n':
                newBox.y = dragOffset.y + dy;
                newBox.height = dragOffset.height - dy;
                if (aspectRatio) {
                    newBox.width = newBox.height * aspectRatio;
                    newBox.x = dragOffset.x + (dragOffset.width - newBox.width) / 2;
                }
                break;
        }
        
        // 先应用新尺寸
        cropData = newBox;
        
        // 约束到边界，如果达到边界则锁定
        const oldData = { ...cropData };
        constrainCropBox();
        
        // 如果有比例锁定且达到边界，保持比例调整另一维度
        if (aspectRatio) {
            const hitBoundary = 
                cropData.x === 0 || 
                cropData.y === 0 || 
                cropData.x + cropData.width >= canvas.width || 
                cropData.y + cropData.height >= canvas.height;
            
            if (hitBoundary) {
                // 达到边界时，根据边界调整尺寸保持比例
                if (cropData.width !== oldData.width) {
                    cropData.height = cropData.width / aspectRatio;
                } else if (cropData.height !== oldData.height) {
                    cropData.width = cropData.height * aspectRatio;
                }
                // 再次约束确保不超出
                constrainCropBox();
            }
        }
        
        render();
    }
    
    function constrainCropBox() {
        // 确保裁剪框在画布范围内
        cropData.x = Math.max(0, cropData.x);
        cropData.y = Math.max(0, cropData.y);
        
        // 最小尺寸
        cropData.width = Math.max(20, cropData.width);
        cropData.height = Math.max(20, cropData.height);
        
        // 确保不超出右侧和底部边界
        if (cropData.x + cropData.width > canvas.width) {
            cropData.width = canvas.width - cropData.x;
        }
        if (cropData.y + cropData.height > canvas.height) {
            cropData.height = canvas.height - cropData.y;
        }
        
        // 如果有比例锁定，确保比例正确
        if (aspectRatio) {
            const currentRatio = cropData.width / cropData.height;
            if (Math.abs(currentRatio - aspectRatio) > 0.01) {
                // 根据哪个维度更接近边界来调整
                const widthRoom = canvas.width - cropData.x;
                const heightRoom = canvas.height - cropData.y;
                
                if (widthRoom / aspectRatio > heightRoom) {
                    // 高度受限，根据高度调整宽度
                    cropData.width = Math.min(cropData.height * aspectRatio, widthRoom);
                    cropData.height = cropData.width / aspectRatio;
                } else {
                    // 宽度受限,根据宽度调整高度
                    cropData.height = Math.min(cropData.width / aspectRatio, heightRoom);
                    cropData.width = cropData.height * aspectRatio;
                }
            }
        }
    }
}

/**
 * Generate preview image with crop overlay and upload to server
 * Based on ComfyUI official MaskEditor implementation
 */
async function generateAndUploadPreview(node, originalImage, cropData) {
    try {
        // Create canvas for preview
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = originalImage.width;
        previewCanvas.height = originalImage.height;
        const ctx = previewCanvas.getContext('2d');
        
        // Draw original image
        ctx.drawImage(originalImage, 0, 0);
        
        // Draw semi-transparent overlay outside crop area
        ctx.fillStyle = 'rgba(64, 64, 64, 0.7)'; // 半透明灰色遮罩
        
        // Top area
        if (cropData.y > 0) {
            ctx.fillRect(0, 0, originalImage.width, cropData.y);
        }
        
        // Bottom area
        if (cropData.y + cropData.height < originalImage.height) {
            ctx.fillRect(0, cropData.y + cropData.height, originalImage.width, originalImage.height - cropData.y - cropData.height);
        }
        
        // Left area
        if (cropData.x > 0) {
            ctx.fillRect(0, cropData.y, cropData.x, cropData.height);
        }
        
        // Right area
        if (cropData.x + cropData.width < originalImage.width) {
            ctx.fillRect(cropData.x + cropData.width, cropData.y, originalImage.width - cropData.x - cropData.width, cropData.height);
        }
        
        // Draw white border around crop area
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(cropData.x, cropData.y, cropData.width, cropData.height);
        
        // Convert canvas to blob
        const blob = await new Promise((resolve) => {
            previewCanvas.toBlob((blob) => resolve(blob), 'image/png');
        });
        
        // Generate filename (similar to official mask editor)
        const timestamp = Date.now();
        const filename = `croppreview-${timestamp}.png`;
        
        // Upload to server (similar to official uploadImage function)
        const formData = new FormData();
        formData.append('image', blob, filename);
        
        // Get original image reference
        const imageWidget = node.widgets?.find(w => w.name === "image");
        const originalRef = {
            filename: imageWidget.value,
            subfolder: '',
            type: 'input'
        };
        formData.append('original_ref', JSON.stringify(originalRef));
        formData.append('type', 'temp');
        formData.append('subfolder', 'croppreview');
        
        // Upload via API
        const response = await api.fetchApi('/upload/image', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            console.error('Failed to upload crop preview');
            return;
        }
        
        const data = await response.json();
        if (!data?.name) {
            console.error('Invalid upload response');
            return;
        }
        
        // Update node display immediately (like official mask editor)
        const previewUrl = api.apiURL(`/view?filename=${encodeURIComponent(data.name)}&type=temp&subfolder=croppreview&rand=${Math.random()}`);
        
        // Create or update preview image
        if (!node.imgs) {
            node.imgs = [];
        }
        
        const previewImg = new Image();
        previewImg.crossOrigin = 'anonymous';
        previewImg.src = previewUrl;
        
        previewImg.onload = () => {
            node.imgs[0] = previewImg;
            
            // Force redraw
            if (app.graph) {
                app.graph.setDirtyCanvas(true, true);
            }
        };
        
    } catch (error) {
        console.error('Error generating/uploading preview:', error);
    }
}
