import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

class FilterDialog {
    constructor(nodeId, filterId, images, timeout, onTimeout) {
        this.nodeId = nodeId;
        this.filterId = filterId;
        this.images = images;
        this.timeout = timeout;
        this.onTimeout = onTimeout;
        this.dialog = null;
        this.blobUrls = [];
        this.currentIndex = 0;
        this.remaining = timeout;
        this.timerElement = null;
        
        // Zoom & Pan state
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.canvas = null;
        this.ctx = null;
        this.image = null;
        
        // Event handlers
        this._handleResize = this.handleResize.bind(this);
        this._handleMouseMove = this.handleMouseMove.bind(this);
        this._handleMouseUp = this.handleMouseUp.bind(this);
    }

    async show() {
        // Create container (Full screen)
        this.dialog = document.createElement('div');
        this.dialog.className = 'a1r-filter-dialog';
        this.dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(30, 30, 30, 0.95);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            color: #fff;
            font-family: sans-serif;
            user-select: none;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            background: #2d2d2d;
            border-bottom: 1px solid #3d3d3d;
        `;

        const title = document.createElement('h3');
        title.textContent = 'Image Filter';
        title.style.cssText = 'margin:0; font-size:18px; font-weight:600; color: #fff;';
        header.appendChild(title);

        this.timerElement = document.createElement('div');
        this.timerElement.style.cssText = 'font-size:16px; font-weight:bold; color:#4CAF50;';
        this.timerElement.textContent = `${this.remaining}s`;
        header.appendChild(this.timerElement);

        this.dialog.appendChild(header);

        // Content (Canvas)
        const content = document.createElement('div');
        content.style.cssText = `
            flex: 1;
            position: relative;
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
            background: #1e1e1e;
        `;
        
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'display: block; cursor: grab;';
        content.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.dialog.appendChild(content);

        // Footer / Controls
        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 15px 20px;
            background: #2d2d2d;
            border-top: 1px solid #3d3d3d;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

        // Left: Navigation
        const navContainer = document.createElement('div');
        navContainer.style.cssText = 'display:flex; gap:10px; align-items:center;';
        
        if (this.images.length > 1) {
            const prevBtn = this.createButton('← Prev', () => this.navigate(-1));
            const nextBtn = this.createButton('Next →', () => this.navigate(1));
            this.counterElement = document.createElement('span');
            this.counterElement.textContent = `1 / ${this.images.length}`;
            this.counterElement.style.cssText = 'margin: 0 10px; color: #aaa;';
            
            navContainer.appendChild(prevBtn);
            navContainer.appendChild(this.counterElement);
            navContainer.appendChild(nextBtn);
        }
        footer.appendChild(navContainer);

        // Right: Actions
        const actionContainer = document.createElement('div');
        actionContainer.style.cssText = 'display:flex; gap:10px; align-items:center;';

        const timeoutHint = document.createElement('span');
        timeoutHint.textContent = `Timeout: ${this.onTimeout}`;
        timeoutHint.style.cssText = 'margin-right:15px; color:#aaa; font-size:12px;';
        actionContainer.appendChild(timeoutHint);

        const cancelBtn = this.createButton('Cancel', () => this.respond('cancel'), '#f44336');
        const sendBtn = this.createButton('Send', () => this.respond('send'), '#4CAF50');
        
        actionContainer.appendChild(cancelBtn);
        actionContainer.appendChild(sendBtn);
        footer.appendChild(actionContainer);

        this.dialog.appendChild(footer);
        document.body.appendChild(this.dialog);

        // Event Listeners
        this.setupEvents();

        // Load images
        await this.loadImages();
        this.showCurrentImage();
    }

    createButton(text, onClick, bgColor = '#444') {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.style.cssText = `
            padding: 8px 20px;
            background: ${bgColor};
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: opacity 0.2s;
        `;
        btn.onmouseover = () => btn.style.opacity = '0.9';
        btn.onmouseout = () => btn.style.opacity = '1';
        btn.onclick = onClick;
        return btn;
    }

    setupEvents() {
        window.addEventListener('resize', this._handleResize);
        window.addEventListener('mousemove', this._handleMouseMove);
        window.addEventListener('mouseup', this._handleMouseUp);
        
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    }

    handleResize() {
        if (this.dialog && this.canvas) {
            const container = this.canvas.parentElement;
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
            this.redraw();
        }
    }

    handleWheel(e) {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
        const newScale = this.scale * (1 + delta);

        // Limit zoom
        if (newScale < 0.1 || newScale > 10) return;

        // Zoom towards mouse position
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate offset to keep mouse point stable
        this.translateX -= (mouseX - this.translateX) * delta;
        this.translateY -= (mouseY - this.translateY) * delta;
        
        this.scale = newScale;
        this.redraw();
    }

    handleMouseDown(e) {
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        
        this.translateX += dx;
        this.translateY += dy;
        
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        
        this.redraw();
    }

    handleMouseUp() {
        this.isDragging = false;
        if (this.canvas) this.canvas.style.cursor = 'grab';
    }

    navigate(dir) {
        this.currentIndex = (this.currentIndex + dir + this.images.length) % this.images.length;
        this.showCurrentImage();
    }

    showCurrentImage() {
        const blobUrl = this.blobUrls[this.currentIndex];
        if (blobUrl) {
            this.image = new Image();
            this.image.onload = () => {
                this.fitImage();
                this.redraw();
            };
            this.image.src = blobUrl;
        }
        if (this.counterElement) {
            this.counterElement.textContent = `${this.currentIndex + 1} / ${this.images.length}`;
        }
    }

    fitImage() {
        if (!this.image || !this.canvas) return;
        
        // Set canvas size to container size
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;

        // Calculate scale to fit
        const scaleX = this.canvas.width / this.image.width;
        const scaleY = this.canvas.height / this.image.height;
        this.scale = Math.min(scaleX, scaleY) * 0.9; // 90% fit

        // Center image
        this.translateX = (this.canvas.width - this.image.width * this.scale) / 2;
        this.translateY = (this.canvas.height - this.image.height * this.scale) / 2;
    }

    redraw() {
        if (!this.ctx || !this.image) return;

        // Clear
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(this.translateX, this.translateY);
        this.ctx.scale(this.scale, this.scale);
        this.ctx.drawImage(this.image, 0, 0);
        this.ctx.restore();
    }

    async loadImages() {
        for (const imgData of this.images) {
            try {
                const url = api.apiURL(`/view?filename=${encodeURIComponent(imgData.filename)}&type=${imgData.type}&subfolder=${imgData.subfolder || ''}`);
                const response = await fetch(url);
                const blob = await response.blob();
                this.blobUrls.push(URL.createObjectURL(blob));
            } catch (error) {
                console.error('[A1rSpace] Load image error:', error);
                this.blobUrls.push(null);
            }
        }
    }

    updateTimer(remaining) {
        this.remaining = remaining;
        if (this.timerElement) {
            this.timerElement.textContent = `${remaining}s`;
            // 最后 10 秒变红色提醒
            if (remaining <= 10) {
                this.timerElement.style.color = '#f44336';
            } else {
                this.timerElement.style.color = '#4CAF50';
            }
        }
        
        // Auto close on timeout
        if (remaining <= 0) {
            this.respond(this.onTimeout);
        }
    }

    async respond(decision) {
        

        // 发送决策到后端
        try {
            await fetch('/a1rspace/filter_decision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filter_id: this.filterId,
                    decision: decision
                })
            });
        } catch (error) {
            console.error('[A1rSpace] Send decision error:', error);
        }

        this.cleanup();
    }

    cleanup() {
        this.blobUrls.forEach(url => url && URL.revokeObjectURL(url));
        if (this.dialog?.parentNode) {
            this.dialog.parentNode.removeChild(this.dialog);
        }
        
        window.removeEventListener('resize', this._handleResize);
        window.removeEventListener('mousemove', this._handleMouseMove);
        window.removeEventListener('mouseup', this._handleMouseUp);
    }
}

class FilterManager {
    constructor() {
        this.dialogs = new Map();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 监听过滤请求
        api.addEventListener("a1rspace-filter-request", (event) => {
            const data = event.detail;
                
            this.showDialog(data);
        });

        // 监听心跳更新倒计时
        api.addEventListener("a1rspace-filter-tick", (event) => {
            const data = event.detail;
            const dialog = this.dialogs.get(data.filter_id);
            if (dialog) {
                dialog.updateTimer(data.remaining);
            }
        });
    }

    async showDialog(data) {
        const filterId = data.filter_id;

        // 关闭之前的对话框 (如果存在)
        if (this.dialogs.has(filterId)) {
            this.dialogs.get(filterId).cleanup();
        }

        // 创建新对话框
        const dialog = new FilterDialog(
            data.node_id,
            filterId,
            data.images,
            data.timeout,
            data.on_timeout
        );

        this.dialogs.set(filterId, dialog);
        await dialog.show();
    }
}

const filterManager = new FilterManager();

app.registerExtension({
    name: 'A1rSpace.ImageFilter',
    async setup() {
        
    }
});
