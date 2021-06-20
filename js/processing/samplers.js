import { ModelBridge } from "../ui/model_bridge.js";
import { ImageProcessingNode, processNodes } from "./process_node.js";
import { clamp, toUint32Array } from "./util.js";
/**
 * A sampler extracts a color from the image
 */
export class BorderColorSampler extends ImageProcessingNode {
    async processImage(buffer) {
        buffer.cropParameters.color = await this.extractColor(buffer);
        return buffer;
    }
}
function actualOffset(val, max) {
    return val ? Math.round(val * max) : 0;
}
export class PointSampler extends BorderColorSampler {
    constructor() {
        super();
        const model = this.ownBridge.model;
        for (let name of this.ownBridge.serializableNames) {
            model[name] = 0;
        }
    }
    extractColor(image) {
        const buffer = image.toByteImageBuffer();
        const words = toUint32Array(buffer.bytes);
        const model = this.ownBridge.model;
        let xOffset = actualOffset(model["normalizedX"], image.width - 1) +
            (model["pixelX"] || 0);
        let yOffset = actualOffset(model["normalizedY"], image.height - 1) +
            (model["pixelY"] || 0);
        const color = words[clamp(xOffset, 0, image.width - 1) +
            clamp(yOffset, 0, image.height - 1) * image.wordPitch];
        this.ownBridge.model["lastColor"] = color;
        this.ownBridge.model["lastX"] = xOffset;
        this.ownBridge.model["lastY"] = yOffset;
        return Promise.resolve(color);
    }
    serialize() {
        return this.ownBridge.exportModel();
    }
    deserialize(obj) {
        this.ownBridge.patchModel(obj);
    }
    get modelBridge() {
        return this.ownBridge.pair;
    }
    get ownBridge() {
        if (!this.bridge) {
            this.bridge = new ModelBridge({ "lastColor": null }, {
                "properties": [
                    {
                        "name": "normalizedX",
                        "editor": "double",
                        "label": "X coordinate normalized to [0, 1]",
                        "min": 0,
                        "max": 1,
                        "step": 0.01
                    },
                    {
                        "name": "normalizedY",
                        "editor": "double",
                        "label": "Y coordinate normalized to [0, 1]",
                        "min": 0,
                        "max": 1,
                        "step": 0.01
                    },
                    {
                        "name": "pixelX",
                        "editor": "int",
                        "label": "X offset in pixels",
                    },
                    {
                        "name": "pixelY",
                        "editor": "int",
                        "label": "Y offset in pixels",
                    },
                    {
                        "name": "lastX",
                        "editor": "int?",
                        "label": "Last X",
                        "readOnly": true,
                        "serializable": false,
                    },
                    {
                        "name": "lastY",
                        "editor": "int?",
                        "label": "Last Y",
                        "readOnly": true,
                        "serializable": false,
                    },
                    {
                        "name": "lastColor",
                        "editor": "color?",
                        "label": "Last border color",
                        "readOnly": true,
                        "serializable": false,
                        "alpha": true,
                    },
                ],
            });
        }
        return this.bridge;
    }
}
PointSampler["className"] = "PointSampler";
processNodes.addClass(PointSampler);
