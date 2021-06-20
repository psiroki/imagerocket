import { replaceUndefined } from "../processing/util.js";

export interface UpdateObserver {
  addHandler(prop: string, handler: UpdateHandler): void;
}

export interface UpdateHandler {
  (target: any, prop: string): void;
}

export class ModelBridge implements UpdateObserver {
  constructor(
    model: any,
    schema: any,
    {
      inputObserver,
      outputObserver,
    }: {
      inputObserver?: ModelObserver;
      outputObserver?: ModelObserver;
    } = {}
  ) {
    this.rawModel = model;
    this.schema = schema;
    this.outputObserver = outputObserver || new ModelObserver(model, schema);
    this.inputObserver = inputObserver || new ModelObserver(model, schema);
  }

  addHandler(prop: string, handler: UpdateHandler): void {
    this.inputObserver.addHandler(prop, handler);
  }

  get model(): any {
    return this.outputObserver.model;
  }

  exportModel(names: string[] | null = null): object {
    const result = {};
    const rawModel = this.rawModel;
    const effectiveNames = names || this.serializableNames;
    for (let name of effectiveNames) {
      result[name] = rawModel[name];
    }
    return result;
  }

  patchModel(patch: object, names: string[] | null = null): void {
    const target = this.model;
    const keys = names || this.serializableNames;
    for (let key of keys) {
      target[key] = patch[key];
    }
  }

  get serializableNames(): string[] {
    const properties = this.schema["properties"];
    if (properties instanceof Array) {
      return properties
        .filter((e) => replaceUndefined(e["serializable"], true))
        .map((e) => e["name"]);
    } else {
      return [];
    }
  }

  get pair(): ModelBridge {
    if (!this._pair) {
      this._pair = new ModelBridge(this.model, this.schema, {
        inputObserver: this.outputObserver,
        outputObserver: this.inputObserver,
      });
      this._pair._pair = this;
    }
    return this._pair;
  }

  toString(): string {
    return (
      "ModelBridge(" + [this.inputObserver.id, this.outputObserver.id] + ")"
    );
  }

  readonly rawModel: any;
  readonly schema: any;
  readonly outputObserver: ModelObserver;
  readonly inputObserver: ModelObserver;
  private _pair?: ModelBridge;
}

export class ModelObserver implements UpdateObserver {
  constructor(instance: any, schema: any) {
    this.instance = instance;
    this.schema = schema;
    this.model = new Proxy(instance, { set: this.setHandler.bind(this) });
  }

  addHandler(prop: string, handler: UpdateHandler): void {
    let handlers = this.handlers.get(prop);
    if (!handlers) {
      this.handlers.set(prop, (handlers = new Set<UpdateHandler>()));
    }
    handlers.add(handler);
  }

  get rawModel(): any {
    return this.instance;
  }

  private setHandler(
    target: any,
    prop: string,
    value: any,
    receiver: any
  ): boolean {
    target[prop] = value;
    if (this.handlers.has(prop)) {
      this.pendingChanges.add(prop);
      queueMicrotask(this.flush.bind(this));
    }
    return true;
  }

  private flush() {
    if (this.pendingChanges.size > 0) {
      const batch = Array.from(this.pendingChanges);
      this.pendingChanges.clear();
      for (const prop of batch) {
        const handlers = Array.from(this.handlers.get(prop) ?? []);
        for (const handler of handlers) {
          queueMicrotask(() => handler(this.model, prop));
        }
      }
    }
  }

  readonly model: any;
  private readonly pendingChanges: Set<string> = new Set<string>();
  private instance: any;
  private schema: any;
  private handlers: Map<string, Set<UpdateHandler>> = new Map();
  readonly id: number = ModelObserver.idCounter++;

  static idCounter: number = 0;
}
