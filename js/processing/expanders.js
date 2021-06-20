import { ModelBridge } from "../ui/model_bridge.js";
import { ImageProcessingNode, processNodes } from "./process_node.js";
export class SimpleExpander extends ImageProcessingNode {
    constructor() {
        super(...arguments);
        this.expand = 0;
    }
    serialize() {
        return this.ownBridge.exportModel();
    }
    deserialize(obj) {
        this.expand = obj["expand"];
        this.ownBridge.patchModel(obj);
    }
    get modelBridge() {
        return this.ownBridge.pair;
    }
    get ownBridge() {
        if (!this.bridge) {
            this.bridge = new ModelBridge({ "expand": this.expand }, {
                "properties": [
                    {
                        "name": "expand",
                        "editor": "exponentialSlider",
                        "label": "Border width",
                        "expOffset": 1,
                        "expMin": 0,
                        "expMax": 64,
                    },
                ],
            });
            this.bridge.addHandler("expand", (target, prop) => (this.expand = target[prop]));
        }
        return this.bridge;
    }
    get expandBy() {
        return this.expand;
    }
    set expandBy(val) {
        this.modelBridge.model["expand"] = val;
    }
    async processImage(buffer) {
        var _a;
        const expand = (_a = this.expand) !== null && _a !== void 0 ? _a : 0;
        let rect = Array.from(buffer.cropParameters.cropRect);
        const cropRect = Array.from(rect);
        if (expand > 0) {
            rect = cropRect.map((e, i) => e + ((i & 2) - 1) * expand);
        }
        buffer.cropParameters.expandedRect = Array.from(rect);
        return buffer;
    }
}
SimpleExpander["className"] = "SimpleExpander";
processNodes.addClass(SimpleExpander);
