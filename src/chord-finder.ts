/** Chord Finder / Reverse Lookup — identify chords from fretboard input */

import { allChordNames, getChordData } from "./chords";

export interface ChordMatch {
	name: string;
	confidence: number;
	midiNotes: number[];
}

/** Standard guitar tuning MIDI values */
const STANDARD_TUNING = [40, 45, 50, 55, 59, 64];

/** Convert fret positions to MIDI notes (-1 = muted) */
export function fretsToMidi(
	frets: number[],
	tuning: number[] = STANDARD_TUNING,
): number[] {
	const midi: number[] = [];
	for (let i = 0; i < frets.length; i++) {
		if (frets[i] >= 0 && i < tuning.length) {
			midi.push(tuning[i] + frets[i]);
		}
	}
	return midi;
}

/** Get pitch classes (0-11) from MIDI notes */
function pitchClasses(midi: number[]): Set<number> {
	return new Set(midi.map((n) => n % 12));
}

/**
 * Given fret positions, find matching chord name(s).
 * Returns sorted by confidence score.
 */
export function findChordByFrets(
	frets: number[],
	tuning: number[] = STANDARD_TUNING,
): ChordMatch[] {
	const inputMidi = fretsToMidi(frets, tuning);
	if (inputMidi.length === 0) return [];

	const inputPitchClasses = pitchClasses(inputMidi);
	const matches: ChordMatch[] = [];

	for (const name of allChordNames) {
		// Check all variations
		for (let v = 0; v < 10; v++) {
			const data = getChordData(name, v);
			if (!data) break;

			const chordPitchClasses = pitchClasses(data.midiNotes);

			// Calculate similarity
			let matchingNotes = 0;
			for (const pc of inputPitchClasses) {
				if (chordPitchClasses.has(pc)) matchingNotes++;
			}

			const totalUnique = new Set([...inputPitchClasses, ...chordPitchClasses])
				.size;
			const confidence = matchingNotes / totalUnique;

			if (confidence >= 0.8) {
				// Avoid duplicates
				if (!matches.some((m) => m.name === name)) {
					matches.push({
						name,
						confidence,
						midiNotes: data.midiNotes,
					});
				}
			}
		}
	}

	matches.sort((a, b) => b.confidence - a.confidence);
	return matches.slice(0, 10);
}

/**
 * Given pitch classes, find matching chord names.
 * For "What chord is this?" without exact fret positions.
 */
export function findChordByNotes(noteIndices: number[]): ChordMatch[] {
	const inputSet = new Set(noteIndices.map((n) => n % 12));
	const matches: ChordMatch[] = [];

	for (const name of allChordNames) {
		const data = getChordData(name, 0);
		if (!data) continue;

		const chordSet = pitchClasses(data.midiNotes);
		let match = 0;
		for (const n of inputSet) {
			if (chordSet.has(n)) match++;
		}

		const total = new Set([...inputSet, ...chordSet]).size;
		const confidence = match / total;

		if (confidence >= 0.7) {
			matches.push({ name, confidence, midiNotes: data.midiNotes });
		}
	}

	matches.sort((a, b) => b.confidence - a.confidence);
	return matches.slice(0, 10);
}

/** Get enharmonic equivalents for a note name */
export function getEnharmonics(noteName: string): string[] {
	const map: Record<string, string[]> = {
		"C#": ["Db"],
		Db: ["C#"],
		"D#": ["Eb"],
		Eb: ["D#"],
		"F#": ["Gb"],
		Gb: ["F#"],
		"G#": ["Ab"],
		Ab: ["G#"],
		"A#": ["Bb"],
		Bb: ["A#"],
		B: ["Cb"],
		Cb: ["B"],
		C: ["B#"],
		"B#": ["C"],
		E: ["Fb"],
		Fb: ["E"],
		"E#": ["F"],
		F: ["E#"],
	};
	return map[noteName] ?? [];
}
