import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "A1rSpace.Save_PreviewImage",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "Save_PreviewImage") {
            const originalOnExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function(message) {
                originalOnExecuted?.apply(this, arguments);
                try {
                    const imgs = message?.images;
                    if (Array.isArray(imgs) && imgs.length > 0) {
                        this.displayImages(imgs);
                    }
                } catch (e) { console.warn('[A1rSpace] display images failed:', e); }
            };
            
            nodeType.prototype.displayImages = function(images) {
                const nodeElement = this.element;
                if (!nodeElement) return;
                
                let imageContainer = nodeElement.querySelector('.conditional-save-image-container');
                if (!imageContainer) {
                    imageContainer = document.createElement('div');
                    imageContainer.className = 'conditional-save-image-container';
                    imageContainer.style.cssText = `
                        margin-top: 10px;
                        padding: 10px;
                        background: var(--comfy-input-bg);
                        border-radius: 4px;
                        max-height: 300px;
                        overflow-y: auto;
                    `;
                    
                    const widgetArea = nodeElement.querySelector('.widget-content') || nodeElement;
                    widgetArea.appendChild(imageContainer);
                }
                
                imageContainer.innerHTML = '';
                
                const title = document.createElement('div');
                title.textContent = 'Preview:';
                title.style.cssText = `
                    font-weight: bold;
                    margin-bottom: 5px;
                    color: var(--comfy-menu-text);
                `;
                imageContainer.appendChild(title);
                
                images.forEach((imageInfo) => {
                    const imageItem = document.createElement('div');
                    imageItem.style.cssText = `
                        margin-bottom: 10px;
                        padding: 5px;
                        background: var(--comfy-node-bg);
                        border-radius: 3px;
                    `;
                    
                    const img = document.createElement('img');
                    img.style.cssText = `
                        max-width: 100%;
                        max-height: 150px;
                        display: block;
                        margin-bottom: 5px;
                    `;
                    
                    try {
                        const imageUrl = this.getImageUrl(imageInfo);
                        img.src = imageUrl;
                    } catch {}
                    
                    const info = document.createElement('div');
                    info.style.cssText = `
                        font-size: 12px;
                        color: var(--comfy-description-text);
                    `;
                    
                    let infoText = `File: ${imageInfo.filename}`;
                    if (imageInfo.subfolder) {
                        infoText += ` | Folder: ${imageInfo.subfolder}`;
                    }
                    infoText += ` | Type: ${imageInfo.type}`;
                    
                    info.textContent = infoText;
                    
                    imageItem.appendChild(img);
                    imageItem.appendChild(info);
                    
                    imageContainer.appendChild(imageItem);
                });
            };
            
            nodeType.prototype.getImageUrl = function(imageInfo) {
                const baseUrl = '/view?filename=';
                const type = imageInfo?.type || 'output';
                let filename = imageInfo?.filename || '';
                if (imageInfo?.subfolder) filename = `${imageInfo.subfolder}/${filename}`;
                return baseUrl + encodeURIComponent(filename) + '&type=' + encodeURIComponent(type);
            };
            
            const originalOnRemoved = nodeType.prototype.onRemoved;
            nodeType.prototype.onRemoved = function() {
                originalOnRemoved?.apply(this, arguments);
                
                const nodeElement = this.element;
                if (nodeElement) {
                    const imageContainer = nodeElement.querySelector('.conditional-save-image-container');
                    if (imageContainer) {
                        imageContainer.remove();
                    }
                }
            };
        }
    }
});