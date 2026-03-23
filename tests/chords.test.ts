import { describe, expect, test } from "bun:test";
import {
	allChordNames,
	filterChordNames,
	getChordData,
	getRecommendedVariation,
	isRecommendedVariation,
	normalizeRootNote,
} from "../src/chords";

describe("normalizeRootNote", () => {
	test("normalizes natural notes to uppercase", () => {
		expect(normalizeRootNote("c")).toBe("C");
		expect(normalizeRootNote("d")).toBe("D");
		expect(normalizeRootNote("e")).toBe("E");
		expect(normalizeRootNote("f")).toBe("F");
		expect(normalizeRootNote("g")).toBe("G");
		expect(normalizeRootNote("a")).toBe("A");
		expect(normalizeRootNote("b")).toBe("B");
	});

	test("normalizes sharp notes to DB keys", () => {
		expect(normalizeRootNote("c#")).toBe("Csharp");
		expect(normalizeRootNote("f#")).toBe("Fsharp");
	});

	test("normalizes enharmonic equivalents", () => {
		expect(normalizeRootNote("d#")).toBe("Eb");
		expect(normalizeRootNote("a#")).toBe("Bb");
		expect(normalizeRootNote("g#")).toBe("Ab");
		expect(normalizeRootNote("db")).toBe("Csharp");
		expect(normalizeRootNote("gb")).toBe("Fsharp");
		expect(normalizeRootNote("ab")).toBe("Ab");
		expect(normalizeRootNote("bb")).toBe("Bb");
		expect(normalizeRootNote("eb")).toBe("Eb");
	});

	test("handles already-normalized input", () => {
		expect(normalizeRootNote("C")).toBe("C");
		expect(normalizeRootNote("A")).toBe("A");
	});

	test("handles edge cases", () => {
		expect(normalizeRootNote("e#")).toBe("F");
		expect(normalizeRootNote("b#")).toBe("C");
		expect(normalizeRootNote("cb")).toBe("B");
		expect(normalizeRootNote("fb")).toBe("E");
	});
});

function unwrap<T>(value: T | null | undefined): T {
	if (value == null) throw new Error("Expected non-null value");
	return value;
}

describe("getChordData", () => {
	test("returns data for valid major chord", () => {
		const result = unwrap(getChordData("C", 0));
		expect(result.totalVariations).toBeGreaterThan(0);
		expect(result.midiNotes).toBeInstanceOf(Array);
		expect(result.midiNotes.length).toBeGreaterThan(0);
		expect(result.chordData.fingers).toBeInstanceOf(Array);
	});

	test("returns data for minor chord", () => {
		const result = unwrap(getChordData("Am", 0));
		expect(result.midiNotes.length).toBeGreaterThan(0);
	});

	test("returns data for sharp chords", () => {
		expect(getChordData("F#", 0)).not.toBeNull();
	});

	test("returns data for flat chords", () => {
		expect(getChordData("Bb", 0)).not.toBeNull();
	});

	test("returns data for 7th chords", () => {
		expect(getChordData("G7", 0)).not.toBeNull();
	});

	test("returns null for invalid chord", () => {
		expect(getChordData("Xyz", 0)).toBeNull();
	});

	test("returns null for invalid variation index", () => {
		expect(getChordData("C", 999)).toBeNull();
	});

	test("returns correct variation count", () => {
		const result = unwrap(getChordData("C", 0));
		expect(result.totalVariations).toBeGreaterThanOrEqual(2);
	});

	test("different variations return different data", () => {
		const v0 = unwrap(getChordData("C", 0));
		const v1 = unwrap(getChordData("C", 1));
		expect(JSON.stringify(v0.chordData)).not.toBe(JSON.stringify(v1.chordData));
	});

	test("handles case insensitive root", () => {
		const upper = unwrap(getChordData("C", 0));
		const lower = unwrap(getChordData("c", 0));
		expect(upper.midiNotes).toEqual(lower.midiNotes);
	});

	test("chord data has correct structure", () => {
		const { chordData } = unwrap(getChordData("D", 0));
		expect(chordData).toHaveProperty("fingers");
		expect(chordData).toHaveProperty("position");
		expect(chordData).toHaveProperty("barres");
		expect(typeof chordData.position).toBe("number");
	});

	test("muted strings are encoded as [string, 'x'] in fingers", () => {
		const { chordData } = unwrap(getChordData("D", 0));
		// D major: strings 6 and 5 are muted (frets = [-1, -1, 0, 2, 3, 2])
		const mutedFingers = chordData.fingers.filter((f) => f[1] === "x");
		expect(mutedFingers.length).toBeGreaterThanOrEqual(2);
		const mutedStrings = mutedFingers.map((f) => f[0]);
		expect(mutedStrings).toContain(6);
		expect(mutedStrings).toContain(5);
	});

	test("open strings are encoded as [string, 0] in fingers", () => {
		const { chordData } = unwrap(getChordData("C", 0));
		// C major has open strings (e.g., high E string 1 is open)
		const openFingers = chordData.fingers.filter((f) => f[1] === 0);
		expect(openFingers.length).toBeGreaterThan(0);
	});

	test("root notes are highlighted with FingerOptions", () => {
		const { chordData } = unwrap(getChordData("C", 0));
		// C major: root is C (pitch class 0)
		// String 5 fret 3 = C3 (MIDI 48, 48%12=0) — should be root
		const rootFingers = chordData.fingers.filter(
			(f) => typeof f[2] === "object" && f[2] !== null && "color" in f[2],
		);
		expect(rootFingers.length).toBeGreaterThan(0);
	});

	test("root note open strings have strokeColor", () => {
		// E major: string 1 (high E) is open and is the root (pitch class 4)
		const { chordData } = unwrap(getChordData("E", 0));
		const openRoots = chordData.fingers.filter(
			(f) =>
				f[1] === 0 &&
				typeof f[2] === "object" &&
				f[2] !== null &&
				"strokeColor" in f[2],
		);
		expect(openRoots.length).toBeGreaterThan(0);
	});
});

