import { ImageView } from "../ui/image_viewer.js";
import { SimpleProcessNode, globalSerializer } from "./process_node.js";
export class ImageViewer extends SimpleProcessNode {
    serialize() {
        return {};
    }
    deserialize(obj) {
    }
    get features() {
        return new Set(["passThrough", "interactive"]);
    }
    processImage(buffer) {
        return new Promise(resolve => {
            // copy then resolve right away and do the rest independently
            const canvas = document.createElement("canvas");
            buffer.drawOnCanvas(canvas);
            resolve(buffer);
            const view = new ImageView(canvas);
            document.querySelector(".imageViewers").appendChild(view.view);
            view.centerImage();
        });
    }
}
ImageViewer["className"] = "ImageViewer";
globalSerializer.addClass(ImageViewer);
