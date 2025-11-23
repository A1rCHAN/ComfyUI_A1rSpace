/**
 * Crop Editor Core Logic
 * Handles image cropping with free and fixed aspect ratio support
 */

class CropEditor {
    constructor(imageUrl, originalWidth, originalHeight, callback) {
        this.imageUrl = imageUrl;
        this.originalWidth = originalWidth;
        this.originalHeight = originalHeight;
        this.callback = callback;
        
        this.canvas = null;
        this.ctx = null;
        this.image = null;
        this.scale = 1;
        
        this.cropBox = {
            x: 0,
            y: 0,
            width: 100,
            height: 100
        };
        
        this.aspectRatio = null; // null = free, number = fixed ratio
        this.isDragging = false;
        this.isResizing = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragOffset = { x: 0, y: 0 };
        this.resizeDirection = null;
        
        this.init();
    }
    
    init() {
        this.canvas = document.getElementById('crop-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Load image
        this.image = new Image();
        this.image.crossOrigin = 'anonymous';
        this.image.onload = () => {
            this.setupCanvas();
            this.resetCropBox();
            this.render();
            this.bindEvents();
        };
        this.image.src = this.imageUrl;
    }
    
    setupCanvas() {
        const container = this.canvas.parentElement;
        const maxWidth = container.clientWidth;
        const maxHeight = container.clientHeight - 20;
        
        const scale = Math.min(
            maxWidth / this.image.width,
            maxHeight / this.image.height,
            1
        );
        
        this.scale = scale;
        this.canvas.width = this.image.width * scale;
        this.canvas.height = this.image.height * scale;
    }
    
    resetCropBox() {
        const padding = 40;
        this.cropBox = {
            x: padding,
            y: padding,
            width: this.canvas.width - padding * 2,
            height: this.canvas.height - padding * 2
        };
        this.updateInputs();
    }
    
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw image
        this.ctx.drawImage(this.image, 0, 0, this.canvas.width, this.canvas.height);
        
        // Draw dimmed overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Clear crop area
        this.ctx.clearRect(this.cropBox.x, this.cropBox.y, this.cropBox.width, this.cropBox.height);
        
        // Redraw image in crop area
        this.ctx.drawImage(
            this.image,
            this.cropBox.x / this.scale,
            this.cropBox.y / this.scale,
            this.cropBox.width / this.scale,
            this.cropBox.height / this.scale,
            this.cropBox.x,
            this.cropBox.y,
            this.cropBox.width,
            this.cropBox.height
        );
        
        // Draw crop box border
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.cropBox.x, this.cropBox.y, this.cropBox.width, this.cropBox.height);
        
