import { app } from "/scripts/app.js";

app.registerExtension({
	name: "A1rSpace.LatentObserver",
	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		if (nodeData.name === "A1r Latent Observer") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
			nodeType.prototype.onNodeCreated = function () {
				const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                this.setSize([512, 512]);

                // 1. Suppress default background drawing (which draws the stretched image)
                // We override the instance method to ensure we take precedence over any prototype methods
                this.onDrawBackground = function(ctx) {
                    // Do nothing. This prevents the "ghost" image from being drawn by default handlers.
                    // The node shape and color are still drawn by the canvas system.
                    return true;
                };

				return r;
			};

            // 2. Draw the image in foreground with correct aspect ratio
            const onDrawForeground = nodeType.prototype.onDrawForeground;
            nodeType.prototype.onDrawForeground = function (ctx) {
                const r = onDrawForeground ? onDrawForeground.apply(this, arguments) : undefined;
                
                if (this.imgs && this.imgs.length) {
                    const img = this.imgs[0];
                    if (img && img.complete && img.width) {
                        const ratio = img.width / img.height;
                        const nodeRatio = this.size[0] / this.size[1];
                        
                        let w, h, x, y;
                        if (ratio > nodeRatio) {
                            w = this.size[0];
                            h = w / ratio;
                            x = 0;
                            y = (this.size[1] - h) / 2;
                        } else {
                            h = this.size[1];
                            w = h * ratio;
                            x = (this.size[0] - w) / 2;
                            y = 0;
                        }
                        
                        try {
                            ctx.save();
                            ctx.drawImage(img, x, y, w, h);
                            ctx.restore();
                        } catch (e) {
                            // Ignore drawing errors
                        }
                    }
                }
                return r;
            };

            // Handle the image update event from the server
            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function(message) {
                onExecuted?.apply(this, arguments);
            }
		}
	},
});
