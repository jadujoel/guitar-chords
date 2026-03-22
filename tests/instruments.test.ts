import { expect, test } from "bun:test";
import {
	GUITAR_TUNINGS,
	getChordDatabase,
	getInstrumentConfig,
	INSTRUMENTS,
	instrumentSignal,
} from "../src/instruments";

// ── INSTRUMENTS ──
test("INSTRUMENTS has all 4 instruments", () => {
	expect(INSTRUMENTS.guitar).toBeTruthy();
	expect(INSTRUMENTS.ukulele).toBeTruthy();
	expect(INSTRUMENTS.bass).toBeTruthy();
	expect(INSTRUMENTS.mandolin).toBeTruthy();
});

test("guitar has 6 strings", () => {
	expect(INSTRUMENTS.guitar.strings).toBe(6);
	expect(INSTRUMENTS.guitar.tuning).toHaveLength(6);
});

test("ukulele has 4 strings", () => {
	expect(INSTRUMENTS.ukulele.strings).toBe(4);
	expect(INSTRUMENTS.ukulele.tuning).toHaveLength(4);
});

test("bass has 4 strings", () => {
	expect(INSTRUMENTS.bass.strings).toBe(4);
	expect(INSTRUMENTS.bass.tuning).toHaveLength(4);
});

test("mandolin has 4 strings", () => {
	expect(INSTRUMENTS.mandolin.strings).toBe(4);
	expect(INSTRUMENTS.mandolin.tuning).toHaveLength(4);
});

// ── GUITAR_TUNINGS ──
test("GUITAR_TUNINGS has Standard tuning", () => {
	expect(GUITAR_TUNINGS.Standard).toBeTruthy();
	expect(GUITAR_TUNINGS.Standard).toHaveLength(6);
});

test("Standard tuning MIDI values are correct", () => {
	// E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
	expect(GUITAR_TUNINGS.Standard).toEqual([40, 45, 50, 55, 59, 64]);
});

test("GUITAR_TUNINGS has Drop D", () => {
	expect(GUITAR_TUNINGS["Drop D"]).toBeTruthy();
	// Drop D lowers first string by 2 semitones
	expect(GUITAR_TUNINGS["Drop D"][0]).toBe(38);
});

// ── Signals ──
test("instrumentSignal defaults to guitar", () => {
	expect(instrumentSignal.get()).toBe("guitar");
});

test("getInstrumentConfig returns current instrument config", () => {
	const config = getInstrumentConfig();
	expect(config.name).toBe("Guitar");
	expect(config.strings).toBe(6);
});

test("getChordDatabase returns data for guitar", () => {
	const db = getChordDatabase();
	expect(db).toBeTruthy();
	expect(Object.keys(db).length).toBeGreaterThan(0);
});
