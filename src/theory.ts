/** Music theory: scales, keys, chord-scale relationships, key detection */

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

const FLAT_NAMES = [
	"C",
	"Db",
	"D",
	"Eb",
	"E",
	"F",
	"Gb",
	"G",
	"Ab",
	"A",
	"Bb",
	"B",
];

export const ALL_KEYS = [
	"C",
	"C#",
	"Db",
	"D",
	"D#",
	"Eb",
	"E",
	"F",
	"F#",
	"Gb",
	"G",
	"G#",
	"Ab",
	"A",
	"A#",
	"Bb",
	"B",
];

// ─── Scale definitions (intervals from root) ──────────
export interface ScaleDefinition {
	name: string;
	intervals: number[];
}

export const SCALES: ScaleDefinition[] = [
	{ name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
	{ name: "Natural Minor", intervals: [0, 2, 3, 5, 7, 8, 10] },
	{ name: "Harmonic Minor", intervals: [0, 2, 3, 5, 7, 8, 11] },
	{ name: "Melodic Minor", intervals: [0, 2, 3, 5, 7, 9, 11] },
	{ name: "Pentatonic Major", intervals: [0, 2, 4, 7, 9] },
	{ name: "Pentatonic Minor", intervals: [0, 3, 5, 7, 10] },
	{ name: "Blues", intervals: [0, 3, 5, 6, 7, 10] },
	{ name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
	{ name: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10] },
	{ name: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11] },
	{ name: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
	{ name: "Locrian", intervals: [0, 1, 3, 5, 6, 8, 10] },
	{ name: "Aeolian", intervals: [0, 2, 3, 5, 7, 8, 10] },
	{ name: "Ionian", intervals: [0, 2, 4, 5, 7, 9, 11] },
];

/** Get note index 0-11 from note name */
export function noteToIndex(note: string): number {
	const n = note.trim();
	let idx = NOTE_NAMES.indexOf(n);
	if (idx >= 0) return idx;
	idx = FLAT_NAMES.indexOf(n);
	if (idx >= 0) return idx;
	// Try case-insensitive
	const upper = n.charAt(0).toUpperCase() + n.slice(1);
	idx = NOTE_NAMES.indexOf(upper);
	if (idx >= 0) return idx;
	idx = FLAT_NAMES.indexOf(upper);
	return idx >= 0 ? idx : 0;
}

/** Get note name from index (prefer sharps) */
export function indexToNote(idx: number, preferFlats = false): string {
	const i = ((idx % 12) + 12) % 12;
	return preferFlats ? FLAT_NAMES[i] : NOTE_NAMES[i];
}

/** Get scale notes for a given key and scale definition */
export function getScaleNotes(key: string, scale: ScaleDefinition): string[] {
	const rootIdx = noteToIndex(key);
	const useFlats = key.includes("b") || ["F"].includes(key);
	return scale.intervals.map((i) => indexToNote(rootIdx + i, useFlats));
}

/** Get MIDI pitch classes (0-11) for a scale in a key */
export function getScalePitchClasses(
	key: string,
	scale: ScaleDefinition,
): number[] {
	const rootIdx = noteToIndex(key);
	return scale.intervals.map((i) => (rootIdx + i) % 12);
}

// ─── Diatonic chords for a key ─────────────────────────

export interface DiatonicChord {
	roman: string;
	name: string;
	quality: string; // major, minor, dim, etc.
	degree: number;
}

/** Roman numerals for diatonic chords in major key */
const MAJOR_DIATONIC: DiatonicChord[] = [
	{ roman: "I", name: "", quality: "major", degree: 0 },
	{ roman: "ii", name: "m", quality: "minor", degree: 1 },
	{ roman: "iii", name: "m", quality: "minor", degree: 2 },
	{ roman: "IV", name: "", quality: "major", degree: 3 },
	{ roman: "V", name: "", quality: "major", degree: 4 },
	{ roman: "vi", name: "m", quality: "minor", degree: 5 },
	{ roman: "vii°", name: "dim", quality: "dim", degree: 6 },
];

const MINOR_DIATONIC: DiatonicChord[] = [
	{ roman: "i", name: "m", quality: "minor", degree: 0 },
	{ roman: "ii°", name: "dim", quality: "dim", degree: 1 },
	{ roman: "III", name: "", quality: "major", degree: 2 },
	{ roman: "iv", name: "m", quality: "minor", degree: 3 },
	{ roman: "v", name: "m", quality: "minor", degree: 4 },
	{ roman: "VI", name: "", quality: "major", degree: 5 },
	{ roman: "VII", name: "", quality: "major", degree: 6 },
];

export function getDiatonicChords(
	key: string,
	minor = false,
): { roman: string; chordName: string }[] {
	const scale = minor
		? SCALES.find((s) => s.name === "Natural Minor")
		: SCALES.find((s) => s.name === "Major");
	if (!scale) return [];
	const template = minor ? MINOR_DIATONIC : MAJOR_DIATONIC;
	const notes = getScaleNotes(key, scale);

	return template.map((d) => ({
		roman: d.roman,
		chordName: `${notes[d.degree]}${d.name}`,
	}));
}

// ─── Common Progressions ───────────────────────────────

export interface ProgressionPreset {
	name: string;
	degrees: number[]; // 1-indexed scale degrees
	romanNumerals: string;
}

export const PROGRESSION_PRESETS: ProgressionPreset[] = [
	{
		name: "Pop (I–V–vi–IV)",
		degrees: [1, 5, 6, 4],
		romanNumerals: "I–V–vi–IV",
	},
	{
		name: "50s (I–vi–IV–V)",
		degrees: [1, 6, 4, 5],
		romanNumerals: "I–vi–IV–V",
	},
	{ name: "Jazz ii–V–I", degrees: [2, 5, 1], romanNumerals: "ii–V–I" },
	{
		name: "12-Bar Blues",
		degrees: [1, 1, 1, 1, 4, 4, 1, 1, 5, 4, 1, 5],
		romanNumerals: "I–I–I–I–IV–IV–I–I–V–IV–I–V",
	},
	{
		name: "Canon (I–V–vi–iii–IV–I–IV–V)",
		degrees: [1, 5, 6, 3, 4, 1, 4, 5],
		romanNumerals: "I–V–vi–iii–IV–I–IV–V",
	},
	{
		name: "Andalusian (i–VII–VI–V)",
		degrees: [1, 7, 6, 5],
		romanNumerals: "i–VII–VI–V",
	},
	{
		name: "Axis (vi–IV–I–V)",
		degrees: [6, 4, 1, 5],
		romanNumerals: "vi–IV–I–V",
	},
];

/** Build chord names for a progression in a given key */
export function buildProgression(
	key: string,
	preset: ProgressionPreset,
	minor = false,
): string[] {
	const diatonic = getDiatonicChords(key, minor);
	return preset.degrees.map((d) => {
		const idx = d - 1;
		return diatonic[idx % diatonic.length].chordName;
	});
}

// ─── Key Detection ─────────────────────────────────────

/** Given a list of chord names, detect the most likely key(s) */
export function detectKey(
	chordNames: string[],
): { key: string; quality: string; score: number }[] {
	const chordRoots = chordNames
		.map((name) => {
			const match = name.match(/^([A-G][#b]?)/);
			return match ? noteToIndex(match[1]) : -1;
		})
		.filter((n) => n >= 0);

	const chordQualities = chordNames.map((name) => {
		if (name.includes("m") && !name.includes("maj")) return "minor";
		if (name.includes("dim")) return "dim";
		return "major";
	});

	const results: { key: string; quality: string; score: number }[] = [];

	// Test each possible major and minor key
	for (let root = 0; root < 12; root++) {
		for (const isMinor of [false, true]) {
			const scale = isMinor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
			const template = isMinor ? MINOR_DIATONIC : MAJOR_DIATONIC;
			const scaleNotes = scale.map((i) => (root + i) % 12);
			let score = 0;

			for (let ci = 0; ci < chordRoots.length; ci++) {
				const cr = chordRoots[ci];
				const cq = chordQualities[ci];
				const scaleIdx = scaleNotes.indexOf(cr);
				if (scaleIdx >= 0) {
					score += 2;
					// Bonus if quality matches
					if (template[scaleIdx] && template[scaleIdx].quality === cq) {
						score += 1;
					}
				}
			}

			if (score > 0) {
				results.push({
					key: indexToNote(root),
					quality: isMinor ? "minor" : "major",
					score,
				});
			}
		}
	}

	results.sort((a, b) => b.score - a.score);
	return results.slice(0, 5);
}

// ─── Transposition ─────────────────────────────────────

/** Transpose a chord name by N semitones */
export function transposeChord(chordName: string, semitones: number): string {
	const match = chordName.match(/^([A-G][#b]?)(.*)$/);
	if (!match) return chordName;
	const [, root, suffix] = match;
	const rootIdx = noteToIndex(root);
	const useFlats = root.includes("b");
	const newRoot = indexToNote(rootIdx + semitones, useFlats);
	return `${newRoot}${suffix}`;
}

/** Transpose many chord names */
export function transposeChords(chords: string[], semitones: number): string[] {
	return chords.map((c) => transposeChord(c, semitones));
}

// ─── Nashville Number System ───────────────────────────

/** Convert chord name to Nashville number given a key */
export function toNashvilleNumber(chordName: string, key: string): string {
	const match = chordName.match(/^([A-G][#b]?)(.*)$/);
	if (!match) return chordName;
	const [, root, suffix] = match;
	const rootIdx = noteToIndex(root);
	const keyIdx = noteToIndex(key);
	const interval = (((rootIdx - keyIdx) % 12) + 12) % 12;

	const majorScale = [0, 2, 4, 5, 7, 9, 11];
	const degree = majorScale.indexOf(interval);

	if (degree >= 0) {
		const num = degree + 1;
		const isMinor = suffix.startsWith("m") && !suffix.startsWith("maj");
		return isMinor ? `${num}m` : String(num);
	}

	return chordName; // non-diatonic
}

/** Capo transposition: given capo position, return "sounds like" and "play as" */
export function withCapo(
	chordName: string,
	capo: number,
): { soundsLike: string; playAs: string } {
	return {
		soundsLike: chordName,
		playAs: transposeChord(chordName, -capo),
	};
}
