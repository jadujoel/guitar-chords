import { expect, test } from "bun:test";
import {
	bpmSignal,
	GUITAR_TONES,
	type GuitarTone,
	loopSignal,
	mutedSignal,
	reverbSignal,
	strumDirectionSignal,
	strumSpeedSignal,
	toneSignal,
	volumeSignal,
} from "../src/audio";

test("GUITAR_TONES has all 4 tone options", () => {
	const keys = Object.keys(GUITAR_TONES);
	expect(keys).toContain("nylon");
	expect(keys).toContain("steel");
	expect(keys).toContain("clean");
	expect(keys).toContain("overdriven");
	expect(keys.length).toBe(4);
});

test("each tone has name, variable, and url", () => {
	for (const [, config] of Object.entries(GUITAR_TONES)) {
		expect(config.name).toBeTruthy();
		expect(config.variable).toBeTruthy();
		expect(config.url).toMatch(/^https:\/\//);
		expect(config.url).toContain("webaudiofontdata");
	}
});

test("toneSignal defaults to nylon", () => {
	expect(toneSignal.get()).toBe("nylon");
});

test("toneSignal can be set to valid tones", () => {
	const validTones: GuitarTone[] = ["nylon", "steel", "clean", "overdriven"];
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
