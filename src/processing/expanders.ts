import { ModelBridge } from "../ui/model_bridge.js";
import { ImageBuffer } from "./image.js";
import { SimpleProcessNode, globalSerializer, NodeFeature } from "./process_node.js";
import { replaceNullish } from "./util.js";

const rectSuffixes = ["Left", "Top", "Right", "Bottom"];

export class SimpleExpander extends SimpleProcessNode {
  serialize(): object {
    return this.ownBridge.exportToModel({ "_super": super.serialize() });
  }

  deserialize(obj: object): void {
    super.deserialize(obj["_super"]);
    this.expand = obj["expand"];
    this.ownBridge.patchModel(obj);
  }

  get features(): Set<NodeFeature> {
    const bridge = this.ownBridge;
    const expands = [this.expand || 0, ...rectSuffixes.map(
      suffix => bridge.model["override" + suffix] || 0
    )];
    return new Set(expands.some(e => e) ? [] : ["noEffect"]);
  }

  get ownBridge(): ModelBridge {
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
            ...rectSuffixes.map(suffix => ({
              "name": "override" + suffix,
              "editor": "int?",
              "label": "Border width override (" + suffix.toLowerCase() + ")",
            })),
          ],
        }
      );
      this.bridge.addHandler(
        "expand",
        (target, prop) => (this.expand = target[prop])
      );
    }
    return this.bridge;
  }

  get expandBy(): number {
    return this.expand;
  }

  set expandBy(val: number) {
    this.modelBridge!.model["expand"] = val;
  }

  async processImage(buffer: ImageBuffer): Promise<ImageBuffer> {
    const expand = this.expand || 0;
    const bridge = this.ownBridge;
    const actual = rectSuffixes.map(
      suffix => replaceNullish(bridge.model["override" + suffix], expand)
    );
    let rect = Array.from(buffer.cropParameters.cropRect);
    const cropRect = Array.from(rect);
    if (expand > 0) {
      rect = cropRect.map(
        (e, i) => e + ((i & 2) - 1) * actual[i]
      );
    }
    buffer.cropParameters.expandedRect = Array.from(rect);
    return buffer;
  }

  private expand: number = 0;
  private bridge?: ModelBridge;
}

SimpleExpander["className"] = "SimpleExpander";

globalSerializer.addClass(SimpleExpander);
