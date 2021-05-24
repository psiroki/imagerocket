import { ByteImageBuffer, ImageBuffer } from "./image.js";
import { ProcessNode, processNodes } from "./process_node.js";
import { Color, Sampler } from "./samplers.js";
import * as util from "./util.js";

export class SimpleCropper extends ProcessNode {

  serialize(): object {
    return {
      "borderColorSampler": this.borderColorSampler,
      "expand": this.expand
    };
  }

  deserialize(obj: object): void {
    this.borderColorSampler = obj["borderColorSampler"];
    this.expand = obj["expand"];
  }

  async processImage(buffer: ImageBuffer): Promise<ImageBuffer> {
    const expand = this.expand ?? 0;
    const border = await this.borderColorSampler!.extractColor(buffer);
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
    const cropRect = Array.from(rect);
    if (expand > 0) {
      console.log("Crop rect before expansion: "+rect);
      rect = cropRect.map((e, i) => e + ((i & 2) - 1)*expand);
      console.log("Crop rect after expansion: "+rect);
    }
    // check for idempotent operation
    if ([0, 0, inputWidth, inputHeight].some((e, i) => rect[i] !== e)) {
      const cropLeft = rect[0];
      const cropTop = rect[1];
      const cropRight = rect[2];
      const cropBottom = rect[3];
      const resultWidth = cropRight - cropLeft;
      const resultHeight = cropBottom - cropTop;
        // there has been some clipping
      const result = ByteImageBuffer.allocate(resultWidth, resultHeight);
      const resultWords = util.toUint32Array(result.bytes);
      const wordPitch = result.wordPitch;
      // we lose pixels on the right if cropRight is less than the width of the image
      const keptWidth = (cropRight < inputWidth ? cropRight : inputWidth)
          // we also lose pixels is cropLeft is positive
          - (cropLeft > 0 ? cropLeft : 0);
      // we lose pixels at the bottom if cropBottom is less than the height of the image
      const keptHeight = (cropBottom < inputHeight ? cropBottom : inputHeight)
          // we also lose pixels is cropTop is positive
          - (cropTop > 0 ? cropTop : 0);
      console.log("Width:", inputWidth, "kept:", keptWidth, "result:", resultWidth);
      console.log("Height:", inputHeight, "kept:", keptHeight, "result:", resultHeight);
      // fill the top, if needed
      if (cropTop < 0) {
        resultWords.subarray(0, -cropTop * wordPitch).fill(border);
      }
      // fill the bottom, if needed
      if (cropBottom > inputHeight) {
        const fillHeight = cropBottom - inputHeight;
        const fillStart = resultHeight - fillHeight;
        resultWords.subarray(fillStart * wordPitch, (fillStart + fillHeight) * wordPitch).fill(border);
      }
      // fill the left, if needed
      if (cropLeft < 0) {
        // we will fill cropLeft number of 32 bit words
        const fillWidth = -cropLeft;
        // if there was fill at the top, we skip that
        const fillTop = cropTop < 0 ? -cropTop : 0;
        const fillLines = keptHeight;
        let pos = fillTop * wordPitch;
        for (let y = 0; y < fillLines; ++y) {
          resultWords.subarray(pos, pos + fillWidth).fill(border);
          pos += wordPitch;
        }
      }
      // fill the right, if needed
      if (cropRight > inputWidth) {
        // we need to fill as many pixels as there is overhang
        const fillWidth = cropRight - inputWidth;
        // if there was fill at the top, we skip that
        const fillTop = cropTop < 0 ? -cropTop : 0;
        const fillLines = keptHeight;
        let pos = fillTop * wordPitch + resultWidth - fillWidth;
        for (let y = 0; y < fillLines; ++y) {
          resultWords.subarray(pos, pos + fillWidth).fill(border);
          pos += wordPitch;
        }
      }
      const sx = cropLeft > 0 ? cropLeft : 0;
      const sy = cropTop > 0 ? cropTop : 0;
      const dx = cropLeft < 0 ? -cropLeft : 0;
      const dy = cropTop < 0 ? -cropTop : 0;
      const sourceWords = util.toUint32Array(buffer.bytes);
      const sourceWordPitch = buffer.wordPitch;
      let spos = sy * sourceWordPitch + sx;
      let dpos = dy * wordPitch + dx;
      // block transfer
      for (let y = 0; y < keptHeight; ++y) {
        resultWords.set(sourceWords.subarray(spos, spos + keptWidth), dpos);
        dpos += wordPitch;
        spos += sourceWordPitch;
      }
      // whew
      return result;
    } else {
      // it was idempotent
      return buffer;
    }
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

  borderColorSampler: Sampler | null = null;
  expand: number = 0;
}

SimpleCropper["className"] = "SimpleCropper";

processNodes.addClass(SimpleCropper);
