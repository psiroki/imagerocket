import { extractAlpha, formatColor, rgba, shiftToAlpha, } from "../processing/image.js";
import { AsyncStream, isNullish, replaceUndefined, } from "../processing/util.js";
import { ProcessNodeEditor } from "./node_editor.js";
import { cloneTemplate } from "./templates.js";
const optionalPattern = /\?$/;
function bindValues(input, output, formatter) {
    const prefix = output.getAttribute("data-prefix") || "";
    if (!formatter)
        formatter = value => value;
    var sync = () => {
        output.value = prefix + formatter(input.value);
    };
    input.addEventListener("input", sync);
    sync();
}
class ExponentialMapper {
    constructor(params) {
        const expOffset = params.expOffset;
        const minValue = params.minValue;
        const maxValue = params.maxValue;
        const mappedMin = params.mappedMin;
        const mappedMax = params.mappedMax;
        this.expOffset = expOffset;
        this.offset = Math.exp(expOffset);
        this.mappedMin = mappedMin;
        this.minValue = minValue;
        this.scale =
            (Math.log(maxValue - minValue + this.offset) - this.expOffset) /
                (mappedMax - mappedMin);
    }
    bindBidirectional(exp, real) {
        const result = new AsyncStream();
        bindValues(exp, real, s => {
            const real = this.mapToReal(+s);
            result.add(real);
            return real.toString();
        });
        bindValues(real, exp, s => {
            const real = +s;
            result.add(real);
            return this.mapToExp(real).toString();
        });
        return result;
    }
    mapToExp(n) {
        return Math.round((Math.log(n + (this.offset - this.minValue)) - this.expOffset) /
            this.scale +
            this.mappedMin);
    }
    mapToReal(exp) {
        return Math.round(Math.exp((exp - this.mappedMin) * this.scale + this.expOffset) -
            (this.offset - this.minValue));
    }
}
function setupNumberInputWidth(e) {
    let bound = Math.max(...[e.min, e.max].map(e => e.length));
    if (bound === 0)
        return;
    let additional = e.step.indexOf(".");
    if (additional >= 0) {
        additional = e.step.length - additional;
    }
    else {
        additional = 0;
    }
    e.style.width = bound + additional + 3 + "ch";
}
export class PropertySheet {
    constructor(bridge) {
        this.bridge = bridge;
        this.model = bridge.model;
        this.schema = bridge.schema;
        const schema = this.schema;
        this.sheetElement = cloneTemplate("propertySheet");
        for (let item of schema["properties"]) {
            const itemElement = cloneTemplate("propertySheetItem");
            this.sheetElement.appendChild(itemElement);
            itemElement.querySelector(".propertyName").textContent =
                item["label"] || item["name"];
            const valueElement = itemElement.querySelector(".propertyValue");
            const editor = item["editor"];
            const rawEditor = editor.replace(optionalPattern, "");
            item["_internal"] = {
                "optional": optionalPattern.test(editor),
                "rawEditor": rawEditor,
            };
            let elements = null;
            switch (rawEditor) {
                case "color":
                    elements = this.createColorEditor(item);
                    break;
                case "exponentialSlider":
                    elements = this.createExponentialSlider(item);
                    break;
                case "int":
                    elements = this.createNumberEditor(item, true);
                    break;
                case "double":
                    elements = this.createNumberEditor(item, false);
                    break;
                case "boolean":
                    elements = this.createBooleanEditor(item);
                    break;
                case "processNode[]":
                    elements = this.createProcessNodeArrayEditor(item);
                    itemElement.classList.add("vertical");
                    break;
            }
            if (elements)
                valueElement.appendChild(elements);
        }
    }
    get element() {
        return this.sheetElement;
    }
    createColorEditor(item) {
        const readOnly = !!item["readOnly"];
        const optional = item["_internal"]["optional"];
        const defaultValue = item["defaultValue"] || shiftToAlpha(255);
        const container = document.createElement("div");
        container.classList.add("colorEditor");
        const name = item["name"];
        const optionalInput = document.createElement("input");
        optionalInput.type = "checkbox";
        optionalInput.checked = true;
        optionalInput.disabled = readOnly;
        if (optional) {
            container.appendChild(optionalInput);
        }
        const colorInput = document.createElement("input");
        container.appendChild(colorInput);
        colorInput.type = "color";
        colorInput.disabled = readOnly;
        const alphaRange = document.createElement("input");
        container.appendChild(alphaRange);
        alphaRange.type = "range";
        alphaRange.min = "0";
        alphaRange.max = "255";
        alphaRange.disabled = readOnly;
        const alphaInput = document.createElement("input");
        container.appendChild(alphaInput);
        alphaInput.type = "number";
        alphaInput.min = "0";
        alphaInput.max = "255";
        setupNumberInputWidth(alphaInput);
        alphaInput.disabled = readOnly;
        const sync = (target, prop) => {
            const raw = target[prop];
            const defined = !isNullish(raw);
            const color = (!defined ? defaultValue : raw);
            colorInput.value = formatColor(color).substring(0, 7);
            alphaInput.value = alphaRange.value = extractAlpha(color).toString();
            optionalInput.checked = defined;
            for (let input of [colorInput, alphaRange, alphaInput]) {
                input.disabled = !defined;
            }
        };
        this.bridge.addHandler(name, sync);
        sync(this.model, name);
        for (let input of [colorInput, alphaRange, alphaInput, optionalInput]) {
            input.addEventListener("input", event => {
                if (event.target === alphaRange)
                    alphaInput.value = alphaRange.value;
                if (event.target === alphaInput)
                    alphaRange.value = alphaInput.value;
                if (event.target === optionalInput) {
                    const disabled = !optionalInput.checked;
                    for (let otherInput of [colorInput, alphaRange, alphaInput]) {
                        otherInput.disabled = disabled;
                    }
                }
                if (!readOnly) {
                    if (optional && !optionalInput.checked) {
                        this.bridge.model[name] = null;
                    }
                    else {
                        const colorString = colorInput.value.substring(1);
                        let comps = new Array(3);
                        for (let i = 0; i < 3; ++i) {
                            let val = parseInt(colorString.substring(i << 1, (i + 1) << 1), 16);
                            if (isNaN(val)) {
                                // invalid input is ignored
                                return;
                            }
                            comps[i] = val;
                        }
                        this.bridge.model[name] = rgba(comps[0], comps[1], comps[2], +alphaRange.value);
                    }
                }
            });
        }
        return container;
    }
    createExponentialSlider(item) {
        var _a;
        const container = document.createElement("div");
        container.classList.add("exponentialSlider");
        const name = item["name"];
        const expOffset = (_a = item["expOffset"]) !== null && _a !== void 0 ? _a : 1;
        const expMin = item["expMin"];
        const expMax = item["expMax"];
        const mapping = {
            expOffset: expOffset,
            minValue: expMin,
            maxValue: expMax,
            mappedMin: 0,
            mappedMax: 4096,
        };
        const mapper = new ExponentialMapper(mapping);
        const rangeInput = document.createElement("input");
        container.appendChild(rangeInput);
        rangeInput.type = "range";
        rangeInput.min = mapping.mappedMin.toString();
        rangeInput.max = mapping.mappedMax.toString();
        rangeInput.disabled = !!item["readOnly"];
        const numberInput = document.createElement("input");
        container.appendChild(numberInput);
        numberInput.type = "number";
        numberInput.min = expMin;
        numberInput.max = expMax;
        setupNumberInputWidth(numberInput);
        numberInput.disabled = !!item["readOnly"];
        const updateControls = (target, prop) => {
            const val = target[prop];
            numberInput.value = val.toString();
            rangeInput.value = mapper.mapToExp(val).toString();
        };
        this.bridge.addHandler(name, updateControls);
        updateControls(this.model, name);
        mapper.bindBidirectional(rangeInput, numberInput).listen(val => {
            this.bridge.model[name] = isNaN(val) ? 0 : Math.round(val);
        });
        return container;
    }
    createNumberEditor(item, forceInteger) {
        const container = document.createElement("div");
        container.classList.add("numberEditor");
        const optional = item["_internal"]["optional"];
        const name = item["name"];
        const min = item["min"];
        const max = item["max"];
        const step = item["step"];
        const numberInput = document.createElement("input");
        container.appendChild(numberInput);
        numberInput.type = "number";
        if (typeof min === "number")
            numberInput.min = min.toString();
        if (typeof max === "number")
            numberInput.max = max.toString();
        if (typeof step === "number")
            numberInput.step = step.toString();
        setupNumberInputWidth(numberInput);
        numberInput.disabled = !!item["readOnly"];
        const updateControls = (target, prop) => {
            const val = target[prop];
            numberInput.value = replaceUndefined(val, "").toString();
        };
        this.bridge.addHandler(name, updateControls);
        updateControls(this.model, name);
        numberInput.addEventListener("input", event => {
            let val = +numberInput.value;
            if (isNaN(val)) {
                val = optional ? null : 0;
            }
            else if (forceInteger) {
                val = Math.round(val);
            }
            this.bridge.model[name] = val;
        });
        return container;
    }
    createBooleanEditor(item) {
        const container = document.createElement("div");
        container.classList.add("booleanEditor");
        const optional = item["_internal"]["optional"];
        const name = item["name"];
        const checkbox = document.createElement("input");
        container.appendChild(checkbox);
        checkbox.type = "checkbox";
        checkbox.disabled = !!item["readOnly"];
        let lastValue;
        if (optional) {
            checkbox.addEventListener("click", event => {
                if (lastValue) {
                    checkbox.checked = true;
                    checkbox.indeterminate = true;
                }
            });
        }
        const updateControls = (target, prop) => {
            const val = target[prop];
            checkbox.checked = !!val;
            if (optional) {
                checkbox.indeterminate = typeof val !== "boolean";
                lastValue = val;
            }
        };
        this.bridge.addHandler(name, updateControls);
        updateControls(this.model, name);
        checkbox.addEventListener("input", event => {
            let val = checkbox.indeterminate ? null : checkbox.checked;
            this.bridge.model[name] = val;
        });
        return container;
    }
    createProcessNodeArrayEditor(item) {
        // optional and readOnly is not supported
        const container = document.createElement("div");
        container.classList.add("processNodeArray");
        const name = item["name"];
        const editors = new Map();
        const updateControls = (target, prop) => {
            const val = target[prop] || [];
            const nodes = val.map((e) => e);
            const nodeById = new Map(nodes.map(p => [p.nodeId, p]));
            const ids = new Set(nodeById.keys());
            // remove deleted editors
            for (let editorId of Array.from(editors.keys())) {
                if (!ids.has(editorId)) {
                    editors.get(editorId).editorElement.remove();
                    editors.delete(editorId);
                }
                else {
                    ids.delete(editorId);
                }
            }
            let lastEditor;
            for (let node of nodes) {
                let editor = editors.get(node.nodeId);
                if (!editor) {
                    editor = new ProcessNodeEditor(node);
                    editors.set(node.nodeId, editor);
                    if (lastEditor) {
                        container.insertBefore(editor.editorElement, lastEditor.editorElement.nextSibling);
                    }
                    else {
                        container.insertBefore(editor.editorElement, container.firstChild);
                    }
                    editor.titleElement.addEventListener("pointerdown", ev => {
                        const e = ev;
                        e.currentTarget.setPointerCapture(e.pointerId);
                    });
                }
                if (lastEditor &&
                    lastEditor.editorElement.nextSibling !== editor.editorElement) {
                    container.insertBefore(editor.editorElement, lastEditor.editorElement.nextSibling);
                }
                lastEditor = editor;
            }
        };
        this.bridge.addHandler(name, updateControls);
        updateControls(this.model, name);
        return container;
    }
}
