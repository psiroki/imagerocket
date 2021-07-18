import { ModelBridge } from "../ui/model_bridge.js";
import {
  ByteImageBuffer,
  ImageBuffer,
  CropParameters,
} from "./image.js";
import { SimpleProcessNode, globalSerializer, NodeFeature } from "./process_node.js";
import * as util from "../common/util.js";

export class BorderColorFiller extends SimpleProcessNode {
  serialize(): object {
    return this.ownBridge.exportToModel({ "_super": super.serialize() });
  }

  deserialize(obj: object): void {
    super.deserialize(obj["_super"]);
    this.ownBridge.patchModel(obj);
  }

  get ownBridge(): ModelBridge {
    if (!this.bridge) {
      this.bridge = new ModelBridge(
        { "preserve": true },
        {
          "properties": [
            {
              "name": "preserve",
              "editor": "boolean",
              "label": "Preserve existing border",
            },
          ],
        }
      );
    }
    return this.bridge;
  }

  async processImage(buffer: ImageBuffer): Promise<ImageBuffer> {
    buffer = buffer.toByteImageBuffer();
    const preserve = this.ownBridge.model["preserve"];
    if (!preserve) buffer = this.logicalCrop(buffer as ByteImageBuffer);
    const border = buffer.cropParameters.color;
    const inputWidth = buffer.width;
    const inputHeight = buffer.height;
    const sourceWordPitch = buffer.wordPitch;
    const sourceWords = util.toUint32Array(buffer.bytes);
    let rect = buffer.cropParameters.expandedRect;
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
      result.cropParameters = buffer.cropParameters;
      result.cropParameters.initCropRect(result);
      const resultWords = util.toUint32Array(result.bytes);
      const wordPitch = result.wordPitch;
      // we lose pixels on the right if cropRight is less than the width of the image
      const keptWidth =
        (cropRight < inputWidth ? cropRight : inputWidth) -
        // we also lose pixels is cropLeft is positive
        (cropLeft > 0 ? cropLeft : 0);
      // we lose pixels at the bottom if cropBottom is less than the height of the image
      const keptHeight =
        (cropBottom < inputHeight ? cropBottom : inputHeight) -
        // we also lose pixels is cropTop is positive
        (cropTop > 0 ? cropTop : 0);
      // fill the top, if needed
      if (cropTop < 0) {
        resultWords.subarray(0, -cropTop * wordPitch).fill(border);
      }
      // fill the bottom, if needed
      if (cropBottom > inputHeight) {
        const fillHeight = cropBottom - inputHeight;
        const fillStart = resultHeight - fillHeight;
        resultWords
          .subarray(fillStart * wordPitch, (fillStart + fillHeight) * wordPitch)
          .fill(border);
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

  logicalCrop(buffer: ByteImageBuffer): ByteImageBuffer {
    const cropRect = buffer.cropParameters.cropRect;
    const byteOffset = cropRect[0] * 4 + buffer.pitch * cropRect[1];
    const newWidth = cropRect[2] - cropRect[0];
    const newHeight = cropRect[3] - cropRect[1];
    const bytes = buffer.bytes;
    const result = new ByteImageBuffer(
      new DataView(
        bytes.buffer,
        bytes.byteOffset + byteOffset,
        buffer.pitch * newHeight
      ),
      newWidth,
      newHeight,
      buffer.pitch
    );
    const newCrop = new CropParameters(buffer.cropParameters);
    const expRect = newCrop.expandedRect;
    const newCropRect = newCrop.cropRect;
    // the origin has changed
    for (let i = 0; i < 4; ++i) {
      expRect[i] -= cropRect[i & 1];
      newCropRect[i] -= cropRect[i & 1];
    }
    result.cropParameters = newCrop;
    return result;
  }

  private bridge?: ModelBridge;
}

BorderColorFiller["className"] = "BorderColorFiller";

globalSerializer.addClass(BorderColorFiller);
