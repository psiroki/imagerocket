import { SimpleCropDetector } from "./processing/simple_crop_detector.js";
import { CanvasImageBuffer, ImageBuffer } from "./processing/image.js";
import {
  ImageProcessingPipeline,
  processNodes,
} from "./processing/process_node.js";
import { PointSampler } from "./processing/samplers.js";

import * as drop from "./ui/drop.js";
import * as util from "./processing/util.js";
import { SimpleExpander } from "./processing/expanders.js";
import { BorderColorFiller } from "./processing/crop_filler.js";
import { PropertySheet } from "./ui/properties.js";
import { cloneTemplate } from "./ui/templates.js";

const pasteTargets = new Set(["text", "number"]);

class ImageRocketApp {
  constructor(root: Element) {
    this.root = root;
    let sampler = new PointSampler();
    let detector = new SimpleCropDetector();
    let expander = new SimpleExpander();
    expander.expandBy = 4;
    let filler = new BorderColorFiller();
    let elements = [sampler, detector, expander, filler];
    let pipeline = new ImageProcessingPipeline(elements);
    for (let node of elements) {
      const title = processNodes.classNameFromInstance(node);
      const bridge = node.modelBridge;
      const nodeElement = cloneTemplate("processNode")!;
      if (bridge) {
        nodeElement.querySelector(".contents")!.appendChild(new PropertySheet(bridge).element);
      }
      nodeElement.querySelector(".title")!.textContent = title;
      document.body.appendChild(nodeElement);
    }
    this.pipeline = pipeline;
  }

  run() {
    const dropBox = this.root.querySelector(".dropBox")!;
    const fileInput = dropBox.querySelector(
      "input[type=file]"
    ) as HTMLInputElement;
    if (fileInput) {
      dropBox.addEventListener("dblclick", (_) => {
        fileInput.click();
      });
      fileInput.addEventListener("change", (e) => {
        Array.from((e.currentTarget as any).files).forEach((blob) =>
          this.processBlob(blob as Blob)
        );
      });
    }
    drop.dropHandler(dropBox, this.processBlob.bind(this));
    dropBox.addEventListener("paste", ((e: ClipboardEvent) => {
      let target = e.target as any;
      if (
        target.tagName?.toLowerCase() === "input" &&
        pasteTargets.has(target.type.toLowerCase())
      )
        return;
      let items = e.clipboardData?.items;
      if (items) {
        let stringItem: DataTransferItem | null = null;
        for (let item of items) {
          if (item.kind === "file") {
            // file support is broken
            console.log("File found: " + item.type, item);
            const m = /^image\/(svg)?/i.exec(item.type);
            if (m && !m[1]) {
              const f = item.getAsFile();
              if (f) {
                this.processBlob(f);
                stringItem = null;
                break;
              } else {
                console.log("No file object though");
              }
            }
          } else if (item.kind === "string" && item.type === "text/plain") {
            stringItem = item;
          }
        }
        if (stringItem) {
          stringItem.getAsString((string) =>
            console.log("Only string found:", string)
          );
        }
      }
    }) as EventListener);
  }

  async processBlob(blob: Blob) {
    let image = await createImageBitmap(blob);
    let canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    let ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    let buffer: ImageBuffer = new CanvasImageBuffer(canvas);
    const pipeline = this.pipeline;
    console.log(processNodes.serializeNodes([pipeline]));
    buffer = await pipeline.processImage(buffer);
    canvas = util.toHtmlCanvas(buffer.toCanvasImageBuffer().canvas);
    let div = document.createElement("div");
    div.addEventListener("click", (_) => div.remove());
    div.className = "result";
    div.appendChild(canvas);
    document.body.appendChild(div);
  }

  readonly root: Element;
  private pipeline: ImageProcessingPipeline;
}

export let app = new ImageRocketApp(document.body);

app.run();
