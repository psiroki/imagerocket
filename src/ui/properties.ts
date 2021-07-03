import {
  Color,
  extractAlpha,
  formatColor,
  rgba,
  shiftToAlpha,
} from "../processing/image.js";
import { globalSerializer, ProcessNode, SerializableConstructor } from "../processing/process_node.js";
import {
  AsyncStream,
  isNullish,
  replaceNullish,
} from "../processing/util.js";
import { ModelBridge } from "./model_bridge.js";
import { ProcessNodeEditor } from "./node_editor.js";
import { cloneTemplate } from "./templates.js";

const optionalPattern = /\?$/;

interface Formatter {
  (input: string): string;
}

function bindValues(
  input: HTMLInputElement,
  output: HTMLInputElement | HTMLOutputElement,
  formatter: Formatter
) {
  const prefix = output.getAttribute("data-prefix") || "";
  if (!formatter) formatter = value => value;
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

  bindBidirectional(
    exp: HTMLInputElement,
    real: HTMLInputElement
  ): AsyncStream<number> {
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

function setupNumberInputWidth(e: HTMLInputElement): void {
  let bound = Math.max(...[e.min, e.max].map(e => e.length));
  if (bound === 0) return;
  let additional = e.step.indexOf(".");
  if (additional >= 0) {
    additional = e.step.length - additional;
  } else {
    additional = 0;
  }
  e.style.width = bound + additional + 3 + "ch";
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
      itemElement.querySelector(".propertyName")!.textContent =
        item["label"] || item["name"];
      const valueElement = itemElement.querySelector(".propertyValue")!;
      const editor = item["editor"];
      const rawEditor = editor.replace(optionalPattern, "");
      item["_internal"] = {
        "optional": optionalPattern.test(editor),
        "rawEditor": rawEditor,
      };
      let elements: DocumentFragment | Element | null = null;
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
      if (elements) valueElement.appendChild(elements);
    }
  }

  get element(): Element {
    return this.sheetElement;
  }

  createColorEditor(item: any): Element {
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

    const sync = (target: any, prop: string): void => {
      const raw = target[prop];
      const defined = !isNullish(raw);
      const color = (!defined ? defaultValue : raw) as Color;
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
        if (event.target === alphaRange) alphaInput.value = alphaRange.value;
        if (event.target === alphaInput) alphaRange.value = alphaInput.value;
        if (event.target === optionalInput) {
          const disabled = !optionalInput.checked;
          for (let otherInput of [colorInput, alphaRange, alphaInput]) {
            otherInput.disabled = disabled;
          }
        }
        if (!readOnly) {
          if (optional && !optionalInput.checked) {
            this.bridge.model[name] = null;
          } else {
            const colorString = colorInput.value.substring(1);
            let comps = new Array(3);
            for (let i = 0; i < 3; ++i) {
              let val = parseInt(
                colorString.substring(i << 1, (i + 1) << 1),
                16
              );
              if (isNaN(val)) {
                // invalid input is ignored
                return;
              }
              comps[i] = val;
            }
            this.bridge.model[name] = rgba(
              comps[0],
              comps[1],
              comps[2],
              +alphaRange.value
            );
          }
        }
      });
    }

    return container;
  }

  createExponentialSlider(item: any): Element {
    const container = document.createElement("div");
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

    const updateControls = (target: any, prop: string): void => {
      const val = target[prop] as number;
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

  createNumberEditor(item: any, forceInteger: boolean): Element {
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
    if (typeof min === "number") numberInput.min = min.toString();
    if (typeof max === "number") numberInput.max = max.toString();
    if (typeof step === "number") numberInput.step = step.toString();
    setupNumberInputWidth(numberInput);
    numberInput.disabled = !!item["readOnly"];

    const updateControls = (target: any, prop: string): void => {
      const val = target[prop] as number;
      numberInput.value = replaceNullish(val, "").toString();
    };

    this.bridge.addHandler(name, updateControls);
    updateControls(this.model, name);

    numberInput.addEventListener("input", event => {
      let val: number | null = +numberInput.value;
      if (isNaN(val)) {
        val = optional ? null : 0;
      } else if (forceInteger) {
        val = Math.round(val);
      }
      this.bridge.model[name] = val;
    });

    return container;
  }

  createBooleanEditor(item: any): Element {
    const container = document.createElement("div");
    container.classList.add("booleanEditor");

    const optional = item["_internal"]["optional"];
    const name = item["name"];

    const checkbox = document.createElement("input");
    container.appendChild(checkbox);
    checkbox.type = "checkbox";
    checkbox.disabled = !!item["readOnly"];

    let lastValue: any;

    if (optional) {
      checkbox.addEventListener("click", event => {
        if (lastValue) {
          checkbox.checked = true;
          checkbox.indeterminate = true;
        }
      });
    }

    const updateControls = (target: any, prop: string): void => {
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

  createProcessNodeArrayEditor(item: any): Element {
    // optional and readOnly is not supported
    const container = document.createElement("div");
    container.classList.add("processNodeArray");
    const name = item["name"];

    const editors: Map<number, ProcessNodeEditor> = new Map();

    const updateControls = (target: any, prop: string): void => {
      const val = target[prop] || [];
      const nodes: ProcessNode[] = val.map((e: any) => e as ProcessNode);
      const nodeById = new Map(nodes.map(p => [p.nodeId, p]));
      const ids = new Set(nodeById.keys());
      // remove deleted editors
      for (let editorId of Array.from(editors.keys())) {
        if (!ids.has(editorId)) {
          editors.get(editorId)!.editorElement.remove();
          editors.delete(editorId);
        } else {
          ids.delete(editorId);
        }
      }
      let lastEditor: ProcessNodeEditor | undefined;
      for (let node of nodes) {
        let editor = editors.get(node.nodeId);
        if (!editor) {
          editor = new ProcessNodeEditor(node);
          editors.set(node.nodeId, editor);
          if (lastEditor) {
            container.insertBefore(
              editor.editorElement,
              lastEditor.editorElement.nextSibling
            );
          } else {
            container.insertBefore(editor.editorElement, container.firstChild);
          }
          editor.titleElement.addEventListener("pointerdown", ev => {
            const e = ev as PointerEvent;
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
          });
        }
        if (
          lastEditor &&
          lastEditor.editorElement.nextSibling !== editor.editorElement
        ) {
          container.insertBefore(
            editor.editorElement,
            lastEditor.editorElement.nextSibling
          );
        }
        lastEditor = editor;
      }
    };

    this.bridge.addHandler(name, updateControls);
    updateControls(this.model, name);

    const addPanel = document.createElement("div");
    addPanel.classList.add("addPanel");
    const prototypes: Map<string, SerializableConstructor> = new Map();
    for (let entry of globalSerializer.enumerateClasses()) {
      let obj = new entry.create();
      if (obj instanceof ProcessNode) {
        prototypes.set(entry.name, entry.create);
      }
    }
    for (let className of Array.from(prototypes.keys()).sort()) {
      let addButton = document.createElement("button");
      addButton.textContent = className;
      const create = prototypes.get(className)!;
      (new create() as ProcessNode).classColorInfo.setupAsBackgroundColor(addButton);
      addButton.addEventListener("click", _ => {
        const instance = new create() as ProcessNode;
        this.model[name] = (this.model[name] || []).concat([instance]);
        updateControls(this.model, name);
      });
      addPanel.appendChild(addButton);
    }
    container.appendChild(addPanel);

    return container;
  }

  private readonly bridge: ModelBridge;
  private readonly model: any;
  private readonly schema: any;
  private readonly sheetElement: Element;
}
