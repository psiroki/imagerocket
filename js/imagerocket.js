import { SolidCropDetector } from "./processing/simple_crop_detector.js";
import { CanvasImageBuffer } from "./processing/image.js";
import { ImageProcessingPipeline, globalSerializer, } from "./processing/process_node.js";
import { ManualColor, PointSampler } from "./processing/samplers.js";
import * as drop from "./ui/drop.js";
import * as util from "./common/util.js";
import { BasicExpander } from "./processing/expanders.js";
import { BorderColorFiller } from "./processing/crop_filler.js";
import { ProcessNodeEditor } from "./ui/node_editor.js";
import { ImageViewer } from "./processing/viewer.js";
const pasteTargets = new Set(["text", "number"]);
class ImageRocketApp {
    constructor(root) {
        this.root = root;
        const def = (() => {
            try {
                return JSON.parse(localStorage.getItem("imagerocket"));
            }
            catch (e) {
                return null;
            }
        })();
        let pipeline = null;
        if ((def === null || def === void 0 ? void 0 : def.pipeline) instanceof Array) {
            try {
                const result = globalSerializer.deserializeAll(def.pipeline);
                pipeline = result[0];
            }
            catch (e) {
                console.error(e);
                pipeline = null;
            }
        }
        if (!pipeline) {
            let sampler = new PointSampler();
            let detector = new SolidCropDetector();
            let expander = new BasicExpander();
            expander.expandBy = 4;
            let manual = new ManualColor();
            let filler = new BorderColorFiller();
            let viewer = new ImageViewer();
            let elements = [sampler, detector, expander, manual, filler, viewer];
            pipeline = new ImageProcessingPipeline(elements);
        }
        document
            .querySelector(".pipelines")
            .appendChild(new ProcessNodeEditor(pipeline).editorElement);
        this.pipeline = pipeline;
    }
    run() {
        window.addEventListener("beforeunload", _ => {
            localStorage.setItem("imagerocket", JSON.stringify({
                pipeline: globalSerializer.serializeAll([this.pipeline]),
            }));
        });
        const dropBox = this.root.querySelector(".dropBox");
        const fileInput = dropBox.querySelector("input[type=file]");
        if (fileInput) {
            dropBox.addEventListener("dblclick", _ => {
                fileInput.click();
            });
            fileInput.addEventListener("change", e => {
                Array.from(e.currentTarget.files).forEach(blob => this.processBlob(blob));
            });
        }
        drop.dropHandler(dropBox, this.processBlob.bind(this));
        document.body.addEventListener("paste", ((e) => {
            var _a, _b;
            let target = e.target;
            if (target === e.currentTarget)
                target = document.activeElement;
            if (((_a = target.tagName) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === "input" &&
                pasteTargets.has(target.type.toLowerCase())) {
                return;
            }
            let items = (_b = e.clipboardData) === null || _b === void 0 ? void 0 : _b.items;
            if (items) {
                let stringItem = null;
                for (let item of items) {
                    if (item.kind === "file") {
                        // file support is broken
                        console.log("File found: " + item.type, item);
                        const m = /^image\/(svg)?/i.exec(item.type);
                        if (m && !m[1]) {
                            const f = item.getAsFile();
                            if (f) {
                                this.processBlob(f);
                                stringItem = null;
                                break;
                            }
                            else {
                                console.log("No file object though");
                            }
                        }
                    }
                    else if (item.kind === "string" && item.type === "text/plain") {
                        stringItem = item;
                    }
                }
                if (stringItem) {
                    stringItem.getAsString(string => console.log("Only string found:", string));
                }
            }
        }));
        // dropping a file anywhere else is probably an accident,
        // prevent the browser from navigating away
        for (let eventName of ["drop", "dragover"]) {
            document.body.addEventListener(eventName, event => {
                event.preventDefault();
                event.stopPropagation();
            });
        }
    }
    async processBlob(blob) {
        let image = await createImageBitmap(blob);
        let canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        let ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        let buffer = new CanvasImageBuffer(canvas);
        const pipeline = this.pipeline;
        console.log(globalSerializer.serializeAll([pipeline]));
        await pipeline.processImages([buffer]);
        const viewer = document.querySelector(".imageViewers > :last-child");
        if (viewer && !util.overlapsView(viewer)) {
            viewer.scrollIntoView();
        }
    }
}
export let app = new ImageRocketApp(document.body);
app.run();