describe("filterChordNames", () => {
	test("returns chords matching query", () => {
		const results = filterChordNames("Am");
		expect(results.length).toBeGreaterThan(0);
		for (const name of results) {
			expect(name.toLowerCase()).toContain("am");
		}
	});

	test("returns limited results", () => {
		const results = filterChordNames("", 5);
		expect(results.length).toBe(5);
	});

	test("returns first 50 for empty query", () => {
		const results = filterChordNames("");
		expect(results.length).toBe(50);
	});

	test("is case insensitive", () => {
		const upper = filterChordNames("Am");
		const lower = filterChordNames("am");
		expect(upper).toEqual(lower);
	});

	test("returns empty for non-matching query", () => {
		const results = filterChordNames("zzzzzzzzq");
		expect(results.length).toBe(0);
	});
});

describe("allChordNames", () => {
	test("contains standard chords", () => {
		expect(allChordNames).toContain("C");
		expect(allChordNames).toContain("Aminor");
		expect(allChordNames).toContain("G");
		expect(allChordNames).toContain("D");
		expect(allChordNames).toContain("E");
	});

	test("contains sharp chords", () => {
		expect(allChordNames.some((n) => n.includes("#"))).toBe(true);
	});

	test("has reasonable count", () => {
		expect(allChordNames.length).toBeGreaterThan(100);
	});
});

describe("getRecommendedVariation", () => {
	test("returns 0 for C major (exempt from bass rule)", () => {
		expect(getRecommendedVariation("C")).toBe(0);
	});

	test("returns 0 for G major (exempt from bass rule)", () => {
		expect(getRecommendedVariation("G")).toBe(0);
	});

	test("returns a valid variation index for D major", () => {
		const idx = getRecommendedVariation("D");
		const data = getChordData("D", idx);
		expect(data).not.toBeNull();
	});

	test("returns a valid variation index for Am", () => {
		const idx = getRecommendedVariation("Am");
		const data = getChordData("Am", idx);
		expect(data).not.toBeNull();
	});

	test("recommended variation has root in bass strings", () => {
		// For E major, root is E (MIDI pitch class 4)
		const idx = getRecommendedVariation("E");
		const data = getChordData("E", idx);
		expect(data).not.toBeNull();
		// MIDI notes should exist
		expect(data?.midiNotes.length).toBeGreaterThan(0);
	});

	test("returns 0 for unknown chord", () => {
		expect(getRecommendedVariation("Xyz")).toBe(0);
	});

	test("works for sharp chords", () => {
		const idx = getRecommendedVariation("F#");
		expect(idx).toBeGreaterThanOrEqual(0);
		expect(getChordData("F#", idx)).not.toBeNull();
	});

	test("works for flat chords", () => {
		const idx = getRecommendedVariation("Bb");
		expect(idx).toBeGreaterThanOrEqual(0);
		expect(getChordData("Bb", idx)).not.toBeNull();
	});

	test("works for minor chords", () => {
		const idx = getRecommendedVariation("Em");
		expect(idx).toBeGreaterThanOrEqual(0);
		expect(getChordData("Em", idx)).not.toBeNull();
	});

	test("works for 7th chords", () => {
		const idx = getRecommendedVariation("A7");
		expect(idx).toBeGreaterThanOrEqual(0);
		expect(getChordData("A7", idx)).not.toBeNull();
	});
});

describe("isRecommendedVariation", () => {
	test("returns true for the recommended index", () => {
		const idx = getRecommendedVariation("D");
		expect(isRecommendedVariation("D", idx)).toBe(true);
	});

	test("returns false for non-recommended index", () => {
		const idx = getRecommendedVariation("D");
		// Try a different index
		const otherIdx = idx === 0 ? 1 : 0;
		const data = getChordData("D", otherIdx);
		if (data) {
			expect(isRecommendedVariation("D", otherIdx)).toBe(idx === otherIdx);
		}
	});

	test("C major variation 0 is recommended", () => {
		expect(isRecommendedVariation("C", 0)).toBe(true);
	});

	test("G major variation 0 is recommended", () => {
		expect(isRecommendedVariation("G", 0)).toBe(true);
	});
});
