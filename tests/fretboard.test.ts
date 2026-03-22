import { expect, test } from "bun:test";
import {
	getInterval,
	getMidiNote,
	getNoteName,
	noteNameToMidi,
} from "../src/fretboard";

// ── getMidiNote ──
test("getMidiNote returns correct MIDI for open strings", () => {
	// Standard tuning: E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
	expect(getMidiNote(0, 0)).toBe(40);
	expect(getMidiNote(1, 0)).toBe(45);
	expect(getMidiNote(5, 0)).toBe(64);
});

test("getMidiNote adds fret number", () => {
	expect(getMidiNote(0, 5)).toBe(45); // E2 + 5 = A2
	expect(getMidiNote(5, 12)).toBe(76); // E4 + 12 = E5
});

// ── getNoteName ──
test("getNoteName returns correct names", () => {
	expect(getNoteName(60)).toBe("C"); // C4
	expect(getNoteName(64)).toBe("E"); // E4
	expect(getNoteName(69)).toBe("A"); // A4
});

test("getNoteName handles sharps", () => {
	expect(getNoteName(61)).toBe("C#");
	expect(getNoteName(66)).toBe("F#");
});

// ── getInterval ──
test("getInterval returns correct interval names", () => {
	expect(getInterval(60, 60)).toBe("R"); // Root/unison
	expect(getInterval(67, 60)).toBe("5"); // Perfect fifth
});

// ── noteNameToMidi ──
test("noteNameToMidi converts note names to pitch classes", () => {
	expect(noteNameToMidi("C")).toBe(0);
	expect(noteNameToMidi("D")).toBe(2);
	expect(noteNameToMidi("E")).toBe(4);
	expect(noteNameToMidi("A")).toBe(9);
});

test("noteNameToMidi handles sharps and flats", () => {
	expect(noteNameToMidi("C#")).toBe(1);
	expect(noteNameToMidi("Db")).toBe(1);
	expect(noteNameToMidi("Bb")).toBe(10);
});
