export interface DropHandlerApi {
  bind(): void;
  unbind(): void;
  readonly dragging: boolean;
  readonly dropX: number | null;
  readonly dropY: number | null;
}

export interface DropCallback {
  (blob: Blob, event: DragEvent, dropHandler: DropHandlerApi): void;
}

export interface HoverCallback {
  (event: DragEvent, dropHandler: DropHandlerApi): any;
}

export function dropHandler(element: Element, callback: DropCallback, hoverCallback: HoverCallback=null) {
  let api: DropHandlerApi | null = null;

  let dragging = false;
  let dropX: number | null = null;
  let dropY: number | null = null;

  function handleDataTransferFiles(dataTransfer: DataTransfer, event: DragEvent) {
    let files = Array.from(dataTransfer.files);
    let foundFiles = false;
    files.forEach(function (f) {
      foundFiles = true;
      callback(f as Blob, event, api);
    });
    return foundFiles;
  }

  function b(x: any) {
    return typeof x === "undefined" || x === null || x;
  }

  function dragOver(e: DragEvent) {
    e.dataTransfer.dropEffect = "copy";
    dropX = e.clientX;
    dropY = e.clientY;
    dragging = true;
    if (!hoverCallback || b(hoverCallback(e, api))) {
      e.stopPropagation();
      e.preventDefault();
    } else {
      dragging = false;
    }
    this.classList.toggle("dragOver", dragging);
  }

  function drop(e: DragEvent) {
    handleDataTransferFiles(e.dataTransfer, e);
    dragging = false;
    if (!hoverCallback || b(hoverCallback(e, api))) {
      e.stopPropagation();
      e.preventDefault();
    }
    this.classList.remove("dragOver");
    dropX = dropY = null;
  }

  function dragEnter(e: DragEvent) {
    dragging = true;
    dropX = e.clientX;
    dropY = e.clientY;
    if (hoverCallback && !b(hoverCallback(e, api))) {
      dragging = false;
    }
    this.classList.toggle("dragOver", dragging);
  }

  function dragLeave(e: DragEvent) {
    this.classList.remove("dragOver");
    dragging = false;
    dropX = dropY = null;
    if (hoverCallback) hoverCallback(e, api);
  }

  let bound = false;

  class Access implements DropHandlerApi {
    bind(): void {
      if (bound) return;
      bound = true;
      element.addEventListener("dragover", dragOver as EventListener, false);
      element.addEventListener("drop", drop as EventListener, false);
      element.addEventListener("dragenter", dragEnter as EventListener, false);
      element.addEventListener("dragleave", dragLeave as EventListener, false);
    }

    unbind(): void {
      if (!bound) return;
      element.removeEventListener("dragover", dragOver as EventListener, false);
      element.removeEventListener("drop", drop as EventListener, false);
      element.removeEventListener("dragenter", dragEnter as EventListener, false);
      element.removeEventListener("dragleave", dragLeave as EventListener, false);
      bound = false;
      dragging = false;
    }

    get dragging() { return dragging; }
    get dropX() { return dropX; }
    get dropY() { return dropY; }
  }

  api = new Access();

  api.bind();

  return api;
}
