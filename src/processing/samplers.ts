import { ModelBridge } from "../ui/model_bridge.js";
import { ImageBuffer, Color } from "./image.js";
import { SimpleProcessNode, globalSerializer, NodeFeature } from "./process_node.js";
import { clamp, isNullish, Optional, toUint32Array } from "./util.js";

/**
 * A sampler extracts a color from the image
 */
export abstract class BorderColorSampler extends SimpleProcessNode {
  abstract extractColor(image: ImageBuffer): Promise<Color | Optional<Color>>;

  async processImage(buffer: ImageBuffer): Promise<ImageBuffer> {
    const colorOrOptional = await this.extractColor(buffer);
    let color: Color | undefined;
    if (colorOrOptional instanceof Optional) {
      if (colorOrOptional.absent) return buffer;
      color = colorOrOptional.value;
    } else {
      color = colorOrOptional;
    }
    buffer.cropParameters.color = color!;
    return buffer;
  }
}

function actualOffset(val: number | null | undefined, max: number) {
  return val ? Math.round(val * max) : 0;
}

export class PointSampler extends BorderColorSampler {
  constructor() {
    super();
    const model = this.ownBridge.model;
    for (let name of this.ownBridge.serializableNames) {
      model[name] = 0;
    }
  }

  extractColor(image: ImageBuffer): Promise<Color> {
    const buffer = image.toByteImageBuffer();
    const words = toUint32Array(buffer.bytes);
    const model = this.ownBridge.model;
    let xOffset =
      actualOffset(model["normalizedX"], image.width - 1) +
      (model["pixelX"] || 0);
    let yOffset =
      actualOffset(model["normalizedY"], image.height - 1) +
      (model["pixelY"] || 0);
    const color: Color = words[
      clamp(xOffset, 0, image.width - 1) +
        clamp(yOffset, 0, image.height - 1) * image.wordPitch
    ] as Color;
    this.ownBridge.model["lastColor"] = color;
    this.ownBridge.model["lastX"] = xOffset;
    this.ownBridge.model["lastY"] = yOffset;
    return Promise.resolve(color);
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
        { "lastColor": null },
        {
          "properties": [
            {
              "name": "normalizedX",
              "editor": "double",
              "label": "X coordinate normalized to [0, 1]",
              "min": 0,
              "max": 1,
              "step": 0.01,
            },
            {
              "name": "normalizedY",
              "editor": "double",
              "label": "Y coordinate normalized to [0, 1]",
              "min": 0,
              "max": 1,
              "step": 0.01,
            },
            {
              "name": "pixelX",
              "editor": "int",
              "label": "X offset in pixels",
            },
            {
              "name": "pixelY",
              "editor": "int",
              "label": "Y offset in pixels",
            },
            {
              "name": "lastX",
              "editor": "int?",
              "label": "Last X",
              "readOnly": true,
              "serializable": false,
            },
            {
              "name": "lastY",
              "editor": "int?",
              "label": "Last Y",
              "readOnly": true,
              "serializable": false,
            },
            {
              "name": "lastColor",
              "editor": "color?",
              "label": "Last sampled color",
              "readOnly": true,
              "serializable": false,
              "alpha": true,
            },
          ],
        }
      );
    }
    return this.bridge;
  }

  private bridge?: ModelBridge;
}

PointSampler["className"] = "PointSampler";

globalSerializer.addClass(PointSampler);

export class ManualColor extends BorderColorSampler {
  constructor() {
    super();
  }

  get features(): Set<NodeFeature> {
    let color = this.ownBridge.model["color"];
    return new Set(isNullish(color) ? ["noEffect"] : []);
  }

  extractColor(image: ImageBuffer): Promise<Color | Optional<Color>> {
    let color = this.ownBridge.model["color"];
    if (isNullish(color)) return Promise.resolve(new Optional<Color>(0, true));
    return Promise.resolve(color);
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
        { "lastColor": null },
        {
          "properties": [
            {
              "name": "color",
              "editor": "color?",
              "label": "Color override",
              "alpha": true,
            },
          ],
        }
      );
    }
    return this.bridge;
  }

  private bridge?: ModelBridge;
}

ManualColor["className"] = "ManualColor";

globalSerializer.addClass(ManualColor);
