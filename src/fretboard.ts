/** Interactive Fretboard — SVG full-neck fretboard (frets 0–22, 6 strings) */
import { playNote, resumeAudio } from "./audio";
import { el } from "./utils";

export interface FretboardOptions {
	frets?: number;
	strings?: number;
	leftHanded?: boolean;
	showNoteNames?: boolean;
	showIntervals?: boolean;
	rootNote?: string;
	highlightedNotes?: number[];
	onNoteClick?: (midi: number, stringIndex: number, fret: number) => void;
}

const NOTE_NAMES = [
	"C",
	"C#",
	"D",
	"D#",
	"E",
	"F",
	"F#",
	"G",
	"G#",
	"A",
	"A#",
	"B",
];

const INTERVAL_NAMES = [
	"R",
	"m2",
	"2",
	"m3",
	"3",
	"4",
	"b5",
	"5",
	"m6",
	"6",
	"m7",
	"7",
];

// Standard tuning MIDI: E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
const STANDARD_TUNING = [40, 45, 50, 55, 59, 64];

// Fret marker positions (dots)
const SINGLE_DOTS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_DOTS = [12];

export function getMidiNote(stringIndex: number, fret: number): number {
	return STANDARD_TUNING[stringIndex] + fret;
}

export function getNoteName(midi: number): string {
	return NOTE_NAMES[midi % 12];
}

export function getInterval(midi: number, rootMidi: number): string {
	const semitones = (((midi - rootMidi) % 12) + 12) % 12;
	return INTERVAL_NAMES[semitones];
}

export function noteNameToMidi(name: string): number {
	const n = name.replace("#", "#").replace("b", "b");
	const base = n.charAt(0).toUpperCase();
	const sharp = n.includes("#");
	const flat = n.includes("b");
	let idx = NOTE_NAMES.indexOf(base);
	if (idx === -1) idx = 0;
	if (sharp) idx = (idx + 1) % 12;
	if (flat) idx = (idx + 11) % 12;
	return idx;
}

export class Fretboard {
	private container: HTMLDivElement;
	private svg!: SVGSVGElement;
	private options: Required<FretboardOptions>;
	private highlightedSet = new Set<number>();

	// Layout constants
	private readonly stringSpacing = 20;
	private readonly fretWidth = 50;
	private readonly nutWidth = 8;
	private readonly paddingTop = 30;
	private readonly paddingBottom = 20;
	private readonly paddingLeft = 40;

	constructor(container: HTMLDivElement, opts: FretboardOptions = {}) {
		this.container = container;
		this.options = {
			frets: opts.frets ?? 22,
			strings: opts.strings ?? 6,
			leftHanded: opts.leftHanded ?? false,
			showNoteNames: opts.showNoteNames ?? false,
			showIntervals: opts.showIntervals ?? false,
			rootNote: opts.rootNote ?? "C",
			highlightedNotes: opts.highlightedNotes ?? [],
			onNoteClick:
				opts.onNoteClick ??
				((midi) => {
					resumeAudio();
					playNote(midi);
				}),
		};
		this.highlightedSet = new Set(this.options.highlightedNotes);
		this.render();
	}

	get totalWidth(): number {
		return (
			this.paddingLeft +
			this.nutWidth +
			this.options.frets * this.fretWidth +
			20
		);
	}

	get totalHeight(): number {
		return (
			this.paddingTop +
			(this.options.strings - 1) * this.stringSpacing +
			this.paddingBottom
		);
	}

	setHighlightedNotes(notes: number[]) {
		this.highlightedSet = new Set(notes);
		this.render();
	}

	setOptions(opts: Partial<FretboardOptions>) {
		Object.assign(this.options, opts);
		if (opts.highlightedNotes) {
			this.highlightedSet = new Set(opts.highlightedNotes);
		}
		this.render();
	}

	private svgEl(
		tag: string,
		attrs: Record<string, string | number>,
	): SVGElement {
		const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
		for (const [k, v] of Object.entries(attrs)) {
			element.setAttribute(k, String(v));
		}
		return element;
	}

	private fretX(fret: number): number {
		if (fret === 0) return this.paddingLeft;
		return this.paddingLeft + this.nutWidth + (fret - 0.5) * this.fretWidth;
	}

	private fretLineX(fret: number): number {
		return this.paddingLeft + this.nutWidth + fret * this.fretWidth;
	}

	private stringY(stringIndex: number): number {
		// stringIndex 0 = lowest (E2), displayed at bottom; 5 = highest (E4) at top
		const visualIndex = this.options.leftHanded
			? stringIndex
			: this.options.strings - 1 - stringIndex;
		return this.paddingTop + visualIndex * this.stringSpacing;
	}

