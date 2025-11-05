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
    }

    async show() {
        // 创建对话框 (无背景遮罩,参考 cg-image-filter)
        this.dialog = document.createElement('div');
        this.dialog.className = 'a1r-filter-dialog';
        this.dialog.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--comfy-menu-bg);
            border: 2px solid var(--border-color);
            border-radius: 8px;
            padding: 20px;
            z-index: 9999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            min-width: 400px;
            max-width: 800px;
        `;

        // 标题栏 (可拖动)
        const header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;cursor:move;user-select:none;';
        header.onmousedown = (e) => this.startDrag(e);

        const title = document.createElement('h3');
        title.textContent = 'Image Filter';
        title.style.cssText = 'margin:0;color:var(--fg-color);font-size:16px;';
        header.appendChild(title);

        // 倒计时显示
        this.timerElement = document.createElement('div');
        this.timerElement.style.cssText = 'color:var(--fg-color);font-size:14px;opacity:0.8;';
        this.timerElement.textContent = `${this.remaining}s`;
        header.appendChild(this.timerElement);

        this.dialog.appendChild(header);

        // 图片容器
        const imgContainer = document.createElement('div');
        imgContainer.style.cssText = 'text-align:center;margin-bottom:15px;';

        const img = document.createElement('img');
        img.style.cssText = 'max-width:100%;max-height:500px;border:1px solid var(--border-color);border-radius:4px;display:block;margin:0 auto;';
        imgContainer.appendChild(img);

        const counter = document.createElement('div');
        counter.style.cssText = 'margin-top:10px;color:var(--fg-color);font-size:14px;';
        imgContainer.appendChild(counter);

        // 导航按钮 (如果有多张图片)
        if (this.images.length > 1) {
            const navContainer = document.createElement('div');
            navContainer.style.cssText = 'display:flex;justify-content:center;gap:10px;margin-top:10px;';

            const prevBtn = document.createElement('button');
            prevBtn.textContent = '← Prev';
            prevBtn.style.cssText = 'padding:5px 15px;background:var(--comfy-input-bg);color:var(--fg-color);border:1px solid var(--border-color);border-radius:4px;cursor:pointer;';
            prevBtn.onclick = () => {
                this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
                this.updateImage(img, counter);
            };
            navContainer.appendChild(prevBtn);

            const nextBtn = document.createElement('button');
            nextBtn.textContent = 'Next →';
            nextBtn.style.cssText = 'padding:5px 15px;background:var(--comfy-input-bg);color:var(--fg-color);border:1px solid var(--border-color);border-radius:4px;cursor:pointer;';
            nextBtn.onclick = () => {
                this.currentIndex = (this.currentIndex + 1) % this.images.length;
                this.updateImage(img, counter);
            };
            navContainer.appendChild(nextBtn);

            imgContainer.appendChild(navContainer);
        }

        this.dialog.appendChild(imgContainer);

        // 按钮容器
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display:flex;gap:10px;justify-content:center;';

        // Send 按钮
        const sendBtn = document.createElement('button');
        sendBtn.textContent = 'Send';
        sendBtn.style.cssText = `
            padding:10px 30px;
            background:#4CAF50;
            color:white;
            border:none;
            border-radius:4px;
            cursor:pointer;
            font-size:14px;
            font-weight:bold;
            transition:opacity 0.2s;
            min-width:100px;
        `;
        sendBtn.onmouseover = () => sendBtn.style.opacity = '0.8';
        sendBtn.onmouseout = () => sendBtn.style.opacity = '1';
        sendBtn.onclick = () => this.respond('send');
        btnContainer.appendChild(sendBtn);

        // Cancel 按钮
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            padding:10px 30px;
            background:#f44336;
            color:white;
            border:none;
            border-radius:4px;
            cursor:pointer;
            font-size:14px;
            font-weight:bold;
            transition:opacity 0.2s;
            min-width:100px;
        `;
        cancelBtn.onmouseover = () => cancelBtn.style.opacity = '0.8';
        cancelBtn.onmouseout = () => cancelBtn.style.opacity = '1';
        cancelBtn.onclick = () => this.respond('cancel');
        btnContainer.appendChild(cancelBtn);

        this.dialog.appendChild(btnContainer);

        // 超时提示
        const timeoutHint = document.createElement('div');
        timeoutHint.style.cssText = 'margin-top:10px;text-align:center;color:var(--fg-color);font-size:12px;opacity:0.6;';
        timeoutHint.textContent = `On timeout: ${this.onTimeout}`;
        this.dialog.appendChild(timeoutHint);

        document.body.appendChild(this.dialog);

        // 加载图片
        await this.loadImages();
        this.updateImage(img, counter);
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

    updateImage(imgElement, counterElement) {
        const blobUrl = this.blobUrls[this.currentIndex];
        if (blobUrl) {
            imgElement.src = blobUrl;
        }
        counterElement.textContent = `Image ${this.currentIndex + 1} / ${this.images.length}`;
    }

    updateTimer(remaining) {
        this.remaining = remaining;
        if (this.timerElement) {
            this.timerElement.textContent = `${remaining}s`;
            // 最后 10 秒变红色提醒
            if (remaining <= 10) {
                this.timerElement.style.color = '#f44336';
            }
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

    startDrag(e) {
        const dialog = this.dialog;
        const startX = e.clientX;
        const startY = e.clientY;
        const rect = dialog.getBoundingClientRect();
        const startLeft = rect.left;
        const startTop = rect.top;

        const onMove = (e) => {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            dialog.style.left = (startLeft + deltaX) + 'px';
            dialog.style.top = (startTop + deltaY) + 'px';
            dialog.style.transform = 'none';
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    cleanup() {
        this.blobUrls.forEach(url => url && URL.revokeObjectURL(url));
        if (this.dialog?.parentNode) {
            this.dialog.parentNode.removeChild(this.dialog);
        }
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
