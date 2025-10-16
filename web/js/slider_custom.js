import { app } from "../../../scripts/app.js";

class Slider_Custom {
    constructor(node) {
        this.node = node;
        // Initialize: default properties
        this.node.properties = this.node.properties || {};
        this.node.properties.value = 20;
        this.node.properties.min = 0;
        this.node.properties.max = 100;
        this.node.properties.step = 1;
        this.node.properties.decimals = 0;
        this.node.properties.snap = true;
        
        // Initialize: slider position & node size
        this.node.intpos = { x:0.2 };
        this.node.size = [210, Math.floor(LiteGraph.NODE_SLOT_HEIGHT*1.5)];

        // Font size & node size
        const fontsize = LiteGraph.NODE_SUBTEXT_SIZE;
        const shX = (this.node.slot_start_y || 0)+fontsize*1.5;
        const shY = LiteGraph.NODE_SLOT_HEIGHT/1.5;
        const shiftLeft = 10;
        const shiftRight = 60;

        // Hide widgets
        for (let i=0; i<3; i++) {
            this.node.widgets[i].hidden = true;
            this.node.widgets[i].type = "hidden";
        }

        // Initialize: when node is added to graph
        this.node.onAdded = function () {
            // Set output name to empty string
            this.outputs[0].name = this.outputs[0].localized_name = "";
            // Hide widgets range
            this.widgets_start_y = -2.4e8*LiteGraph.NODE_SLOT_HEIGHT;
            // Calculate slider position based on default value (0-1)
            this.intpos.x = Math.max(0, Math.min(1,
                (this.properties.value-this.properties.min)/(this.properties.max-this.properties.min)));
            // ensure node height within limit
            if (this.size && this.size.length && this.size[1] > LiteGraph.NODE_SLOT_HEIGHT*1.5) {
                this.size[1] = LiteGraph.NODE_SLOT_HEIGHT*1.5;
            }
            // Set output type based on decimals
            this.outputs[0].type = (this.properties.decimals > 0) ? "FLOAT" : "INT";
        };
        
        // function: when node is configure (updated)
        this.node.onConfigure = function () {
            // Update output type based on decimals
            this.outputs[0].type = (this.properties.decimals > 0)?"FLOAT":"INT";
        }

        // function: when node is configure (done)
        this.node.onGraphConfigured = function () {
            // Signal that node is configured
            this.configured = true;
            // Trigger property change
            this.onPropertyChanged();
        }

        // function: Logic when node property change is configured (core function)
        this.node.onPropertyChanged = function (propName) {
            // return if not configured
            if (!this.configured) return;

            // Verify & correct properties values
            // step must be greater than 0
            if (this.properties.step <= 0) this.properties.step = 1;
            // value must be between min and max
            if ( isNaN(this.properties.value) ) this.properties.value = this.properties.min;
            // max must be greater than min
            if ( this.properties.min >= this.properties.max ) this.properties.max = this.properties.min+this.properties.step;
            // adjust value when min/max change
            if ((propName === "min") && (this.properties.value < this.properties.min)) this.properties.value = this.properties.min;
            if ((propName === "max") && (this.properties.value > this.properties.max)) this.properties.value = this.properties.max;

            // decimals must be between 0 and 4
            this.properties.decimals = Math.floor(this.properties.decimals);
            if (this.properties.decimals>4) this.properties.decimals = 4;
            if (this.properties.decimals<0) this.properties.decimals = 0;

            // round value to decimals
            this.properties.value = Math.round(Math.pow(10,this.properties.decimals)*this.properties.value)/Math.pow(10,this.properties.decimals);

            // update slider position (0-1)
            this.intpos.x = Math.max(0, Math.min(1,
                (this.properties.value-this.properties.min)/(this.properties.max-this.properties.min)));

            // cut off incompatible links when changing value type
            if ((this.properties.decimals > 0 && this.outputs[0].type !== "FLOAT") || (this.properties.decimals === 0 && this.outputs[0].type !== "INT")) {
                if (this.outputs[0].links !== null) {
                    for (let i = this.outputs[0].links.length; i > 0; i--) {
                        const tlinkId = this.outputs[0].links[i-1];
                        const tlink = app.graph.links[tlinkId];
                        app.graph.getNodeById(tlink.target_id).disconnectInput(tlink.target_slot);
                    }
                }
            }

            // update outputs type and widget values
            this.outputs[0].type = (this.properties.decimals > 0)?"FLOAT":"INT";

            // update value type wedget
            this.widgets[2].value = (this.properties.decimals > 0)?1:0;

            // update value widget
            this.widgets[1].value = this.properties.value;

            // update int value widget
            this.widgets[0].value = Math.floor(this.properties.value);
        }

        // function: draw the slider on the node -visual function
        this.node.onDrawForeground = function(ctx)
        {
            this.configured = true;

            // dont draw if collapsed
            if ( this.flags.collapsed ) return false;

            // ensure node height within limit
            if (this.size[1] > LiteGraph.NODE_SLOT_HEIGHT*1.5) {
                this.size[1] = LiteGraph.NODE_SLOT_HEIGHT*1.5;
            }

            // get decimals
            let dgt = parseInt(this.properties.decimals);

            // draw slider track with inset shadow effect
            const trackWidth = this.size[0]-shiftRight-shiftLeft;
            const trackHeight = 6;
            const trackRadius = 3;
            const trackX = shiftLeft;
            const trackY = shY - trackHeight/2;
            
            // Main track background (#222222ff)
            ctx.fillStyle = "#222222ff";
            ctx.beginPath();
            ctx.roundRect(trackX, trackY, trackWidth, trackHeight, trackRadius);
            ctx.fill();
            
            // Save context for clipping
            ctx.save();
            
            // Create clipping path for track (so shadows stay inside)
            ctx.beginPath();
            ctx.roundRect(trackX, trackY, trackWidth, trackHeight, trackRadius);
            ctx.clip();
            
            // Inner shadow effect (top and left darker shadow)
            // Top shadow - use gradient
            const topGradient = ctx.createLinearGradient(trackX, trackY, trackX, trackY + 3);
            topGradient.addColorStop(0, "rgba(0,0,0,0.45)");
            topGradient.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = topGradient;
            ctx.fillRect(trackX, trackY, trackWidth, 3);
            
            // Left shadow - use gradient
            const leftGradient = ctx.createLinearGradient(trackX, trackY, trackX + 2, trackY);
            leftGradient.addColorStop(0, "rgba(0,0,0,0.3)");
            leftGradient.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = leftGradient;
            ctx.fillRect(trackX, trackY, 2, trackHeight);
            
            // Inner highlight effect (bottom slight highlight)
            const bottomGradient = ctx.createLinearGradient(trackX, trackY + trackHeight - 1, trackX, trackY + trackHeight);
            bottomGradient.addColorStop(0, "rgba(255,255,255,0)");
            bottomGradient.addColorStop(1, "rgba(255,255,255,0.05)");
            ctx.fillStyle = bottomGradient;
            ctx.fillRect(trackX, trackY + trackHeight - 1, trackWidth, 1);
            
            // Restore context (remove clipping)
            ctx.restore();
            
            // Create scale marks (9 divisions inside track)
            for (let i = 1; i <= 9; i++) {
                const position = i * 10; // 10%, 20%, ..., 90%
                const isMajor = i === 5; // Major tick at 50%
                const tickX = shiftLeft + (trackWidth * position / 100);
                const tickHeight = isMajor ? 4 : 3;
                
                ctx.fillStyle = isMajor ? "rgba(102,102,102,0.5)" : "rgba(85,85,85,0.35)";
                ctx.beginPath();
                ctx.fillRect(tickX - 0.5, shY - tickHeight/2, 1, tickHeight);
                ctx.fill();
            }

            // Draw thumb (slider handle)
            const thumbX = shiftLeft + trackWidth * this.intpos.x;
            const thumbY = shY;
            const thumbRadius = 8; // 16px diameter
            
            // Thumb shadow
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.beginPath();
            ctx.arc(thumbX, thumbY + 1, thumbRadius, 0, 2 * Math.PI, false);
            ctx.fill();
            
            // Main thumb
            ctx.fillStyle = "#aaaaaaff";
            ctx.beginPath();
            ctx.arc(thumbX, thumbY, thumbRadius, 0, 2 * Math.PI, false);
            ctx.fill();

            // display current value at center
            ctx.fillStyle=LiteGraph.NODE_TEXT_COLOR;
            ctx.font = (fontsize) + "px Arial";
            ctx.textAlign = "center";
            ctx.fillText(this.properties.value.toFixed(dgt), this.size[0]-shiftRight+24, shX);
        }

        // drag slider handle with mouse
        this.node.onMouseDown = function(e) {
            // check if mouse is over the slider area
            // upside of node
            if ( e.canvasY - this.pos[1] < 0 ) return false;
            // left/right of frame
            if ( e.canvasX < this.pos[0]+shiftLeft-5 || e.canvasX > this.pos[0]+this.size[0]-shiftRight+5 ) return false;
            // top/bottom of frame
            if ( e.canvasY < this.pos[1]+shiftLeft-5 || e.canvasY > this.pos[1]+this.size[1]-shiftLeft+5 ) return false;

            // start capture mouse input
            this.capture = true;
            // reset position sign
            this.unlock = false;
            // update right now
            this.valueUpdate(e);
            // done
            return true;
        }

        // mouse event: update slider value (use when dragging)
        this.node.onMouseMove = function(e, pos, canvas) {
            // return when not capturing
            if (!this.capture) return;
            if ( canvas.pointer.isDown === false ) {
                // release mouse input, then stop
                this.onMouseUp(e);
                return;
            }
            // update slider value
            this.valueUpdate(e);
        }

        // mouse event: stop capturing
        this.node.onMouseUp = function(e) {
            // return when not capturing
            if (!this.capture) return;
            this.capture = false;

            // update widgets to sync value
            this.widgets[0].value = Math.floor(this.properties.value);
            this.widgets[1].value = this.properties.value;
        }

        // calculate core: update slider value
        this.node.valueUpdate = function(e) {
            // save old value to compare later
            let prevX = this.properties.value;
            // calculate precision coefficient
            let rn = Math.pow(10,this.properties.decimals);
            // calculate new value based on mouse position
            let vX = (e.canvasX - this.pos[0] - shiftLeft)/(this.size[0]-shiftRight-shiftLeft);

            // keyboard modifier: ctrl = unlock position, shift = snap to step
            if (e.ctrlKey) this.unlock = true;
            if (e.shiftKey !== this.properties.snap) {
                // snap step to grid
                let step = this.properties.step/(this.properties.max - this.properties.min);
                vX = Math.round(vX/step)*step;
            }

            // update slider position (0-1) & value
            this.intpos.x = Math.max(0, Math.min(1, vX));
            // calculate actual value: min + range * position
            this.properties.value = Math.round(rn*(this.properties.min +
                (this.properties.max - this.properties.min) * ((this.unlock)?vX:this.intpos.x)))/rn;

            // update canvas when value changes
            if ( this.properties.value !== prevX ) {
                this.setDirtyCanvas?.(true, true);
                this.graph?.setDirtyCanvas?.(true, true);
            }
        }

        // end drag when node is selected
        this.node.onSelected = function(e) { this.onMouseUp(e) }

        // calculate node size
        this.node.computeSize = () => [LiteGraph.NODE_WIDTH,Math.floor(LiteGraph.NODE_SLOT_HEIGHT*1.5)];
    }
}

app.registerExtension(
{
    name: "slider_custom",
    async beforeRegisterNodeDef(nodeType, nodeData, _app) {
        if (nodeData.name === "A1r Slider Custom") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                if (onNodeCreated) onNodeCreated.apply(this, []);
                this.slider_custom = new Slider_Custom(this);
            }
        }
    }
});