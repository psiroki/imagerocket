import { ImageBuffer, Color, platformIsLittleEndian } from "./image.js";
import { ImageProcessingNode, processNodes } from "./process_node.js";

/**
 * A sampler extracts a color from the image
 */
export abstract class Sampler extends ImageProcessingNode {
  abstract extractColor(image: ImageBuffer): Promise<Color>;

  async processImage(buffer: ImageBuffer): Promise<ImageBuffer> {
    buffer.cropParameters.borderColor = await this.extractColor(buffer);
    return buffer;
  }
}

export class TopLeftSampler extends Sampler {
  constructor(ignored={}) {
    super();
  }

  extractColor(image: ImageBuffer): Promise<Color> {
    const bytes = image.toByteImageBuffer().bytes;
    return Promise.resolve(<Color>bytes.getUint32(0, platformIsLittleEndian));
  }

  serialize(): object {
    return {};
  }

  deserialize(obj: object) {
    // nothing to do
  }
}

TopLeftSampler["className"] = "TopLeftSampler";

processNodes.addClass(TopLeftSampler);
