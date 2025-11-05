import { app } from "/scripts/app.js";

app.registerExtension({
    name: "A1rSpace.DraggableEditableList",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "A1r Draggable List") return;
        
        /**
         * Initialize draggable and editable list functionality
         */
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function() {
            // Ensure a sensible default size is present before original onNodeCreated
            // so the original initialization can rely on node size when needed.
            if (!this.size || !Array.isArray(this.size) || this.size.length < 2) {
                this.size = [400, 280];
            }

            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            
            // Hide original widgets
            this.widgets.forEach(widget => {
                widget.type = "converted-widget";
                widget.computeSize = () => [0, -4];
            });
            
            // Initialize state
            this.itemOrder = [0, 1, 2, 3];
            
            // Item dragging state
            this.draggedItemIndex = null;
            this.hoverItemIndex = null;
            this.isDraggingItem = false;
            
            // Tag dragging state
            this.draggedTag = null;
            this.hoverTag = null;
            this.isDraggingTag = false;
            
            // Editing state
            this.editingItem = null;
            this.editingTag = null;
            this.editCursorPosition = 0;
            this.editScrollOffset = 0;
            this.lineHeight = 18;
            
            // Double-click detection
            this.lastClickTime = 0;
            this.lastClickTarget = null;
            this.doubleClickDelay = 300;
            
            this.cursorBlinkState = true;
            this.lastBlinkTime = Date.now();
            
            // Layout constants
            this.headerHeight = 50;
            this.footerHeight = 10;
            this.itemMargin = 5;
            this.padding = 8;
            this.tagHeight = 24;
            this.tagMargin = 4;
            this.tagPadding = 6;
            this.fontSize = 12;

            // hovered tag for showing delete button
            this.hoveredTag = null;

            // deferred tag-drag state: only start real tag-drag after hold+move
            this.potentialDragTag = null;

            // deferred item-drag state: only start real drag
            this.potentialDragItem = null;
            this.mouseDownPos = null;
            this.dragStartThreshold = 0; // pixels
            // require longer press duration before starting drag
            this.mouseDownTime = null;
            this.dragStartDelay = 1000; // ms (1 second)

            // visual feedback for drag start (glow)
            this.showDragFeedback = false;
            this.dragFeedbackStart = 0;
            this.dragFeedbackDuration = 400; // ms
            
            // Get text widgets
            this.textWidgets = [];
            for (let i = 1; i <= 4; i++) {
                const widget = this.widgets.find(w => w.name === `text${i}`);
                if (widget) {
                    this.textWidgets.push(widget);
                }
            }
            
            // Get order widget
            this.orderWidget = this.widgets.find(w => w.name === "item_order");
            if (this.orderWidget) {
                this.parseOrder();
            }
            
            // Setup global keyboard listener
            this.setupGlobalKeyboardListener();
            
            return r;
        };
        
        /**
         * Parse text into tags
         */
        nodeType.prototype.parseTextToTags = function(text) {
            if (!text || !text.trim()) return [];
            return text.split(',').map(t => t.trim()).filter(t => t.length > 0);
        };
        
        /**
         * Convert tags to text
         */
        nodeType.prototype.tagsToText = function(tags) {
            return tags.join(', ');
        };
        
        /**
         * Setup global keyboard listener
         */
        nodeType.prototype.setupGlobalKeyboardListener = function() {
            // Create bound handler that can be removed later
            this.boundKeyHandler = (e) => {
                // Only handle if this node is in edit mode
                if (this.editingTag !== null) {
                    if (this.handleTagInput(e)) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                } else if (this.editingItem !== null) {
                    if (this.handleItemInput(e)) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }
            };
            
            // Add global listener
            document.addEventListener('keydown', this.boundKeyHandler, true);
        };
        
        /**
         * Enter edit mode
         */
        nodeType.prototype.enterEditMode = function(mode, params) {
            if (mode === 'tag') {
                this.editingTag = params;
                this.editingItem = null;
                
                const { itemIndex, tagIndex } = params;
                const itemIdx = this.itemOrder[itemIndex];
                const widget = this.textWidgets[itemIdx];
                const tags = this.parseTextToTags(widget?.value || "");
                this.editCursorPosition = tags[tagIndex]?.length || 0;
                
                
            } else if (mode === 'item') {
                this.editingItem = params;
                this.editingTag = null;
                
                const { itemIndex } = params;
                const itemIdx = this.itemOrder[itemIndex];
                const widget = this.textWidgets[itemIdx];
                this.editCursorPosition = (widget?.value || "").length;
                
                
            }
            
            this.setDirtyCanvas(true, true);
        };
        
        /**
         * Exit edit mode
         */
        nodeType.prototype.exitEditMode = function() {
            this.editingTag = null;
            this.editingItem = null;
            this.editCursorPosition = 0;
            this.setDirtyCanvas(true, true);
            
        };
        
        /**
         * Handle tag text input
         */
        nodeType.prototype.handleTagInput = function(e) {
            if (this.editingTag === null) return false;
            
            const { itemIndex, tagIndex } = this.editingTag;
            const itemIdx = this.itemOrder[itemIndex];
            const widget = this.textWidgets[itemIdx];
            if (!widget) return false;
            
            const tags = this.parseTextToTags(widget.value);
            if (tagIndex >= tags.length) return false;
            
            let tagText = tags[tagIndex];
            let handled = true;
            
            switch(e.key) {
                case "Escape":

                case "Enter":
                    this.exitEditMode();
                    break;
                case "ArrowLeft":
                    if (this.editCursorPosition > 0) {
                        this.editCursorPosition--;
                        this.setDirtyCanvas(true, true);
                    }
                    break;
                case "ArrowRight":
                    if (this.editCursorPosition < tagText.length) {
                        this.editCursorPosition++;
                        this.setDirtyCanvas(true, true);
                    }
                    break;
                case "Home":
                    this.editCursorPosition = 0;
                    this.setDirtyCanvas(true, true);
                    break;
                case "End":
                    this.editCursorPosition = tagText.length;
                    this.setDirtyCanvas(true, true);
                    break;

                case "Backspace":
                    // 修复：内容为空时拦截Backspace，防止冒泡
                    if (!tagText || tagText.length === 0) {
                        return true;
                    }
                    if (this.editCursorPosition > 0) {
                        if (text.length === 1 && this.editCursorPosition === 1) {
                            widget.value = "";
                            this.exitEditMode();
                            this.setDirtyCanvas(true, true);
                            
                            return true;
                        }

                        widget.value = text.slice(0, this.editCursorPosition - 1) + text.slice(this.editCursorPosition);
                        this.editCursorPosition--;
                        this.setDirtyCanvas(true, true);
                    }
                    break;

                case "Delete":
                    if (this.editCursorPosition < tagText.length) {
                        widget.value = text.slice(0, this.editCursorPosition) + text.slice(this.editCursorPosition + 1);
                        if ((widget.value || "").length === 0) {
                            this.exitEditMode();
                        }
                        this.setDirtyCanvas(true, true);
                    }
                    break;

                default:
                    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        widget.value = text.slice(0, this.editCursorPosition) + e.key + text.slice(this.editCursorPosition);
                        this.editCursorPosition++;
                        this.setDirtyCanvas(true, true);
                    } else {
                        handled = false;
                    }
                    break;
            }
            return handled;
        };
        
        /**
         * Handle item text input
         */
        nodeType.prototype.handleItemInput = function(e) {
            if (this.editingItem === null) return false;
            
            const { itemIndex } = this.editingItem;
            const itemIdx = this.itemOrder[itemIndex];
            const widget = this.textWidgets[itemIdx];
            if (!widget) return false;
            
            let text = widget.value || "";
            let handled = true;
            
            switch(e.key) {
                case "Escape":
                    this.exitEditMode();
                    break;
                case "Enter":
                    if (e.shiftKey) {
                        widget.value = text.slice(0, this.editCursorPosition) + '\n' + text.slice(this.editCursorPosition);
                        this.editCursorPosition++;
                        this.setDirtyCanvas(true, true);
                    } else {
                        this.exitEditMode();
                    }
                    break;
                case "ArrowLeft":
                    if (this.editCursorPosition > 0) {
                        this.editCursorPosition--;
                        this.setDirtyCanvas(true, true);
                    }
                    break;
                case "ArrowRight":
                    if (this.editCursorPosition < text.length) {
                        this.editCursorPosition++;
                        this.setDirtyCanvas(true, true);
                    }
                    break;
                case "Home":
                    this.editCursorPosition = 0;
                    this.setDirtyCanvas(true, true);
                    break;
                case "End":
                    this.editCursorPosition = text.length;
                    this.setDirtyCanvas(true, true);
                    break;
                case "Backspace":
                    // 修复：内容为空时拦截Backspace，防止冒泡
                    if (!text || text.length === 0) {
                        return true;
                    }
                    if (this.editCursorPosition > 0) {
                        widget.value = text.slice(0, this.editCursorPosition - 1) + text.slice(this.editCursorPosition);
                        this.editCursorPosition--;
                        this.setDirtyCanvas(true, true);
                    }
                    break;
                case "Delete":
                    if (this.editCursorPosition < text.length) {
                        widget.value = text.slice(0, this.editCursorPosition) + text.slice(this.editCursorPosition + 1);
                        this.setDirtyCanvas(true, true);
                    }
                    break;
                default:
                    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        widget.value = text.slice(0, this.editCursorPosition) + e.key + text.slice(this.editCursorPosition);
                        this.editCursorPosition++;
                        this.setDirtyCanvas(true, true);
                    } else {
                        handled = false;
                    }
                    break;
            }
            return handled;
        };
        
        /**
         * Parse order
         */
        nodeType.prototype.parseOrder = function() {
            if (this.orderWidget && this.orderWidget.value) {
                try {
                    this.itemOrder = this.orderWidget.value.split(',').map(x => parseInt(x.trim()));
                } catch(e) {
                    this.itemOrder = [0, 1, 2, 3];
                }
            }
        };
        
        /**
         * Update order widget
         */
        nodeType.prototype.updateOrderWidget = function() {
            if (this.orderWidget) {
                this.orderWidget.value = this.itemOrder.join(',');
            }
        };
        
        /**
         * Get item bounds
         */
        nodeType.prototype.getItemBounds = function() {
            const bounds = [];
            const startY = this.headerHeight;
            const availableHeight = this.size[1] - this.headerHeight - this.footerHeight;
            const itemHeight = (availableHeight - this.itemMargin * 3) / 4;
            const itemTotalHeight = itemHeight + this.itemMargin;
            
            for (let i = 0; i < 4; i++) {
                bounds.push({
                    x: 10,
                    y: startY + i * itemTotalHeight,
                    width: this.size[0] - 20,
                    height: itemHeight
                });
            }
            
            return bounds;
        };
        
        /**
         * Get tag bounds
         */
        nodeType.prototype.getTagBounds = function(itemBounds, tags) {
            const tagBounds = [];
            const textStartX = itemBounds.x + this.padding;
            const textStartY = itemBounds.y + this.padding;
            const maxWidth = itemBounds.width - this.padding * 2;
            
            let currentX = textStartX;
            let currentY = textStartY;
            
            for (let i = 0; i < tags.length; i++) {
                const tag = tags[i];
                const tagWidth = this.measureTagWidth(tag);
                
                if (currentX + tagWidth > textStartX + maxWidth && currentX > textStartX) {
                    currentX = textStartX;
                    currentY += this.tagHeight + this.tagMargin;
                }
                
                if (currentY + this.tagHeight <= itemBounds.y + itemBounds.height) {
                    tagBounds.push({
                        x: currentX,
                        y: currentY,
                        width: tagWidth,
                        height: this.tagHeight,
                        text: tag
                    });
                    
                    currentX += tagWidth + this.tagMargin;
                } else {
                    break;
                }
            }
            
            return tagBounds;
        };
        
        /**
         * Measure tag width
         */
        nodeType.prototype.measureTagWidth = function(tagText) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.font = `${this.fontSize}px monospace`;
            return ctx.measureText(tagText).width + this.tagPadding * 2;
        };
        
        /**
         * Get item index from Y position
         */
        nodeType.prototype.getItemIndexFromPos = function(mouseY) {
            const bounds = this.getItemBounds();
            for (let i = 0; i < bounds.length; i++) {
                const b = bounds[i];
                if (mouseY >= b.y && mouseY <= b.y + b.height) {
                    return i;
                }
            }
            return null;
        };
        
        /**
         * Get tag from mouse position
         */
        nodeType.prototype.getTagFromPos = function(mouseX, mouseY) {
            const bounds = this.getItemBounds();
            
            for (let i = 0; i < 4; i++) {
                const b = bounds[i];
                if (mouseY >= b.y && mouseY <= b.y + b.height) {
                    const itemIdx = this.itemOrder[i];
                    const widget = this.textWidgets[itemIdx];
                    const tags = this.parseTextToTags(widget?.value || "");
                    const tagBounds = this.getTagBounds(b, tags);
                    
                    for (let j = 0; j < tagBounds.length; j++) {
                        const tb = tagBounds[j];
                        if (mouseX >= tb.x && mouseX <= tb.x + tb.width &&
                            mouseY >= tb.y && mouseY <= tb.y + tb.height) {
                            return { itemIndex: i, tagIndex: j, bounds: tb };
                        }
                    }
                }
            }
            
            return null;
        };
        
        /**
         * Compute size
         */
        nodeType.prototype.computeSize = function(out) {
            return out || this.size;
        };
        
        /**
         * Handle resize
         */
        nodeType.prototype.onResize = function(size) {
            this.size[0] = size[0];
            this.size[1] = size[1];
            this.setDirtyCanvas(true, true);
            return this.size;
        };
        
        /**
         * Draw the UI
         */
        nodeType.prototype.onDrawForeground = function(ctx) {
            if (!this.textWidgets || this.textWidgets.length === 0) return;
            
            const bounds = this.getItemBounds();
            const currentTime = Date.now();
            // Clear drag feedback when expired
            if (this.showDragFeedback && (currentTime - this.dragFeedbackStart) > this.dragFeedbackDuration) {
                this.showDragFeedback = false;
            }
            
            // Update cursor blink
            if (currentTime - this.lastBlinkTime > 530) {
                this.cursorBlinkState = !this.cursorBlinkState;
                this.lastBlinkTime = currentTime;
                if (this.editingTag !== null || this.editingItem !== null) {
                    this.setDirtyCanvas(true, false);
                }
            }
            
            // Draw title
            ctx.save();
            ctx.font = "bold 14px Arial";
            ctx.fillStyle = "#cccccc";
            ctx.fillText("Draggable Tag List", 10, 20);
            ctx.restore();
            
            // Draw instruction
            ctx.save();
            ctx.font = "10px Arial";
            ctx.fillStyle = "#888888";
            ctx.fillText("Drag to move • Double-click to edit • Shift+Enter/Esc to exit", 10, 38);
            ctx.restore();
            
            // Draw each item
            for (let i = 0; i < 4; i++) {
                const b = bounds[i];
                const itemIdx = this.itemOrder[i];
                const widget = this.textWidgets[itemIdx];
                const text = widget?.value || "";
                
                const isItemDragged = (this.isDraggingItem && this.draggedItemIndex === i);
                const isItemEditing = (this.editingItem?.itemIndex === i);
                
                // Draw background
                ctx.save();
                // If we just started dragging and feedback is enabled, draw a glow behind the dragged item
                if (this.showDragFeedback && this.draggedItemIndex === i) {
                    ctx.fillStyle = "rgba(90,160,255,0.14)";
                    ctx.beginPath();
                    ctx.roundRect(b.x - 4, b.y - 4, b.width + 8, b.height + 8, 6);
                    ctx.fill();
                }

                ctx.fillStyle = isItemEditing ? "#2a3a4a" :
                               isItemDragged ? "#3a3a3a" : 
                               "#1e1e1e";
                ctx.strokeStyle = isItemEditing ? "#5a9eff" :
                                 isItemDragged ? "#4a9eff" : 
                                 "#333333";
                ctx.lineWidth = isItemEditing ? 2 : 1;
                
                ctx.beginPath();
                ctx.roundRect(b.x, b.y, b.width, b.height, 4);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
                
                // Draw content based on mode
                if (isItemEditing) {
                    // Editing mode: show raw text with cursor
                    this.drawItemEditMode(ctx, b, text);
                } else {
                    // Normal mode: show tags
                    const tags = this.parseTextToTags(text);
                    if (tags.length > 0) {
                        this.drawTags(ctx, b, tags, i);
                    } else {
                        // Placeholder
                        ctx.save();
                        ctx.font = `${this.fontSize}px monospace`;
                        ctx.fillStyle = "#666666";
                        ctx.textBaseline = "top";
                        ctx.fillText(`Item ${itemIdx + 1} (double-click to edit)`, b.x + this.padding, b.y + this.padding);
                        ctx.restore();
                    }
                }
                
                // Draw insert indicator when dragging item
                if (this.isDraggingItem && this.hoverItemIndex === i && this.draggedItemIndex !== i) {
                    ctx.save();
                    ctx.strokeStyle = "#4a9eff";
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    const insertY = (this.draggedItemIndex < i) ? b.y + b.height : b.y;
                    ctx.moveTo(b.x, insertY);
                    ctx.lineTo(b.x + b.width, insertY);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        };
        
        /**
         * Draw item in edit mode
         */
        nodeType.prototype.drawItemEditMode = function(ctx, bounds, text) {
            const textStartX = bounds.x + this.padding;
            const textStartY = bounds.y + this.padding;
            
            ctx.save();
            ctx.font = `${this.fontSize}px monospace`;
            ctx.fillStyle = "#eeeeee";
            ctx.textBaseline = "top";
            
            // Clip
            ctx.beginPath();
            ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
            ctx.clip();
            
            // Draw text
            const displayText = text || "";
            const lines = displayText.split('\n');
            for (let i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], textStartX, textStartY + i * this.lineHeight);
            }
            
            // Draw cursor
            if (this.cursorBlinkState) {
                const textBeforeCursor = displayText.slice(0, this.editCursorPosition);
                const linesBeforeCursor = textBeforeCursor.split('\n');
                const cursorLine = linesBeforeCursor.length - 1;
                const cursorCol = linesBeforeCursor[cursorLine].length;
                
                const cursorX = textStartX + ctx.measureText(linesBeforeCursor[cursorLine]).width;
                const cursorY = textStartY + cursorLine * this.lineHeight;
                
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(cursorX, cursorY);
                ctx.lineTo(cursorX, cursorY + this.lineHeight);
                ctx.stroke();
            }
            
            ctx.restore();
        };
        
        /**
         * Draw tags
         */
        nodeType.prototype.drawTags = function(ctx, itemBounds, tags, itemIndex) {
            const tagBounds = this.getTagBounds(itemBounds, tags);
            const now = Date.now();
            if (this.showDragFeedback && this.draggedTag && this.draggedTag.itemIndex === itemIndex) {
                // draw subtle glow behind tags area
                ctx.save();
                ctx.fillStyle = "rgba(90,160,255,0.10)";
                ctx.beginPath();
                ctx.roundRect(itemBounds.x - 2, itemBounds.y - 2, itemBounds.width + 4, itemBounds.height + 4, 6);
                ctx.fill();
                ctx.restore();
            }
            
            // If there is an insertion index for this item, compute insert X once
            let insertX = null;
            if (this.hoverTag && this.hoverTag.itemIndex === itemIndex && typeof this.hoverTag.insertIndex === 'number') {
                const ins = this.hoverTag.insertIndex;
                if (ins <= 0) {
                    if (tagBounds.length > 0) insertX = tagBounds[0].x;
                    else insertX = itemBounds.x + this.padding;
                } else if (ins >= tagBounds.length) {
                    if (tagBounds.length > 0) {
                        const last = tagBounds[tagBounds.length - 1];
                        insertX = last.x + last.width;
                    } else {
                        insertX = itemBounds.x + this.padding;
                    }
                } else {
                    const tbIns = tagBounds[ins];
                    insertX = tbIns.x;
                }
            }
            
            for (let j = 0; j < tagBounds.length; j++) {
                const tb = tagBounds[j];
                const tag = tags[j];
                
                const isDragged = this.isDraggingTag && 
                                this.draggedTag?.itemIndex === itemIndex && 
                                this.draggedTag?.tagIndex === j;
                const isEditing = this.editingTag?.itemIndex === itemIndex && 
                                this.editingTag?.tagIndex === j;
                
                // Draw tag background
                ctx.save();
                ctx.fillStyle = isEditing ? "#2a3a5a" :
                                isDragged ? "#4a4a4a" :
                                "#2a2a2a";
                ctx.strokeStyle = isEditing ? "#5a9eff" :
                                isDragged ? "#5a9eff" :
                                "#444444";
                ctx.lineWidth = isEditing || isDragged ? 1.5 : 1;
                
                ctx.beginPath();
                ctx.roundRect(tb.x, tb.y, tb.width, tb.height, 3);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
                
                // Draw tag text
                ctx.save();
                ctx.font = `${this.fontSize}px monospace`;
                ctx.fillStyle = "#eeeeee";
                ctx.textBaseline = "middle";
                
                ctx.beginPath();
                ctx.rect(tb.x, tb.y, tb.width, tb.height);
                ctx.clip();
                
                ctx.fillText(tag, tb.x + this.tagPadding, tb.y + tb.height / 2);
                
                // Draw cursor if editing
                if (isEditing && this.cursorBlinkState) {
                    const textBeforeCursor = tag.slice(0, this.editCursorPosition);
                    const cursorX = tb.x + this.tagPadding + ctx.measureText(textBeforeCursor).width;
                    
                    ctx.strokeStyle = "#ffffff";
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(cursorX, tb.y + 4);
                    ctx.lineTo(cursorX, tb.y + tb.height - 4);
                    ctx.stroke();
                }
                
                ctx.restore();
            }
                
            // Draw insert indicator (vertical line) if applicable
            if (insertX !== null && !this.isDraggingItem) {
                ctx.save();
                ctx.strokeStyle = "#4a9eff";
                ctx.lineWidth = 2;
                const topY = itemBounds.y + this.padding - 2;
                const botY = Math.min(itemBounds.y + itemBounds.height - this.padding + 2, topY + this.tagHeight + 10);
                ctx.beginPath();
                ctx.moveTo(insertX, topY);
                ctx.lineTo(insertX, itemBounds.y + itemBounds.height - this.padding);
                ctx.stroke();
                ctx.restore();
            }
        };
        
        /**
         * Handle mouse down
         */
        nodeType.prototype.onMouseDown = function(e, localPos, graphCanvas) {
            const now = Date.now();
            
            // Check for tag click first
            const tagHit = this.getTagFromPos(localPos[0], localPos[1]);
            
            if (tagHit) {
                // Detect double-click on tag
                const isDoubleClick = this.lastClickTarget &&
                                    this.lastClickTarget.type === 'tag' &&
                                    this.lastClickTarget.itemIndex === tagHit.itemIndex &&
                                    this.lastClickTarget.tagIndex === tagHit.tagIndex &&
                                    (now - this.lastClickTime) < this.doubleClickDelay;

                if (isDoubleClick) {
                    // Enter tag edit mode
                    this.enterEditMode('tag', { itemIndex: tagHit.itemIndex, tagIndex: tagHit.tagIndex });
                    this.isDraggingTag = false;
                    this.draggedTag = null;
                } else {
                    // Record potential tag-drag (require hold+move to start actual drag)
                    this.potentialDragTag = { itemIndex: tagHit.itemIndex, tagIndex: tagHit.tagIndex };
                    this.mouseDownPos = [localPos[0], localPos[1]];
                    this.mouseDownTime = now;
                    // do not exit edit mode yet until drag actually starts
                    
                }

                this.lastClickTarget = { type: 'tag', itemIndex: tagHit.itemIndex, tagIndex: tagHit.tagIndex };
                this.lastClickTime = now;
                // Do not force redraw now; redraw when drag actually starts or other visible actions occur
                return true;
            }
            
            // Check for item click (empty area)
            const itemIndex = this.getItemIndexFromPos(localPos[1]);
            if (itemIndex !== null) {
                const bounds = this.getItemBounds();
                const b = bounds[itemIndex];
                
                if (localPos[0] >= b.x && localPos[0] <= b.x + b.width) {
                    // Detect double-click on item
                    const isDoubleClick = this.lastClickTarget &&
                                        this.lastClickTarget.type === 'item' &&
                                        this.lastClickTarget.itemIndex === itemIndex &&
                                        (now - this.lastClickTime) < this.doubleClickDelay;
                    
                    if (isDoubleClick) {
                        // Enter item edit mode
                        this.enterEditMode('item', { itemIndex: itemIndex });
                        this.isDraggingItem = false;
                        this.draggedItemIndex = null;
                    } else {
                        // Record potential drag and mouse down position
                        this.potentialDragItem = itemIndex;
                        this.mouseDownPos = [localPos[0], localPos[1]];
                        this.mouseDownTime = now;
                        // do not exit edit mode yet until real drag begins
                        
                    }

                    // update last click info
                    this.lastClickTarget = { type: 'item', itemIndex: itemIndex };
                    this.lastClickTime = now;
                    // Do NOT force a full immediate redraw for a simple mousedown that may become a drag.
                    // Redraw will be triggered when actual drag starts or other visible actions occur.
                    return true;
                }
            }
            
            // Click outside - exit edit mode
            this.exitEditMode();
            
            return false;
        };
        
        /**
         * Handle mouse move
         */
        nodeType.prototype.onMouseMove = function(e, localPos, graphCanvas) {
            // If there is a potential item drag, check movement to start actual drag
            if (this.potentialDragItem !== null && !this.isDraggingItem) {
                const dx = Math.abs(localPos[0] - (this.mouseDownPos ? this.mouseDownPos[0] : localPos[0]));
                const dy = Math.abs(localPos[1] - (this.mouseDownPos ? this.mouseDownPos[1] : localPos[1]));
                const elapsed = Date.now() - (this.mouseDownTime || 0);
                if ((dx >= this.dragStartThreshold || dy >= this.dragStartThreshold) && elapsed >= this.dragStartDelay) {
                    // Start dragging item (only now update hover and visual state)
                    this.isDraggingItem = true;
                    this.draggedItemIndex = this.potentialDragItem;
                    this.hoverItemIndex = this.potentialDragItem;
                    this.potentialDragItem = null;
                    this.mouseDownPos = null;
                    this.mouseDownTime = null;
                    this.exitEditMode();
                    // show visual feedback briefly
                    this.showDragFeedback = true;
                    this.dragFeedbackStart = Date.now();
                    this.setDirtyCanvas(true, true);
                    
                } else {
                    // Not yet a real drag: consume the mousemove to avoid external UI reactions
                    return true;
                }
            }
            // If there's a potential tag drag, check movement/time to start actual tag drag
            if (this.potentialDragTag !== null && !this.isDraggingTag) {
                const dx = Math.abs(localPos[0] - (this.mouseDownPos ? this.mouseDownPos[0] : localPos[0]));
                const dy = Math.abs(localPos[1] - (this.mouseDownPos ? this.mouseDownPos[1] : localPos[1]));
                const elapsed = Date.now() - (this.mouseDownTime || 0);
                if ((dx >= this.dragStartThreshold || dy >= this.dragStartThreshold) && elapsed >= this.dragStartDelay) {
                    // Start actual tag drag
                    this.isDraggingTag = true;
                    this.draggedTag = { itemIndex: this.potentialDragTag.itemIndex, tagIndex: this.potentialDragTag.tagIndex };
                    // initialize hoverTag using clicked tag position
                    const tb = this.getTagBounds(this.getItemBounds()[this.draggedTag.itemIndex], this.parseTextToTags(this.textWidgets[this.itemOrder[this.draggedTag.itemIndex]]?.value || ""))[this.draggedTag.tagIndex] || null;
                    const mid = tb ? (tb.x + tb.width / 2) : (this.getItemBounds()[this.draggedTag.itemIndex].x + this.padding);
                    const initInsert = (localPos[0] < mid) ? this.draggedTag.tagIndex : this.draggedTag.tagIndex + 1;
                    this.hoverTag = { itemIndex: this.draggedTag.itemIndex, tagIndex: this.draggedTag.tagIndex, insertIndex: initInsert };
                    this.potentialDragTag = null;
                    this.mouseDownPos = null;
                    this.mouseDownTime = null;
                    this.exitEditMode();
                    // show visual feedback briefly
                    this.showDragFeedback = true;
                    this.dragFeedbackStart = Date.now();
                    this.setDirtyCanvas(true, true);
                    
                } else {
                    // consume mousemove until it becomes an actual drag
                    return true;
                }
            }
            if (this.isDraggingTag) {
                const tagHit = this.getTagFromPos(localPos[0], localPos[1]);
                if (tagHit && tagHit.itemIndex === this.draggedTag.itemIndex) {
                    // decide insertIndex based on mouse X relative to hovered tag center
                    const tb = tagHit.bounds;
                    const midX = tb.x + tb.width / 2;
                    const insertIndex = (localPos[0] < midX) ? tagHit.tagIndex : tagHit.tagIndex + 1;
                    // only update & redraw on change
                    if (!this.hoverTag || this.hoverTag.itemIndex !== tagHit.itemIndex || this.hoverTag.insertIndex !== insertIndex) {
                        this.hoverTag = { itemIndex: tagHit.itemIndex, tagIndex: tagHit.tagIndex, insertIndex: insertIndex };
                        this.setDirtyCanvas(true, true);
                    }
                } else {
                    // If moved outside tag area within same item, allow inserting at ends:
                    const bounds = this.getItemBounds();
                    const itemIdx = this.getItemIndexFromPos(localPos[1]);
                    if (itemIdx === this.draggedTag.itemIndex) {
                        const b = bounds[itemIdx];
                        const tags = this.parseTextToTags(this.textWidgets[this.itemOrder[itemIdx]]?.value || "");
                        // If mouse is left of first tag -> insertIndex = 0; right of last -> tags.length
                        const tagBounds = this.getTagBounds(b, tags);
                        if (tagBounds.length === 0) {
                            const insertIndex = 0;
                            if (!this.hoverTag || this.hoverTag.insertIndex !== insertIndex) {
                                this.hoverTag = { itemIndex: itemIdx, tagIndex: 0, insertIndex };
                                this.setDirtyCanvas(true, true);
                            }
                        } else {
                            const first = tagBounds[0];
                            const last = tagBounds[tagBounds.length - 1];
                            if (localPos[0] < first.x) {
                                const insertIndex = 0;
                                if (!this.hoverTag || this.hoverTag.insertIndex !== insertIndex) {
                                    this.hoverTag = { itemIndex: itemIdx, tagIndex: 0, insertIndex };
                                    this.setDirtyCanvas(true, true);
                                }
                            } else if (localPos[0] > last.x + last.width) {
                                const insertIndex = tagBounds.length;
                                if (!this.hoverTag || this.hoverTag.insertIndex !== insertIndex) {
                                    this.hoverTag = { itemIndex: itemIdx, tagIndex: tagBounds.length - 1, insertIndex };
                                    this.setDirtyCanvas(true, true);
                                }
                            } else {
                                // cleared hover if none matched
                                // no-op, keep previous hoverTag if any
                            }
                        }
                    } else {
                        // moved to other item or outside — clear hoverTag
                        if (this.hoverTag) {
                            this.hoverTag = null;
                            this.setDirtyCanvas(true, true);
                        }
                    }
                }
                return true;
            }
            
            if (this.isDraggingItem) {
                const newHoverIndex = this.getItemIndexFromPos(localPos[1]);
                if (newHoverIndex !== null && newHoverIndex !== this.hoverItemIndex) {
                    this.hoverItemIndex = newHoverIndex;
                    this.setDirtyCanvas(true, true);
                }
                return true;
            }
            
            return false;
        };
        
        /**
         * Handle mouse up
         */
        nodeType.prototype.onMouseUp = function(e, localPos, graphCanvas) {
            if (this.isDraggingTag) {
                if (this.hoverTag && 
                    this.draggedTag.itemIndex === this.hoverTag.itemIndex) {
                    
                    const itemIdx = this.itemOrder[this.draggedTag.itemIndex];
                    const widget = this.textWidgets[itemIdx];
                    const tags = this.parseTextToTags(widget.value);
                    
                    const draggedTagText = tags[this.draggedTag.tagIndex];
                    // remove original
                    tags.splice(this.draggedTag.tagIndex, 1);
                    
                    // determine destination index
                    let dest = this.hoverTag.insertIndex;
                    // adjust destination when removing an earlier index
                    if (this.draggedTag.tagIndex < dest) dest = dest - 1;
                    if (dest < 0) dest = 0;
                    if (dest > tags.length) dest = tags.length;
                    
                    tags.splice(dest, 0, draggedTagText);
                    
                    widget.value = this.tagsToText(tags);
                    
                }
                
                this.isDraggingTag = false;
                this.draggedTag = null;
                this.hoverTag = null;
                this.setDirtyCanvas(true, true);
                return true;
            }
            
            if (this.isDraggingItem) {
                if (this.hoverItemIndex !== null && this.draggedItemIndex !== this.hoverItemIndex) {
                    const newOrder = [...this.itemOrder];
                    const draggedItem = newOrder[this.draggedItemIndex];
                    
                    newOrder.splice(this.draggedItemIndex, 1);
                    const insertIndex = this.hoverItemIndex > this.draggedItemIndex ? 
                                        this.hoverItemIndex : this.hoverItemIndex;
                    newOrder.splice(insertIndex, 0, draggedItem);
                    
                    this.itemOrder = newOrder;
                    this.updateOrderWidget();
                    
                }
                
                this.isDraggingItem = false;
                this.draggedItemIndex = null;
                // Clear potential drag in case it was left
                this.potentialDragItem = null;
                this.mouseDownPos = null;
                this.setDirtyCanvas(true, true);
                return true;
            }

            // If mouse was released without starting a drag, clear potential drag state
            if (this.potentialDragItem !== null) {
                this.potentialDragItem = null;
                this.mouseDownPos = null;
                this.mouseDownTime = null;
            }
            if (this.potentialDragTag !== null) {
                this.potentialDragTag = null;
                this.mouseDownPos = null;
                this.mouseDownTime = null;
            }

            return false;
        };
        
        /**
         * Handle mouse leave
         */
        nodeType.prototype.onMouseLeave = function(e) {
            if (this.isDraggingItem) {
                this.isDraggingItem = false;
                this.draggedItemIndex = null;
                this.hoverItemIndex = null;
                this.setDirtyCanvas(true, true);
            }
            if (this.isDraggingTag) {
                this.isDraggingTag = false;
                this.draggedTag = null;
                this.hoverTag = null;
                this.setDirtyCanvas(true, true);
            }
            // clear transient hoverTag when cursor leaves
            if (this.hoverTag) {
                this.hoverTag = null;
                this.setDirtyCanvas(true, true);
            }
            // Clear potential item-drag if leaving
            if (this.potentialDragItem !== null) {
                this.potentialDragItem = null;
                this.mouseDownPos = null;
                this.setDirtyCanvas(true, true);
            }
        };
        
        /**
         * Serialize
         */
        const onSerialize = nodeType.prototype.onSerialize;
        nodeType.prototype.onSerialize = function(o) {
            if (onSerialize) {
                onSerialize.apply(this, arguments);
            }
            o.itemOrder = this.itemOrder;
        };
        
        /**
         * Configure
         */
        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function(o) {
            if (onConfigure) {
                onConfigure.apply(this, arguments);
            }
            if (o.itemOrder) {
                this.itemOrder = o.itemOrder;
                this.updateOrderWidget();
            }
            
            this.widgets.forEach(widget => {
                widget.type = "converted-widget";
                widget.computeSize = () => [0, -4];
            });
        };
    }
});