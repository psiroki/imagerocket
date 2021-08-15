import { crc32hex } from "../common/crc32.js";
import { loadBlob } from "../common/util.js";
import { ScrollZoom } from "./scrollzoom.js";
import { cloneTemplate } from "./templates.js";

export class ImageView {
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.view = cloneTemplate("imageView")!;
    const close = this.view.querySelector(".close") as HTMLElement;
    close.addEventListener("click", _ => {
      this.view.remove();
    });
    const contents = this.view.querySelector(".contents") as HTMLElement;
    contents.appendChild(canvas);
    this.zoomer = new ScrollZoom(contents);
    const savePanel = this.view.querySelector(".savePanel") as HTMLElement;
    for (let format of ["image/png", "image/jpeg"]) {
      const block = document.createElement("span");
      savePanel.appendChild(block);
      const short = format.substring(format.indexOf("/")+1);
      const ext = short.replace(/e/g, "");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = short.toUpperCase();
      block.appendChild(button);
      let range: HTMLInputElement | null = null;
      if (short !== "png") {
        range = document.createElement("input");
        range.type = "range";
        range.min = "0";
        range.max = "100";
        range.step = "1";
        const output = document.createElement("output");
        range.value = output.value = "70";
        range.addEventListener("input", e => {
          output.value = range!.value;
        });
        block.append(range, output);
      }
      button.addEventListener("click", e => {
        let quality: any;
        if (range) quality = +range.value;
        canvas.toBlob(async blob => {
          const crc = crc32hex(new Uint8Array(await loadBlob(blob!)));
          const uri = URL.createObjectURL(blob);
          const fn = "image_"+crc+"."+ext;
          const a = document.createElement("a");
          a.download = fn;
          a.href = uri;
          a.click();
          URL.revokeObjectURL(uri);
        }, format, quality)
      });
    }
  }

  centerImage(): void {
    this.zoomer.centerImage();
  }

  readonly canvas: HTMLCanvasElement;
  readonly view: HTMLElement;
  readonly zoomer: ScrollZoom;
}
