// src/index.js

// Import necessary modules
import { SVGuitarChord, type Finger } from 'svguitar';

render()

async function render() {
  await App()
}

type Chords = SVGuitarChord[];
interface ChordDiagram {
  [key: string]: {
    fingers: MFinger[]
    position: number;
    barres: { fromString: number; toString: number; fret: number }[];
    mutedStrings: number[];
  }
}

type MFinger = [string: number, fret: number, info: string];

interface LoadFileEvent extends Event {
  target: HTMLInputElement;
}

async function App() {
  // Application State
  let chordNames: string[] = [];

  // Define chord data
  const chordDiagrams: ChordDiagram = {
    'C': {
      fingers: [
        [5, 3, "3"],
        [4, 2, "2"],
        [3, 1, "1"],
      ],
      position: 0,
      barres: [],
      mutedStrings: [6],
    },
    'G': {
      fingers: [
        [6, 3, "2"],
        [5, 2, "1"],
        [1, 3, "3"],
      ],
      position: 0,
      barres: [],
      mutedStrings: [],
    },
    // Add more chords here
  };

  // Get reference to the root element
  const app = document.getElementById('app');
  assert(app, 'Root element not found');

  // Create Elements Dynamically

  // Container for the application
  const container = document.createElement('div');
  container.className = 'container';

  // Heading
  const heading = document.createElement('h1');
  heading.textContent = 'Chord Viewer';
  container.appendChild(heading);

  // Input field for chord name
  const chordInput = document.createElement('input');
  chordInput.type = 'text';
  chordInput.id = 'chord-input';
  chordInput.placeholder = 'Enter chord name';
  container.appendChild(chordInput);

  // Add Chord Button
  const addChordBtn = document.createElement('button');
  addChordBtn.id = 'add-chord-btn';
  addChordBtn.textContent = 'Add Chord';
  container.appendChild(addChordBtn);

  // Save JSON Button
  const saveJsonBtn = document.createElement('button');
  saveJsonBtn.id = 'save-json-btn';
  saveJsonBtn.textContent = 'Save State as JSON';
  container.appendChild(saveJsonBtn);

  // Load JSON Input
  const loadJsonInput = document.createElement('input');
  loadJsonInput.type = 'file';
  loadJsonInput.id = 'load-json-input';
  loadJsonInput.accept = '.json';
  container.appendChild(loadJsonInput);

  // Chord Container
  const chordContainer = document.createElement('div');
  chordContainer.id = 'chord-container';
  chordContainer.className = 'chord-container';
  container.appendChild(chordContainer);

  // Append the container to the app root
  app.appendChild(container);

  // Template for Chord Element (created using a function)
  function createChordElement(chordName: string) {
    const chordElement = document.createElement('div');
    chordElement.className = 'chord';

    const removeBtn = document.createElement('button');
      removeBtn.textContent = 'X';
      removeBtn.onclick = () => {
        chordNames = chordNames.filter((name) => name !== chordName);
        renderChords();
        saveState();
      }
    chordElement.appendChild(removeBtn);


    const chordTitle = document.createElement('p');
    chordTitle.className = 'chord-name';
    chordTitle.textContent = chordName;
    chordElement.appendChild(chordTitle);

    const svgContainer = document.createElement('div');
    svgContainer.className = 'svg-container';
    chordElement.appendChild(svgContainer);

    return { chordElement, svgContainer };
  }

  // Function to render chords
  function renderChords() {
    chordContainer.innerHTML = ''; // Clear existing chords
    for (const chordName of chordNames) {
      console.log('Rendering chord:', chordName);
      const { chordElement, svgContainer } = createChordElement(chordName);
      chordContainer.appendChild(chordElement);

      // Get chord data from the chordDiagrams object
      const chordData = chordDiagrams[chordName as keyof typeof chordDiagrams];

      if (chordData) {
        const { width, height } = new SVGuitarChord(svgContainer)
          .configure({
            // Global configurations (optional)
          })
          .chord(chordData)
          .draw();
      } else {
        svgContainer.textContent = 'Chord not found';
      }
    };
  }

  // Function to save state to localStorage
  function saveState() {
    console.log('Saving state to localStorage', chordNames);
    localStorage.setItem('guitar-chords-state', JSON.stringify(chordNames));
  }

  // Function to load state from localStorage
  function loadState() {
    const savedChords = localStorage.getItem('guitar-chords-state');
    if (savedChords) {
      chordNames = JSON.parse(savedChords);
      console.log('Loading state from localStorage', chordNames);
      renderChords();
    }
  }

  // Event listener for adding chords
  addChordBtn.addEventListener('click', () => {
    const chordName = chordInput.value.trim();
    if (chordName && !chordNames.includes(chordName)) {
      chordNames.push(chordName);
      chordInput.value = '';
      renderChords();
      saveState();
    }
  });

  // Event listener for saving state as JSON
  saveJsonBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify(chordNames, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'chords.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Event listener for loading state from JSON file
  loadJsonInput.addEventListener('change', loadFile as any);


  async function loadFile(event: LoadFileEvent | null) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        assert(result, 'File reader result is null');
        const loadedChords = JSON.parse(result as string);
        chordNames = loadedChords;
        renderChords();
        saveState();
      } catch (err) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }
  loadState()
  return container;
}

function assert(thing: unknown, message = 'Assertion failed'): asserts thing {
  if (!thing) {
    throw new Error(message);
  }
}
