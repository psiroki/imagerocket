import { ImageBuffer } from "./image.js";
import { ProcessNode, processNodes } from "./process_node.js";

/**
 * A 32 bit color value with alpha. Always in playform endianness
 * and pixel order.
 */
export type Color = number;

export const platformIsLittleEndian = (() => {
  const test = new Uint32Array([0x12345678]);
  return new DataView(test.buffer).getUint32(0, true) === 0x12345678;
})();

/**
 * A sampler extracts a color from the image
 */
export abstract class Sampler extends ProcessNode {
  abstract extractColor(image: ImageBuffer): Promise<Color>;
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