	render() {
		this.container.innerHTML = "";

		const w = this.totalWidth;
		const h = this.totalHeight;

		this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		this.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
		this.svg.setAttribute("class", "fretboard-svg");
		this.svg.setAttribute("role", "img");
		this.svg.setAttribute("aria-label", "Guitar fretboard");

		// Background
		this.svg.appendChild(
			this.svgEl("rect", {
				x: 0,
				y: 0,
				width: w,
				height: h,
				fill: "var(--fb-bg, #1a1a1e)",
				rx: 4,
			}),
		);

		// Fretboard wood
		const fbX = this.paddingLeft + this.nutWidth;
		const fbY = this.paddingTop - 8;
		const fbW = this.options.frets * this.fretWidth;
		const fbH = (this.options.strings - 1) * this.stringSpacing + 16;
		this.svg.appendChild(
			this.svgEl("rect", {
				x: fbX,
				y: fbY,
				width: fbW,
				height: fbH,
				fill: "var(--fb-wood, #2a2420)",
				rx: 2,
			}),
		);

		// Nut
		this.svg.appendChild(
			this.svgEl("rect", {
				x: this.paddingLeft,
				y: this.paddingTop - 8,
				width: this.nutWidth,
				height: fbH,
				fill: "var(--fb-nut, #d4d4d8)",
				rx: 1,
			}),
		);

		this.drawFretMarkers();
		this.drawFrets();
		this.drawStrings();
		this.drawNotes();
		this.drawFretNumbers();

		this.container.appendChild(this.svg);
	}

	private drawFrets() {
		for (let f = 1; f <= this.options.frets; f++) {
			const x = this.fretLineX(f);
			this.svg.appendChild(
				this.svgEl("line", {
					x1: x,
					y1: this.paddingTop - 8,
					x2: x,
					y2:
						this.paddingTop +
						(this.options.strings - 1) * this.stringSpacing +
						8,
					stroke: "var(--fb-fret, #71717a)",
					"stroke-width": f === 0 ? 3 : 1.5,
				}),
			);
		}
	}

	private drawStrings() {
		const endX = this.fretLineX(this.options.frets);
		for (let s = 0; s < this.options.strings; s++) {
			const y = this.stringY(s);
			const thickness = 1 + (s < 3 ? 0 : (s - 2) * 0.3);
			this.svg.appendChild(
				this.svgEl("line", {
					x1: this.paddingLeft,
					y1: y,
					x2: endX,
					y2: y,
					stroke: "var(--fb-string, #a1a1aa)",
					"stroke-width": thickness,
				}),
			);
		}
	}

	private drawFretMarkers() {
		for (const f of SINGLE_DOTS) {
			if (f > this.options.frets) continue;
			const cx = this.paddingLeft + this.nutWidth + (f - 0.5) * this.fretWidth;
			const cy =
				this.paddingTop + ((this.options.strings - 1) * this.stringSpacing) / 2;
			this.svg.appendChild(
				this.svgEl("circle", {
					cx,
					cy,
					r: 4,
					fill: "var(--fb-dot, #3f3f46)",
				}),
			);
		}
		for (const f of DOUBLE_DOTS) {
			if (f > this.options.frets) continue;
			const cx = this.paddingLeft + this.nutWidth + (f - 0.5) * this.fretWidth;
			const midY =
				this.paddingTop + ((this.options.strings - 1) * this.stringSpacing) / 2;
			this.svg.appendChild(
				this.svgEl("circle", {
					cx,
					cy: midY - this.stringSpacing * 1.5,
					r: 4,
					fill: "var(--fb-dot, #3f3f46)",
				}),
			);
			this.svg.appendChild(
				this.svgEl("circle", {
					cx,
					cy: midY + this.stringSpacing * 1.5,
					r: 4,
					fill: "var(--fb-dot, #3f3f46)",
				}),
			);
		}
	}

	private drawFretNumbers() {
		for (let f = 1; f <= this.options.frets; f++) {
			if (!SINGLE_DOTS.includes(f) && !DOUBLE_DOTS.includes(f) && f !== 1)
				continue;
			const cx = this.paddingLeft + this.nutWidth + (f - 0.5) * this.fretWidth;
			const y =
				this.paddingTop +
				(this.options.strings - 1) * this.stringSpacing +
				this.paddingBottom -
				4;
			const text = this.svgEl("text", {
				x: cx,
				y,
				"text-anchor": "middle",
				"font-size": 9,
				fill: "var(--fb-fret-num, #71717a)",
				"font-family": "Inter, system-ui, sans-serif",
			});
			text.textContent = String(f);
			this.svg.appendChild(text);
		}
	}

