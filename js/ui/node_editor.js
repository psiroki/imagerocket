import { globalSerializer } from "../processing/process_node.js";
import { colorHashString } from "../processing/util.js";
import { PropertySheet } from "./properties.js";
import { cloneTemplate } from "./templates.js";
export class ProcessNodeEditor {
    constructor(node) {
        this.node = node;
        this.editorElement = cloneTemplate("processNode");
        const title = globalSerializer.classNameFromInstance(node);
        const bridge = node.modelBridge;
        if (bridge) {
            this.editorElement
                .querySelector(".contents")
                .appendChild(new PropertySheet(bridge).element);
        }
        const titleElement = this.editorElement.querySelector(".title");
        titleElement.textContent = title;
        colorHashString(title, 0.5).setupAsBackgroundColor(titleElement);
        this.titleElement = titleElement;
    }
    set itemControls(newControls) {
        var _a;
        (_a = this._itemControls) === null || _a === void 0 ? void 0 : _a.remove();
        this._itemControls = newControls;
        if (newControls) {
            this.titleElement.appendChild(newControls);
        }
    }
}
