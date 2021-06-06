import { ImageBuffer, Color, formatColor } from "./image.js";
import { ImageProcessingNode, processNodes } from "./process_node.js";
import * as util from "./util.js";

export class SimpleCropDetector extends ImageProcessingNode {

  serialize(): object {
    return {};
  }

  deserialize(obj: object): void {
  }

  async processImage(buffer: ImageBuffer): Promise<ImageBuffer> {
    buffer = buffer.toByteImageBuffer();
    const border = buffer.cropParameters.borderColor;
    const inputWidth = buffer.width;
    const inputHeight = buffer.height;
    let rect = [0, 0, inputWidth, inputHeight];
    for (let side = 0; side < 4; ++side) {
      while (rect[side & 1] < rect[side & 1 | 2]) {
        if (!this.allBorderColor(border, buffer, rect.map((e, i, a) => {
          if ((i & 2) === (side & 2) || (i & 1) !== (side & 1)) {
            return e;
          }
          return a[i^2] - (side & 2) + 1;
        }))) break;
        // step sides towards the center
        rect[side] -= (side & 2) - 1;
      }
    }
    buffer.cropParameters.cropRect = Array.from(rect);
    return buffer
  }

  private allBorderColor(border: Color, buffer: ImageBuffer, rect: number[]) {
    if (rect[0] >= rect[2] || rect[1] >= rect[3]) return false;
    const left = rect[0];
    const top = rect[1];
    const right = rect[2];
    const bottom = rect[3];
    const words = util.toUint32Array(buffer.bytes);
    const wordPitch = buffer.wordPitch;
    let pos = left + top * wordPitch;
    let rowStep = wordPitch - (right - left);
    for (let y = top; y < bottom; ++y) {
      for (let x = left; x < right; ++x) {
        // TODO: we don't care if fully transparent pixels
        // would be red or green, maybe premultiply colors?
        if (border !== words[pos]) {
          return false;
        }
        ++pos;
      }
      pos += rowStep;
    }
    return true;
  }
}

SimpleCropDetector["className"] = "SimpleCropDetector";

processNodes.addClass(SimpleCropDetector);
