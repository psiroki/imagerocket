import { ImageBuffer } from "./image.js";
import { ModelBridge } from "../ui/model_bridge.js";

export abstract class ProcessNode {
  /**
   * Returns an almost JSON compatible object
   * that can be used with [deserialize].
   * Apart from standard JSON types [ProcessNode]s
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
}

export abstract class ImageProcessingNode extends ProcessNode {
  abstract processImage(buffer: ImageBuffer): Promise<ImageBuffer>;
  get modelBridge(): ModelBridge | null {
    return null;
  }
}

export interface ProcessNodeConstructor {
  new (): ProcessNode;
}

class ProcessNodeSerializer {
  constructor(service: ProcessNodes) {
    this.service = service;
  }

  addNode(node: ProcessNode): string {
    let id = this.ids.get(node);
    if (!id) {
      let className = this.service.className(node.constructor as ProcessNodeConstructor);
      let index = (this.counter.get(className) ?? 0) + 1;
      id = className+index;
      this.ids.set(node, id);
      let serialized: object = <object>this.findReferences(node, node.serialize());
      serialized["_class"] = className;
      serialized["_id"] = id;
      this.result[id] = serialized;
    }
    return id;
  }

  serialize(): object[] {
    return Object.values(this.result);
  }

  private findReferences(node: ProcessNode, value: any): any {
    if (value instanceof ProcessNode) {
      return { "_class": "_ref", "id": this.addNode(value) };
    } else if (value instanceof Array) {
      return value.map(e => this.findReferences(node, e));
    } else if (typeof value === "object" && value) {
      return Object.fromEntries(Object.entries(value).map(e => {
        e[1] = this.findReferences(node, e[1]);
        return e;
      }));
    } else if (typeof value !== "boolean" &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      value !== null) {
      throw new Error(`Invalid value: ${value} in ${node}`);
    } else {
      // primitive
      return value;
    }
  }

  private ids: Map<ProcessNode, string> = new Map();
  private result: object = {};
  private counter: Map<string, number> = new Map();
  private readonly service: ProcessNodes;
}

class ProcessNodeDeserializer {
  constructor(service: ProcessNodes) {
    this.service = service;
  }

  deserialize(serializedNodes: object[]): ProcessNode[] {
    for (let serializedForm of serializedNodes) {
      let c = this.service.lookupClass(serializedForm["_class"]);
      let id = serializedForm["_id"];
      this.nodeById.set(id, new c());
    }
    for (let serializedForm of serializedNodes) {
      let resolved = this.resolveReferences(serializedForm);
      this.nodeById.get(serializedForm["_id"])!.deserialize(resolved);
    }
    return Array.from(this.nodeById.values());
  }

  private resolveReferences(value: any): any {
    if (value instanceof Array) {
      return value.map(e => this.resolveReferences(e));
    } else if (typeof value === "object" && value) {
      if (value["_class"] === "_ref") {
        return this.nodeById.get(value["_id"]);
      } else {
        return Object.fromEntries(Object.entries(value).map(e => {
          e[1] = this.resolveReferences(e[1]);
          return e;
        }));
      }
    } else {
      return value;
    }
  }

  private readonly service: ProcessNodes;
  private nodeById: Map<string, ProcessNode> = new Map();
}

export class ProcessNodes {
  addClass(classFunction: ProcessNodeConstructor, name: string = "") {
    if (name === "") name = classFunction["className"] ?? classFunction.name;
    this.classByName.set(name, classFunction);
    this.nameByClass.set(classFunction, name);
  }

  serializeNodes(nodes: ProcessNode[]): object[] {
    let result = new ProcessNodeSerializer(this);
    for (let node of nodes) {
      result.addNode(node);
    }
    return result.serialize();
  }

  deserializeNodes(serializedNodes: object[]): ProcessNode[] {
    return new ProcessNodeDeserializer(this).deserialize(serializedNodes);
  }

  className(classFunction: ProcessNodeConstructor): string {
    return this.nameByClass.get(classFunction)!;
  }

  lookupClass(name: string): ProcessNodeConstructor {
    return this.classByName.get(name)!;
  }

  protected readonly classByName: Map<string, ProcessNodeConstructor> = new Map();
  protected readonly nameByClass: Map<ProcessNodeConstructor, string> = new Map();
}

export const processNodes = new ProcessNodes();

export class ImageProcessingPipeline extends ImageProcessingNode {
  constructor(nodes: ImageProcessingNode[]=[]) {
    super();
    this.nodes = nodes;
  }

  async processImage(buffer: ImageBuffer): Promise<ImageBuffer> {
    for (let node of this.nodes) {
      buffer = await node.processImage(buffer);
    }
    return buffer;
  }

  serialize(): object {
    return { "pipeline": this.nodes };
  }

  deserialize(obj: object) {
    this.nodes = obj["pipeline"] as ImageProcessingNode[];
  }
  
  private nodes: ImageProcessingNode[];
}

ImageProcessingPipeline["className"] = "ImageProcessingPipeline";

processNodes.addClass(ImageProcessingPipeline);
