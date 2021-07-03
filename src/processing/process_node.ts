import { ImageBuffer } from "./image.js";
import { ModelBridge } from "../ui/model_bridge.js";
import { colorHashString, CssColorWithLuminosity, deepCopyJson } from "./util.js";

/// The node may be transferred to a worker thread based on the
/// features it requires.
/// * `canvas`: if the browser supports `OffScreenCanvas` it may
///   be transferred to a worker
/// * `userInteraction`: must not be executed in a worker thread
///   because DOM access is required
/// * `passThrough`: the process will not modify the image at all
///   (processImage is always called though, but the result will
///   be ignored, useful for display nodes)
/// * `noEffect`: the node is configured to perform no effect at
///   all, it can be skipped over
export type NodeFeature = "canvas" | "userInteraction" | "passThrough" | "noEffect";

export abstract class Serializable {
  /**
   * Returns an almost JSON compatible object
   * that can be used with [deserialize].
   * Apart from standard JSON types [Serializable]s
   * are allowed as well.
   */
  abstract serialize(): object;
  /**
   * Should replace the entire object state with
   * the serialized state. The referenced objects
   * may not have been deserialized at the point
   * of calling this object.
   * @param obj the serialized object (returned by
   *            [serialize])
   */
  abstract deserialize(obj: object): void;

  serializedClone(): Serializable {
    const arr = globalSerializer.deserializeAll(
      deepCopyJson(globalSerializer.serializeAll([this]))
    );
    return arr[0];
  }
}

export abstract class ProcessNode extends Serializable {
  abstract processImages(buffers: ImageBuffer[]): Promise<ImageBuffer[]>;

  get classColorInfo(): CssColorWithLuminosity {
    const className = globalSerializer.classNameFromInstance(this);
    return colorHashString(className, 0.5);
  }

  /// Specify what features the node has to decide wether it can be
  /// run in a worker or not. The result may change based on the
  /// node configuration (for example a zero pixel expansion node does
  /// nothing, it can be a `"noEffect"` node)
  get features(): Set<NodeFeature> {
    return new Set();
  }

  get modelBridge(): ModelBridge | null {
    return this.ownBridge?.pair || null;
  }

  get ownBridge(): ModelBridge | null {
    return null;
  }

  serialize(): object {
    return { "nodeId": this.nodeId };
  }

  deserialize(obj: object): void {
    this._nodeId = obj["nodeId"];
  }

  get nodeId(): number {
    return this._nodeId;
  }

  private _nodeId: number = ++ProcessNode.idCounter;

  private static idCounter: number = Date.now();
}

export abstract class SimpleProcessNode extends ProcessNode {
  protected abstract processImage(buffer: ImageBuffer): Promise<ImageBuffer>;

  /// Most nodes operate on one image at a time, but some nodes
  /// (like collage nodes) would combine or split images. Those
  /// classes need to override this function and ignore processImage
  /// altogether.
  processImages(buffers: ImageBuffer[]): Promise<ImageBuffer[]> {
    return Promise.all(buffers.map(buffer => this.processImage(buffer)));
  }
}

export interface SerializableConstructor {
  new (): Serializable;
}

class SerializationSession {
  constructor(service: Serializer) {
    this.service = service;
  }

  addNode(node: Serializable): string {
    return this.addNodeInternal(node, true);
  }

  serialize(): object[] {
    return [{ "_class": "_rootRefs", "ids": Array.from(this.rootIds) }].concat(
      Object.values(this.result)
    );
  }

  private addNodeInternal(node: Serializable, root: boolean): string {
    let id = this.ids.get(node);
    if (!id) {
      let className = this.service.classNameFromInstance(node);
      let index = (this.counter.get(className) ?? 0) + 1;
      id = className + index;
      this.ids.set(node, id);
      let serialized: object = this.findReferences(node, node.serialize());
      serialized["_class"] = className;
      serialized["_id"] = id;
      this.result[id] = serialized;
    }
    if (root) this.rootIds.push(id);
    return id;
  }

  private findReferences(node: Serializable, value: any): any {
    if (value instanceof Serializable) {
      return { "_class": "_ref", "id": this.addNodeInternal(value, false) };
    } else if (value instanceof Array) {
      return value.map(e => this.findReferences(node, e));
    } else if (typeof value === "object" && value) {
      return Object.fromEntries(
        Object.entries(value).map(e => {
          e[1] = this.findReferences(node, e[1]);
          return e;
        })
      );
    } else if (typeof value === "undefined") {
      // undefined is mapped to null
      return null;
    } else if (
      typeof value !== "boolean" &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      value !== null
    ) {
      throw new Error(`Invalid value: ${value} in ${node}`);
    } else {
      // primitive
      return value;
    }
  }

