import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

app.registerExtension({
	name: "A1r.LatentObserver",
    setup() {
        // 监听进度事件
        api.addEventListener("progress", (e) => {
            const { node, value, max } = e.detail;
            if (!node) return;
            
            const graphNode = app.graph.getNodeById(node);
            if (!graphNode || graphNode.type !== "A1r Latent Observer") return;
            
            // 更新进度
            graphNode.observerProgress = value / max;
            // 触发重绘
            app.graph.setDirtyCanvas(true, false);
        });

        // 监听执行结束，重置进度
        api.addEventListener("executed", (e) => {
            const { node } = e.detail;
            if (!node) return;
            const graphNode = app.graph.getNodeById(node);
            if (graphNode && graphNode.type === "A1r Latent Observer") {
                graphNode.observerProgress = 0;
                app.graph.setDirtyCanvas(true, false);
            }
        });
    },
	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		if (nodeData.name === "A1r Latent Observer") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
			nodeType.prototype.onNodeCreated = function () {
				const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                this.setSize([512, 512]);
				return r;
			};

            // 仅添加进度条绘制逻辑，不干扰图片绘制
            const onDrawForeground = nodeType.prototype.onDrawForeground;
            nodeType.prototype.onDrawForeground = function(ctx) {
                const r = onDrawForeground ? onDrawForeground.apply(this, arguments) : undefined;
                
                // 如果有进度，绘制绿色进度条
                if (this.observerProgress > 0 && this.observerProgress < 1) {
                    ctx.save();
                    ctx.fillStyle = "#00FF00";
                    // 绘制在顶部，高度为 10 像素，类似 KSampler
                    ctx.fillRect(0, 0, this.size[0] * this.observerProgress, 10);
                    ctx.restore();
                }
                
                return r;
            };
		}
	},
});