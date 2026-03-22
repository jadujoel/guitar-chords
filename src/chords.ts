/** Chord data access, parsing, normalization */
import { chords as untypedChords } from "@tombatossals/chords-db/lib/guitar.json";
import type { Finger } from "svguitar";

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

/** Build flat list of all chord names for autocomplete */
export const allChordNames: string[] = [];
for (const [root, chordList] of Object.entries(chords)) {
	const displayRoot = root.replace("sharp", "#");
	for (const chord of chordList) {
		const name =
			chord.suffix === "major" ? displayRoot : `${displayRoot}${chord.suffix}`;
		allChordNames.push(name);
	}
}

export function normalizeRootNote(note: string): string {
	const noteMap: Record<string, string> = {
		c: "C",
		d: "D",
		e: "E",
		f: "F",
		g: "G",
		a: "A",
		b: "B",
		"c#": "Csharp",
		"d#": "Eb",
		"e#": "F",
		"f#": "Fsharp",
		"g#": "Ab",
		"a#": "Bb",
		"b#": "C",
		cb: "B",
		db: "Csharp",
		eb: "Eb",
		fb: "E",
		gb: "Fsharp",
		ab: "Ab",
		bb: "Bb",
	};
	return (
		noteMap[note.toLowerCase()] || note.charAt(0).toUpperCase() + note.slice(1)
	);
}

const suffixMap: Record<string, string> = {
	"": "major",
	m: "minor",
	"7": "7",
	maj7: "maj7",
	min7: "min7",
	dim: "dim",
	aug: "aug",
};

export interface ChordRenderData {
	chordData: {
		fingers: Finger[];
		position: number;
		barres: { fromString: number; toString: number; fret: number }[];
		mutedStrings: number[];
	};
	totalVariations: number;
	midiNotes: number[];
}

export function getChordData(
	chordName: string,
	variationIndex: number,
): ChordRenderData | null {
	const match = chordName.match(/^([A-Ga-g][#b]?)(.*)$/);
	if (!match) return null;

	let [, root, suffix] = match;
	root = normalizeRootNote(root);
	const normalizedSuffix = suffixMap[suffix.toLowerCase()] || suffix;

	const chordList = chords[root];
	if (!chordList || chordList.length === 0) return null;

	const chord = chordList.find(
		(c) => c.suffix.toLowerCase() === normalizedSuffix.toLowerCase(),
	);
	if (!chord) return null;

	const position = chord.positions[variationIndex];
	if (!position) return null;

	const midiNotes = position.midi;
	const fingers: Finger[] = [];
	const mutedStrings: number[] = [];
	const baseFret = position.baseFret;

	position.frets.forEach((fret, index) => {
		const string = 6 - index;
		if (fret === -1) {
			mutedStrings.push(string);
		} else if (fret > 0) {
			fingers.push([
				string,
				fret,
				position.fingers[index] > 0
					? position.fingers[index].toString()
					: undefined,
			]);
		}
	});

	const barres = position.barres.map((barreFret) => ({
		fromString: 6,
		toString: 1,
		fret: barreFret,
	}));

	return {
		chordData: {
			fingers,
			position: baseFret === 1 ? 0 : baseFret - 1,
			barres,
			mutedStrings,
		},
		totalVariations: chord.positions.length,
		midiNotes,
	};
}

/** Filter chord names for autocomplete */
export function filterChordNames(query: string, limit = 50): string[] {
	const q = query.toLowerCase();
	return q
		? allChordNames.filter((n) => n.toLowerCase().includes(q)).slice(0, limit)
		: allChordNames.slice(0, limit);
}
