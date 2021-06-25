import { SimpleCropDetector } from "./processing/simple_crop_detector.js";
import { CanvasImageBuffer, ImageBuffer } from "./processing/image.js";
import {
  ImageProcessingPipeline,
  globalSerializer,
} from "./processing/process_node.js";
import { ManualColor, PointSampler } from "./processing/samplers.js";

import * as drop from "./ui/drop.js";
import * as util from "./processing/util.js";
import { SimpleExpander } from "./processing/expanders.js";
import { BorderColorFiller } from "./processing/crop_filler.js";
import { PropertySheet } from "./ui/properties.js";
import { cloneTemplate } from "./ui/templates.js";
import { ProcessNodeEditor } from "./ui/node_editor.js";

const pasteTargets = new Set(["text", "number"]);

class ImageRocketApp {
  constructor(root: Element) {
    this.root = root;
    let sampler = new PointSampler();
    let detector = new SimpleCropDetector();
    let expander = new SimpleExpander();
    expander.expandBy = 4;
    let manual = new ManualColor();
    let filler = new BorderColorFiller();
    let elements = [sampler, detector, expander, manual, filler];
    let pipeline = new ImageProcessingPipeline(elements);
    for (let node of elements) {
      document.body.appendChild(new ProcessNodeEditor(node).editorElement);
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
    document.body.addEventListener("paste", ((e: ClipboardEvent) => {
      let target = e.target as any;
      if (target === e.currentTarget) target = document.activeElement;
      if (
        target.tagName?.toLowerCase() === "input" &&
        pasteTargets.has(target.type.toLowerCase())
      ) {
        return;
      }
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
    // dropping a file anywhere else is probably an accident,
    // prevent the browser from navigating away
    for (let eventName of ["drop", "dragover"]) {
      document.body.addEventListener(eventName, event => {
        event.preventDefault();
        event.stopPropagation();
      });
    }
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
    console.log(globalSerializer.serializeAll([pipeline]));
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
