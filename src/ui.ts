/** UI module — builds and manages the entire DOM */
import {
	Download,
	GripVertical,
	Moon,
	Music,
	Pencil,
	Play,
	Plus,
	Sun,
	Upload,
	X,
} from "lucide";
import { SVGuitarChord } from "svguitar";
import { playChord, resumeAudio } from "./audio";
import { filterChordNames, getChordData } from "./chords";
import { type ChordItem, chordsSignal, themeSignal } from "./state";
import { toast } from "./toast";
import { assert, el, icon } from "./utils";

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

	const app = document.getElementById("app");
	assert(app, "Root element not found");

	const container = el("div", { className: "container" });

	// ── Header ──
	const header = el("div", { className: "app-header" });
	header.appendChild(icon(Music, 28));
	header.appendChild(el("h1", {}, "Chord Viewer"));

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
		(_name) => {
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

	// Add button
	const addChordBtn = el("button", { className: "btn btn-primary" });
	addChordBtn.setAttribute("aria-label", "Add chord");
	addChordBtn.appendChild(icon(Plus, 16));
	addChordBtn.appendChild(document.createTextNode("Add"));
	addChordBtn.addEventListener("click", addChord);
	toolbar.appendChild(addChordBtn);

	// Save JSON button
	const saveJsonBtn = el("button", { className: "btn" });
	saveJsonBtn.setAttribute("aria-label", "Save chords as JSON file");
	saveJsonBtn.appendChild(icon(Download, 16));
	saveJsonBtn.appendChild(document.createTextNode("Save"));
	saveJsonBtn.addEventListener("click", saveToFile);
	toolbar.appendChild(saveJsonBtn);

	// Load JSON
	const loadLabel = document.createElement("label");
	loadLabel.className = "file-label";
	loadLabel.setAttribute("role", "button");
	loadLabel.setAttribute("tabindex", "0");
	loadLabel.setAttribute("aria-label", "Load chords from JSON file");
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
	loadLabel.addEventListener("keydown", (e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			fileInput.click();
		}
	});
	toolbar.appendChild(loadLabel);

	container.appendChild(toolbar);

	// ── Chord Container ──
	const chordContainer = el("div", {
		className: "chord-container",
		id: "chord-container",
	});
	chordContainer.setAttribute("role", "list");
	chordContainer.setAttribute("aria-label", "Chord cards");
	container.appendChild(chordContainer);

	app.appendChild(container);

	// ─── Render chords reactively ───
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
			const chordItem = items[idx];
			const card = createChordCard(chordItem, idx);
			chordContainer.appendChild(card);
		}
	}

	function createChordCard(
		chordItem: ChordItem,
		index: number,
	): HTMLDivElement {
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
		card.addEventListener("dragleave", () =>
			card.classList.remove("drag-over"),
		);
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

	// ─── Actions ──────────────────────────────────
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

	interface LoadFileEvent extends Event {
		target: HTMLInputElement;
	}

	function loadFile(event: LoadFileEvent | null) {
		const file = event?.target?.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const result = e.target?.result;
				assert(result, "File reader result is null");
				const loadedChords: ChordItem[] = JSON.parse(result as string);
				if (!Array.isArray(loadedChords)) throw new Error("Invalid format");
				chordsSignal.set(loadedChords);
				toast("Chords loaded from file", "success");
				announce("Chords loaded");
			} catch {
				toast("Invalid JSON file", "error");
			}
		};
		reader.readAsText(file);
	}

	// Subscribe to state changes
	chordsSignal.subscribe(renderChords);

	// Initial render
	renderChords();
}
