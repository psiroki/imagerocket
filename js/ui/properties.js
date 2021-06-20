import { extractAlpha, formatColor } from "../processing/image.js";
import { AsyncStream, replaceUndefined } from "../processing/util.js";
import { cloneTemplate } from "./templates.js";
const optionalPattern = /\?$/;
function bindValues(input, output, formatter) {
    const prefix = output.getAttribute("data-prefix") || "";
    if (!formatter)
        formatter = (value) => value;
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
        bindValues(exp, real, (s) => {
            const real = this.mapToReal(+s);
            result.add(real);
            return real.toString();
        });
        bindValues(real, exp, (s) => {
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
            }
            if (elements)
                valueElement.appendChild(elements);
        }
    }
    get element() {
        return this.sheetElement;
    }
    createColorEditor(item) {
        const container = document.createElement("span");
        container.classList.add("colorEditor");
        const name = item["name"];
        const colorInput = document.createElement("input");
        container.appendChild(colorInput);
        colorInput.type = "color";
        colorInput.disabled = !!item["readOnly"];
        const alphaRange = document.createElement("input");
        container.appendChild(alphaRange);
        alphaRange.type = "range";
        alphaRange.min = "0";
        alphaRange.max = "255";
        alphaRange.disabled = !!item["readOnly"];
        const sync = (target, prop) => {
            const color = target[prop];
            colorInput.value = formatColor(color).substring(0, 7);
            alphaRange.value = extractAlpha(color).toString();
        };
        this.bridge.addHandler(name, sync);
        sync(this.model, name);
        return container;
    }
    createExponentialSlider(item) {
        var _a;
        const container = document.createElement("span");
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
        numberInput.disabled = !!item["readOnly"];
        const updateControls = (target, prop) => {
            const val = target[prop];
            numberInput.value = val.toString();
            rangeInput.value = mapper.mapToExp(val).toString();
        };
        this.bridge.addHandler(name, updateControls);
        updateControls(this.model, name);
        mapper.bindBidirectional(rangeInput, numberInput).listen((val) => {
            this.bridge.model[name] = isNaN(val) ? 0 : Math.round(val);
        });
        return container;
    }
    createNumberEditor(item, forceInteger) {
        const container = document.createElement("span");
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
        const container = document.createElement("span");
        container.classList.add("booleanEditor");
        const name = item["name"];
        const checkbox = document.createElement("input");
        container.appendChild(checkbox);
        checkbox.type = "checkbox";
        checkbox.disabled = !!item["readOnly"];
        const updateControls = (target, prop) => {
            const val = target[prop];
            checkbox.checked = !!val;
        };
        this.bridge.addHandler(name, updateControls);
        updateControls(this.model, name);
        checkbox.addEventListener("input", event => {
            let val = checkbox.checked;
            this.bridge.model[name] = val;
        });
        return container;
    }
}