  private ids: Map<Serializable, string> = new Map();
  private rootIds: string[] = [];
  private result: object = {};
  private counter: Map<string, number> = new Map();
  private readonly service: Serializer;
}

class DeserializationSession {
  constructor(service: Serializer) {
    this.service = service;
  }

  deserialize(serializedNodes: object[]): Serializable[] {
    const rootRefs: object | null =
      serializedNodes.find(e => e["_class"] === "_rootRefs") || null;
    const rootIds: string[] | null = rootRefs ? rootRefs["ids"] || null : null;
    const rest = serializedNodes.filter(s => s["_class"] !== "_rootRefs");
    for (let serializedForm of rest) {
      const classSpec: string = serializedForm["_class"];
      let c = this.service.lookupClass(classSpec);
      let id = serializedForm["_id"];
      this.nodeById.set(id, new c());
    }
    for (let serializedForm of rest) {
      let resolved = this.resolveReferences(serializedForm);
      this.nodeById.get(serializedForm["_id"])!.deserialize(resolved);
    }
    return rootIds
      ? rootIds.map(id => this.nodeById.get(id) as Serializable)
      : Array.from(this.nodeById.values());
  }

  private resolveReferences(value: any): any {
    if (value instanceof Array) {
      return value.map(e => this.resolveReferences(e));
    } else if (typeof value === "object" && value) {
      if (value["_class"] === "_ref") {
        return this.nodeById.get(value["_id"]);
      } else {
        return Object.fromEntries(
          Object.entries(value).map(e => {
            e[1] = this.resolveReferences(e[1]);
            return e;
          })
        );
      }
    } else {
      return value;
    }
  }

  private readonly service: Serializer;
  private nodeById: Map<string, Serializable> = new Map();
}

export class SerializableClass {
  constructor(name: string, create: SerializableConstructor) {
    this.name = name;
    this.create = create;
  }

  readonly name: string;
  readonly create: SerializableConstructor;
}

export class Serializer {
  addClass(classFunction: SerializableConstructor, name: string = "") {
    if (name === "") name = classFunction["className"] ?? classFunction.name;
    this.classByName.set(name, classFunction);
    this.nameByClass.set(classFunction, name);
  }

  *enumerateClasses(): Iterable<SerializableClass> {
    for (let entry of this.classByName.entries()) {
      yield new SerializableClass(entry[0], entry[1]);
    }
  }

  serializeAll(nodes: Serializable[]): object[] {
    let result = new SerializationSession(this);
    for (let node of nodes) {
      result.addNode(node);
    }
    return result.serialize();
  }

  deserializeAll(serializedNodes: object[]): Serializable[] {
    return new DeserializationSession(this).deserialize(serializedNodes);
  }

  classNameFromInstance(instance: Serializable): string {
    return this.className(instance.constructor as SerializableConstructor);
  }

  className(classFunction: SerializableConstructor): string {
    return this.nameByClass.get(classFunction)!;
  }

  lookupClass(name: string): SerializableConstructor {
    return this.classByName.get(name)!;
  }

  protected readonly classByName: Map<string, SerializableConstructor> =
    new Map();
  protected readonly nameByClass: Map<SerializableConstructor, string> =
    new Map();
}

export const globalSerializer = new Serializer();

export class ImageProcessingPipeline extends ProcessNode {
  constructor(nodes: ProcessNode[] = []) {
    super();
    this.ownBridge.model["pipeline"] = nodes;
  }

  async processImages(buffers: ImageBuffer[]): Promise<ImageBuffer[]> {
    const nodes: ProcessNode[] = this.ownBridge.model["pipeline"];
    for (let node of nodes) {
      buffers = await node.processImages(buffers);
    }
    return buffers;
  }

  serialize(): object {
    return this.ownBridge.exportToModel({ "_super": super.serialize() });
  }

  deserialize(obj: object) {
    super.deserialize(obj["_super"]);
    this.ownBridge.patchModel(obj);
  }

  get ownBridge(): ModelBridge {
    if (!this.bridge) {
      this.bridge = new ModelBridge(
        { "pipeline": [] },
        {
          "properties": [
            {
              "name": "pipeline",
              "editor": "processNode[]",
              "label": "Nodes",
            },
          ],
        }
      );
    }
    return this.bridge;
  }

  private bridge?: ModelBridge;
}

ImageProcessingPipeline["className"] = "ImageProcessingPipeline";

globalSerializer.addClass(ImageProcessingPipeline);
