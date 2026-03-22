import type { IconNode } from "lucide";

export function assert(
	thing: unknown,
	message = "Assertion failed",
): asserts thing {
	if (!thing) {
		throw new Error(message);
	}
}

export function icon(iconNode: IconNode, size = 18): SVGSVGElement {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("width", String(size));
	svg.setAttribute("height", String(size));
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("fill", "none");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("stroke-width", "2");
	svg.setAttribute("stroke-linecap", "round");
	svg.setAttribute("stroke-linejoin", "round");
	for (const [tag, attrs] of iconNode) {
		const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
		for (const [k, v] of Object.entries(attrs)) {
			el.setAttribute(k, String(v));
		}
		svg.appendChild(el);
	}
	return svg;
}

export function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	attrs?: Record<string, string>,
	...children: (string | Node)[]
): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag);
	if (attrs) {
		for (const [k, v] of Object.entries(attrs)) {
			if (k === "className") {
				element.className = v;
			} else {
				element.setAttribute(k, v);
			}
		}
	}
	for (const child of children) {
		if (typeof child === "string") {
			element.appendChild(document.createTextNode(child));
		} else {
			element.appendChild(child);
		}
	}
	return element;
}
