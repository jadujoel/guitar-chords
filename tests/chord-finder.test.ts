import { expect, test } from "bun:test";
import {
	findChordByFrets,
	findChordByNotes,
	fretsToMidi,
	getEnharmonics,
} from "../src/chord-finder";

// ── fretsToMidi ──
test("fretsToMidi converts open strings correctly", () => {
	// Standard tuning: E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
	const result = fretsToMidi([0, 0, 0, 0, 0, 0]);
	expect(result).toEqual([40, 45, 50, 55, 59, 64]);
});

test("fretsToMidi skips muted strings (-1)", () => {
	const result = fretsToMidi([-1, 0, 2, 2, 2, 0]);
	expect(result).not.toContain(40 - 1); // shouldn't have the muted string
	expect(result.length).toBe(5);
});

test("fretsToMidi adds fret numbers to tuning", () => {
	const result = fretsToMidi([0, 0, 0, 0, 0, 1]);
	// Last string: 64 + 1 = 65
	expect(result[result.length - 1]).toBe(65);
});

test("fretsToMidi with custom tuning", () => {
	const dropD = [38, 45, 50, 55, 59, 64];
	const result = fretsToMidi([0, 0, 0, 0, 0, 0], dropD);
	expect(result[0]).toBe(38);
});

// ── findChordByFrets ──
test("findChordByFrets identifies open C major", () => {
	// x-3-2-0-1-0 = C major
	const result = findChordByFrets([-1, 3, 2, 0, 1, 0]);
	expect(result.length).toBeGreaterThan(0);
	const names = result.map((r) => r.name);
	expect(names.some((n) => n.startsWith("C"))).toBe(true);
});

test("findChordByFrets returns empty for invalid input", () => {
	const result = findChordByFrets([]);
	expect(result).toEqual([]);
});

// ── findChordByNotes ──
test("findChordByNotes identifies C major from pitch classes", () => {
	// C=0, E=4, G=7
	const result = findChordByNotes([0, 4, 7]);
	expect(result.length).toBeGreaterThan(0);
	const names = result.map((r) => r.name);
	expect(names.some((n) => n.startsWith("C"))).toBe(true);
});

test("findChordByNotes identifies Am from pitch classes", () => {
	// A=9, C=0, E=4
	const result = findChordByNotes([9, 0, 4]);
	expect(result.length).toBeGreaterThan(0);
	const names = result.map((r) => r.name);
	expect(names.some((n) => n.includes("A"))).toBe(true);
});

test("findChordByNotes returns sorted by confidence", () => {
	const result = findChordByNotes([0, 4, 7]);
	if (result.length > 1) {
		expect(result[0].confidence).toBeGreaterThanOrEqual(result[1].confidence);
	}
});

// ── getEnharmonics ──
test("getEnharmonics returns equivalent notes", () => {
	const enh = getEnharmonics("C#");
	expect(enh).toContain("Db");
});

test("getEnharmonics for natural note", () => {
	const enh = getEnharmonics("C");
	// C's enharmonic is B#
	expect(enh).toContain("B#");
});

test("getEnharmonics for flat note", () => {
	const enh = getEnharmonics("Bb");
	expect(enh).toContain("A#");
});
