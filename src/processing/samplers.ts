import { ModelBridge } from "../ui/model_bridge.js";
import { ImageBuffer, Color, platformIsLittleEndian } from "./image.js";
import { ImageProcessingNode, processNodes } from "./process_node.js";
import { clamp, toUint32Array } from "./util.js";

/**
 * A sampler extracts a color from the image
 */
export abstract class BorderColorSampler extends ImageProcessingNode {
  abstract extractColor(image: ImageBuffer): Promise<Color>;

  async processImage(buffer: ImageBuffer): Promise<ImageBuffer> {
    buffer.cropParameters.color = await this.extractColor(buffer);
    return buffer;
  }
}

function actualOffset(val: number | null | undefined, max: number) {
  return val ? Math.round(val * max) : 0;
}

export class PointSampler extends BorderColorSampler {
  private static readonly parameterProperties = [
    "normalizedX",
    "normalizedY",
    "pixelX",
    "pixelY",
  ];

  constructor() {
    super();
    const model = this.ownBridge.model;
    for (let key of PointSampler.parameterProperties) {
      model[key] = 0;
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
    return this.ownBridge.exportModel(PointSampler.parameterProperties);
  }

  deserialize(obj: object) {
    this.ownBridge.patchModel(obj, PointSampler.parameterProperties);
  }

  get modelBridge(): ModelBridge {
    return this.ownBridge.pair;
  }

  private get ownBridge(): ModelBridge {
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
              "step": 0.01
            },
            {
              "name": "normalizedY",
              "editor": "double",
              "label": "Y coordinate normalized to [0, 1]",
              "min": 0,
              "max": 1,
              "step": 0.01
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
            },
            {
              "name": "lastY",
              "editor": "int?",
              "label": "Last Y",
              "readOnly": true,
            },
            {
              "name": "lastColor",
              "editor": "color?",
              "label": "Last border color",
              "readOnly": true,
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

processNodes.addClass(PointSampler);
