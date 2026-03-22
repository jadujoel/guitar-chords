/** UI module — builds and manages the entire DOM with all feature panels */
import {
	Copy,
	Download,
	FileText,
	GripVertical,
	ListMusic,
	Moon,
	Music,
	Pencil,
	Play,
	Plus,
	Repeat,
	Share2,
	Square,
	Sun,
	Trash2,
	Upload,
	Volume2,
	VolumeX,
	X,
} from "lucide";
import { SVGuitarChord } from "svguitar";
import {
	bpmSignal,
	metronomeSignal,
	mutedSignal,
	onMetronomeBeat,
	playChord,
	resumeAudio,
	reverbSignal,
	type StrumDirection,
	setMetronomeBpm,
	setTimeSignature,
	startMetronome,
	stopMetronome,
	strumDirectionSignal,
	strumSpeedSignal,
	type TimeSignature,
	tapTempo,
	volumeSignal,
} from "./audio";
import { findChordByNotes } from "./chord-finder";
import { filterChordNames, getChordData } from "./chords";
import { createFretboardPanel, type Fretboard } from "./fretboard";
import { INSTRUMENTS, type Instrument, instrumentSignal } from "./instruments";
import {
	getMasteryHeatmap,
	masterySignal,
	type PracticeMode,
	pickQuizChord,
	pickTransitionPair,
	practiceSignal,
	recordAttempt,
	recordPracticeDay,
	streakSignal,
} from "./practice";
import {
	checkShareUrl,
	copySvgToClipboard,
	encodeShareUrl,
	exportPDF,
	exportPNG,
	generateQRCodeSvg,
} from "./sharing";
import {
	addSetlist,
	addSong,
	createSetlist,
	createSong,
	deleteSetlist,
	deleteSong,
	estimateSetlistDuration,
	exportChordPro,
	importChordPro,
	type ProgressionItem,
	progressionSignal,
	type Song,
	setlistsSignal,
	songsSignal,
	updateSong,
} from "./songs";
import { type ChordItem, chordsSignal, themeSignal } from "./state";
import {
	ALL_KEYS,
	buildProgression,
	detectKey,
	getDiatonicChords,
	getScalePitchClasses,
	PROGRESSION_PRESETS,
	SCALES,
	toNashvilleNumber,
	transposeChord,
	withCapo,
} from "./theory";
import { toast } from "./toast";
import { assert, el, icon } from "./utils";

interface LoadFileEvent extends Event {
	target: HTMLInputElement;
}

