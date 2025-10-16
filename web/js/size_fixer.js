import { app } from "../../../scripts/app.js";

/*
 * Fix the size of nodes that have been resized incorrectly.
 */

function isA1rNode(nodeName) {
    return nodeName.startsWith("A1r");
}

const DEFAULT_SIZE = {
    // config nodes
    "A1r KSampler Config": [230, 330],
    "A1r KSampler Config Values": [230, 200],
    "A1r KSampler Config Values Lite": [230, 170],
    "A1r LoRA Config": [210, 230],
    "A1r ControlNet Config": [210, 280],

    // control nodes
    "A1r KSampler ControlPad Advanced": [220, 280],
    "A1r LoRA ControlPad": [220, 310],

    // text nodes
    "A1r Text Box": [400, 200],
    "A1r Merge Text": [220, 280],
    "A1r Translate ClipEncode Merge": [220, 470],

    // Utils nodes
    "A1r Slider Custom": [210, 30]
}

window.A1rSpace_SizeFixer = {
    registerDefaultSize: function (nodeName, size) {
        if (!DEFAULT_SIZE[nodeName]) {
            DEFAULT_SIZE[nodeName] = size;
            console.log(`[A1rSpace] Registered default size for ${nodeName}: ${size}`);
        } else {
            console.log(`[A1rSpace] Ignored registering default size for ${nodeName}, already registered`);
        }
    },

    hasDefaultSize: function (nodeName) {
        return DEFAULT_SIZE.hasOwnProperty(nodeName);
    }
};

app.registerExtension({
    name: "A1rSpace.NodeSizeFixer",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (!isA1rNode(nodeData.name)) {
            return;
        }

        // Save original methods
        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        const origOnConfigure = nodeType.prototype.onConfigure;
        const origOnResize = nodeType.prototype.onResize;
        const origOnSerialize = nodeType.prototype.onSerialize;

        // Size protection
        nodeType.prototype.onNodeCreated = function() {
            const result = origOnNodeCreated ? origOnNodeCreated.apply(this, arguments) : undefined;

            // console.log(`[A1rSpace] Size fixer applied to node type: ${nodeData.name}`);

            if (!this._a1r_size_data) {
                this._a1r_size_data = {};
            }

            this._a1r_size_data = {
                userModified: false,
                lastWidth: this.size ? this.size[0] : null,
                lastHeight: this.size ? this.size[1] : null,
            };

            if (!this._a1r_size_data.lastWidth || !this._a1r_size_data.lastHeight) {
                const defaultSize = DEFAULT_SIZE[nodeData.name];
                if (defaultSize) {
                    this.size = [...defaultSize];
                    this._a1r_size_data.lastWidth = defaultSize[0];
                    this._a1r_size_data.lastHeight = defaultSize[1];
                }
            }

            return result;
        };

        nodeType.prototype.onConfigure = function(info) {
            // Save current size
            const prevUserModified = this._a1r_size_data?.userModified;
            const prevSize = this.size ? [...this.size] : null;

            const result = origOnConfigure ? origOnConfigure.apply(this, arguments) : undefined;

            if (!this._a1r_size_data) {
                this._a1r_size_data = { userModified: false };
            }

            if (info && info.size) {
                if (info._a1r_size_userModified) {
                    this._a1r_size_data.userModified = true;
                }
            
                this._a1r_size_data.lastWidth = info.size[0];
                this._a1r_size_data.lastHeight = info.size[1];

                this.size = [...info.size];
            } else if (prevUserModified && prevSize) {
                this._a1r_size_data.userModified = true;

                this._a1r_size_data.lastWidth = prevSize[0];
                this._a1r_size_data.lastHeight = prevSize[1];

                this.size = [...prevSize];
            } else {
                const defaultSize = DEFAULT_SIZE[nodeData.name];
                if (defaultSize) {
                    this.size = [...defaultSize];

                    this._a1r_size_data.lastWidth = defaultSize[0];
                    this._a1r_size_data.lastHeight = defaultSize[1];
                }
            }

            return result;
        };

        nodeType.prototype.onResize = function(size) {
            const result = origOnResize ? origOnResize.apply(this, arguments) : undefined;

            if (!this._a1r_size_data) {
                this._a1r_size_data = {};
            }

            if (this.size) {
                this._a1r_size_data.userModified = true;
                this._a1r_size_data.lastWidth = this.size[0];
                this._a1r_size_data.lastHeight = this.size[1];
            }

            return result;
        };

        nodeType.prototype.onSerialize = function(info) {
            const result = origOnSerialize ? origOnSerialize.apply(this, arguments) : undefined;

            if (this._a1r_size_data) {
                if (this._a1r_size_data.lastWidth || this._a1r_size_data.lastHeight) {
                    info.size = [
                        this._a1r_size_data.lastWidth,
                        this._a1r_size_data.lastHeight
                    ];
                }

                if (this._a1r_size_data.userModified) {
                    info._a1r_size_userModified = true;
                }
            }

            return result;
        };
    },

    async afterGraphLoad() {
        setTimeout(() => {
            for (const node of app.graph.nodes) {
                if (isA1rNode(node.type)) {
                    if (!node._a1r_size_data) {
                        node._a1r_size_data = {};
                    }

                    if ((!node.size || node.size.length !== 2) && !node._a1r_size_data.userModified) {
                        const defaultSize = DEFAULT_SIZE[node.type];
                        if (defaultSize) {
                            node.size = [...defaultSize];
                        }
                    }

                    if (node._a1r_size_data.lastWidth && node._a1r_size_data.lastHeight) {
                        node.size = [
                            node._a1r_size_data.lastWidth,
                            node._a1r_size_data.lastHeight
                        ];
                    }

                    node.setDirtyCanvas(true, true);
                }
            }
        }, 100);
    }
});