// src/index.ts

import { chords as untypedChords } from "@tombatossals/chords-db/lib/guitar.json";
import { Download, Music, Play, Plus, Upload, X } from "lucide";
import type { IconNode } from "lucide";
import { type Finger, SVGuitarChord } from "svguitar";

// Create audio context and player
const audioContext = new AudioContext({ sampleRate: 48000 });
const player = new WebAudioFontPlayer();
const notarget = audioContext.createGain();
const sf2File = _tone_0250_FluidR3_GM_sf2_file;
const sf2FileName = "_tone_0250_FluidR3_GM_sf2_file";

// Audio routing: player → gain → dry/wet split → compressor → destination
const gain = audioContext.createGain();
const dryGain = audioContext.createGain();
const wetGain = audioContext.createGain();
const convolver = audioContext.createConvolver();
const compressor = audioContext.createDynamicsCompressor();

gain.gain.value = 0.55;
dryGain.gain.value = 0.75;
wetGain.gain.value = 0.25;
compressor.threshold.value = -18;
compressor.knee.value = 12;
compressor.ratio.value = 4;

// Build reverb impulse response
convolver.buffer = createReverbImpulse(audioContext, 1.8, 3.5);

// Route: gain → dry + reverb → compressor → out
gain.connect(dryGain);
gain.connect(convolver);
convolver.connect(wetGain);
dryGain.connect(compressor);
wetGain.connect(compressor);
compressor.connect(audioContext.destination);

player.loader.decodeAfterLoading(audioContext, sf2FileName);
// Pre-decode all notes
for (let i = 0; i < 128; i++) {
	player.queueWaveTable(audioContext, notarget, sf2File, 0, i, 1.5);
}

/** Generate a synthetic reverb impulse response */
function createReverbImpulse(
	ctx: AudioContext,
	duration: number,
	decay: number,
): AudioBuffer {
	const length = ctx.sampleRate * duration;
	const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
	for (let ch = 0; ch < 2; ch++) {
		const data = impulse.getChannelData(ch);
		for (let i = 0; i < length; i++) {
			data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
		}
	}
	return impulse;
}

// Application State Interface
interface ChordItem {
	name: string;
	variationIndex: number;
}

interface LoadFileEvent extends Event {
	target: HTMLInputElement;
}

interface PositionA {
	frets: number[];
	fingers: number[];
	barres: number[];
	capo: boolean;
	baseFret: number;
	midi: number[];
}

interface PositionB {
	frets: number[];
	fingers: number[];
	barres: number[];
	baseFret: number;
	midi: number[];
	capo?: undefined;
}

type Position = PositionA | PositionB;

interface Chord {
	key: string;
	suffix: string;
	positions: Position[];
}

type Chords = Record<string, Chord[]>;

const chords = untypedChords as Chords;
console.log("Chords loaded:", chords);
console.log("Available chord roots:", Object.keys(chords));

// Build flat list of all chord names for autocomplete
const allChordNames: string[] = [];
for (const [root, chordList] of Object.entries(chords)) {
	const displayRoot = root.replace("sharp", "#");
	for (const chord of chordList) {
		const name =
			chord.suffix === "major" ? displayRoot : `${displayRoot}${chord.suffix}`;
		allChordNames.push(name);
	}
}

render();