// ─── Autocomplete helper ──────────────────────────────────
function renderAutocompleteItems(
	dropdown: HTMLDivElement,
	matches: string[],
	onSelect: (name: string) => void,
) {
	dropdown.innerHTML = "";
	if (matches.length === 0) {
		dropdown.classList.remove("visible");
		return;
	}
	for (const name of matches) {
		const item = document.createElement("div");
		item.className = "autocomplete-item";
		item.setAttribute("role", "option");
		const rootMatch = name.match(/^([A-G][#b]?)(.*)$/);
		if (rootMatch) {
			const rootSpan = el("span", { className: "root" }, rootMatch[1]);
			item.appendChild(rootSpan);
			if (rootMatch[2]) {
				item.appendChild(el("span", { className: "suffix" }, rootMatch[2]));
			}
		} else {
			item.textContent = name;
		}
		item.addEventListener("mousedown", (e) => {
			e.preventDefault();
			onSelect(name);
		});
		dropdown.appendChild(item);
	}
	dropdown.classList.add("visible");
}

function setupAutocompleteKeyboard(
	input: HTMLInputElement,
	dropdown: HTMLDivElement,
	getActiveIndex: () => number,
	setActiveIndex: (i: number) => void,
	onCommit: (name: string) => void,
	onEscape: () => void,
	showFn: () => void,
) {
	input.addEventListener("keydown", (e) => {
		const items = dropdown.querySelectorAll(".autocomplete-item");
		const idx = getActiveIndex();
		if (e.key === "ArrowDown") {
			e.preventDefault();
			if (!dropdown.classList.contains("visible")) showFn();
			const next = Math.min(idx + 1, items.length - 1);
			setActiveIndex(next);
			highlightItem(dropdown, next);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			const prev = Math.max(idx - 1, 0);
			setActiveIndex(prev);
			highlightItem(dropdown, prev);
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (idx >= 0 && idx < items.length) {
				onCommit(items[idx].textContent || "");
			} else {
				onCommit(input.value.trim());
			}
		} else if (e.key === "Escape") {
			onEscape();
		}
	});
}

function highlightItem(dropdown: HTMLDivElement, index: number) {
	const items = Array.from(dropdown.querySelectorAll(".autocomplete-item"));
	for (const item of items) item.classList.remove("active");
	if (index >= 0 && index < items.length) {
		items[index].classList.add("active");
		items[index].scrollIntoView({ block: "nearest" });
	}
}

// ─── Screen reader announcements ──────────────────────────
let liveRegion: HTMLDivElement | null = null;
function announce(message: string) {
	if (!liveRegion) {
		liveRegion = document.createElement("div");
		liveRegion.setAttribute("aria-live", "assertive");
		liveRegion.setAttribute("aria-atomic", "true");
		liveRegion.className = "sr-only";
		document.body.appendChild(liveRegion);
	}
	liveRegion.textContent = "";
	requestAnimationFrame(() => {
		if (liveRegion) liveRegion.textContent = message;
	});
}

// ─── Guitar SVG illustration for empty state ──────────────
function guitarIllustration(): SVGSVGElement {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 120 120");
	svg.setAttribute("width", "120");
	svg.setAttribute("height", "120");
	svg.setAttribute("fill", "none");
	svg.setAttribute("aria-hidden", "true");

	const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
	g.setAttribute("stroke", "currentColor");
	g.setAttribute("stroke-width", "2");
	g.setAttribute("stroke-linecap", "round");

	// Guitar body
	const body = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"ellipse",
	);
	body.setAttribute("cx", "60");
	body.setAttribute("cy", "78");
	body.setAttribute("rx", "30");
	body.setAttribute("ry", "24");
	g.appendChild(body);

	// Sound hole
	const hole = document.createElementNS("http://www.w3.org/2000/svg", "circle");
	hole.setAttribute("cx", "60");
	hole.setAttribute("cy", "78");
	hole.setAttribute("r", "8");
	g.appendChild(hole);

	// Neck
	const neck = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	neck.setAttribute("x", "55");
	neck.setAttribute("y", "18");
	neck.setAttribute("width", "10");
	neck.setAttribute("height", "40");
	neck.setAttribute("rx", "2");
	g.appendChild(neck);

	// Headstock
	const head = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	head.setAttribute("x", "53");
	head.setAttribute("y", "10");
	head.setAttribute("width", "14");
	head.setAttribute("height", "12");
	head.setAttribute("rx", "3");
	g.appendChild(head);

	// Strings
	for (let i = 0; i < 6; i++) {
		const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
		const x = 56 + i * 1.6;
		line.setAttribute("x1", String(x));
		line.setAttribute("y1", "22");
		line.setAttribute("x2", String(x));
		line.setAttribute("y2", "95");
		line.setAttribute("stroke-width", "0.8");
		g.appendChild(line);
	}

	svg.appendChild(g);
	return svg;
}

// ─── Drag & Drop state ────────────────────────────────────
let dragSrcIndex = -1;

// ─── Main App ─────────────────────────────────────────────
export function App() {
	window.addEventListener("click", () => resumeAudio(), { once: true });

	// Check for shared state in URL
	const shared = checkShareUrl();
	if (shared) {
		chordsSignal.set(shared);
		toast("Chords loaded from shared link", "success");
		// Clear hash
		history.replaceState(null, "", window.location.pathname);
	}

	const app = document.getElementById("app");
	assert(app, "Root element not found");

	const container = el("div", { className: "container" });

	// ── Header ──
	const header = el("div", { className: "app-header" });
	header.appendChild(icon(Music, 28));
	header.appendChild(el("h1", {}, "Chord Viewer"));

	// Streak badge
	const streakBadge = el("span", { className: "streak-badge" });
	function updateStreakBadge() {
		const s = streakSignal.get();
		streakBadge.textContent =
			s.currentStreak > 0 ? `🔥 ${s.currentStreak} day streak` : "";
	}
	updateStreakBadge();
	streakSignal.subscribe(updateStreakBadge);
	header.appendChild(streakBadge);

	// Theme toggle
	const themeBtn = document.createElement("button");
	themeBtn.className = "btn btn-icon theme-toggle";
	themeBtn.setAttribute("aria-label", "Toggle light/dark theme");
	themeBtn.title = "Toggle theme";
	function updateThemeIcon() {
		themeBtn.innerHTML = "";
		themeBtn.appendChild(icon(themeSignal.get() === "dark" ? Sun : Moon, 18));
	}
	updateThemeIcon();
	themeBtn.onclick = () => {
		themeSignal.set(themeSignal.get() === "dark" ? "light" : "dark");
		updateThemeIcon();
	};
	themeSignal.subscribe(updateThemeIcon);
	header.appendChild(themeBtn);
	container.appendChild(header);

	// ── Tab Navigation ──
	const tabNames = [
		"Chords",
		"Fretboard",
		"Progression",
		"Songs",
		"Theory",
		"Practice",
		"Share",
	];
	const tabBar = el("div", { className: "tab-bar" });
	tabBar.setAttribute("role", "tablist");
	const panels: HTMLDivElement[] = [];
	let _activeTabIdx = 0;

	for (let i = 0; i < tabNames.length; i++) {
		const btn = el("button", {
			className: `tab-btn${i === 0 ? " active" : ""}`,
		});
		btn.setAttribute("role", "tab");
		btn.setAttribute("aria-selected", i === 0 ? "true" : "false");
		btn.textContent = tabNames[i];
		btn.onclick = () => switchTab(i);
		tabBar.appendChild(btn);
	}
	container.appendChild(tabBar);

	function switchTab(idx: number) {
		_activeTabIdx = idx;
		const tabs = tabBar.querySelectorAll(".tab-btn");
		for (let i = 0; i < tabs.length; i++) {
			tabs[i].classList.toggle("active", i === idx);
			tabs[i].setAttribute("aria-selected", i === idx ? "true" : "false");
		}
		for (let i = 0; i < panels.length; i++) {
			panels[i].classList.toggle("active", i === idx);
		}
	}

	// ═══ Panel 0: Chords (main chord viewer) ═══
	const chordsPanel = el("div", { className: "tab-panel active" });
	chordsPanel.setAttribute("role", "tabpanel");
	buildChordsPanel(chordsPanel);
	panels.push(chordsPanel);
	container.appendChild(chordsPanel);

	// ═══ Panel 1: Fretboard ═══
	const fretboardPanel = el("div", { className: "tab-panel" });
	fretboardPanel.setAttribute("role", "tabpanel");
	buildFretboardTab(fretboardPanel);
	panels.push(fretboardPanel);
	container.appendChild(fretboardPanel);

	// ═══ Panel 2: Progression ═══
	const progressionPanel = el("div", { className: "tab-panel" });
	progressionPanel.setAttribute("role", "tabpanel");
	buildProgressionPanel(progressionPanel);
	panels.push(progressionPanel);
	container.appendChild(progressionPanel);

	// ═══ Panel 3: Songs ═══
	const songsPanel = el("div", { className: "tab-panel" });
	songsPanel.setAttribute("role", "tabpanel");
	buildSongsPanel(songsPanel);
	panels.push(songsPanel);
	container.appendChild(songsPanel);

	// ═══ Panel 4: Theory ═══
	const theoryPanel = el("div", { className: "tab-panel" });
	theoryPanel.setAttribute("role", "tabpanel");
	buildTheoryPanel(theoryPanel);
	panels.push(theoryPanel);
	container.appendChild(theoryPanel);

	// ═══ Panel 5: Practice ═══
	const practicePanel = el("div", { className: "tab-panel" });
	practicePanel.setAttribute("role", "tabpanel");
	buildPracticePanel(practicePanel);
	panels.push(practicePanel);
	container.appendChild(practicePanel);

	// ═══ Panel 6: Share ═══
	const sharePanel = el("div", { className: "tab-panel" });
	sharePanel.setAttribute("role", "tabpanel");
	buildSharePanel(sharePanel);
	panels.push(sharePanel);
	container.appendChild(sharePanel);

	app.appendChild(container);
}

// ═══════════════════════════════════════════════════════════
// Panel Builders
// ═══════════════════════════════════════════════════════════

function buildChordsPanel(panel: HTMLDivElement) {
	// ── Instrument selector ──
	const instrBar = el("div", { className: "instrument-selector" });
	for (const [key, config] of Object.entries(INSTRUMENTS)) {
		const btn = el("button", {
			className: `instrument-btn${key === "guitar" ? " active" : ""}`,
		});
		btn.textContent = config.name;
		btn.onclick = () => {
			instrumentSignal.set(key as Instrument);
			instrBar.querySelectorAll(".instrument-btn").forEach((b) => {
				b.classList.remove("active");
			});
			btn.classList.add("active");
		};
		instrBar.appendChild(btn);
	}
	panel.appendChild(instrBar);

	// ── Audio controls ──
	const audioCtrl = el("div", { className: "audio-controls" });

	// Volume
	const volGroup = el("div", { className: "audio-control-group" });
	const volBtn = el("button", { className: "btn btn-icon" });
	volBtn.setAttribute("aria-label", "Toggle mute");
	function updateVolIcon() {
		volBtn.innerHTML = "";
		volBtn.appendChild(icon(mutedSignal.get() ? VolumeX : Volume2, 16));
	}
	updateVolIcon();
	volBtn.onclick = () => {
		mutedSignal.set(!mutedSignal.get());
		updateVolIcon();
	};
	volGroup.appendChild(volBtn);
	const volSlider = document.createElement("input");
	volSlider.type = "range";
	volSlider.min = "0";
	volSlider.max = "1";
	volSlider.step = "0.01";
	volSlider.value = String(volumeSignal.get());
	volSlider.oninput = () => volumeSignal.set(Number(volSlider.value));
	volGroup.appendChild(volSlider);
	audioCtrl.appendChild(volGroup);

	// Reverb
	const revGroup = el("div", { className: "audio-control-group" });
	revGroup.appendChild(el("label", {}, "Reverb"));
	const revSlider = document.createElement("input");
	revSlider.type = "range";
	revSlider.min = "0";
	revSlider.max = "1";
	revSlider.step = "0.01";
	revSlider.value = String(reverbSignal.get());
	revSlider.oninput = () => reverbSignal.set(Number(revSlider.value));
	revGroup.appendChild(revSlider);
	audioCtrl.appendChild(revGroup);

	// Strum direction
	const strumGroup = el("div", { className: "audio-control-group" });
	strumGroup.appendChild(el("label", {}, "Strum"));
	const strumSelect = document.createElement("select");
	for (const dir of [
		"down",
		"up",
		"fingerpick",
		"arpeggio",
	] as StrumDirection[]) {
		const opt = document.createElement("option");
		opt.value = dir;
		opt.textContent = dir.charAt(0).toUpperCase() + dir.slice(1);
		strumSelect.appendChild(opt);
	}
	strumSelect.onchange = () =>
		strumDirectionSignal.set(strumSelect.value as StrumDirection);
	strumGroup.appendChild(strumSelect);
	audioCtrl.appendChild(strumGroup);

	// Strum speed
	const speedGroup = el("div", { className: "audio-control-group" });
	speedGroup.appendChild(el("label", {}, "Speed"));
	const speedSlider = document.createElement("input");
	speedSlider.type = "range";
	speedSlider.min = "0.01";
	speedSlider.max = "0.1";
	speedSlider.step = "0.005";
	speedSlider.value = String(strumSpeedSignal.get());
	speedSlider.oninput = () => strumSpeedSignal.set(Number(speedSlider.value));
	speedGroup.appendChild(speedSlider);
	audioCtrl.appendChild(speedGroup);

	panel.appendChild(audioCtrl);

	// ── Metronome ──
	buildMetronomeUI(panel);

	// ── Toolbar ──
	const toolbar = el("div", { className: "toolbar" });
	const inputWrapper = el("div", { className: "input-wrapper" });

	const chordInput = document.createElement("input");
	chordInput.type = "text";
	chordInput.id = "chord-input";
	chordInput.placeholder = "Search chords…";
	chordInput.setAttribute("autocomplete", "off");
	chordInput.setAttribute("role", "combobox");
	chordInput.setAttribute("aria-expanded", "false");
	chordInput.setAttribute("aria-autocomplete", "list");
	chordInput.setAttribute("aria-label", "Search chords");
	inputWrapper.appendChild(chordInput);

	const dropdown = el("div", { className: "autocomplete-list" });
	dropdown.setAttribute("role", "listbox");
	dropdown.id = "chord-autocomplete";
	chordInput.setAttribute("aria-controls", "chord-autocomplete");
	inputWrapper.appendChild(dropdown);
	toolbar.appendChild(inputWrapper);

	let activeIndex = -1;

	function showDropdown() {
		const matches = filterChordNames(chordInput.value.trim());
		renderAutocompleteItems(dropdown, matches, (name) => {
			chordInput.value = name;
			hideDropdown();
			addChord();
		});
		chordInput.setAttribute(
			"aria-expanded",
			matches.length > 0 ? "true" : "false",
		);
	}

	function hideDropdown() {
		dropdown.classList.remove("visible");
		activeIndex = -1;
		chordInput.setAttribute("aria-expanded", "false");
	}

	chordInput.addEventListener("input", showDropdown);
	chordInput.addEventListener("focus", showDropdown);
	chordInput.addEventListener("blur", () => setTimeout(hideDropdown, 120));

	setupAutocompleteKeyboard(
		chordInput,
		dropdown,
		() => activeIndex,
		(i) => {
			activeIndex = i;
		},
		() => {
			if (activeIndex >= 0) {
				const items = dropdown.querySelectorAll(".autocomplete-item");
				if (activeIndex < items.length) {
					chordInput.value = items[activeIndex].textContent || "";
				}
			}
			hideDropdown();
			addChord();
		},
		hideDropdown,
		showDropdown,
	);

	// Buttons
	const addChordBtn = el("button", { className: "btn btn-primary" });
	addChordBtn.setAttribute("aria-label", "Add chord");
	addChordBtn.appendChild(icon(Plus, 16));
	addChordBtn.appendChild(document.createTextNode("Add"));
	addChordBtn.addEventListener("click", addChord);
	toolbar.appendChild(addChordBtn);

	const saveJsonBtn = el("button", { className: "btn" });
	saveJsonBtn.setAttribute("aria-label", "Save chords as JSON file");
	saveJsonBtn.appendChild(icon(Download, 16));
	saveJsonBtn.appendChild(document.createTextNode("Save"));
	saveJsonBtn.addEventListener("click", saveToFile);
	toolbar.appendChild(saveJsonBtn);

	const loadLabel = document.createElement("label");
	loadLabel.className = "file-label";
	loadLabel.setAttribute("role", "button");
	loadLabel.setAttribute("tabindex", "0");
	loadLabel.setAttribute("aria-label", "Load chords from JSON file");
	loadLabel.appendChild(icon(Upload, 16));
	loadLabel.appendChild(document.createTextNode("Load"));
	const fileInput = document.createElement("input");
	fileInput.type = "file";
	fileInput.accept = ".json,.cho";
	fileInput.style.display = "none";
	fileInput.addEventListener("change", (e) =>
		loadFile(e as unknown as LoadFileEvent),
	);
	loadLabel.appendChild(fileInput);
	loadLabel.addEventListener("keydown", (e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			fileInput.click();
		}
	});
	toolbar.appendChild(loadLabel);

	panel.appendChild(toolbar);

	// ── Transpose / Capo controls ──
	const transposeBar = el("div", { className: "transpose-controls" });
	transposeBar.appendChild(el("label", {}, "Transpose:"));
	const transpDown = el("button", { className: "btn btn-icon" });
	transpDown.textContent = "−";
	transpDown.onclick = () => transposeAll(-1);
	transposeBar.appendChild(transpDown);
	const transpUp = el("button", { className: "btn btn-icon" });
	transpUp.textContent = "+";
	transpUp.onclick = () => transposeAll(1);
	transposeBar.appendChild(transpUp);

	transposeBar.appendChild(el("label", {}, "Capo:"));
	const capoSelect = document.createElement("select");
	for (let i = 0; i <= 12; i++) {
		const opt = document.createElement("option");
		opt.value = String(i);
		opt.textContent = i === 0 ? "None" : `Fret ${i}`;
		capoSelect.appendChild(opt);
	}
	capoSelect.onchange = () => updateCapoDisplay(Number(capoSelect.value));
	transposeBar.appendChild(capoSelect);

	const capoInfo = el("span", { className: "capo-display" });
	transposeBar.appendChild(capoInfo);
	panel.appendChild(transposeBar);

	function updateCapoDisplay(capo: number) {
		if (capo === 0) {
			capoInfo.textContent = "";
			return;
		}
		const items = chordsSignal.get();
		const parts = items.map((c) => {
			const w = withCapo(c.name, capo);
			return `${c.name}→${w.playAs}`;
		});
		capoInfo.textContent = parts.length > 0 ? `Play: ${parts.join(", ")}` : "";
	}

	function transposeAll(semitones: number) {
		chordsSignal.update((chords) =>
			chords.map((c) => ({ ...c, name: transposeChord(c.name, semitones) })),
		);
		toast(`Transposed ${semitones > 0 ? "up" : "down"}`, "info");
	}

	// ── Chord Container ──
	const chordContainer = el("div", {
		className: "chord-container",
		id: "chord-container",
	});
	chordContainer.setAttribute("role", "list");
	chordContainer.setAttribute("aria-label", "Chord cards");
	panel.appendChild(chordContainer);

	// ─── Render chords ───
	function renderChords() {
		chordContainer.innerHTML = "";
		const items = chordsSignal.get();

		if (items.length === 0) {
			const empty = el("div", { className: "empty-state" });
			empty.appendChild(guitarIllustration());
			empty.appendChild(
				el("p", {}, "No chords yet — type a chord name above and click Add"),
			);
			chordContainer.appendChild(empty);
			return;
		}

		for (let idx = 0; idx < items.length; idx++) {
			const card = createChordCard(items[idx], idx);
			chordContainer.appendChild(card);
		}
	}

	function addChord() {
		const chordName = chordInput.value.trim();
		if (!chordName) return;
		const items = chordsSignal.get();
		if (items.some((item) => item.name === chordName)) {
			toast(`${chordName} is already added`, "info");
			return;
		}
		if (!getChordData(chordName, 0)) {
			toast(`Chord "${chordName}" not found`, "error");
			return;
		}
		chordsSignal.update((c) => [...c, { name: chordName, variationIndex: 0 }]);
		chordInput.value = "";
		chordInput.focus();
		announce(`${chordName} added`);
		toast(`Added ${chordName}`, "success");
	}

	function saveToFile() {
		const dataStr = JSON.stringify(chordsSignal.get(), null, 2);
		const blob = new Blob([dataStr], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "chords.json";
		a.click();
		URL.revokeObjectURL(url);
		toast("Chords saved to file", "success");
	}

	function loadFile(event: LoadFileEvent | null) {
		const file = event?.target?.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const result = e.target?.result;
				assert(result, "File reader result is null");
				if (file.name.endsWith(".cho")) {
					const imported = importChordPro(result as string);
					if (imported.chords && imported.chords.length > 0) {
						chordsSignal.set(
							imported.chords.map((c) => ({
								name: c.chordName,
								variationIndex: 0,
							})),
						);
						if (imported.title) {
							const song = createSong(imported);
							addSong(song);
							toast(`Imported "${imported.title}"`, "success");
						} else {
							toast("Chords imported from ChordPro", "success");
						}
					}
				} else {
					const loadedChords: ChordItem[] = JSON.parse(result as string);
					if (!Array.isArray(loadedChords)) throw new Error("Invalid format");
					chordsSignal.set(loadedChords);
					toast("Chords loaded from file", "success");
				}
				announce("Chords loaded");
			} catch {
				toast("Invalid file", "error");
			}
		};
		reader.readAsText(file);
	}

	chordsSignal.subscribe(renderChords);
	renderChords();
}

