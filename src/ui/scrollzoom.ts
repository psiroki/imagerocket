import * as m from "../common/math.js";

function add(a: number[], b: number[]): number[] {
	return a.map((e, i) => i < 3 ? e+b[i] : e);
}

function sub(a: number[], b: number[]): number[] {
	return a.map((e, i) => i < 3 ? e-b[i] : e);
}

function scale(a: number[], f: number): number[] {
	return a.map((e, i) => i < 3 ? e*f : e);
}

function vectorLength(vec: number[]): number {
	const x = vec[0];
  const y = vec[1];
  const z = vec[2];
	return Math.sqrt(x*x+y*y+z*z);
}

function coordsInCurrentTarget(e: MouseEvent, targetOverride: HTMLElement|null=null) {
	const r = (targetOverride || e.currentTarget as HTMLElement).getBoundingClientRect();
	return [e.clientX - r.x, e.clientY - r.y, 0, 1];
}

export class ScrollZoom {
  constructor(view: HTMLElement) {
    this.view = view;
    this.image = this.view.querySelector("*")!;

    this.pointerState = new Map();

    view.addEventListener("pointerdown", e => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      this.pointerState.set(e.pointerId, e);
      e.preventDefault();
    });
    
    view.addEventListener("pointermove", e => {
      const lastState = this.pointerState.get(e.pointerId);
      if (!lastState) return;
      const before = coordsInCurrentTarget(lastState, this.view);
      const now = coordsInCurrentTarget(e, this.view);
      if (this.pointerState.size === 1) {
        const delta = sub(now, before);
        this.viewMatrix = m.multiplyMatrices(m.translation(delta), this.viewMatrix);
        this.constrainAndApply();
      } else if (this.pointerState.size === 2) {
        for (let otherEvent of this.pointerState.values()) {
          if (otherEvent.pointerId !== e.pointerId) {
            const origin = coordsInCurrentTarget(otherEvent, this.view);
            const deltaScale = vectorLength(sub(now, origin)) / vectorLength(sub(before, origin));
            const centerBefore = scale(add(before, origin), 0.5);
            const centerNow = scale(add(now, origin), 0.5);
            this.scaleAroundClientCoordinates(origin, deltaScale);
            const delta = sub(centerNow, centerBefore);
            this.viewMatrix = m.multiplyMatrices(m.translation(delta), this.viewMatrix);
            this.constrainAndApply();
          }
        }
      }
      this.pointerState.set(e.pointerId, e);
    });
    
    view.addEventListener("pointercancel", e => {
      this.pointerState.delete(e.pointerId);
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    });
    
    view.addEventListener("pointerup", e => {
      this.pointerState.delete(e.pointerId);
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    });
    
    
    view.addEventListener("wheel", e => {
      const deltaScale = Math.pow(2, -e.deltaY / 256);
      this.scaleAroundClientCoordinates(coordsInCurrentTarget(e), deltaScale);
      this.constrainAndApply();
      e.preventDefault();
    });
  }

  centerImage(): void {
    const center = m.multiplyMatrixAndVector(this.viewMatrix, [
      this.image.offsetWidth*0.5,
      this.image.offsetHeight*0.5,
      0,
      1,
    ]);
    this.viewMatrix[12] += this.view.offsetWidth * 0.5 - center[0];
    this.viewMatrix[13] += this.view.offsetHeight * 0.5 - center[1];
    this.constrainAndApply();
  }

  private scaleAroundClientCoordinates(coords: number[], deltaScale: number): void {
    const negOffset = scale(coords, -1);
    const offset = coords;
    const transformMatrix = m.multiplyArrayOfMatrices([m.translation(offset), m.uniformScale(deltaScale), m.translation(negOffset)]);
    this.viewMatrix = m.multiplyMatrices(transformMatrix, this.viewMatrix);
  }

  private constrainAndApply(): void {
//    this.applyMatrixConstraints();
    this.image.style.transform = m.matrixArrayToCssMatrix(this.viewMatrix);
  }

  private applyMatrixConstraints(): void {
    if (this.viewMatrix[12] * 2 > this.view.offsetWidth) {
      this.viewMatrix[12] = this.view.offsetWidth * 0.5;
    }
    if (this.viewMatrix[13] * 2 > this.view.offsetHeight) {
      this.viewMatrix[13] = this.view.offsetHeight * 0.5;
    }
    const bottomRight = m.multiplyMatrixAndVector(this.viewMatrix, [
      this.image.offsetWidth,
      this.image.offsetHeight,
      0,
      1,
    ]);
    if (bottomRight[0] * 2 < this.view.offsetWidth) {
      this.viewMatrix[12] += this.view.offsetWidth * 0.5 - bottomRight[0];
    }
    if (bottomRight[1] * 2 < this.view.offsetHeight) {
      this.viewMatrix[13] += this.view.offsetHeight * 0.5 - bottomRight[1];
    }
  }

  readonly pointerState: Map<number, PointerEvent>;
  readonly view: HTMLElement;
  readonly image: HTMLElement;
  private viewMatrix: number[] = m.uniformScale(1);
}
