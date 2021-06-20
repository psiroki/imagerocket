import { replaceUndefined } from "../processing/util.js";
export class ModelBridge {
    constructor(model, schema, { inputObserver, outputObserver, } = {}) {
        this.rawModel = model;
        this.schema = schema;
        this.outputObserver = outputObserver || new ModelObserver(model, schema);
        this.inputObserver = inputObserver || new ModelObserver(model, schema);
    }
    addHandler(prop, handler) {
        this.inputObserver.addHandler(prop, handler);
    }
    get model() {
        return this.outputObserver.model;
    }
    exportModel(names = null) {
        const result = {};
        const rawModel = this.rawModel;
        const effectiveNames = names || this.serializableNames;
        for (let name of effectiveNames) {
            result[name] = rawModel[name];
        }
        return result;
    }
    patchModel(patch, names = null) {
        const target = this.model;
        const keys = names || this.serializableNames;
        for (let key of keys) {
            target[key] = patch[key];
        }
    }
    get serializableNames() {
        const properties = this.schema["properties"];
        if (properties instanceof Array) {
            return properties
                .filter((e) => replaceUndefined(e["serializable"], true))
                .map((e) => e["name"]);
        }
        else {
            return [];
        }
    }
    get pair() {
        if (!this._pair) {
            this._pair = new ModelBridge(this.model, this.schema, {
                inputObserver: this.outputObserver,
                outputObserver: this.inputObserver,
            });
            this._pair._pair = this;
        }
        return this._pair;
    }
    toString() {
        return ("ModelBridge(" + [this.inputObserver.id, this.outputObserver.id] + ")");
    }
}
export class ModelObserver {
    constructor(instance, schema) {
        this.pendingChanges = new Set();
        this.handlers = new Map();
        this.id = ModelObserver.idCounter++;
        this.instance = instance;
        this.schema = schema;
        this.model = new Proxy(instance, { set: this.setHandler.bind(this) });
    }
    addHandler(prop, handler) {
        let handlers = this.handlers.get(prop);
        if (!handlers) {
            this.handlers.set(prop, (handlers = new Set()));
        }
        handlers.add(handler);
    }
    get rawModel() {
        return this.instance;
    }
    setHandler(target, prop, value, receiver) {
        target[prop] = value;
        if (this.handlers.has(prop)) {
            this.pendingChanges.add(prop);
            queueMicrotask(this.flush.bind(this));
        }
        return true;
    }
    flush() {
        var _a;
        if (this.pendingChanges.size > 0) {
            const batch = Array.from(this.pendingChanges);
            this.pendingChanges.clear();
            for (const prop of batch) {
                const handlers = Array.from((_a = this.handlers.get(prop)) !== null && _a !== void 0 ? _a : []);
                for (const handler of handlers) {
                    queueMicrotask(() => handler(this.model, prop));
                }
            }
        }
    }
}
ModelObserver.idCounter = 0;
