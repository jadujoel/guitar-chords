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

// ─── Recommended variation logic ─────────────────────────────
// Standard tuning open-string MIDI values: E2, A2, D3, G3, B3, E4
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];

/** Map database root keys to pitch classes (0-11) */
const ROOT_PITCH_CLASS: Record<string, number> = {
	C: 0,
	Csharp: 1,
	D: 2,
	Eb: 3,
	E: 4,
	F: 5,
	Fsharp: 6,
	G: 7,
	Ab: 8,
	A: 9,
	Bb: 10,
	B: 11,
};

/** Suffixes that imply a minor 3rd */
const MINOR_SUFFIXES = new Set([
	"minor",
	"dim",
	"dim7",
	"m6",
	"m69",
	"m7",
	"m7b5",
	"m9",
	"m11",
	"mmaj7",
	"mmaj7b5",
	"mmaj9",
	"mmaj11",
	"madd9",
]);

/**
 * Get the forbidden pitch classes (2nd and 3rd scale degrees) for a chord.
 * 2nd step = root + 2 semitones (whole step, same for major/minor).
 * 3rd step = root + 4 (major) or root + 3 (minor).
 */
function getForbiddenBassNotes(rootPc: number, suffix: string): Set<number> {
	const second = (rootPc + 2) % 12;
	const isMinor = MINOR_SUFFIXES.has(suffix.toLowerCase());
	const third = (rootPc + (isMinor ? 3 : 4)) % 12;
	return new Set([second, third]);
}

/**
 * Check if a variation follows the bass-string rule:
 * strings 6, 5, 4 (frets indices 0, 1, 2) must not contain the 2nd or 3rd
 * scale degrees. Exception: C major and G major are exempt.
 */
function passesBassStringRule(
	root: string,
	suffix: string,
	position: Position,
): boolean {
	if ((root === "C" || root === "G") && suffix.toLowerCase() === "major") {
		return true;
	}

	const rootPc = ROOT_PITCH_CLASS[root];
	if (rootPc === undefined) return true; // unknown root, skip rule

	const forbidden = getForbiddenBassNotes(rootPc, suffix);

	// Check strings 6, 5, 4 (indices 0, 1, 2)
	for (let i = 0; i < 3; i++) {
		const fret = position.frets[i];
		if (fret === -1) continue; // muted is fine
		const midi = OPEN_STRING_MIDI[i] + fret + (position.baseFret - 1);
		const pitchClass = midi % 12;
		if (forbidden.has(pitchClass)) return false;
	}
	return true;
}

/**
 * Get the recommended (best-sounding) variation index for a chord.
 * Picks the first variation that passes the bass-string rule,
 * or falls back to 0.
 */
export function getRecommendedVariation(chordName: string): number {
	const match = chordName.match(/^([A-Ga-g][#b]?)(.*)$/);
	if (!match) return 0;

	let [, root, suffix] = match;
	root = normalizeRootNote(root);
	const normalizedSuffix = suffixMap[suffix.toLowerCase()] || suffix;

	const chordList = chords[root];
	if (!chordList || chordList.length === 0) return 0;

	const chord = chordList.find(
		(c) => c.suffix.toLowerCase() === normalizedSuffix.toLowerCase(),
	);
	if (!chord) return 0;

	for (let i = 0; i < chord.positions.length; i++) {
		if (passesBassStringRule(root, normalizedSuffix, chord.positions[i])) {
			return i;
		}
	}
	return 0;
}

/**
 * Check if a specific variation is the recommended one for a chord.
 */
export function isRecommendedVariation(
	chordName: string,
	variationIndex: number,
): boolean {
	return getRecommendedVariation(chordName) === variationIndex;
}

/** Filter chord names for autocomplete */
export function filterChordNames(query: string, limit = 50): string[] {
	const q = query.toLowerCase();
	return q
		? allChordNames.filter((n) => n.toLowerCase().includes(q)).slice(0, limit)
		: allChordNames.slice(0, limit);
}
