// src/index.ts

import { chords as untypedChords } from "@tombatossals/chords-db/lib/guitar.json";
// Import necessary modules
import { type Finger, SVGuitarChord } from "svguitar";

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
console.log("CHORDS", chords);
render();

async function render() {
	await App();
}

async function App() {
	// Application State
	let chordNames: string[] = [];
  window.addEventListener('beforeunload', saveState)

	// Get reference to the root element
	const app = document.getElementById("app");
	assert(app, "Root element not found");

	// Create Elements Dynamically

	// Container for the application
	const container = document.createElement("div");
	container.className = "container";

	// Heading
	const heading = document.createElement("h1");
	heading.textContent = "Chord Viewer";
	container.appendChild(heading);

	// Input field for chord name
	const chordInput = document.createElement("input");
	chordInput.type = "text";
	chordInput.id = "chord-input";
	chordInput.placeholder = "Enter chord name (e.g., C, G, Am)";
	container.appendChild(chordInput);

	// Add Chord Button
	const addChordBtn = document.createElement("button");
	addChordBtn.id = "add-chord-btn";
	addChordBtn.textContent = "Add Chord";
	container.appendChild(addChordBtn);

	// Save JSON Button
	const saveJsonBtn = document.createElement("button");
	saveJsonBtn.id = "save-json-btn";
	saveJsonBtn.textContent = "Save State as JSON";
	container.appendChild(saveJsonBtn);

	// Load JSON Input
	const loadJsonInput = document.createElement("input");
	loadJsonInput.type = "file";
	loadJsonInput.id = "load-json-input";
	loadJsonInput.accept = ".json";
	container.appendChild(loadJsonInput);

	// Chord Container
	const chordContainer = document.createElement("div");
	chordContainer.id = "chord-container";
	chordContainer.className = "chord-container";
	container.appendChild(chordContainer);

	// Append the container to the app root
	app.appendChild(container);

	// Template for Chord Element
	function createChordElement(chordName: string) {
		const chordElement = document.createElement("div");
		chordElement.className = "chord";

		const removeBtn = document.createElement("button");
		removeBtn.textContent = "X";
		removeBtn.onclick = () => {
			chordNames = chordNames.filter((name) => name !== chordName);
			renderChords();
			saveState();
		};
		chordElement.appendChild(removeBtn);

		const chordTitle = document.createElement("p");
		chordTitle.className = "chord-name";
		chordTitle.textContent = chordName;
		chordElement.appendChild(chordTitle);

		const svgContainer = document.createElement("div");
		svgContainer.className = "svg-container";
		chordElement.appendChild(svgContainer);

		return { chordElement, svgContainer };
	}

	function getChordData(chordName: string) {
    // Parse the chord name into root note and suffix
    const match = chordName.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return null;

    const [, root, suffix] = match;

    // Default to 'major' if no suffix is provided
    const chordType = suffix || "major";

    console.log("Getting chord data for", { root, chordType, chords });
    // Retrieve chord variations
    const chordList = chords[root as keyof Chords];
    if (!chordList || chordList.length === 0) return null;

    // Find the chord with the matching suffix
    const chord = chordList.find(
      (c) => c.suffix.toLowerCase() === chordType.toLowerCase()
    );
    if (!chord) return null;

    // Use the first position variation
    const position = chord.positions[0];
    if (!position) return null;

    // Now map the position data to the format expected by svguitar
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
      toString: 1,   // To high E string
      fret: barreFret,
    }));

    const chordData = {
      fingers,
      position: baseFret === 1 ? 0 : baseFret - 1, // Adjust position for svguitar
      barres,
      mutedStrings,
    };

    return chordData;
  }


	// Function to render chords
	function renderChords() {
		chordContainer.innerHTML = ""; // Clear existing chords
		for (const chordName of chordNames) {
			console.log("Rendering chord:", chordName);
			const { chordElement, svgContainer } = createChordElement(chordName);
			chordContainer.appendChild(chordElement);

			// Get chord data from the chord library
			const chordData = getChordData(chordName);

			if (chordData) {
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

	// Function to save state to localStorage
	function saveState() {
		console.log("Saving state to localStorage", chordNames);
		localStorage.setItem("guitar-chords-state", JSON.stringify(chordNames));
	}

	// Function to load state from localStorage
	function loadState() {
		const savedChords = localStorage.getItem("guitar-chords-state");
		if (savedChords) {
			chordNames = JSON.parse(savedChords);
			console.log("Loading state from localStorage", chordNames);
			renderChords();
		}
	}

	// Event listener for adding chords
	addChordBtn.addEventListener("click", () => {
		const chordName = chordInput.value.trim();
		if (chordName && !chordNames.includes(chordName)) {
			chordNames.push(chordName);
			chordInput.value = "";
			renderChords();
			saveState();
		}
	});

	// Event listener for saving state as JSON
	saveJsonBtn.addEventListener("click", () => {
		const dataStr = JSON.stringify(chordNames, null, 2);
		const blob = new Blob([dataStr], { type: "application/json" });
		const url = URL.createObjectURL(blob);

		const a = document.createElement("a");
		a.href = url;
		a.download = "chords.json";
		a.click();
		URL.revokeObjectURL(url);
	});

	// Event listener for loading state from JSON file
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	loadJsonInput.addEventListener("change", loadFile as any);

	async function loadFile(event: LoadFileEvent | null) {
		const file = event?.target?.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const result = e.target?.result;
				assert(result, "File reader result is null");
				const loadedChords = JSON.parse(result as string);
				chordNames = loadedChords;
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
