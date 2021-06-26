import { globalSerializer, ProcessNode } from "../processing/process_node.js";
import { colorHashString } from "../processing/util.js";
import { PropertySheet } from "./properties.js";
import { cloneTemplate } from "./templates.js";

export class ProcessNodeEditor {
  constructor(node: ProcessNode) {
    this.node = node;
    this.editorElement = cloneTemplate("processNode")!;
    const title = globalSerializer.classNameFromInstance(node);
    const bridge = node.modelBridge;
    if (bridge) {
      this.editorElement
        .querySelector(".contents")!
        .appendChild(new PropertySheet(bridge).element);
    }
    const titleElement = this.editorElement.querySelector(".title") as HTMLElement;
    titleElement.textContent = title;
    const colorInfo = colorHashString(title, 0.5);
    titleElement.style.backgroundColor = colorInfo.cssColor;
    titleElement.style.color = colorInfo.luminosity >= 128 ? "black" : "white";
    this.titleElement = titleElement;
  }

  readonly node: ProcessNode;
  readonly editorElement: Element;
  readonly titleElement: Element;
}
