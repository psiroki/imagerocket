const templateLookup = Object.fromEntries(Array.from(document.querySelectorAll(".template"))
    .flatMap(e => {
    e.remove();
    e.classList.remove("template");
    return Array.from(e.classList).map(cls => [cls, e]);
}));
export function cloneTemplate(name) {
    const template = templateLookup[name];
    return template ? template.cloneNode(true) : null;
}
