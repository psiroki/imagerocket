import { globalSerializer, ProcessNode } from "../processing/process_node.js";
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
    this.editorElement.querySelector(".title")!.textContent = title;
  }

  readonly node: ProcessNode;
  readonly editorElement: Element;
}