// ═══ Fretboard Tab ═══
function buildFretboardTab(panel: HTMLDivElement) {
	const fbPanel = createFretboardPanel(() => {});
	// Remove close button since this is a tab
	const closeBtn = fbPanel.querySelector(".fretboard-header .btn-icon");
	closeBtn?.remove();
	panel.appendChild(fbPanel);

	// Highlight current chords on fretboard
	const fb = (fbPanel as HTMLDivElement & { fretboard?: Fretboard }).fretboard;
	if (fb) {
		chordsSignal.subscribe((chords) => {
			if (chords.length > 0) {
				const last = chords[chords.length - 1];
				const data = getChordData(last.name, last.variationIndex);
				if (data) {
					const pitchClasses = data.midiNotes.map((n) => n % 12);
					const root = last.name.match(/^([A-G][#b]?)/)?.[1] ?? "C";
					fb.setOptions({ highlightedNotes: pitchClasses, rootNote: root });
				}
			}
		});
	}

	// Chord finder section
	const finder = el("div", { className: "chord-finder" });
	finder.appendChild(el("h3", {}, "Chord Finder — What chord is this?"));
	finder.appendChild(
		el(
			"p",
			{ className: "capo-display" },
			"Enter notes (comma-separated, e.g. C,E,G):",
		),
	);

	const finderInput = document.createElement("input");
	finderInput.type = "text";
	finderInput.placeholder = "C, E, G";
	finderInput.className = "practice-input";
	finderInput.style.width = "100%";
	finderInput.style.textAlign = "left";
	finder.appendChild(finderInput);

	const finderResults = el("div", { className: "finder-results" });
	finder.appendChild(finderResults);

	finderInput.oninput = () => {
		const notes = finderInput.value
			.split(",")
			.map((n) => n.trim())
			.filter(Boolean);
		if (notes.length < 2) {
			finderResults.innerHTML = "";
			return;
		}
		const NOTE_MAP: Record<string, number> = {
			C: 0,
			"C#": 1,
			Db: 1,
			D: 2,
			"D#": 3,
			Eb: 3,
			E: 4,
			F: 5,
			"F#": 6,
			Gb: 6,
			G: 7,
			"G#": 8,
			Ab: 8,
			A: 9,
			"A#": 10,
			Bb: 10,
			B: 11,
		};
		const indices = notes
			.map((n) => NOTE_MAP[n.charAt(0).toUpperCase() + n.slice(1)] ?? -1)
			.filter((n) => n >= 0);
		const matches = findChordByNotes(indices);
		finderResults.innerHTML = "";
		for (const m of matches) {
			const item = el("div", { className: "finder-match" });
			item.innerHTML = `<span class="match-name">${m.name}</span> <span class="match-confidence">${Math.round(m.confidence * 100)}%</span>`;
			item.onclick = () => {
				chordsSignal.update((c) => [...c, { name: m.name, variationIndex: 0 }]);
				toast(`Added ${m.name}`, "success");
			};
			finderResults.appendChild(item);
		}
	};

	panel.appendChild(finder);
}

// ═══ Metronome UI ═══
function buildMetronomeUI(container: HTMLDivElement) {
	const panel = el("div", { className: "metronome-panel" });

	const bpmDisplay = el("div", {});
	const bpmValue = el(
		"div",
		{ className: "metronome-bpm" },
		String(metronomeSignal.get().bpm),
	);
	const bpmLabel = el("div", { className: "metronome-bpm-label" }, "BPM");
	bpmDisplay.appendChild(bpmValue);
	bpmDisplay.appendChild(bpmLabel);
	panel.appendChild(bpmDisplay);

	// BPM slider
	const bpmSlider = document.createElement("input");
	bpmSlider.type = "range";
	bpmSlider.min = "40";
	bpmSlider.max = "240";
	bpmSlider.value = String(metronomeSignal.get().bpm);
	bpmSlider.style.flex = "1";
	bpmSlider.style.accentColor = "var(--accent)";
	bpmSlider.oninput = () => {
		setMetronomeBpm(Number(bpmSlider.value));
		bpmValue.textContent = bpmSlider.value;
	};
	panel.appendChild(bpmSlider);

	// Time signature
	const tsSelect = document.createElement("select");
	tsSelect.className = "variation-selector";
	for (const ts of [
		"4/4",
		"3/4",
		"6/8",
		"2/4",
		"5/4",
		"7/8",
	] as TimeSignature[]) {
		const opt = document.createElement("option");
		opt.value = ts;
		opt.textContent = ts;
		tsSelect.appendChild(opt);
	}
	tsSelect.onchange = () => setTimeSignature(tsSelect.value as TimeSignature);
	panel.appendChild(tsSelect);

	// Beat indicator
	const beatIndicator = el("div", { className: "beat-indicator" });
	const beats = Number(metronomeSignal.get().timeSignature.split("/")[0]);
	for (let i = 0; i < beats; i++) {
		beatIndicator.appendChild(el("div", { className: "beat-dot" }));
	}
	panel.appendChild(beatIndicator);

	onMetronomeBeat((beat, isAccent) => {
		const dots = beatIndicator.querySelectorAll(".beat-dot");
		dots.forEach((d, i) => {
			d.classList.remove("active", "accent");
			if (i === beat) d.classList.add(isAccent ? "accent" : "active");
		});
	});

	// Tap tempo
	const tapBtn = el("button", { className: "btn" });
	tapBtn.textContent = "Tap";
	tapBtn.onclick = () => {
		const bpm = tapTempo();
		bpmSlider.value = String(bpm);
		bpmValue.textContent = String(bpm);
	};
	panel.appendChild(tapBtn);

	// Play/Stop
	const playBtn = el("button", { className: "btn btn-primary" });
	function updatePlayBtn() {
		playBtn.innerHTML = "";
		const playing = metronomeSignal.get().playing;
		playBtn.appendChild(icon(playing ? Square : Play, 14));
		playBtn.appendChild(document.createTextNode(playing ? "Stop" : "Start"));
	}
	updatePlayBtn();
	playBtn.onclick = () => {
		if (metronomeSignal.get().playing) stopMetronome();
		else startMetronome();
		updatePlayBtn();
	};
	metronomeSignal.subscribe(() => updatePlayBtn());
	panel.appendChild(playBtn);

	// Update beat dots when time signature changes
	metronomeSignal.subscribe((state) => {
		const numBeats = Number(state.timeSignature.split("/")[0]);
		beatIndicator.innerHTML = "";
		for (let i = 0; i < numBeats; i++) {
			beatIndicator.appendChild(el("div", { className: "beat-dot" }));
		}
		bpmValue.textContent = String(state.bpm);
	});

	container.appendChild(panel);
}

// ═══ Progression Panel ═══
function buildProgressionPanel(panel: HTMLDivElement) {
	panel.appendChild(el("h2", {}, "Chord Progression Builder"));

	// Key selector
	const keyBar = el("div", { className: "scale-selector" });
	keyBar.appendChild(el("label", {}, "Key:"));
	const keySelect = document.createElement("select");
	for (const k of ALL_KEYS) {
		const opt = document.createElement("option");
		opt.value = k;
		opt.textContent = k;
		if (k === "C") opt.selected = true;
		keySelect.appendChild(opt);
	}
	keyBar.appendChild(keySelect);

	const minorCheck = document.createElement("input");
	minorCheck.type = "checkbox";
	const minorLabel = el("label", { className: "fb-toggle" });
	minorLabel.appendChild(minorCheck);
	minorLabel.appendChild(document.createTextNode("Minor"));
	keyBar.appendChild(minorLabel);
	panel.appendChild(keyBar);

	// Preset progressions
	const presetBar = el("div", { className: "scale-selector" });
	presetBar.appendChild(el("label", {}, "Preset:"));
	const presetSelect = document.createElement("select");
	const emptyOpt = document.createElement("option");
	emptyOpt.value = "";
	emptyOpt.textContent = "— Select preset —";
	presetSelect.appendChild(emptyOpt);
	for (const p of PROGRESSION_PRESETS) {
		const opt = document.createElement("option");
		opt.value = p.name;
		opt.textContent = `${p.name}`;
		presetSelect.appendChild(opt);
	}
	presetSelect.onchange = () => {
		const preset = PROGRESSION_PRESETS.find(
			(p) => p.name === presetSelect.value,
		);
		if (!preset) return;
		const chords = buildProgression(
			keySelect.value,
			preset,
			minorCheck.checked,
		);
		const items: ProgressionItem[] = chords.map((c) => ({
			chordName: c,
			beats: 4,
		}));
		progressionSignal.update((p) => ({ ...p, key: keySelect.value, items }));
	};
	presetBar.appendChild(presetSelect);

	// Transpose progression
	const transpDownBtn = el("button", { className: "btn btn-icon" });
	transpDownBtn.textContent = "−";
	transpDownBtn.title = "Transpose down";
	transpDownBtn.onclick = () => {
		progressionSignal.update((p) => ({
			...p,
			items: p.items.map((i) => ({
				...i,
				chordName: transposeChord(i.chordName, -1),
			})),
		}));
	};
	presetBar.appendChild(transpDownBtn);

	const transpUpBtn = el("button", { className: "btn btn-icon" });
	transpUpBtn.textContent = "+";
	transpUpBtn.title = "Transpose up";
	transpUpBtn.onclick = () => {
		progressionSignal.update((p) => ({
			...p,
			items: p.items.map((i) => ({
				...i,
				chordName: transposeChord(i.chordName, 1),
			})),
		}));
	};
	presetBar.appendChild(transpUpBtn);
	panel.appendChild(presetBar);

	// Progression strip
	const strip = el("div", { className: "progression-strip" });
	const emptyMsg = el(
		"div",
		{ className: "progression-empty" },
		"Select a preset or drag chords here",
	);
	strip.appendChild(emptyMsg);
	panel.appendChild(strip);

	// Controls
	const controls = el("div", { className: "scale-selector" });
	const playProgBtn = el("button", { className: "btn btn-primary" });
	playProgBtn.appendChild(icon(Play, 14));
	playProgBtn.appendChild(document.createTextNode("Play"));
	playProgBtn.onclick = () => playProgression();
	controls.appendChild(playProgBtn);

	const loopProgBtn = el("button", { className: "btn" });
	loopProgBtn.appendChild(icon(Repeat, 14));
	loopProgBtn.appendChild(document.createTextNode("Loop"));
	loopProgBtn.onclick = () => {
		progressionSignal.update((p) => ({ ...p, loop: !p.loop }));
		loopProgBtn.classList.toggle("btn-primary", progressionSignal.get().loop);
	};
	controls.appendChild(loopProgBtn);

	const addAllBtn = el("button", { className: "btn" });
	addAllBtn.appendChild(icon(Plus, 14));
	addAllBtn.appendChild(document.createTextNode("Add All to Chords"));
	addAllBtn.onclick = () => {
		const prog = progressionSignal.get();
		for (const item of prog.items) {
			const existing = chordsSignal.get();
			if (!existing.some((c) => c.name === item.chordName)) {
				chordsSignal.update((c) => [
					...c,
					{ name: item.chordName, variationIndex: 0 },
				]);
			}
		}
		toast("Added progression chords", "success");
	};
	controls.appendChild(addAllBtn);

	// Roman numeral analysis
	const romanDisplay = el("div", { className: "key-detected" });
	controls.appendChild(romanDisplay);
	panel.appendChild(controls);

	function renderStrip() {
		strip.innerHTML = "";
		const prog = progressionSignal.get();
		if (prog.items.length === 0) {
			strip.appendChild(
				el(
					"div",
					{ className: "progression-empty" },
					"Select a preset or add chords",
				),
			);
			romanDisplay.textContent = "";
			return;
		}
		for (let i = 0; i < prog.items.length; i++) {
			const item = prog.items[i];
			const div = el("div", { className: "progression-item" });
			div.appendChild(el("div", { className: "chord-label" }, item.chordName));
			div.appendChild(
				el("div", { className: "beats-label" }, `${item.beats} beats`),
			);

			const removeBtn = el("button", { className: "btn btn-remove btn-icon" });
			removeBtn.textContent = "✕";
			removeBtn.onclick = () => {
				progressionSignal.update((p) => ({
					...p,
					items: p.items.filter((_, idx) => idx !== i),
				}));
			};
			div.appendChild(removeBtn);
			strip.appendChild(div);
		}

		const romanParts = prog.items.map((item) =>
			toNashvilleNumber(item.chordName, prog.key),
		);
		romanDisplay.textContent = `Analysis: ${romanParts.join(" – ")}`;
	}

	progressionSignal.subscribe(renderStrip);
	renderStrip();
}

function playProgression() {
	const prog = progressionSignal.get();
	if (prog.items.length === 0) return;
	const bpm = bpmSignal.get();
	const beatDuration = 60000 / bpm;

	let offset = 0;
	for (const item of prog.items) {
		setTimeout(() => {
			const data = getChordData(item.chordName, 0);
			if (data) playChord(data.midiNotes);
		}, offset);
		offset += item.beats * beatDuration;
	}

	if (prog.loop) {
		setTimeout(() => playProgression(), offset);
	}
}

// ═══ Songs Panel ═══
function buildSongsPanel(panel: HTMLDivElement) {
	const header = el("div", { className: "fretboard-header" });
	header.appendChild(el("h2", {}, "Songs & Setlists"));

	const newSongBtn = el("button", { className: "btn btn-primary" });
	newSongBtn.appendChild(icon(Plus, 14));
	newSongBtn.appendChild(document.createTextNode("New Song"));
	newSongBtn.onclick = () => openSongEditor();
	header.appendChild(newSongBtn);

	const newSetlistBtn = el("button", { className: "btn" });
	newSetlistBtn.appendChild(icon(ListMusic, 14));
	newSetlistBtn.appendChild(document.createTextNode("New Setlist"));
	newSetlistBtn.onclick = () => openSetlistEditor();
	header.appendChild(newSetlistBtn);

	const importBtn = el("button", { className: "btn" });
	importBtn.appendChild(icon(Upload, 14));
	importBtn.appendChild(document.createTextNode("Import ChordPro"));
	const importInput = document.createElement("input");
	importInput.type = "file";
	importInput.accept = ".cho,.chordpro,.txt";
	importInput.style.display = "none";
	importInput.onchange = () => {
		const file = importInput.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (e) => {
			const text = e.target?.result as string;
			const partial = importChordPro(text);
			const song = createSong(partial);
			addSong(song);
			toast(`Imported "${song.title}"`, "success");
			renderSongList();
		};
		reader.readAsText(file);
	};
	importBtn.onclick = () => importInput.click();
	importBtn.appendChild(importInput);
	header.appendChild(importBtn);
	panel.appendChild(header);

	// Song list
	const songList = el("div", { className: "song-list" });
	panel.appendChild(songList);

	// Setlist section
	panel.appendChild(el("h3", {}, "Setlists"));
	const setlistList = el("div", { className: "song-list" });
	panel.appendChild(setlistList);

	// Song detail view
	const songDetail = el("div", { className: "theory-panel" });
	songDetail.style.display = "none";
	panel.appendChild(songDetail);

	function renderSongList() {
		songList.innerHTML = "";
		const songs = songsSignal.get();
		if (songs.length === 0) {
			songList.appendChild(
				el(
					"p",
					{ className: "progression-empty" },
					"No songs yet — create one above",
				),
			);
			return;
		}
		for (const song of songs) {
			const card = el("div", { className: "song-card" });
			const info = el("div", { className: "song-info" });
			info.appendChild(el("div", { className: "song-title" }, song.title));
			info.appendChild(
				el(
					"div",
					{ className: "song-meta" },
					`${song.artist || "Unknown"} • Key: ${song.key} • ${song.tempo} BPM`,
				),
			);
			card.appendChild(info);

			const editBtn = el("button", { className: "btn btn-icon" });
			editBtn.appendChild(icon(Pencil, 14));
			editBtn.onclick = (e) => {
				e.stopPropagation();
				openSongEditor(song);
			};
			card.appendChild(editBtn);

			const exportBtn = el("button", { className: "btn btn-icon" });
			exportBtn.appendChild(icon(Download, 14));
			exportBtn.onclick = (e) => {
				e.stopPropagation();
				const text = exportChordPro(song);
				const blob = new Blob([text], { type: "text/plain" });
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `${song.title}.cho`;
				a.click();
				URL.revokeObjectURL(url);
				toast("Exported as ChordPro", "success");
			};
			card.appendChild(exportBtn);

			const delBtn = el("button", { className: "btn btn-icon btn-remove" });
			delBtn.appendChild(icon(Trash2, 14));
			delBtn.onclick = (e) => {
				e.stopPropagation();
				deleteSong(song.id);
			};
			card.appendChild(delBtn);

			card.onclick = () => showSongDetail(song);
			songList.appendChild(card);
		}
	}

	function renderSetlistList() {
		setlistList.innerHTML = "";
		const setlists = setlistsSignal.get();
		if (setlists.length === 0) {
			setlistList.appendChild(
				el("p", { className: "progression-empty" }, "No setlists"),
			);
			return;
		}
		for (const sl of setlists) {
			const card = el("div", { className: "song-card" });
			const info = el("div", { className: "song-info" });
			const duration = estimateSetlistDuration(sl.id);
			info.appendChild(el("div", { className: "song-title" }, sl.name));
			info.appendChild(
				el(
					"div",
					{ className: "song-meta" },
					`${sl.songIds.length} songs • ~${Math.ceil(duration)} min`,
				),
			);
			card.appendChild(info);

			const delBtn = el("button", { className: "btn btn-icon btn-remove" });
			delBtn.appendChild(icon(Trash2, 14));
			delBtn.onclick = () => deleteSetlist(sl.id);
			card.appendChild(delBtn);
			setlistList.appendChild(card);
		}
	}

	function showSongDetail(song: Song) {
		songDetail.style.display = "";
		songDetail.innerHTML = "";
		songDetail.appendChild(el("h3", {}, song.title));
		if (song.artist)
			songDetail.appendChild(
				el("p", { className: "capo-display" }, `by ${song.artist}`),
			);
		songDetail.appendChild(
			el(
				"p",
				{ className: "capo-display" },
				`Key: ${song.key} • ${song.tempo} BPM • ${song.timeSignature}`,
			),
		);

		if (song.lyrics) {
			const lyricsDiv = el("div", { className: "lyrics-display" });
			lyricsDiv.textContent = song.lyrics;
			songDetail.appendChild(lyricsDiv);
		}

		if (song.chords.length > 0) {
			const chordRow = el("div", { className: "diatonic-chords" });
			for (const c of song.chords) {
				const btn = el("button", { className: "diatonic-chord-btn" });
				btn.appendChild(el("span", { className: "chord-name" }, c.chordName));
				btn.appendChild(el("span", { className: "roman" }, `${c.beats} beats`));
				btn.onclick = () => {
					const data = getChordData(c.chordName, 0);
					if (data) playChord(data.midiNotes);
				};
				chordRow.appendChild(btn);
			}
			songDetail.appendChild(chordRow);
		}

		const closeBtn = el("button", { className: "btn" });
		closeBtn.textContent = "Close";
		closeBtn.onclick = () => {
			songDetail.style.display = "none";
		};
		songDetail.appendChild(closeBtn);
	}

	function openSongEditor(existing?: Song) {
		const overlay = el("div", { className: "modal-overlay" });
		const modal = el("div", { className: "modal" });
		modal.appendChild(el("h2", {}, existing ? "Edit Song" : "New Song"));

		const form = document.createElement("form");
		form.onsubmit = (e) => e.preventDefault();

		const fields: Record<
			string,
			HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
		> = {};

		for (const [key, label, type, def] of [
			["title", "Title", "text", existing?.title ?? ""],
			["artist", "Artist", "text", existing?.artist ?? ""],
			["key", "Key", "select", existing?.key ?? "C"],
			["tempo", "Tempo (BPM)", "number", String(existing?.tempo ?? 120)],
			[
				"timeSignature",
				"Time Signature",
				"text",
				existing?.timeSignature ?? "4/4",
			],
		] as const) {
			const group = el("div", { className: "form-group" });
			group.appendChild(el("label", {}, label));
			if (key === "key") {
				const select = document.createElement("select");
				for (const k of ALL_KEYS) {
					const opt = document.createElement("option");
					opt.value = k;
					opt.textContent = k;
					if (k === def) opt.selected = true;
					select.appendChild(opt);
				}
				fields[key] = select;
				group.appendChild(select);
			} else {
				const input = document.createElement("input");
				input.type = type;
				input.value = def;
				fields[key] = input;
				group.appendChild(input);
			}
			form.appendChild(group);
		}

		const lyricsGroup = el("div", { className: "form-group" });
		lyricsGroup.appendChild(
			el("label", {}, "Lyrics (ChordPro format: [Am]words)"),
		);
		const lyricsArea = document.createElement("textarea");
		lyricsArea.className = "lyrics-editor";
		lyricsArea.value = existing?.lyrics ?? "";
		fields.lyrics = lyricsArea;
		lyricsGroup.appendChild(lyricsArea);
		form.appendChild(lyricsGroup);

		const actions = el("div", { className: "modal-actions" });
		const cancelBtn = el("button", { className: "btn" });
		cancelBtn.textContent = "Cancel";
		cancelBtn.onclick = () => overlay.remove();
		actions.appendChild(cancelBtn);

		const saveBtn = el("button", { className: "btn btn-primary" });
		saveBtn.textContent = existing ? "Update" : "Create";
		saveBtn.onclick = () => {
			const parsed = importChordPro(
				(fields.lyrics as HTMLTextAreaElement).value,
			);
			if (existing) {
				updateSong(existing.id, {
					title: (fields.title as HTMLInputElement).value,
					artist: (fields.artist as HTMLInputElement).value,
					key: (fields.key as HTMLSelectElement).value,
					tempo: Number((fields.tempo as HTMLInputElement).value) || 120,
					timeSignature: (fields.timeSignature as HTMLInputElement).value,
					lyrics: (fields.lyrics as HTMLTextAreaElement).value,
					chords: parsed.chords ?? existing.chords,
				});
				toast("Song updated", "success");
			} else {
				const song = createSong({
					title: (fields.title as HTMLInputElement).value,
					artist: (fields.artist as HTMLInputElement).value,
					key: (fields.key as HTMLSelectElement).value,
					tempo: Number((fields.tempo as HTMLInputElement).value) || 120,
					timeSignature: (fields.timeSignature as HTMLInputElement).value,
					lyrics: (fields.lyrics as HTMLTextAreaElement).value,
					chords: parsed.chords ?? [],
				});
				addSong(song);
				toast("Song created", "success");
			}
			overlay.remove();
		};
		actions.appendChild(saveBtn);
		form.appendChild(actions);

		modal.appendChild(form);
		overlay.appendChild(modal);
		overlay.onclick = (e) => {
			if (e.target === overlay) overlay.remove();
		};
		document.body.appendChild(overlay);
		(fields.title as HTMLInputElement).focus();
	}

	function openSetlistEditor() {
		const name = prompt("Setlist name:");
		if (!name) return;
		const sl = createSetlist(name);
		addSetlist(sl);
		toast("Setlist created", "success");
	}

	songsSignal.subscribe(renderSongList);
	setlistsSignal.subscribe(renderSetlistList);
	renderSongList();
	renderSetlistList();
}

// ═══ Theory Panel ═══
function buildTheoryPanel(panel: HTMLDivElement) {
	panel.appendChild(el("h2", {}, "Music Theory"));

	// Key + scale selector
	const selRow = el("div", { className: "scale-selector" });
	selRow.appendChild(el("label", {}, "Key:"));
	const keySelect = document.createElement("select");
	for (const k of ALL_KEYS) {
		const opt = document.createElement("option");
		opt.value = k;
		opt.textContent = k;
		if (k === "C") opt.selected = true;
		keySelect.appendChild(opt);
	}
	selRow.appendChild(keySelect);

	selRow.appendChild(el("label", {}, "Scale:"));
	const scaleSelect = document.createElement("select");
	for (const s of SCALES) {
		const opt = document.createElement("option");
		opt.value = s.name;
		opt.textContent = s.name;
		scaleSelect.appendChild(opt);
	}
	selRow.appendChild(scaleSelect);
	panel.appendChild(selRow);

	// Diatonic chords
	const diatonicSection = el("div", { className: "theory-panel" });
	diatonicSection.appendChild(el("h3", {}, "Diatonic Chords"));
	const diatonicRow = el("div", { className: "diatonic-chords" });
	diatonicSection.appendChild(diatonicRow);
	panel.appendChild(diatonicSection);

	// Scale notes display
	const scaleNotesDiv = el("div", { className: "key-detected" });
	panel.appendChild(scaleNotesDiv);

	// Key detection
	const detectionSection = el("div", { className: "theory-panel" });
	detectionSection.appendChild(el("h3", {}, "Key Detection"));
	const detectionResult = el("div", { className: "key-detected" });
	detectionResult.textContent = "Add chords to detect key";
	detectionSection.appendChild(detectionResult);
	panel.appendChild(detectionSection);

	function updateTheory() {
		const key = keySelect.value;
		const scaleName = scaleSelect.value;
		const scale = SCALES.find((s) => s.name === scaleName) ?? SCALES[0];
		const isMinor =
			scaleName.toLowerCase().includes("minor") ||
			scaleName === "Dorian" ||
			scaleName === "Phrygian" ||
			scaleName === "Aeolian" ||
			scaleName === "Locrian";

		// Diatonic chords
		const chords = getDiatonicChords(key, isMinor);
		diatonicRow.innerHTML = "";
		for (const c of chords) {
			const btn = el("button", { className: "diatonic-chord-btn" });
			btn.appendChild(el("span", { className: "roman" }, c.roman));
			btn.appendChild(el("span", { className: "chord-name" }, c.chordName));
			btn.onclick = () => {
				chordsSignal.update((items) => {
					if (items.some((i) => i.name === c.chordName)) return items;
					return [...items, { name: c.chordName, variationIndex: 0 }];
				});
				toast(`Added ${c.chordName}`, "success");
			};
			diatonicRow.appendChild(btn);
		}

		// Scale notes
		const pitchClasses = getScalePitchClasses(key, scale);
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
		const scaleNotes = pitchClasses.map((pc) => NOTE_NAMES[pc]);
		scaleNotesDiv.textContent = `${key} ${scaleName}: ${scaleNotes.join(" – ")}`;

		// Key detection from current chords
		const currentChords = chordsSignal.get();
		if (currentChords.length > 0) {
			const detected = detectKey(currentChords.map((c) => c.name));
			if (detected.length > 0) {
				const top = detected[0];
				detectionResult.textContent = `Likely key: ${top.key} ${top.quality} (score: ${top.score})`;
				if (detected.length > 1) {
					const alt = detected
						.slice(1, 3)
						.map((d) => `${d.key} ${d.quality}`)
						.join(", ");
					detectionResult.textContent += ` | Also: ${alt}`;
				}
			}
		} else {
			detectionResult.textContent = "Add chords to detect key";
		}
	}

	keySelect.onchange = updateTheory;
	scaleSelect.onchange = updateTheory;
	chordsSignal.subscribe(updateTheory);
	updateTheory();
}

// ═══ Practice Panel ═══
function buildPracticePanel(panel: HTMLDivElement) {
	panel.appendChild(el("h2", {}, "Practice Tools"));

	// Streak info
	const streakInfo = el("div", { className: "theory-panel" });
	const streakText = el("div", { className: "streak-badge" });
	function updateStreak() {
		const s = streakSignal.get();
		streakText.textContent = `🔥 ${s.currentStreak} day streak • ${s.totalSessions} sessions`;
	}
	updateStreak();
	streakSignal.subscribe(updateStreak);
	streakInfo.appendChild(streakText);
	panel.appendChild(streakInfo);

	// Mode selector
	const modeBar = el("div", { className: "instrument-selector" });
	const modes: { key: PracticeMode; label: string }[] = [
		{ key: "quiz", label: "Chord Quiz" },
		{ key: "ear", label: "Ear Training" },
		{ key: "transition", label: "Transition Trainer" },
	];

	for (const mode of modes) {
		const btn = el("button", { className: "instrument-btn" });
		btn.textContent = mode.label;
		btn.onclick = () => startPractice(mode.key);
		modeBar.appendChild(btn);
	}
	panel.appendChild(modeBar);

	// Practice area
	const practiceArea = el("div", { className: "practice-panel" });
	practiceArea.appendChild(el("p", {}, "Select a practice mode above"));
	panel.appendChild(practiceArea);

	// Stats display
	const statsArea = el("div", { className: "practice-stats" });
	panel.appendChild(statsArea);

	// Mastery heatmap
	const masterySection = el("div", { className: "theory-panel" });
	masterySection.appendChild(el("h3", {}, "Mastery Heatmap"));
	const masteryGrid = el("div", { className: "mastery-grid" });
	masterySection.appendChild(masteryGrid);
	panel.appendChild(masterySection);

	function renderMastery() {
		masteryGrid.innerHTML = "";
		const data = getMasteryHeatmap();
		if (data.length === 0) {
			masteryGrid.appendChild(
				el(
					"p",
					{ className: "progression-empty" },
					"Practice chords to build mastery",
				),
			);
			return;
		}
		for (const item of data) {
			const cell = el("div", {
				className: `mastery-cell mastery-${item.level}`,
			});
			cell.textContent = item.chord;
			cell.title = `${item.chord}: Level ${item.level}/5 (${item.attempts} attempts)`;
			masteryGrid.appendChild(cell);
		}
	}

	masterySignal.subscribe(renderMastery);
	renderMastery();

	function startPractice(mode: PracticeMode) {
		recordPracticeDay();
		practiceSignal.set({
			startTime: Date.now(),
			chordsAttempted: [],
			correctCount: 0,
			totalCount: 0,
			mode,
		});

		modeBar.querySelectorAll(".instrument-btn").forEach((b, i) => {
			b.classList.toggle("active", modes[i].key === mode);
		});

		if (mode === "quiz") startQuiz();
		else if (mode === "ear") startEarTraining();
		else if (mode === "transition") startTransitionTrainer();
	}

	function updateStats() {
		const s = practiceSignal.get();
		statsArea.innerHTML = "";
		if (s.totalCount === 0) return;

		const elapsed = Math.floor((Date.now() - s.startTime) / 1000);
		const mins = Math.floor(elapsed / 60);
		const secs = elapsed % 60;

		for (const [value, label] of [
			[`${s.correctCount}/${s.totalCount}`, "Score"],
			[`${Math.round((s.correctCount / s.totalCount) * 100)}%`, "Accuracy"],
			[`${mins}:${secs.toString().padStart(2, "0")}`, "Time"],
		] as const) {
			const stat = el("div", { className: "practice-stat" });
			stat.appendChild(el("div", { className: "stat-value" }, value));
			stat.appendChild(el("div", { className: "stat-label" }, label));
			statsArea.appendChild(stat);
		}
	}

	function startQuiz() {
		practiceArea.innerHTML = "";
		const q = pickQuizChord();
		if (!q) {
			practiceArea.appendChild(el("p", {}, "No chords available for quiz"));
			return;
		}
		const question = q;

		practiceArea.appendChild(el("p", {}, "What chord is this?"));
		const questionDisplay = el("div", { className: "practice-question" }, "?");
		practiceArea.appendChild(questionDisplay);

		// Show chord diagram
		const svgDiv = el("div", { className: "svg-container" });
		const chordData = getChordData(question.chordName, 0);
		if (chordData) {
			new SVGuitarChord(svgDiv).chord(chordData.chordData).draw();
		}
		practiceArea.appendChild(svgDiv);

		const answerInput = document.createElement("input");
		answerInput.className = "practice-input";
		answerInput.placeholder = "Type chord name…";
		answerInput.setAttribute("autocomplete", "off");
		practiceArea.appendChild(answerInput);

		const submitBtn = el("button", { className: "btn btn-primary" });
		submitBtn.textContent = "Check";
		submitBtn.onclick = () => checkAnswer();
		practiceArea.appendChild(submitBtn);

		answerInput.onkeydown = (e) => {
			if (e.key === "Enter") checkAnswer();
		};
		answerInput.focus();

		function checkAnswer() {
			const answer = answerInput.value.trim();
			if (!answer) return;
			const correct = answer.toLowerCase() === question.chordName.toLowerCase();
			recordAttempt(question.chordName, correct);

			practiceSignal.update((s) => ({
				...s,
				totalCount: s.totalCount + 1,
				correctCount: s.correctCount + (correct ? 1 : 0),
				chordsAttempted: [...s.chordsAttempted, question.chordName],
			}));

			questionDisplay.textContent = question.chordName;
			questionDisplay.style.color = correct
				? "var(--success)"
				: "var(--danger)";
			toast(
				correct ? "Correct!" : `Wrong — it was ${question.chordName}`,
				correct ? "success" : "error",
			);
			updateStats();

			setTimeout(() => startQuiz(), 1500);
		}
	}

	function startEarTraining() {
		practiceArea.innerHTML = "";
		const q = pickQuizChord();
		if (!q) {
			practiceArea.appendChild(el("p", {}, "No chords available"));
			return;
		}
		const question = q;

		practiceArea.appendChild(
			el("p", {}, "Listen to the chord and identify it"),
		);

		const playBtn = el("button", { className: "btn btn-primary" });
		playBtn.appendChild(icon(Play, 14));
		playBtn.appendChild(document.createTextNode("Play Chord"));
		playBtn.onclick = () => playChord(question.midiNotes);
		practiceArea.appendChild(playBtn);

		playChord(question.midiNotes);

		const answerInput = document.createElement("input");
		answerInput.className = "practice-input";
		answerInput.placeholder = "Type chord name…";
		answerInput.setAttribute("autocomplete", "off");
		practiceArea.appendChild(answerInput);

		const submitBtn = el("button", { className: "btn btn-primary" });
		submitBtn.textContent = "Check";
		submitBtn.onclick = () => {
			const answer = answerInput.value.trim();
			if (!answer) return;
			const correct = answer.toLowerCase() === question.chordName.toLowerCase();
			recordAttempt(question.chordName, correct);
			practiceSignal.update((s) => ({
				...s,
				totalCount: s.totalCount + 1,
				correctCount: s.correctCount + (correct ? 1 : 0),
			}));
			toast(
				correct ? "Correct!" : `Wrong — it was ${question.chordName}`,
				correct ? "success" : "error",
			);
			updateStats();
			setTimeout(() => startEarTraining(), 1500);
		};
		practiceArea.appendChild(submitBtn);
		answerInput.focus();
		answerInput.onkeydown = (e) => {
			if (e.key === "Enter") submitBtn.click();
		};
	}

	function startTransitionTrainer() {
		practiceArea.innerHTML = "";
		const pair = pickTransitionPair();

		practiceArea.appendChild(el("p", {}, "Practice transitioning between:"));

		const display = el("div", { className: "practice-question" });
		display.textContent = `${pair.from} → ${pair.to}`;
		practiceArea.appendChild(display);

		// Show both chord diagrams side by side
		const diagrams = el("div", { className: "diatonic-chords" });
		for (const name of [pair.from, pair.to]) {
			const card = el("div", { className: "chord" });
			card.appendChild(el("span", { className: "chord-name" }, name));
			const svgDiv = el("div", { className: "svg-container" });
			const data = getChordData(name, 0);
			if (data) new SVGuitarChord(svgDiv).chord(data.chordData).draw();
			card.appendChild(svgDiv);
			diagrams.appendChild(card);
		}
		practiceArea.appendChild(diagrams);

		const nextBtn = el("button", { className: "btn btn-primary" });
		nextBtn.textContent = "Next Pair";
		nextBtn.onclick = () => startTransitionTrainer();
		practiceArea.appendChild(nextBtn);

		practiceSignal.update((s) => ({
			...s,
			totalCount: s.totalCount + 1,
			correctCount: s.correctCount + 1,
		}));
		updateStats();
	}
}

// ═══ Share Panel ═══
function buildSharePanel(panel: HTMLDivElement) {
	panel.appendChild(el("h2", {}, "Share & Export"));

	// URL sharing
	const shareSection = el("div", { className: "theory-panel" });
	shareSection.appendChild(el("h3", {}, "Share via URL"));
	const shareUrlBox = el("div", { className: "share-url-box" });
	const shareInput = document.createElement("input");
	shareInput.className = "share-url-input";
	shareInput.readOnly = true;
	shareUrlBox.appendChild(shareInput);

	const generateBtn = el("button", { className: "btn" });
	generateBtn.appendChild(icon(Share2, 14));
	generateBtn.appendChild(document.createTextNode("Generate"));
	generateBtn.onclick = () => {
		const url = encodeShareUrl(chordsSignal.get());
		shareInput.value = url;
	};
	shareUrlBox.appendChild(generateBtn);

	const copyUrlBtn = el("button", { className: "btn" });
	copyUrlBtn.appendChild(icon(Copy, 14));
	copyUrlBtn.onclick = () => {
		navigator.clipboard.writeText(shareInput.value);
		toast("URL copied", "success");
	};
	shareUrlBox.appendChild(copyUrlBtn);
	shareSection.appendChild(shareUrlBox);

	// QR code
	const qrContainer = el("div", {});
	const qrBtn = el("button", { className: "btn" });
	qrBtn.textContent = "Generate QR Code";
	qrBtn.onclick = () => {
		qrContainer.innerHTML = "";
		const url = shareInput.value || encodeShareUrl(chordsSignal.get());
		shareInput.value = url;
		const qr = generateQRCodeSvg(url);
		qrContainer.appendChild(qr);
	};
	shareSection.appendChild(qrBtn);
	shareSection.appendChild(qrContainer);
	panel.appendChild(shareSection);

	// Export section
	const exportSection = el("div", { className: "theory-panel" });
	exportSection.appendChild(el("h3", {}, "Export"));

	const exportRow = el("div", { className: "scale-selector" });

	const pdfBtn = el("button", { className: "btn" });
	pdfBtn.appendChild(icon(FileText, 14));
	pdfBtn.appendChild(document.createTextNode("Print / PDF"));
	pdfBtn.onclick = () => {
		const container = document.getElementById("chord-container");
		if (container) exportPDF("Guitar Chords", container);
	};
	exportRow.appendChild(pdfBtn);

	const pngBtn = el("button", { className: "btn" });
	pngBtn.appendChild(icon(Download, 14));
	pngBtn.appendChild(document.createTextNode("Export PNG"));
	pngBtn.onclick = () => {
		const container = document.getElementById("chord-container");
		if (container) exportPNG(container);
	};
	exportRow.appendChild(pngBtn);

	const jsonBtn = el("button", { className: "btn" });
	jsonBtn.appendChild(icon(Download, 14));
	jsonBtn.appendChild(document.createTextNode("Export JSON"));
	jsonBtn.onclick = () => {
		const data = JSON.stringify(chordsSignal.get(), null, 2);
		const blob = new Blob([data], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "chords.json";
		a.click();
		URL.revokeObjectURL(url);
		toast("Exported JSON", "success");
	};
	exportRow.appendChild(jsonBtn);

	const svgCopyBtn = el("button", { className: "btn" });
	svgCopyBtn.appendChild(icon(Copy, 14));
	svgCopyBtn.appendChild(document.createTextNode("Copy SVG"));
	svgCopyBtn.onclick = async () => {
		const container = document.getElementById("chord-container");
		const firstSvg = container?.querySelector("svg");
		if (firstSvg) {
			const ok = await copySvgToClipboard(firstSvg as SVGSVGElement);
			toast(
				ok ? "SVG copied to clipboard" : "Failed to copy",
				ok ? "success" : "error",
			);
		} else {
			toast("No chord diagram to copy", "error");
		}
	};
	exportRow.appendChild(svgCopyBtn);

	exportSection.appendChild(exportRow);
	panel.appendChild(exportSection);
}

function createChordCard(chordItem: ChordItem, index: number): HTMLDivElement {
	const card = el("div", { className: "chord chord-enter" });
	card.setAttribute("role", "listitem");
	card.setAttribute("tabindex", "0");
	card.setAttribute("aria-label", `Chord ${chordItem.name}`);
	card.setAttribute("draggable", "true");
	card.dataset.index = String(index);

	// Trigger enter animation
	requestAnimationFrame(() => card.classList.remove("chord-enter"));

	// ── Drag handle ──
	const dragHandle = el("span", { className: "drag-handle" });
	dragHandle.setAttribute("aria-hidden", "true");
	dragHandle.appendChild(icon(GripVertical, 16));

	// ── Top row ──
	const topRow = el("div", { className: "chord-top-row" });
	topRow.appendChild(dragHandle);

	const chordTitle = el("span", { className: "chord-name" }, chordItem.name);
	topRow.appendChild(chordTitle);

	const topActions = el("div", { className: "chord-top-actions" });

	// Move up/down buttons (keyboard alternative to drag)
	if (index > 0) {
		const moveUpBtn = el("button", { className: "btn btn-remove btn-icon" });
		moveUpBtn.title = "Move up";
		moveUpBtn.setAttribute("aria-label", `Move ${chordItem.name} up`);
		moveUpBtn.textContent = "↑";
		moveUpBtn.onclick = () => {
			chordsSignal.update((c) => {
				const arr = [...c];
				[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
				return arr;
			});
			announce(`${chordItem.name} moved up`);
		};
		topActions.appendChild(moveUpBtn);
	}
	if (index < chordsSignal.get().length - 1) {
		const moveDownBtn = el("button", {
			className: "btn btn-remove btn-icon",
		});
		moveDownBtn.title = "Move down";
		moveDownBtn.setAttribute("aria-label", `Move ${chordItem.name} down`);
		moveDownBtn.textContent = "↓";
		moveDownBtn.onclick = () => {
			chordsSignal.update((c) => {
				const arr = [...c];
				[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
				return arr;
			});
			announce(`${chordItem.name} moved down`);
		};
		topActions.appendChild(moveDownBtn);
	}

	const replaceBtn = el("button", { className: "btn btn-remove btn-icon" });
	replaceBtn.title = "Replace chord";
	replaceBtn.setAttribute("aria-label", `Replace ${chordItem.name}`);
	replaceBtn.appendChild(icon(Pencil, 14));
	topActions.appendChild(replaceBtn);

	const removeBtn = el("button", { className: "btn btn-remove btn-icon" });
	removeBtn.setAttribute("aria-label", `Remove ${chordItem.name}`);
	removeBtn.appendChild(icon(X, 16));
	removeBtn.onclick = () => {
		card.classList.add("chord-exit");
		card.addEventListener(
			"animationend",
			() => {
				chordsSignal.update((c) =>
					c.filter((item) => item.name !== chordItem.name),
				);
				announce(`${chordItem.name} removed`);
				toast(`Removed ${chordItem.name}`, "info");
			},
			{ once: true },
		);
	};
	topActions.appendChild(removeBtn);

	topRow.appendChild(topActions);
	card.appendChild(topRow);

	// ── Controls ──
	const controls = el("div", { className: "chord-controls" });
	const variationSelector = document.createElement("select");
	variationSelector.className = "variation-selector";
	variationSelector.setAttribute(
		"aria-label",
		`Variation for ${chordItem.name}`,
	);
	controls.appendChild(variationSelector);

	const playBtn = el("button", { className: "btn btn-play" });
	playBtn.setAttribute("aria-label", `Play ${chordItem.name}`);
	playBtn.appendChild(icon(Play, 14));
	playBtn.appendChild(document.createTextNode("Play"));
	controls.appendChild(playBtn);
	card.appendChild(controls);

	// ── SVG container (with skeleton) ──
	const svgContainer = el("div", { className: "svg-container" });
	const skeleton = el("div", { className: "skeleton-chord" });
	svgContainer.appendChild(skeleton);
	card.appendChild(svgContainer);

	// ── Populate data ──
	const chordResult = getChordData(chordItem.name, chordItem.variationIndex);
	if (chordResult) {
		const { chordData, totalVariations, midiNotes } = chordResult;

		variationSelector.innerHTML = "";
		for (let i = 0; i < totalVariations; i++) {
			const option = document.createElement("option");
			option.value = i.toString();
			option.textContent = `Variation ${i + 1}`;
			if (i === chordItem.variationIndex) option.selected = true;
			variationSelector.appendChild(option);
		}

		variationSelector.addEventListener("change", (event) => {
			const newIndex = Number.parseInt(
				(event.target as HTMLSelectElement).value,
				10,
			);
			chordsSignal.update((c) =>
				c.map((item) =>
					item.name === chordItem.name
						? { ...item, variationIndex: newIndex }
						: item,
				),
			);
		});

		playBtn.onclick = () => playChord(midiNotes);

		// Remove skeleton, draw chord
		skeleton.remove();
		new SVGuitarChord(svgContainer).chord(chordData).draw();
	} else {
		skeleton.remove();
		svgContainer.textContent = "Chord not found";
	}

	// Replace mode
	replaceBtn.onclick = () => enterReplaceMode(chordItem, chordTitle, topRow);

	// ── Drag & Drop ──
	card.addEventListener("dragstart", (e) => {
		dragSrcIndex = index;
		card.classList.add("dragging");
		e.dataTransfer?.setData("text/plain", String(index));
	});
	card.addEventListener("dragend", () => card.classList.remove("dragging"));
	card.addEventListener("dragover", (e) => {
		e.preventDefault();
		card.classList.add("drag-over");
	});
	card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
	card.addEventListener("drop", (e) => {
		e.preventDefault();
		card.classList.remove("drag-over");
		const from = dragSrcIndex;
		const to = index;
		if (from !== to && from >= 0) {
			chordsSignal.update((c) => {
				const arr = [...c];
				const [item] = arr.splice(from, 1);
				arr.splice(to, 0, item);
				return arr;
			});
			announce(`Chord moved`);
		}
	});

	// ── Touch swipe to remove ──
	let touchStartX = 0;
	let touchDeltaX = 0;
	card.addEventListener(
		"touchstart",
		(e) => {
			touchStartX = e.touches[0].clientX;
			touchDeltaX = 0;
		},
		{ passive: true },
	);
	card.addEventListener(
		"touchmove",
		(e) => {
			touchDeltaX = e.touches[0].clientX - touchStartX;
			if (Math.abs(touchDeltaX) > 10) {
				card.style.transform = `translateX(${touchDeltaX}px)`;
				card.style.opacity = String(
					Math.max(0, 1 - Math.abs(touchDeltaX) / 200),
				);
			}
		},
		{ passive: true },
	);
	card.addEventListener("touchend", () => {
		if (Math.abs(touchDeltaX) > 100) {
			card.classList.add("chord-exit");
			card.addEventListener(
				"animationend",
				() => {
					chordsSignal.update((c) =>
						c.filter((item) => item.name !== chordItem.name),
					);
					announce(`${chordItem.name} removed`);
					toast(`Removed ${chordItem.name}`, "info");
				},
				{ once: true },
			);
		} else {
			card.style.transform = "";
			card.style.opacity = "";
		}
	});

	// Keyboard actions on the card
	card.addEventListener("keydown", (e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			playBtn.click();
		} else if (e.key === "Delete" || e.key === "Backspace") {
			e.preventDefault();
			removeBtn.click();
		}
	});

	return card;
}

function enterReplaceMode(
	chordItem: ChordItem,
	chordTitle: HTMLSpanElement,
	topRow: HTMLDivElement,
) {
	chordTitle.style.display = "none";
	const actions = topRow.querySelector(".chord-top-actions") as HTMLElement;
	if (actions) actions.style.display = "none";
	const handle = topRow.querySelector(".drag-handle") as HTMLElement;
	if (handle) handle.style.display = "none";

	const replaceWrapper = el("div", { className: "replace-wrapper" });

	const replaceInput = document.createElement("input");
	replaceInput.type = "text";
	replaceInput.className = "replace-input";
	replaceInput.placeholder = "Replace with…";
	replaceInput.setAttribute("autocomplete", "off");
	replaceInput.setAttribute("aria-label", `Replace ${chordItem.name} with`);
	replaceWrapper.appendChild(replaceInput);

	const replaceDropdown = el("div", { className: "autocomplete-list" });
	replaceDropdown.setAttribute("role", "listbox");
	replaceWrapper.appendChild(replaceDropdown);

	const cancelBtn = el("button", { className: "btn btn-remove btn-icon" });
	cancelBtn.setAttribute("aria-label", "Cancel replace");
	cancelBtn.appendChild(icon(X, 14));
	replaceWrapper.appendChild(cancelBtn);

	topRow.insertBefore(replaceWrapper, topRow.firstChild);
	replaceInput.focus();

	let replaceActiveIndex = -1;

	function showReplaceDropdown() {
		const matches = filterChordNames(replaceInput.value.trim());
		renderAutocompleteItems(replaceDropdown, matches, commitReplace);
	}

	function commitReplace(newName: string) {
		if (newName && getChordData(newName, 0)) {
			chordsSignal.update((c) =>
				c.map((item) =>
					item.name === chordItem.name
						? { name: newName, variationIndex: 0 }
						: item,
				),
			);
			announce(`Replaced with ${newName}`);
			toast(`Replaced with ${newName}`, "success");
		}
	}

	function exitReplaceMode() {
		replaceWrapper.remove();
		chordTitle.style.display = "";
		if (actions) actions.style.display = "";
		if (handle) handle.style.display = "";
	}

	replaceInput.addEventListener("input", showReplaceDropdown);
	replaceInput.addEventListener("focus", showReplaceDropdown);
	replaceInput.addEventListener("blur", () => {
		setTimeout(() => replaceDropdown.classList.remove("visible"), 120);
	});

	setupAutocompleteKeyboard(
		replaceInput,
		replaceDropdown,
		() => replaceActiveIndex,
		(i) => {
			replaceActiveIndex = i;
		},
		commitReplace,
		exitReplaceMode,
		showReplaceDropdown,
	);

	cancelBtn.onclick = exitReplaceMode;
}
