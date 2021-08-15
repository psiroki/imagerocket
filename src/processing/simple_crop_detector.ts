import { ModelBridge } from "../ui/model_bridge.js";
import { ImageBuffer, Color, formatColor } from "./image.js";
import { SimpleProcessNode, globalSerializer } from "./process_node.js";
import * as util from "../common/util.js";

export class SolidCropDetector extends SimpleProcessNode {
  serialize(): object {
    return { "_super": super.serialize() };
  }

  deserialize(obj: object): void {
    super.deserialize(obj["_super"]);
  }

  async processImage(buffer: ImageBuffer): Promise<ImageBuffer> {
    buffer = buffer.toByteImageBuffer();
    const border = buffer.cropParameters.color;
    this.ownBridge.model["lastColor"] = border;
    const channelDelta = this.ownBridge.model["channelDelta"];
    const inputWidth = buffer.width;
    const inputHeight = buffer.height;
    let rect = [0, 0, inputWidth, inputHeight];
    for (let side = 0; side < 4; ++side) {
      while (rect[side & 1] < rect[(side & 1) | 2]) {
        if (
          !this.allBorderColor(
            border,
            buffer,
            rect.map((e, i, a) => {
              if ((i & 2) === (side & 2) || (i & 1) !== (side & 1)) {
                return e;
              }
              return a[i ^ 2] - (side & 2) + 1;
            }),
            channelDelta
          )
        )
          break;
        // step sides towards the center
        rect[side] -= (side & 2) - 1;
      }
    }
    buffer.cropParameters.cropRect = Array.from(rect);
    return buffer;
  }

  private allBorderColor(
    border: Color,
    buffer: ImageBuffer,
    rect: number[],
    channelDelta: number
  ): boolean {
    if (rect[0] >= rect[2] || rect[1] >= rect[3]) return false;
    const left = rect[0];
    const top = rect[1];
    const right = rect[2];
    const bottom = rect[3];
    const words = util.toUint32Array(buffer.bytes);
    const wordPitch = buffer.wordPitch;
    let pos = left + top * wordPitch;
    let rowStep = wordPitch - (right - left);
    if (channelDelta) {
      for (let y = top; y < bottom; ++y) {
        for (let x = left; x < right; ++x) {
          // TODO: we don't care if fully transparent pixels
          // would be red or green, maybe premultiply colors?
          if (!this.similar(border, words[pos], channelDelta)) {
            return false;
          }
          ++pos;
        }
        pos += rowStep;
      }
    } else {
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
    }
    return true;
  }

  private similar(a: Color, b: Color, similarity: number): boolean {
    // TODO handle alpha
    for (let i = 0; i < 4; ++i) {
      const c = i << 3;
      const ac = (a >>> c) & 0xff;
      const bc = (b >>> c) & 0xff;
      if (Math.abs(ac - bc) > similarity) return false;
    }
    return true;
  }

  get ownBridge(): ModelBridge {
    if (!this.bridge) {
      this.bridge = new ModelBridge(
        { "lastColor": null, "channelDelta": 0 },
        {
          "properties": [
            {
              "name": "channelDelta",
              "editor": "exponentialSlider",
              "label": "Max difference in each channel",
              "expOffset": 1,
              "expMin": 0,
              "expMax": 255,
            },
            {
              "name": "lastColor",
              "editor": "color?",
              "label": "Last color used for crop detection",
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

SolidCropDetector["className"] = "SolidCropDetector";
SolidCropDetector["aliases"] = ["SimpleCropDetector"];

globalSerializer.addClass(SolidCropDetector);
