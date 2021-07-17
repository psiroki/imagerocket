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
    const caption = titleElement.querySelector(".caption")!;
    caption.textContent = title;
    colorHashString(title, 0.5).setupAsBackgroundColor(titleElement);
    this.titleElement = titleElement;
    this.captionElement = caption;
  }

  set itemControls(newControls: Element) {
    this._itemControls?.remove();
    this._itemControls = newControls;
    if (newControls) {
      this.titleElement.appendChild(newControls);
    }
  }

  readonly node: ProcessNode;
  readonly editorElement: Element;
  readonly titleElement: Element;
  readonly captionElement: Element;
  private _itemControls: Element | undefined | null;
}