        // Update overlay position
        this.updateOverlay();
    }
    
    updateOverlay() {
        const overlay = document.getElementById('crop-overlay');
        const cropBoxEl = document.getElementById('crop-box');
        
        if (overlay && cropBoxEl) {
            cropBoxEl.style.left = this.cropBox.x + 'px';
            cropBoxEl.style.top = this.cropBox.y + 'px';
            cropBoxEl.style.width = this.cropBox.width + 'px';
            cropBoxEl.style.height = this.cropBox.height + 'px';
        }
        
        this.updateDimensions();
    }
    
    updateDimensions() {
        const actualWidth = Math.round(this.cropBox.width / this.scale);
        const actualHeight = Math.round(this.cropBox.height / this.scale);
        
        const infoEl = document.getElementById('crop-dimensions');
        if (infoEl) {
            infoEl.textContent = `${actualWidth} × ${actualHeight}`;
        }
    }
    
    updateInputs() {
        const actualX = Math.round(this.cropBox.x / this.scale);
        const actualY = Math.round(this.cropBox.y / this.scale);
        const actualWidth = Math.round(this.cropBox.width / this.scale);
        const actualHeight = Math.round(this.cropBox.height / this.scale);
        
        document.getElementById('crop-x').value = actualX;
        document.getElementById('crop-y').value = actualY;
        document.getElementById('crop-width').value = actualWidth;
        document.getElementById('crop-height').value = actualHeight;
    }
    
    setAspectRatio(ratio) {
        if (ratio === 'free') {
            this.aspectRatio = null;
        } else {
            const [w, h] = ratio.split(':').map(Number);
            this.aspectRatio = w / h;
            
            // Adjust current crop box to match ratio
            const currentRatio = this.cropBox.width / this.cropBox.height;
            if (Math.abs(currentRatio - this.aspectRatio) > 0.01) {
                // Keep width, adjust height
                this.cropBox.height = this.cropBox.width / this.aspectRatio;
                this.constrainCropBox();
                this.render();
            }
        }
    }
    
    constrainCropBox() {
        // Keep within canvas bounds
        if (this.cropBox.x < 0) this.cropBox.x = 0;
        if (this.cropBox.y < 0) this.cropBox.y = 0;
        
        if (this.cropBox.x + this.cropBox.width > this.canvas.width) {
            this.cropBox.width = this.canvas.width - this.cropBox.x;
        }
        if (this.cropBox.y + this.cropBox.height > this.canvas.height) {
            this.cropBox.height = this.canvas.height - this.cropBox.y;
        }
        
        // Minimum size
        const minSize = 20;
        if (this.cropBox.width < minSize) this.cropBox.width = minSize;
        if (this.cropBox.height < minSize) this.cropBox.height = minSize;
        
        this.updateInputs();
    }
    
    bindEvents() {
        const cropBoxEl = document.getElementById('crop-box');
        const handles = document.querySelectorAll('.crop-handle');
        
        // Drag crop box
        cropBoxEl.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('crop-handle')) return;
            
            this.isDragging = true;
            const rect = this.canvas.getBoundingClientRect();
            this.dragStart.x = e.clientX;
            this.dragStart.y = e.clientY;
            this.dragOffset.x = this.cropBox.x;
            this.dragOffset.y = this.cropBox.y;
            e.preventDefault();
        });
        
        // Resize handles
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                this.isResizing = true;
                this.resizeDirection = e.target.dataset.direction;
                this.dragStart.x = e.clientX;
                this.dragStart.y = e.clientY;
                this.dragOffset = { ...this.cropBox };
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        // Mouse move
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = e.clientX - this.dragStart.x;
                const dy = e.clientY - this.dragStart.y;
                
                this.cropBox.x = this.dragOffset.x + dx;
                this.cropBox.y = this.dragOffset.y + dy;
                
                this.constrainCropBox();
                this.render();
            } else if (this.isResizing) {
                this.handleResize(e);
            }
        });
        
        // Mouse up
        document.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.isResizing = false;
            this.resizeDirection = null;
        });
        
        // Aspect ratio buttons
        document.querySelectorAll('.crop-ratio-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.crop-ratio-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.setAspectRatio(e.target.dataset.ratio);
            });
        });
        
        // Input fields
        const inputs = ['crop-x', 'crop-y', 'crop-width', 'crop-height'];
        inputs.forEach(id => {
            const input = document.getElementById(id);
            input.addEventListener('change', () => {
                const x = parseInt(document.getElementById('crop-x').value) * this.scale;
                const y = parseInt(document.getElementById('crop-y').value) * this.scale;
                const width = parseInt(document.getElementById('crop-width').value) * this.scale;
                const height = parseInt(document.getElementById('crop-height').value) * this.scale;
                
                this.cropBox.x = x;
                this.cropBox.y = y;
                this.cropBox.width = width;
                this.cropBox.height = height;
                
                this.constrainCropBox();
                this.render();
            });
        });
        
        // Reset button
        document.getElementById('crop-reset-btn').addEventListener('click', () => {
            this.resetCropBox();
            this.render();
        });
        
        // Apply button
        document.getElementById('crop-apply-btn').addEventListener('click', () => {
            this.applyCrop();
        });
        
        // Cancel/Close buttons
        document.getElementById('crop-cancel-btn').addEventListener('click', () => {
            this.close();
        });
        document.getElementById('crop-close-btn').addEventListener('click', () => {
            this.close();
        });
    }
    
    handleResize(e) {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        
        let newBox = { ...this.dragOffset };
        
        switch (this.resizeDirection) {
            case 'nw':
                newBox.x = this.dragOffset.x + dx;
                newBox.y = this.dragOffset.y + dy;
                newBox.width = this.dragOffset.width - dx;
                newBox.height = this.dragOffset.height - dy;
                break;
            case 'n':
                newBox.y = this.dragOffset.y + dy;
                newBox.height = this.dragOffset.height - dy;
                if (this.aspectRatio) {
                    newBox.width = newBox.height * this.aspectRatio;
                    newBox.x = this.dragOffset.x + (this.dragOffset.width - newBox.width) / 2;
                }
                break;
            case 'ne':
                newBox.y = this.dragOffset.y + dy;
                newBox.width = this.dragOffset.width + dx;
                newBox.height = this.dragOffset.height - dy;
                break;
            case 'w':
                newBox.x = this.dragOffset.x + dx;
                newBox.width = this.dragOffset.width - dx;
                if (this.aspectRatio) {
                    newBox.height = newBox.width / this.aspectRatio;
                    newBox.y = this.dragOffset.y + (this.dragOffset.height - newBox.height) / 2;
                }
                break;
            case 'e':
                newBox.width = this.dragOffset.width + dx;
                if (this.aspectRatio) {
                    newBox.height = newBox.width / this.aspectRatio;
                    newBox.y = this.dragOffset.y + (this.dragOffset.height - newBox.height) / 2;
                }
                break;
            case 'sw':
                newBox.x = this.dragOffset.x + dx;
                newBox.width = this.dragOffset.width - dx;
                newBox.height = this.dragOffset.height + dy;
                break;
            case 's':
                newBox.height = this.dragOffset.height + dy;
                if (this.aspectRatio) {
                    newBox.width = newBox.height * this.aspectRatio;
                    newBox.x = this.dragOffset.x + (this.dragOffset.width - newBox.width) / 2;
                }
                break;
            case 'se':
                newBox.width = this.dragOffset.width + dx;
                newBox.height = this.dragOffset.height + dy;
                break;
        }
        
        // Apply aspect ratio constraint
        if (this.aspectRatio && !['n', 's', 'e', 'w'].includes(this.resizeDirection)) {
            const ratio = newBox.width / newBox.height;
            if (Math.abs(ratio - this.aspectRatio) > 0.01) {
                // Adjust based on which dimension changed more
                if (Math.abs(dx) > Math.abs(dy)) {
                    newBox.height = newBox.width / this.aspectRatio;
                    if (this.resizeDirection.includes('n')) {
                        newBox.y = this.dragOffset.y + this.dragOffset.height - newBox.height;
                    }
                } else {
                    newBox.width = newBox.height * this.aspectRatio;
                    if (this.resizeDirection.includes('w')) {
                        newBox.x = this.dragOffset.x + this.dragOffset.width - newBox.width;
                    }
                }
            }
        }
        
        this.cropBox = newBox;
        this.constrainCropBox();
        this.render();
    }
    
    applyCrop() {
        const cropData = {
            x: Math.round(this.cropBox.x / this.scale),
            y: Math.round(this.cropBox.y / this.scale),
            width: Math.round(this.cropBox.width / this.scale),
            height: Math.round(this.cropBox.height / this.scale)
        };
        
        if (this.callback) {
            this.callback(cropData);
        }
        
        this.close();
    }
    
    close() {
        const container = document.getElementById('crop-editor-container');
        if (container && container.parentElement) {
            container.parentElement.removeChild(container);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CropEditor;
}
