import { ImageBuffer } from "./image.js";
import { ImageProcessingNode, processNodes } from "./process_node.js";
import * as util from "./util.js";

export class SimpleExpander extends ImageProcessingNode {

  serialize(): object {
    return {
      "expand": this.expand
    };
  }

  deserialize(obj: object): void {
    this.expand = obj["expand"];
  }

  async processImage(buffer: ImageBuffer): Promise<ImageBuffer> {
    const expand = this.expand ?? 0;
    let rect = Array.from(buffer.cropParameters.cropRect);
    const cropRect = Array.from(rect);
    if (expand > 0) {
      rect = cropRect.map((e, i) => e + ((i & 2) - 1)*expand);
    }
    buffer.cropParameters.expandedRect = Array.from(rect);
    return buffer;
  }

  expand: number = 0;
}

SimpleExpander["className"] = "SimpleExpander";

processNodes.addClass(SimpleExpander);
