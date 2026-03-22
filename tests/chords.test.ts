import { describe, expect, test } from "bun:test";
import {
	allChordNames,
	filterChordNames,
	getChordData,
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
		expect(chordData).toHaveProperty("mutedStrings");
		expect(typeof chordData.position).toBe("number");
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
