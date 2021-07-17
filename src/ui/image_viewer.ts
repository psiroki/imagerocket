import { globalSerializer, ProcessNode } from "../processing/process_node.js";
import { colorHashString } from "../processing/util.js";
import { PropertySheet } from "./properties.js";
import { cloneTemplate } from "./templates.js";

export class ImageView {
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.view = cloneTemplate("imageView")!;
    const contents = this.view.querySelector(".contents")!;
    contents.appendChild(canvas);
  }



  readonly canvas: HTMLCanvasElement;
  readonly view: HTMLElement;
}
