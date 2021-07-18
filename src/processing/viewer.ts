import { ImageView } from "../ui/image_viewer.js";
import { ImageBuffer } from "./image.js";
import { SimpleProcessNode, globalSerializer, NodeFeature } from "./process_node.js";

export class ImageViewer extends SimpleProcessNode {
  serialize(): object {
    return {};
  }

  deserialize(obj: object): void {
  }

  get features(): Set<NodeFeature> {
    return new Set(["passThrough", "interactive"]);
  }

  processImage(buffer: ImageBuffer): Promise<ImageBuffer> {
    return new Promise(resolve => {
      // copy then resolve right away and do the rest independently
      const canvas = document.createElement("canvas");
      buffer.drawOnCanvas(canvas);
      resolve(buffer);
      const view = new ImageView(canvas);
      document.querySelector(".imageViewers")!.appendChild(view.view);
      view.centerImage();
    });
  }
}

ImageViewer["className"] = "ImageViewer";

globalSerializer.addClass(ImageViewer);
