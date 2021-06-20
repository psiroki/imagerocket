import { Color, extractAlpha, formatColor } from "../processing/image.js";
import { AsyncStream } from "../processing/util.js";
import { ModelBridge } from "./model_bridge.js";
import { cloneTemplate } from "./templates.js";

const optionalPattern = /\?$/;

interface Formatter {
  (input: string): string;
}

interface RealUpdate {
  (real: number): void;
}

function bindValues(
  input: HTMLInputElement,
  output: HTMLInputElement | HTMLOutputElement,
  formatter: Formatter
) {
  const prefix = output.getAttribute("data-prefix") || "";
  if (!formatter) formatter = (value) => value;
  var sync = () => {
    output.value = prefix + formatter(input.value);
  };
  input.addEventListener("input", sync);
  sync();
}

interface ExponentialMapping {
  expOffset: number;
  minValue: number;
  maxValue: number;
  mappedMin: number;
  mappedMax: number;
}

class ExponentialMapper {
  constructor(params: ExponentialMapping) {
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

  bindBidirectional(exp: HTMLInputElement, real: HTMLInputElement): AsyncStream<number> {
    const result = new AsyncStream<number>();
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

  mapToExp(n: number): number {
    return Math.round(
      (Math.log(n + (this.offset - this.minValue)) - this.expOffset) /
        this.scale +
        this.mappedMin
    );
  }

  mapToReal(exp: number): number {
    return Math.round(
      Math.exp((exp - this.mappedMin) * this.scale + this.expOffset) -
        (this.offset - this.minValue)
    );
  }

  private readonly offset: number;
  private readonly expOffset: number;
  private readonly mappedMin: number;
  private readonly minValue: number;
  private readonly scale: number;
}

export class PropertySheet {
  constructor(bridge: ModelBridge) {
    this.bridge = bridge;
    this.model = bridge.model;
    this.schema = bridge.schema;
    const schema = this.schema;
    this.sheetElement = cloneTemplate("propertySheet")!;
    for (let item of schema["properties"]) {
      const itemElement = cloneTemplate("propertySheetItem")!;
      this.sheetElement.appendChild(itemElement);
      itemElement.querySelector(".propertyName")!.textContent = item["name"];
      const valueElement = itemElement.querySelector(".propertyValue")!;
      const editor = item["editor"];
      const rawEditor = editor.replace(optionalPattern, "");
      item["_internal"] = {
        "optional": optionalPattern.test(editor),
        "rawEditor": rawEditor,
      };
      switch (rawEditor) {
        case "color":
          valueElement.appendChild(this.createColorEditor(item));
          break;
        case "exponentialSlider":
          valueElement.appendChild(this.createExponentialSlider(item));
          break;
      }
    }
  }

  get element(): Element {
    return this.sheetElement;
  }

  createColorEditor(item: any): DocumentFragment {
    const result = new DocumentFragment();
    const container = document.createElement("span");
    container.classList.add("colorEditor");
    const name = item["name"];
    result.appendChild(container);
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

    const sync = (target: any, prop: string): void => {
      const color = target[prop] as Color;
      colorInput.value = formatColor(color).substring(0, 7);
      alphaRange.value = extractAlpha(color).toString();
    };

    this.bridge.addHandler(name, sync);
    sync(this.model, name);

    return result;
  }

  createExponentialSlider(item: any): DocumentFragment {
    const result = new DocumentFragment();
    const container = document.createElement("span");
    container.classList.add("exponentialSlider");
    const name = item["name"];
    const expOffset = item["expOffset"] ?? 1;
    const expMin = item["expMin"];
    const expMax = item["expMax"];
    const mapping: ExponentialMapping = {
      expOffset: expOffset,
      minValue: expMin,
      maxValue: expMax,
      mappedMin: 0,
      mappedMax: 4096,
    };
    const mapper = new ExponentialMapper(mapping);
    result.appendChild(container);

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

    const updateControls = (target: any, prop: string): void => {
      const val = target[prop] as number;
      numberInput.value = val.toString();
      rangeInput.value = mapper.mapToExp(val).toString();
    };

    this.bridge.addHandler(name, updateControls);
    updateControls(this.model, name);

    mapper.bindBidirectional(rangeInput, numberInput).listen(val => {
      this.bridge.model[name] = isNaN(val) ? 0 : val;
    });

    return result;
  }

  private readonly bridge: ModelBridge;
  private readonly model: any;
  private readonly schema: any;
  private readonly sheetElement: Element;
}
