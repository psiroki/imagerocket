import { ModelBridge } from "../ui/model_bridge.js";
import { colorHashString, deepCopyJson } from "../common/util.js";
export class Serializable {
    serializedClone() {
        const arr = globalSerializer.deserializeAll(deepCopyJson(globalSerializer.serializeAll([this])));
        return arr[0];
    }
}
export class ProcessNode extends Serializable {
    constructor() {
        super(...arguments);
        this.instanceId = ++ProcessNode.idCounter;
        this._nodeId = ++ProcessNode.idCounter;
    }
    get classColorInfo() {
        const className = globalSerializer.classNameFromInstance(this);
        return colorHashString(className, 0.5);
    }
    /// Specify what features the node has to decide wether it can be
    /// run in a worker or not. The result may change based on the
    /// node configuration (for example a zero pixel expansion node does
    /// nothing, it can be a `"noEffect"` node)
    get features() {
        return new Set();
    }
    get modelBridge() {
        var _a;
        return ((_a = this.ownBridge) === null || _a === void 0 ? void 0 : _a.pair) || null;
    }
    get ownBridge() {
        return null;
    }
    serialize() {
        return { "nodeId": this.nodeId };
    }
    deserialize(obj) {
        this._nodeId = obj["nodeId"];
    }
    get nodeId() {
        return this._nodeId;
    }
    serializedClone() {
        const result = super.serializedClone();
        result._nodeId = ++ProcessNode.idCounter;
        return result;
    }
}
ProcessNode.idCounter = Date.now() - 1625597180147;
export class SimpleProcessNode extends ProcessNode {
    /// Most nodes operate on one image at a time, but some nodes
    /// (like collage nodes) would combine or split images. Those
    /// classes need to override this function and ignore processImage
    /// altogether.
    processImages(buffers) {
        return Promise.all(buffers.map(buffer => this.processImage(buffer)));
    }
}
class SerializationSession {
    constructor(service) {
        this.ids = new Map();
        this.rootIds = [];
        this.result = {};
        this.counter = new Map();
        this.service = service;
    }
    addNode(node) {
        return this.addNodeInternal(node, true);
    }
    serialize() {
        return [{ "_class": "_rootRefs", "ids": Array.from(this.rootIds) }].concat(Object.values(this.result));
    }
    addNodeInternal(node, root) {
        var _a;
        let id = this.ids.get(node);
        if (!id) {
            let className = this.service.classNameFromInstance(node);
            let index = ((_a = this.counter.get(className)) !== null && _a !== void 0 ? _a : 0) + 1;
            this.counter.set(className, index);
            id = className + index;
            this.ids.set(node, id);
            let serialized = this.findReferences(node, node.serialize());
            serialized["_class"] = className;
            serialized["_id"] = id;
            this.result[id] = serialized;
        }
        if (root)
            this.rootIds.push(id);
        return id;
    }
    findReferences(node, value) {
        if (value instanceof Serializable) {
            return { "_class": "_ref", "_id": this.addNodeInternal(value, false) };
        }
        else if (value instanceof Array) {
            return value.map(e => this.findReferences(node, e));
        }
        else if (typeof value === "object" && value) {
            return Object.fromEntries(Object.entries(value).map(e => {
                e[1] = this.findReferences(node, e[1]);
                return e;
            }));
        }
        else if (typeof value === "undefined") {
            // undefined is mapped to null
            return null;
        }
        else if (typeof value !== "boolean" &&
            typeof value !== "string" &&
            typeof value !== "number" &&
            value !== null) {
            throw new Error(`Invalid value: ${value} in ${node}`);
        }
        else {
            // primitive
            return value;
        }
    }
}
class DeserializationSession {
    constructor(service) {
        this.nodeById = new Map();
        this.service = service;
    }
    deserialize(serializedNodes) {
        const rootRefs = serializedNodes.find(e => e["_class"] === "_rootRefs") || null;
        const rootIds = rootRefs ? rootRefs["ids"] || null : null;
        const rest = serializedNodes.filter(s => s["_class"] !== "_rootRefs");
        for (let serializedForm of rest) {
            const classSpec = serializedForm["_class"];
            let c = this.service.lookupClass(classSpec);
            let id = serializedForm["_id"];
            this.nodeById.set(id, new c());
        }
        for (let serializedForm of rest) {
            let resolved = this.resolveReferences(serializedForm);
            this.nodeById.get(serializedForm["_id"]).deserialize(resolved);
        }
        return rootIds
            ? rootIds.map(id => this.nodeById.get(id))
            : Array.from(this.nodeById.values());
    }
    resolveReferences(value) {
        if (value instanceof Array) {
            return value.map(e => this.resolveReferences(e));
        }
        else if (typeof value === "object" && value) {
            if (value["_class"] === "_ref") {
                return this.nodeById.get(value["_id"]);
            }
            else {
                return Object.fromEntries(Object.entries(value).map(e => {
                    e[1] = this.resolveReferences(e[1]);
                    return e;
                }));
            }
        }
        else {
            return value;
        }
    }
}
export class SerializableClass {
    constructor(name, create) {
        this.name = name;
        this.create = create;
    }
}
export class Serializer {
    constructor() {
        this.classByName = new Map();
        this.nameByClass = new Map();
    }
    addClass(classFunction, name = "") {
        var _a;
        if (name === "")
            name = (_a = classFunction["className"]) !== null && _a !== void 0 ? _a : classFunction.name;
        console.log(`Class: ${classFunction.name} as ${name}`);
        this.classByName.set(name, classFunction);
        this.nameByClass.set(classFunction, name);
    }
    *enumerateClasses() {
        for (let entry of this.classByName.entries()) {
            yield new SerializableClass(entry[0], entry[1]);
        }
    }
    serializeAll(nodes) {
        let result = new SerializationSession(this);
        for (let node of nodes) {
            result.addNode(node);
        }
        return result.serialize();
    }
    deserializeAll(serializedNodes) {
        return new DeserializationSession(this).deserialize(serializedNodes);
    }
    classNameFromInstance(instance) {
        return this.className(instance.constructor);
    }
    className(classFunction) {
        return this.nameByClass.get(classFunction);
    }
    lookupClass(name) {
        return this.classByName.get(name);
    }
}
export const globalSerializer = new Serializer();
export class ImageProcessingPipeline extends ProcessNode {
    constructor(nodes = []) {
        super();
        this.ownBridge.model["pipeline"] = nodes;
    }
    async processImages(buffers) {
        const nodes = this.ownBridge.model["pipeline"];
        for (let node of nodes) {
            buffers = await node.processImages(buffers);
        }
        return buffers;
    }
    serialize() {
        return this.ownBridge.exportToModel({ "_super": super.serialize() });
    }
    deserialize(obj) {
        super.deserialize(obj["_super"]);
        this.ownBridge.patchModel(obj);
    }
    get nodes() {
        return this.ownBridge.model["pipeline"];
    }
    get ownBridge() {
        if (!this.bridge) {
            this.bridge = new ModelBridge({ "pipeline": [] }, {
                "properties": [
                    {
                        "name": "pipeline",
                        "editor": "processNode[]",
                        "label": "Nodes",
                    },
                ],
            });
        }
        return this.bridge;
    }
}
ImageProcessingPipeline["className"] = "ImageProcessingPipeline";
globalSerializer.addClass(ImageProcessingPipeline);
