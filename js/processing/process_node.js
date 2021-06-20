export class ProcessNode {
}
export class ImageProcessingNode extends ProcessNode {
    get modelBridge() {
        return null;
    }
}
class ProcessNodeSerializer {
    constructor(service) {
        this.ids = new Map();
        this.result = {};
        this.counter = new Map();
        this.service = service;
    }
    addNode(node) {
        var _a;
        let id = this.ids.get(node);
        if (!id) {
            let className = this.service.classNameFromInstance(node);
            let index = ((_a = this.counter.get(className)) !== null && _a !== void 0 ? _a : 0) + 1;
            id = className + index;
            this.ids.set(node, id);
            let serialized = this.findReferences(node, node.serialize());
            serialized["_class"] = className;
            serialized["_id"] = id;
            this.result[id] = serialized;
        }
        return id;
    }
    serialize() {
        return Object.values(this.result);
    }
    findReferences(node, value) {
        if (value instanceof ProcessNode) {
            return { "_class": "_ref", "id": this.addNode(value) };
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
class ProcessNodeDeserializer {
    constructor(service) {
        this.nodeById = new Map();
        this.service = service;
    }
    deserialize(serializedNodes) {
        for (let serializedForm of serializedNodes) {
            let c = this.service.lookupClass(serializedForm["_class"]);
            let id = serializedForm["_id"];
            this.nodeById.set(id, new c());
        }
        for (let serializedForm of serializedNodes) {
            let resolved = this.resolveReferences(serializedForm);
            this.nodeById.get(serializedForm["_id"]).deserialize(resolved);
        }
        return Array.from(this.nodeById.values());
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
export class ProcessNodes {
    constructor() {
        this.classByName = new Map();
        this.nameByClass = new Map();
    }
    addClass(classFunction, name = "") {
        var _a;
        if (name === "")
            name = (_a = classFunction["className"]) !== null && _a !== void 0 ? _a : classFunction.name;
        this.classByName.set(name, classFunction);
        this.nameByClass.set(classFunction, name);
    }
    serializeNodes(nodes) {
        let result = new ProcessNodeSerializer(this);
        for (let node of nodes) {
            result.addNode(node);
        }
        return result.serialize();
    }
    deserializeNodes(serializedNodes) {
        return new ProcessNodeDeserializer(this).deserialize(serializedNodes);
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
export const processNodes = new ProcessNodes();
export class ImageProcessingPipeline extends ImageProcessingNode {
    constructor(nodes = []) {
        super();
        this.nodes = nodes;
    }
    async processImage(buffer) {
        for (let node of this.nodes) {
            buffer = await node.processImage(buffer);
        }
        return buffer;
    }
    serialize() {
        return { "pipeline": this.nodes };
    }
    deserialize(obj) {
        this.nodes = obj["pipeline"];
    }
}
ImageProcessingPipeline["className"] = "ImageProcessingPipeline";
processNodes.addClass(ImageProcessingPipeline);
