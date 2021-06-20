import { ModelBridge } from "../ui/model_bridge.js";
import { ImageBuffer, Color, platformIsLittleEndian } from "./image.js";
import { ImageProcessingNode, processNodes } from "./process_node.js";

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

export class TopLeftSampler extends BorderColorSampler {
  constructor() {
    super();
  }

  extractColor(image: ImageBuffer): Promise<Color> {
    const bytes = image.toByteImageBuffer().bytes;
    const color: Color = <Color>bytes.getUint32(0, platformIsLittleEndian);
    this.ownBridge.model["lastColor"] = color;
    return Promise.resolve(color);
  }

  serialize(): object {
    return {};
  }

  deserialize(obj: object) {
    // nothing to do
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

TopLeftSampler["className"] = "TopLeftSampler";

processNodes.addClass(TopLeftSampler);