function icon(iconNode: IconNode, size = 18): SVGSVGElement {
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

async function render() {
	await App();
}

async function App() {
	window.addEventListener(
		"click",
		() => {
			audioContext.resume();
		},
		{ once: true },
	);

	// Application State
	let chordsState: ChordItem[] = [];
	window.addEventListener("beforeunload", saveState);

	// Get reference to the root element
	const app = document.getElementById("app");
	assert(app, "Root element not found");

	// Create Elements Dynamically

	// Container for the application
	const container = document.createElement("div");
	container.className = "container";

	// Header with icon + title
	const header = document.createElement("div");
	header.className = "app-header";
	header.appendChild(icon(Music, 28));
	const heading = document.createElement("h1");
	heading.textContent = "Chord Viewer";
	header.appendChild(heading);
	container.appendChild(header);

	// Toolbar
	const toolbar = document.createElement("div");
	toolbar.className = "toolbar";

	// Input wrapper for chord name + autocomplete
	const inputWrapper = document.createElement("div");
	inputWrapper.className = "input-wrapper";

	const chordInput = document.createElement("input");
	chordInput.type = "text";
	chordInput.id = "chord-input";
	chordInput.placeholder = "Search chords…";
	chordInput.setAttribute("autocomplete", "off");
	inputWrapper.appendChild(chordInput);

	const dropdown = document.createElement("div");
	dropdown.className = "autocomplete-list";
	inputWrapper.appendChild(dropdown);

	toolbar.appendChild(inputWrapper);

	let activeIndex = -1;

	function showDropdown(filter: string) {
		dropdown.innerHTML = "";
		activeIndex = -1;
		const q = filter.toLowerCase();
		const matches = q
			? allChordNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 50)
			: allChordNames.slice(0, 50);

		if (matches.length === 0) {
			dropdown.classList.remove("visible");
			return;
		}

		for (const name of matches) {
			const item = document.createElement("div");
			item.className = "autocomplete-item";
			// Split into root + suffix for styling
			const rootMatch = name.match(/^([A-G][#b]?)(.*)$/);
			if (rootMatch) {
				const rootSpan = document.createElement("span");
				rootSpan.className = "root";
				rootSpan.textContent = rootMatch[1];
				item.appendChild(rootSpan);
				if (rootMatch[2]) {
					const suffixSpan = document.createElement("span");
					suffixSpan.className = "suffix";
					suffixSpan.textContent = rootMatch[2];
					item.appendChild(suffixSpan);
				}
			} else {
				item.textContent = name;
			}
			item.addEventListener("mousedown", (e) => {
				e.preventDefault(); // prevent blur before click fires
				chordInput.value = name;
				hideDropdown();
				addChord();
			});
			dropdown.appendChild(item);
		}
		dropdown.classList.add("visible");
	}

	function hideDropdown() {
		dropdown.classList.remove("visible");
		activeIndex = -1;
	}

	function setActiveItem(index: number) {
		const items = Array.from(dropdown.querySelectorAll(".autocomplete-item"));
		for (const item of items) item.classList.remove("active");
		if (index >= 0 && index < items.length) {
			items[index].classList.add("active");
			items[index].scrollIntoView({ block: "nearest" });
		}
	}

	chordInput.addEventListener("input", () => {
		showDropdown(chordInput.value.trim());
	});

	chordInput.addEventListener("focus", () => {
		showDropdown(chordInput.value.trim());
	});

	chordInput.addEventListener("blur", () => {
		// Small delay so mousedown on item can fire first
		setTimeout(hideDropdown, 120);
	});

	// Add Chord Button
	const addChordBtn = document.createElement("button");
	addChordBtn.className = "btn btn-primary";
	addChordBtn.appendChild(icon(Plus, 16));
	addChordBtn.appendChild(document.createTextNode("Add"));
	toolbar.appendChild(addChordBtn);

	// Save JSON Button
	const saveJsonBtn = document.createElement("button");
	saveJsonBtn.className = "btn";
	saveJsonBtn.appendChild(icon(Download, 16));
	saveJsonBtn.appendChild(document.createTextNode("Save"));
	toolbar.appendChild(saveJsonBtn);

	// Load JSON - file input styled as button
	const loadLabel = document.createElement("label");
	loadLabel.className = "file-label";
	loadLabel.appendChild(icon(Upload, 16));
	loadLabel.appendChild(document.createTextNode("Load"));
	const fileInput = document.createElement("input");
	fileInput.type = "file";
	fileInput.accept = ".json";
	fileInput.style.display = "none";
	fileInput.addEventListener("change", (e) =>
		loadFile(e as unknown as LoadFileEvent),
	);
	loadLabel.appendChild(fileInput);
	toolbar.appendChild(loadLabel);

	container.appendChild(toolbar);

	// Chord Container
	const chordContainer = document.createElement("div");
	chordContainer.id = "chord-container";
	chordContainer.className = "chord-container";
	container.appendChild(chordContainer);

	// Append the container to the app root
	app.appendChild(container);

	// Template for Chord Element
	function createChordElement(chordItem: ChordItem) {
		const chordElement = document.createElement("div");
		chordElement.className = "chord";

		// Top row: chord name + remove button
		const topRow = document.createElement("div");
		topRow.className = "chord-top-row";

		const chordTitle = document.createElement("span");
		chordTitle.className = "chord-name";
		chordTitle.textContent = chordItem.name;
		topRow.appendChild(chordTitle);

		const removeBtn = document.createElement("button");
		removeBtn.className = "btn btn-remove btn-icon";
		removeBtn.appendChild(icon(X, 16));
		removeBtn.onclick = () => {
			chordsState = chordsState.filter((item) => item.name !== chordItem.name);
			renderChords();
			saveState();
		};
		topRow.appendChild(removeBtn);
		chordElement.appendChild(topRow);

		// Controls row: variation selector + play button
		const controls = document.createElement("div");
		controls.className = "chord-controls";

		const variationSelector = document.createElement("select");
		variationSelector.className = "variation-selector";
		controls.appendChild(variationSelector);

		const playBtn = document.createElement("button");
		playBtn.className = "btn btn-play";
		playBtn.appendChild(icon(Play, 14));
		playBtn.appendChild(document.createTextNode("Play"));
		controls.appendChild(playBtn);

		chordElement.appendChild(controls);

		const svgContainer = document.createElement("div");
		svgContainer.className = "svg-container";
		chordElement.appendChild(svgContainer);

		return { chordElement, svgContainer, variationSelector, playBtn };
	}

	function normalizeRootNote(note: string): string {
		const noteMap: { [key: string]: string } = {
			// Naturals
			c: "C",
			d: "D",
			e: "E",
			f: "F",
			g: "G",
			a: "A",
			b: "B",

			// Sharps
			"c#": "Csharp",
			"d#": "Eb",
			"e#": "F",
			"f#": "Fsharp",
			"g#": "Ab",
			"a#": "Bb",
			"b#": "C",

			// Flats
			cb: "B",
			db: "Csharp",
			eb: "Eb",
			fb: "E",
			gb: "Fsharp",
			ab: "Ab",
			bb: "Bb",
		};

		const normalizedNote = noteMap[note.toLowerCase()];
		return normalizedNote || note.charAt(0).toUpperCase() + note.slice(1);
	}

	function getChordData(chordName: string, variationIndex: number) {
		// Parse the chord name into root note and suffix
		const match = chordName.match(/^([A-Ga-g][#b]?)(.*)$/);
		if (!match) return null;

		let [, root, suffix] = match;

		// Normalize the root note
		root = normalizeRootNote(root);

		// Map shorthand suffixes to full suffixes
		const suffixMap: { [key: string]: string } = {
			"": "major", // Default to "major"
			m: "minor",
			"7": "7", // e.g., C7
			maj7: "maj7", // e.g., Cmaj7
			min7: "min7", // e.g., Cmin7
			dim: "dim", // e.g., Cdim
			aug: "aug", // e.g., Caug
			// Add other mappings as needed
		};

		// Normalize the suffix using the map
		const normalizedSuffix = suffixMap[suffix.toLowerCase()] || suffix;

		console.log("Getting chord data for", { root, normalizedSuffix });

		// Retrieve chord variations
		const chordList = chords[root];
		if (!chordList || chordList.length === 0) {
			console.error(`No chord list found for root: ${root}`);
			return null;
		}

		// Find the chord with the matching suffix
		const chord = chordList.find(
			(c) => c.suffix.toLowerCase() === normalizedSuffix.toLowerCase(),
		);
		if (!chord) {
			console.error(`No chord found for ${root}${normalizedSuffix}`);
			return null;
		}

		// Use the specified position variation
		const position = chord.positions[variationIndex];
		if (!position) return null;

		// Collect MIDI notes
		const midiNotes = position.midi;

		// Map the position data to the format expected by svguitar
		const fingers: Finger[] = [];
		const mutedStrings: number[] = [];
		const baseFret = position.baseFret;

		position.frets.forEach((fret, index) => {
			const string = 6 - index; // Strings are numbered from high E (1) to low E (6)
			if (fret === -1) {
				// String is muted
				mutedStrings.push(string);
			} else if (fret === 0) {
				// Open string; no fret pressed
			} else {
				fingers.push([
					string,
					fret,
					position.fingers[index] > 0
						? position.fingers[index].toString()
						: undefined,
				]);
			}
		});

		// Map barres
		const barres = position.barres.map((barreFret) => ({
			fromString: 6, // From low E string
			toString: 1, // To high E string
			fret: barreFret,
		}));

		const chordData = {
			fingers,
			position: baseFret === 1 ? 0 : baseFret - 1, // Adjust position for svguitar
			barres,
			mutedStrings,
		};

		return { chordData, totalVariations: chord.positions.length, midiNotes };
	}

	// Function to render chords
	function renderChords() {
		chordContainer.innerHTML = ""; // Clear existing chords

		if (chordsState.length === 0) {
			const empty = document.createElement("div");
			empty.className = "empty-state";
			empty.appendChild(icon(Music, 48));
			const msg = document.createElement("p");
			msg.textContent = "No chords yet — type a chord name above and click Add";
			empty.appendChild(msg);
			chordContainer.appendChild(empty);
			return;
		}

		for (const chordItem of chordsState) {
			console.log("Rendering chord:", chordItem.name);
			const { chordElement, svgContainer, variationSelector, playBtn } =
				createChordElement(chordItem);
			chordContainer.appendChild(chordElement);

			// Get chord data from the chord library
			const chordResult = getChordData(
				chordItem.name,
				chordItem.variationIndex,
			);

			if (chordResult) {
				const { chordData, totalVariations, midiNotes } = chordResult;

				// Populate the variation selector
				variationSelector.innerHTML = "";
				for (let i = 0; i < totalVariations; i++) {
					const option = document.createElement("option");
					option.value = i.toString();
					option.textContent = `Variation ${i + 1}`;
					if (i === chordItem.variationIndex) {
						option.selected = true;
					}
					variationSelector.appendChild(option);
				}

				// Handle variation change
				variationSelector.addEventListener("change", (event) => {
					const newIndex = Number.parseInt(
						(event.target as HTMLSelectElement).value,
						10,
					);
					chordItem.variationIndex = newIndex;
					renderChords();
					saveState();
				});

				// Attach play button event listener
				playBtn.onclick = () => {
					playChord(midiNotes);
				};

				new SVGuitarChord(svgContainer)
					.configure({
						// Global configurations (optional)
					})
					.chord(chordData)
					.draw();
			} else {
				svgContainer.textContent = "Chord not found";
			}
		}
	}

	function playChord(midiNotes: number[]) {
		console.log("Playing chord", midiNotes);
		if (audioContext.state === "suspended") {
			audioContext.resume();
		}

		const now = audioContext.currentTime;
		// Strum: stagger notes by 30-50ms each (low to high)
		const strumInterval = 0.03 + Math.random() * 0.02;

		for (let i = 0; i < midiNotes.length; i++) {
			const time = now + i * strumInterval;
			// Humanize velocity slightly per string
			const velocity = 0.65 + Math.random() * 0.35;
			player.queueWaveTable(
				audioContext,
				gain,
				sf2File,
				time,
				midiNotes[i],
				2.5, // longer sustain for natural decay
				velocity,
			);
		}
	}

	// Function to save state to localStorage
	function saveState() {
		console.log("Saving state to localStorage", chordsState);
		localStorage.setItem("guitar-chords-state", JSON.stringify(chordsState));
	}

	// Function to load state from localStorage
	function loadState() {
		const savedChords = localStorage.getItem("guitar-chords-state");
		if (savedChords) {
			chordsState = JSON.parse(savedChords);
			console.log("Loading state from localStorage", chordsState);
			try {
				renderChords();
			} catch {
				chordsState = [];
				saveState();
				renderChords();
			}
		}
	}

	// Event listener for adding chords
	function addChord() {
		const chordName = chordInput.value.trim();
		if (chordName && !chordsState.some((item) => item.name === chordName)) {
			chordsState.push({ name: chordName, variationIndex: 0 });
			chordInput.value = "";
			renderChords();
			saveState();
		}
	}

	addChordBtn.addEventListener("click", addChord);

	chordInput.addEventListener("keydown", (e) => {
		const items = dropdown.querySelectorAll(".autocomplete-item");
		if (e.key === "ArrowDown") {
			e.preventDefault();
			if (!dropdown.classList.contains("visible")) {
				showDropdown(chordInput.value.trim());
			}
			activeIndex = Math.min(activeIndex + 1, items.length - 1);
			setActiveItem(activeIndex);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			activeIndex = Math.max(activeIndex - 1, 0);
			setActiveItem(activeIndex);
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (activeIndex >= 0 && activeIndex < items.length) {
				chordInput.value = items[activeIndex].textContent || "";
			}
			hideDropdown();
			addChord();
		} else if (e.key === "Escape") {
			hideDropdown();
		}
	});

	// Event listener for saving state as JSON
	saveJsonBtn.addEventListener("click", () => {
		const dataStr = JSON.stringify(chordsState, null, 2);
		const blob = new Blob([dataStr], { type: "application/json" });
		const url = URL.createObjectURL(blob);

		const a = document.createElement("a");
		a.href = url;
		a.download = "chords.json";
		a.click();
		URL.revokeObjectURL(url);
	});

	async function loadFile(event: LoadFileEvent | null) {
		const file = event?.target?.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const result = e.target?.result;
				assert(result, "File reader result is null");
				const loadedChords = JSON.parse(result as string);
				chordsState = loadedChords;
				renderChords();
				saveState();
			} catch (err) {
				alert("Invalid JSON file");
			}
		};
		reader.readAsText(file);
	}

	loadState();
	return container;
}

function assert(thing: unknown, message = "Assertion failed"): asserts thing {
	if (!thing) {
		throw new Error(message);
	}
}
