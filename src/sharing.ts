/** Sharing & Export: URL sharing, PDF/PNG export, QR code, SVG copy */

import { encodeQR } from "./qr";
import type { Song } from "./songs";
import type { ChordItem } from "./state";

// ─── URL Sharing ───────────────────────────────────────

/** Encode chord set or song state into a shareable URL hash */
export function encodeShareUrl(chords: ChordItem[]): string {
	const data = JSON.stringify(chords);
	const encoded = btoa(encodeURIComponent(data));
	const origin =
		typeof window !== "undefined"
			? window.location.origin + window.location.pathname
			: "";
	return `${origin}#share=${encoded}`;
}

/** Decode chord set from URL hash */
export function decodeShareUrl(hash: string): ChordItem[] | null {
	try {
		const match = hash.match(/share=([A-Za-z0-9+/=]+)/);
		if (!match) return null;
		const decoded = decodeURIComponent(atob(match[1]));
		const parsed = JSON.parse(decoded);
		if (Array.isArray(parsed)) return parsed;
		return null;
	} catch {
		return null;
	}
}

/** Check URL on load for shared state */
export function checkShareUrl(): ChordItem[] | null {
	if (typeof window === "undefined") return null;
	return decodeShareUrl(window.location.hash);
}

// ─── PDF Export ────────────────────────────────────────

/** Strip interactive elements (play, variation, drag, action buttons) for print */
function stripInteractiveElements(html: string): string {
	const template = document.createElement("div");
	template.innerHTML = html;
	for (const sel of [".chord-controls", ".chord-top-actions", ".drag-handle"]) {
		for (const el of Array.from(template.querySelectorAll(sel))) el.remove();
	}
	return template.innerHTML;
}

/** Export chord sheet as printable PDF (uses browser print) */
export function exportPDF(title: string, container: HTMLElement) {
	const printWindow = window.open("", "_blank");
	if (!printWindow) return;

	const cleanHTML = stripInteractiveElements(container.innerHTML);

	printWindow.document.write(`
		<!DOCTYPE html>
		<html>
		<head>
			<title>${escapeHtml(title)}</title>
			<style>
				body { font-family: Inter, system-ui, sans-serif; padding: 2rem; color: #18181b; }
				h1 { font-size: 1.5rem; margin-bottom: 1rem; }
				.chord-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
				.chord-card { border: 1px solid #d4d4d8; border-radius: 8px; padding: 1rem; text-align: center; }
				.chord-card h3 { margin: 0 0 0.5rem; }
				.chord-card svg { max-width: 160px; width: 100%; }
				.chord { border: 1px solid #d4d4d8; border-radius: 8px; padding: 1rem; text-align: center; }
				.chord-name { font-size: 1.125rem; font-weight: 700; }
				.chord-top-row { display: flex; justify-content: center; margin-bottom: 0.5rem; }
				svg { max-width: 160px; width: 100%; }
				@media print { body { padding: 0; } }
			</style>
		</head>
		<body>
			<h1>${escapeHtml(title)}</h1>
			<div class="chord-grid">${cleanHTML}</div>
		</body>
		</html>
	`);
	printWindow.document.close();
	printWindow.focus();
	printWindow.print();
}

// ─── PNG Export ────────────────────────────────────────

/** Export chord container as PNG image */
export async function exportPNG(
	container: HTMLElement,
	filename = "chords.png",
): Promise<void> {
	const svgs = container.querySelectorAll("svg");
	const canvas = document.createElement("canvas");
	const cols = Math.min(svgs.length, 4);
	const rows = Math.ceil(svgs.length / cols);
	const cardW = 220;
	const cardH = 280;
	const padding = 20;

	canvas.width = cols * cardW + padding * 2;
	canvas.height = rows * cardH + padding * 2;

	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	for (let i = 0; i < svgs.length; i++) {
		const col = i % cols;
		const row = Math.floor(i / cols);
		const x = padding + col * cardW;
		const y = padding + row * cardH;

		const svgData = new XMLSerializer().serializeToString(svgs[i]);
		const svgBlob = new Blob([svgData], {
			type: "image/svg+xml;charset=utf-8",
		});
		const url = URL.createObjectURL(svgBlob);

		try {
			const img = await loadImage(url);
			ctx.drawImage(img, x + 10, y + 30, cardW - 20, cardH - 50);
		} finally {
			URL.revokeObjectURL(url);
		}
	}

	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/png"),
	);
	if (blob) downloadBlob(blob, filename);
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = src;
	});
}

// ─── SVG Copy ──────────────────────────────────────────

/** Copy a chord diagram SVG to clipboard */
export async function copySvgToClipboard(svgElement: SVGSVGElement) {
	const svgString = new XMLSerializer().serializeToString(svgElement);
	try {
		await navigator.clipboard.writeText(svgString);
		return true;
	} catch {
		return false;
	}
}

// ─── QR Code ───────────────────────────────────────────

/** Generate a real QR code as SVG using built-in encoder */
export function generateQRCodeSvg(data: string, size = 200): SVGSVGElement {
	const modules = encodeQR(data);
	const moduleCount = modules.length;
	const quiet = 4; // quiet zone modules
	const total = moduleCount + quiet * 2;
	const cellSize = size / total;

	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
	svg.setAttribute("width", String(size));
	svg.setAttribute("height", String(size));

	// White background
	const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	bg.setAttribute("width", String(size));
	bg.setAttribute("height", String(size));
	bg.setAttribute("fill", "white");
	svg.appendChild(bg);

	// Build a single path for all dark modules (much more efficient than individual rects)
	let pathData = "";
	for (let row = 0; row < moduleCount; row++) {
		for (let col = 0; col < moduleCount; col++) {
			if (modules[row][col]) {
				const x = (col + quiet) * cellSize;
				const y = (row + quiet) * cellSize;
				pathData += `M${x},${y}h${cellSize}v${cellSize}h${-cellSize}z`;
			}
		}
	}

	if (pathData) {
		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
		path.setAttribute("d", pathData);
		path.setAttribute("fill", "black");
		svg.appendChild(path);
	}

	return svg;
}

// ─── Song Export Formats ───────────────────────────────

export function exportSongJSON(song: Song): string {
	return JSON.stringify(song, null, 2);
}

// ─── Helpers ───────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

function escapeHtml(text: string): string {
	const div = document.createElement("div");
	div.appendChild(document.createTextNode(text));
	return div.innerHTML;
}
