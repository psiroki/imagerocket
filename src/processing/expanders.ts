import { ModelBridge } from "../ui/model_bridge.js";
import { ImageBuffer } from "./image.js";
import { ImageProcessingNode, processNodes } from "./process_node.js";

export class SimpleExpander extends ImageProcessingNode {
  serialize(): object {
    return {
      "expand": this.expand,
    };
  }

  deserialize(obj: object): void {
    this.expand = obj["expand"];
  }

  get modelBridge(): ModelBridge {
    if (!this.bridge) {
      this.bridge = new ModelBridge(
        { "expand": this.expand },
        {
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
        }
      );
      this.bridge.addHandler(
        "expand",
        (target, prop) => (this.expand = target[prop])
      );
    }
    return this.bridge.pair;
  }

  get expandBy(): number {
    return this.expand;
  }

  set expandBy(val: number) {
    this.modelBridge.model["expand"] = val;
  }

  async processImage(buffer: ImageBuffer): Promise<ImageBuffer> {
    const expand = this.expand ?? 0;
    let rect = Array.from(buffer.cropParameters.cropRect);
    const cropRect = Array.from(rect);
    if (expand > 0) {
      rect = cropRect.map((e, i) => e + ((i & 2) - 1) * expand);
    }
    buffer.cropParameters.expandedRect = Array.from(rect);
    return buffer;
  }

  private expand: number = 0;
  private bridge?: ModelBridge;
}

SimpleExpander["className"] = "SimpleExpander";

processNodes.addClass(SimpleExpander);
