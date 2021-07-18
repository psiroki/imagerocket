import { SimpleCropDetector } from "./processing/simple_crop_detector.js";
import { CanvasImageBuffer, ImageBuffer } from "./processing/image.js";
import {
  ImageProcessingPipeline,
  globalSerializer,
  ProcessNode,
} from "./processing/process_node.js";
import { ManualColor, PointSampler } from "./processing/samplers.js";

import * as drop from "./ui/drop.js";
import * as util from "./common/util.js";
import { SimpleExpander } from "./processing/expanders.js";
import { BorderColorFiller } from "./processing/crop_filler.js";
import { ProcessNodeEditor } from "./ui/node_editor.js";
import { ImageViewer } from "./processing/viewer.js";

const pasteTargets = new Set(["text", "number"]);

class ImageRocketApp {
  constructor(root: Element) {
    this.root = root;
    const def = (() => {
      try {
        return JSON.parse(localStorage.getItem("imagerocket")!);
      } catch (e) {
        return null;
      }
    })();
    let pipeline: ProcessNode | null = null;
    if (def?.pipeline instanceof Array) {
      try {
        const result = globalSerializer.deserializeAll(def.pipeline);
        pipeline = result[0] as ProcessNode;
      } catch (e) {
        console.error(e);
        pipeline = null;
      }
    }
    if (!pipeline) {
      let sampler = new PointSampler();
      let detector = new SimpleCropDetector();
      let expander = new SimpleExpander();
      expander.expandBy = 4;
      let manual = new ManualColor();
      let filler = new BorderColorFiller();
      let viewer = new ImageViewer();
      let elements = [sampler, detector, expander, manual, filler, viewer];
      pipeline = new ImageProcessingPipeline(elements);
    }

    document
      .querySelector(".pipelines")!
      .appendChild(new ProcessNodeEditor(pipeline).editorElement);
    this.pipeline = pipeline;
  }

  run() {
    window.addEventListener("beforeunload", _ => {
      localStorage.setItem(
        "imagerocket",
        JSON.stringify({
          pipeline: globalSerializer.serializeAll([this.pipeline]),
        })
      );
    });
    const dropBox = this.root.querySelector(".dropBox")!;
    const fileInput = dropBox.querySelector(
      "input[type=file]"
    ) as HTMLInputElement;
    if (fileInput) {
      dropBox.addEventListener("dblclick", _ => {
        fileInput.click();
      });
      fileInput.addEventListener("change", e => {
        Array.from((e.currentTarget as any).files).forEach(blob =>
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
          stringItem.getAsString(string =>
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
    await pipeline.processImages([buffer]);
    const viewer = document.querySelector(".imageViewers > :last-child");
    if (viewer && !util.overlapsView(viewer as HTMLElement)) {
      viewer.scrollIntoView();
    }
  }

  readonly root: Element;
  private pipeline: ProcessNode;
}

export let app = new ImageRocketApp(document.body);

app.run();
