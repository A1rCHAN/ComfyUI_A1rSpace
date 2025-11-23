import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

app.registerExtension({
    name: "A1r.ImageSaver",
    
    async setup() {
        // 监听所有节点的执行结果
        api.addEventListener("executed", (event) => {
            const { node, output } = event.detail || {};
            
            // 如果有图像输出，通知所有Image Saver节点
            if (output && output.images && output.images.length > 0) {
                app.graph._nodes.forEach((n) => {
                    if (n.type === "A1r Image Saver" && n.onImageAvailable) {
                        n.onImageAvailable(node, output.images);
                    }
                });
            }
        });
    },
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "A1r Image Saver") {
            
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            
            nodeType.prototype.onNodeCreated = function() {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                
                // 状态
                this.capturedImages = [];
                this.currentImageIndex = 0;
                this.totalSaved = 0;
                
                // 样式
                this.color = "#2a5a2a";
                this.bgcolor = "#1a3a1a";
                
                // 添加widgets
                this.statusWidget = this.addWidget("text", "Status", "⏸ Waiting for images", () => {}, {
                    serialize: false
                });
                
                this.imageInfoWidget = this.addWidget("text", "Captured", "0 images", () => {}, {
                    serialize: false
                });
                
                this.saveButton = this.addWidget("button", "💾 Save Current", null, () => {
                    this.saveCurrentImage();
                });
                
                this.saveAllButton = this.addWidget("button", "💾 Save All", null, () => {
                    this.saveAllImages();
                });
                
                this.savedCountWidget = this.addWidget("text", "Total Saved", "0 images", () => {}, {
                    serialize: false
                });
                
                this.setSize([340, 280]);
                
                return r;
            };
            
            // 接收图像
            nodeType.prototype.onImageAvailable = function(sourceNode, images) {
                console.log(`[A1r Image Saver] Received ${images.length} images from node ${sourceNode}`);
                
                // 存储图像信息
                this.capturedImages = images.map(img => ({
                    ...img,
                    sourceNode: sourceNode,
                    captureTime: Date.now()
                }));
                
                this.currentImageIndex = 0;
                
                // 更新状态
                this.statusWidget.value = "✓ Images captured";
                this.imageInfoWidget.value = `${this.capturedImages.length} image(s)`;
                
                // 显示预览
                if (this.capturedImages.length > 0) {
                    this.updatePreview(this.capturedImages[0]);
                }
                
                app.graph.setDirtyCanvas(true);
            };
            
            // 保存当前图像
            nodeType.prototype.saveCurrentImage = async function() {
                if (this.capturedImages.length === 0) {
                    this.statusWidget.value = "⚠ No images to save";
                    return;
                }
                
                const imageData = this.capturedImages[this.currentImageIndex];
                await this.saveImage(imageData);
            };
            
            // 保存所有图像
            nodeType.prototype.saveAllImages = async function() {
                if (this.capturedImages.length === 0) {
                    this.statusWidget.value = "⚠ No images to save";
                    return;
                }
                
                this.statusWidget.value = `⏳ Saving ${this.capturedImages.length} images...`;
                
                let savedCount = 0;
                for (const imageData of this.capturedImages) {
                    const success = await this.saveImage(imageData, true);
                    if (success) savedCount++;
                }
                
                this.statusWidget.value = `✓ Saved ${savedCount}/${this.capturedImages.length}`;
                
                setTimeout(() => {
                    this.statusWidget.value = "✓ Images captured";
                }, 3000);
            };
            
            // 保存单个图像
            nodeType.prototype.saveImage = async function(imageData, silent = false) {
                try {
                    if (!silent) {
                        this.statusWidget.value = "⏳ Saving...";
                    }
                    
                    // 获取filename_prefix
                    const prefixWidget = this.widgets.find(w => w.name === "filename_prefix");
                    const filename_prefix = prefixWidget ? prefixWidget.value : "A1r/Image";
                    
                    // 调用保存API
                    const response = await fetch("/a1r/save_image", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            source_file: imageData.filename,
                            source_type: imageData.type || "temp",
                            source_subfolder: imageData.subfolder || "",
                            filename_prefix: filename_prefix
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        this.totalSaved++;
                        this.savedCountWidget.value = `${this.totalSaved} image(s)`;
                        
                        if (!silent) {
                            this.statusWidget.value = `✓ Saved as ${result.filename}`;
                            
                            setTimeout(() => {
                                this.statusWidget.value = "✓ Images captured";
                            }, 3000);
                        }
                        
                        console.log(`[A1r Image Saver] Saved: ${result.path}`);
                        return true;
                    } else {
                        if (!silent) {
                            this.statusWidget.value = `✗ Failed: ${result.error}`;
                        }
                        console.error(`[A1r Image Saver] Save failed:`, result.error);
                        return false;
                    }
                    
                } catch (error) {
                    if (!silent) {
                        this.statusWidget.value = "✗ Save error";
                    }
                    console.error("[A1r Image Saver] Error:", error);
                    return false;
                }
            };
            
            // 更新预览
            nodeType.prototype.updatePreview = function(imageData) {
                const self = this;
                
                const url = `/view?filename=${imageData.filename}&type=${imageData.type || "temp"}&subfolder=${imageData.subfolder || ""}&rand=${Math.random()}`;
                
                const img = new Image();
                img.onload = function() {
                    self.previewImage = img;
                    app.graph.setDirtyCanvas(true);
                };
                img.src = url;
            };
            
            // 右键菜单
            const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
            nodeType.prototype.getExtraMenuOptions = function(_, options) {
                const r = getExtraMenuOptions ? getExtraMenuOptions.apply(this, arguments) : undefined;
                
                options.unshift(
                    {
                        content: "━━━ Image Saver ━━━",
                        disabled: true,
                        className: "a1r-menu-header"
                    },
                    {
                        content: "💾 Save Current Image",
                        callback: () => {
                            this.saveCurrentImage();
                        },
                        disabled: this.capturedImages.length === 0
                    },
                    {
                        content: "💾 Save All Images",
                        callback: () => {
                            this.saveAllImages();
                        },
                        disabled: this.capturedImages.length === 0
                    },
                    {
                        content: "📂 Open Output Folder",
                        callback: () => {
                            const prefixWidget = this.widgets.find(w => w.name === "filename_prefix");
                            const prefix = prefixWidget ? prefixWidget.value : "A1r/Image";
                            const subfolder = prefix.includes("/") ? prefix.split("/").slice(0, -1).join("/") : "";
                            window.open(`/view?filename=&type=output&subfolder=${subfolder}`, '_blank');
                        }
                    },
                    {
                        content: "🗑️ Clear Captured",
                        callback: () => {
                            this.capturedImages = [];
                            this.previewImage = null;
                            this.currentImageIndex = 0;
                            this.statusWidget.value = "⏸ Waiting for images";
                            this.imageInfoWidget.value = "0 images";
                            app.graph.setDirtyCanvas(true);
                        },
                        disabled: this.capturedImages.length === 0
                    },
                    {
                        content: "🔄 Reset Save Counter",
                        callback: () => {
                            this.totalSaved = 0;
                            this.savedCountWidget.value = "0 images";
                        }
                    },
                    null
                );
                
                return r;
            };
            
            // 绘制预览
            const onDrawForeground = nodeType.prototype.onDrawForeground;
            nodeType.prototype.onDrawForeground = function(ctx) {
                const r = onDrawForeground ? onDrawForeground.apply(this, arguments) : undefined;
                
                if (this.previewImage && this.flags.collapsed !== true) {
                    const margin = 10;
                    const y = 140; // widgets height
                    const w = this.size[0] - margin * 2;
                    const h = this.size[1] - y - margin;
                    
                    if (w > 0 && h > 0) {
                        ctx.save();
                        
                        // 背景
                        ctx.fillStyle = "#000000";
                        ctx.fillRect(margin, y, w, h);
                        
                        // 图像（保持宽高比）
                        const imgRatio = this.previewImage.naturalHeight / this.previewImage.naturalWidth;
                        const boxRatio = h / w;
                        
                        let drawW, drawH, drawX, drawY;
                        if (imgRatio > boxRatio) {
                            drawH = h;
                            drawW = h / imgRatio;
                            drawX = margin + (w - drawW) / 2;
                            drawY = y;
                        } else {
                            drawW = w;
                            drawH = w * imgRatio;
                            drawX = margin;
                            drawY = y + (h - drawH) / 2;
                        }
                        
                        ctx.drawImage(this.previewImage, drawX, drawY, drawW, drawH);
                        
                        // 边框
                        ctx.strokeStyle = "#2a7a4a";
                        ctx.lineWidth = 2;
                        ctx.strokeRect(margin, y, w, h);
                        
                        // 如果有多张图片，显示索引
                        if (this.capturedImages.length > 1) {
                            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
                            ctx.fillRect(margin + 5, y + 5, 60, 25);
                            
                            ctx.font = "14px Arial";
                            ctx.fillStyle = "#ffffff";
                            ctx.textAlign = "center";
                            ctx.fillText(
                                `${this.currentImageIndex + 1}/${this.capturedImages.length}`,
                                margin + 35,
                                y + 20
                            );
                        }
                        
                        ctx.restore();
                    }
                }
                
                return r;
            };
            
            // 鼠标滚轮切换图片
            const onMouseWheel = nodeType.prototype.onMouseWheel;
            nodeType.prototype.onMouseWheel = function(event) {
                const r = onMouseWheel ? onMouseWheel.apply(this, arguments) : undefined;
                
                if (this.capturedImages.length > 1) {
                    if (event.deltaY > 0) {
                        // 下一张
                        this.currentImageIndex = (this.currentImageIndex + 1) % this.capturedImages.length;
                    } else {
                        // 上一张
                        this.currentImageIndex = (this.currentImageIndex - 1 + this.capturedImages.length) % this.capturedImages.length;
                    }
                    
                    this.updatePreview(this.capturedImages[this.currentImageIndex]);
                    return true; // 阻止默认行为
                }
                
                return r;
            };
        }
    }
});

// 样式
const style = document.createElement("style");
style.textContent = `
    .a1r-menu-header {
        font-weight: bold;
        color: #2a7a4a !important;
        background: rgba(42, 122, 74, 0.15) !important;
        padding: 6px 12px !important;
        text-align: center !important;
    }
`;
document.head.appendChild(style);