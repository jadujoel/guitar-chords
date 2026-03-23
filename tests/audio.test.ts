import { expect, test } from "bun:test";
import {
	bpmSignal,
	GUITAR_TONES,
	type GuitarTone,
	loopSignal,
	midiToNoteName,
	mutedSignal,
	reverbSignal,
	strumDirectionSignal,
	strumSpeedSignal,
	toneSignal,
	volumeSignal,
} from "../src/audio";

test("GUITAR_TONES has all 7 tone options", () => {
	const keys = Object.keys(GUITAR_TONES);
	expect(keys).toContain("nylon");
	expect(keys).toContain("steel");
	expect(keys).toContain("jazz");
	expect(keys).toContain("clean");
	expect(keys).toContain("muted");
	expect(keys).toContain("overdriven");
	expect(keys).toContain("distortion");
	expect(keys.length).toBe(7);
});

test("each tone has name and folder", () => {
	for (const [, config] of Object.entries(GUITAR_TONES)) {
		expect(config.name).toBeTruthy();
		expect(config.folder).toBeTruthy();
		expect(config.folder).toMatch(/^(acoustic|electric|overdriven|distortion)/);
	}
});

test("toneSignal defaults to nylon", () => {
	expect(toneSignal.get()).toBe("nylon");
});

test("toneSignal can be set to valid tones", () => {
	const validTones: GuitarTone[] = [
		"nylon",
		"steel",
		"jazz",
		"clean",
		"muted",
		"overdriven",
		"distortion",
	];
	for (const tone of validTones) {
		toneSignal.set(tone);
		expect(toneSignal.get()).toBe(tone);
	}
	// Reset to default
	toneSignal.set("nylon");
});

test("audio signals have sensible defaults", () => {
	expect(volumeSignal.get()).toBeGreaterThan(0);
	expect(volumeSignal.get()).toBeLessThanOrEqual(1);
	expect(reverbSignal.get()).toBeGreaterThanOrEqual(0);
	expect(reverbSignal.get()).toBeLessThanOrEqual(1);
	expect(strumSpeedSignal.get()).toBeGreaterThan(0);
	expect(mutedSignal.get()).toBe(false);
	expect(strumDirectionSignal.get()).toBe("down");
	expect(loopSignal.get()).toBe(false);
	expect(bpmSignal.get()).toBeGreaterThan(0);
});

test("midiToNoteName converts MIDI numbers to note names", () => {
	expect(midiToNoteName(60)).toBe("C4");
	expect(midiToNoteName(69)).toBe("A4");
	expect(midiToNoteName(40)).toBe("E2");
	expect(midiToNoteName(64)).toBe("E4");
	expect(midiToNoteName(61)).toBe("Db4");
	expect(midiToNoteName(70)).toBe("Bb4");
});

test("midiToNoteName covers full guitar range", () => {
	// Guitar standard tuning: E2 (40) to E6 (88)
	for (let midi = 40; midi <= 88; midi++) {
		const name = midiToNoteName(midi);
		expect(name).toMatch(/^[A-G]b?\d$/);
	}
});
