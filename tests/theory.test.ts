import { expect, test } from "bun:test";
import {
	ALL_KEYS,
	buildProgression,
	detectKey,
	getDiatonicChords,
	getScaleNotes,
	getScalePitchClasses,
	indexToNote,
	noteToIndex,
	PROGRESSION_PRESETS,
	SCALES,
	toNashvilleNumber,
	transposeChord,
	transposeChords,
	withCapo,
} from "../src/theory";

// ── noteToIndex ──
test("noteToIndex converts natural notes", () => {
	expect(noteToIndex("C")).toBe(0);
	expect(noteToIndex("D")).toBe(2);
	expect(noteToIndex("E")).toBe(4);
	expect(noteToIndex("G")).toBe(7);
	expect(noteToIndex("A")).toBe(9);
	expect(noteToIndex("B")).toBe(11);
});

test("noteToIndex handles sharps and flats", () => {
	expect(noteToIndex("C#")).toBe(1);
	expect(noteToIndex("Db")).toBe(1);
	expect(noteToIndex("F#")).toBe(6);
	expect(noteToIndex("Gb")).toBe(6);
	expect(noteToIndex("Bb")).toBe(10);
});

// ── indexToNote ──
test("indexToNote returns sharp names by default", () => {
	expect(indexToNote(0)).toBe("C");
	expect(indexToNote(1)).toBe("C#");
	expect(indexToNote(6)).toBe("F#");
});

test("indexToNote returns flat names when preferFlats is true", () => {
	expect(indexToNote(1, true)).toBe("Db");
	expect(indexToNote(3, true)).toBe("Eb");
	expect(indexToNote(6, true)).toBe("Gb");
	expect(indexToNote(10, true)).toBe("Bb");
});

// ── getScaleNotes ──
test("C Major scale has correct notes", () => {
	const major = SCALES.find((s) => s.name === "Major")!;
	const notes = getScaleNotes("C", major);
	expect(notes).toEqual(["C", "D", "E", "F", "G", "A", "B"]);
});

test("getScalePitchClasses returns correct pitch classes", () => {
	const major = SCALES.find((s) => s.name === "Major")!;
	const pitchClasses = getScalePitchClasses("C", major);
	expect(pitchClasses).toEqual([0, 2, 4, 5, 7, 9, 11]);
});

// ── getDiatonicChords ──
test("C major diatonic chords are correct", () => {
	const chords = getDiatonicChords("C", false);
	expect(chords.length).toBe(7);
	const names = chords.map((c) => c.chordName);
	expect(names).toContain("C");
	expect(names).toContain("Dm");
	expect(names).toContain("Em");
	expect(names).toContain("F");
	expect(names).toContain("G");
	expect(names).toContain("Am");
});

test("getDiatonicChords returns roman numerals", () => {
	const chords = getDiatonicChords("C", false);
	expect(chords[0].roman).toBe("I");
	expect(chords[1].roman).toBe("ii");
	expect(chords[3].roman).toBe("IV");
});

// ── buildProgression ──
test("buildProgression builds Pop progression in C", () => {
	const pop = PROGRESSION_PRESETS.find((p) => p.name.startsWith("Pop"))!;
	const chords = buildProgression("C", pop, false);
	expect(chords.length).toBe(4);
	expect(chords).toContain("C");
	expect(chords).toContain("G");
	expect(chords).toContain("Am");
	expect(chords).toContain("F");
});

// ── detectKey ──
test("detectKey identifies C major from common chords", () => {
	const result = detectKey(["C", "F", "G", "Am"]);
	expect(result.length).toBeGreaterThan(0);
	expect(result[0].key).toBe("C");
});

test("detectKey returns empty for empty input", () => {
	expect(detectKey([])).toEqual([]);
});

// ── transposeChord ──
test("transposeChord transposes up by semitone", () => {
	expect(transposeChord("C", 1)).toBe("C#");
	expect(transposeChord("E", 1)).toBe("F");
	expect(transposeChord("B", 1)).toBe("C");
});

test("transposeChord transposes down by semitone", () => {
	expect(transposeChord("C", -1)).toBe("B");
	expect(transposeChord("F", -1)).toBe("E");
});

test("transposeChord preserves chord quality", () => {
	expect(transposeChord("Am", 2)).toBe("Bm");
	expect(transposeChord("G7", 5)).toBe("C7");
	expect(transposeChord("Dm", 2)).toBe("Em");
});

// ── transposeChords ──
test("transposeChords transposes array of chords", () => {
	const result = transposeChords(["C", "G", "Am", "F"], 2);
	expect(result).toEqual(["D", "A", "Bm", "G"]);
});

// ── toNashvilleNumber ──
test("toNashvilleNumber converts chords to Nashville numbers", () => {
	expect(toNashvilleNumber("C", "C")).toBe("1");
	expect(toNashvilleNumber("G", "C")).toBe("5");
	expect(toNashvilleNumber("F", "C")).toBe("4");
});

// ── withCapo ──
test("withCapo calculates correct transposition", () => {
	const result = withCapo("C", 2);
	expect(result.playAs).toBeDefined();
	expect(result.soundsLike).toBeDefined();
});

// ── Constants ──
test("ALL_KEYS contains standard keys", () => {
	expect(ALL_KEYS).toContain("C");
	expect(ALL_KEYS).toContain("G");
	expect(ALL_KEYS).toContain("F#");
	expect(ALL_KEYS).toContain("Bb");
});

test("SCALES contains Major and Minor", () => {
	expect(SCALES.find((s) => s.name === "Major")).toBeTruthy();
	expect(SCALES.find((s) => s.name === "Natural Minor")).toBeTruthy();
	expect(SCALES.find((s) => s.name === "Blues")).toBeTruthy();
});

test("PROGRESSION_PRESETS has valid presets", () => {
	expect(PROGRESSION_PRESETS.length).toBeGreaterThan(0);
	for (const p of PROGRESSION_PRESETS) {
		expect(p.name).toBeTruthy();
		expect(p.degrees.length).toBeGreaterThan(0);
	}
});
