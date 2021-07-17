const templateLookup: any = Object.fromEntries(
  Array.from(document.querySelectorAll(".template"))
    .flatMap(e => {
      e.remove();
      e.classList.remove("template");
      return Array.from(e.classList).map(cls => [cls, e]);
    }));


export function cloneTemplate(name: string): HTMLElement | null {
  const template = templateLookup[name];
  return template ? template.cloneNode(true) : null;
}