	private drawNotes() {
		const rootMidi = noteNameToMidi(this.options.rootNote);

		for (let s = 0; s < this.options.strings; s++) {
			for (let f = 0; f <= this.options.frets; f++) {
				const midi = getMidiNote(s, f);
				const isHighlighted = this.highlightedSet.has(midi % 12);
				const isRoot = midi % 12 === rootMidi;

				if (!isHighlighted && !this.options.showNoteNames) continue;

				const cx = this.fretX(f);
				const cy = this.stringY(s);
				const r = 8;

				const group = this.svgEl("g", {
					class: "fb-note-group",
					cursor: "pointer",
				});
				group.addEventListener("click", () => {
					this.options.onNoteClick(midi, s, f);
				});

				if (isHighlighted) {
					group.appendChild(
						this.svgEl("circle", {
							cx,
							cy,
							r,
							fill: isRoot
								? "var(--accent, #a78bfa)"
								: "var(--fb-highlight, #6366f1)",
							opacity: 0.9,
						}),
					);
				}

				// Label
				if (this.options.showNoteNames || this.options.showIntervals) {
					let label: string;
					if (this.options.showIntervals && isHighlighted) {
						label = getInterval(midi, rootMidi);
					} else if (this.options.showNoteNames) {
						label = getNoteName(midi);
					} else {
						continue;
					}

					const text = this.svgEl("text", {
						x: cx,
						y: cy + 3.5,
						"text-anchor": "middle",
						"font-size": isHighlighted ? 8 : 6,
						"font-weight": isHighlighted ? "600" : "400",
						fill: isHighlighted ? "#fff" : "var(--fb-note-label, #52525b)",
						"font-family": "Inter, system-ui, sans-serif",
						"pointer-events": "none",
					});
					text.textContent = label;
					group.appendChild(text);

					// Click target for non-highlighted
					if (!isHighlighted) {
						group.insertBefore(
							this.svgEl("circle", {
								cx,
								cy,
								r: 6,
								fill: "transparent",
							}),
							text,
						);
					}
				}

				this.svg.appendChild(group);
			}
		}
	}
}

/** Create an interactive fretboard panel UI */
export function createFretboardPanel(onClose: () => void): HTMLDivElement {
	const panel = el("div", { className: "fretboard-panel" });

	// Header
	const header = el("div", { className: "fretboard-header" });
	header.appendChild(el("h2", {}, "Fretboard"));

	const controls = el("div", { className: "fretboard-controls" });

	// Show note names toggle
	const noteNamesLabel = el("label", { className: "fb-toggle" });
	const noteNamesCheck = document.createElement("input");
	noteNamesCheck.type = "checkbox";
	noteNamesCheck.checked = false;
	noteNamesLabel.appendChild(noteNamesCheck);
	noteNamesLabel.appendChild(document.createTextNode("Notes"));
	controls.appendChild(noteNamesLabel);

	// Show intervals toggle
	const intervalsLabel = el("label", { className: "fb-toggle" });
	const intervalsCheck = document.createElement("input");
	intervalsCheck.type = "checkbox";
	intervalsCheck.checked = false;
	intervalsLabel.appendChild(intervalsCheck);
	intervalsLabel.appendChild(document.createTextNode("Intervals"));
	controls.appendChild(intervalsLabel);

	// Left-handed toggle
	const leftHandedLabel = el("label", { className: "fb-toggle" });
	const leftHandedCheck = document.createElement("input");
	leftHandedCheck.type = "checkbox";
	leftHandedCheck.checked = false;
	leftHandedLabel.appendChild(leftHandedCheck);
	leftHandedLabel.appendChild(document.createTextNode("Left-hand"));
	controls.appendChild(leftHandedLabel);

	// Close button
	const closeBtn = el("button", { className: "btn btn-icon" });
	closeBtn.textContent = "✕";
	closeBtn.title = "Close fretboard";
	closeBtn.onclick = onClose;
	controls.appendChild(closeBtn);

	header.appendChild(controls);
	panel.appendChild(header);

	// Fretboard container with scroll
	const fbWrapper = el("div", { className: "fretboard-wrapper" });
	const fbContainer = el("div", { className: "fretboard-container" });
	fbWrapper.appendChild(fbContainer);
	panel.appendChild(fbWrapper);

	const fretboard = new Fretboard(fbContainer);

	noteNamesCheck.onchange = () => {
		fretboard.setOptions({ showNoteNames: noteNamesCheck.checked });
	};
	intervalsCheck.onchange = () => {
		fretboard.setOptions({ showIntervals: intervalsCheck.checked });
	};
	leftHandedCheck.onchange = () => {
		fretboard.setOptions({ leftHanded: leftHandedCheck.checked });
	};

	// expose fretboard for external control
	(panel as HTMLDivElement & { fretboard: Fretboard }).fretboard = fretboard;

	return panel;
}
