import { beforeEach, expect, test } from "bun:test";
import {
	getDueChords,
	getMasteryHeatmap,
	masterySignal,
	pickQuizChord,
	pickTransitionPair,
	practiceSignal,
	recordAttempt,
	recordPracticeDay,
	streakSignal,
} from "../src/practice";

beforeEach(() => {
	practiceSignal.set({
		startTime: 0,
		chordsAttempted: [],
		correctCount: 0,
		totalCount: 0,
		mode: "none",
	});
	streakSignal.set({
		currentStreak: 0,
		longestStreak: 0,
		lastPracticeDate: "",
		totalSessions: 0,
	});
	masterySignal.set({});
});

// ── practiceSignal ──
test("practiceSignal has correct initial state", () => {
	const s = practiceSignal.get();
	expect(s.mode).toBe("none");
	expect(s.totalCount).toBe(0);
	expect(s.correctCount).toBe(0);
});

// ── streakSignal ──
test("recordPracticeDay increments streak", () => {
	recordPracticeDay();
	const s = streakSignal.get();
	expect(s.currentStreak).toBe(1);
	expect(s.totalSessions).toBe(1);
});

test("recordPracticeDay sets lastPracticeDate to today", () => {
	recordPracticeDay();
	const s = streakSignal.get();
	const today = new Date().toISOString().split("T")[0];
	expect(s.lastPracticeDate).toBe(today);
});

test("recordPracticeDay called twice same day keeps streak at 1", () => {
	recordPracticeDay();
	recordPracticeDay();
	const s = streakSignal.get();
	expect(s.currentStreak).toBe(1);
});

// ── recordAttempt ──
test("recordAttempt creates mastery entry", () => {
	recordAttempt("C", true);
	const m = masterySignal.get();
	expect(m.C).toBeTruthy();
	expect(m.C.attempts).toBe(1);
	expect(m.C.correct).toBe(1);
});

test("recordAttempt tracks incorrect attempts", () => {
	recordAttempt("G", false);
	const m = masterySignal.get();
	expect(m.G).toBeTruthy();
	expect(m.G.attempts).toBe(1);
	expect(m.G.correct).toBe(0);
});

test("recordAttempt increments level on correct", () => {
	recordAttempt("Am", true);
	const m = masterySignal.get();
	expect(m.Am.level).toBeGreaterThanOrEqual(1);
});

test("recordAttempt decrements level on incorrect", () => {
	// First get to level 1
	recordAttempt("Dm", true);
	recordAttempt("Dm", false);
	const m = masterySignal.get();
	expect(m.Dm.level).toBe(0);
});

// ── getDueChords ──
test("getDueChords returns chords due for review", () => {
	// Record an attempt with nextReview in the past
	recordAttempt("C", true);
	masterySignal.update((m) => ({
		...m,
		C: { ...m.C, nextReview: Date.now() - 1000 },
	}));
	const due = getDueChords();
	expect(due).toContain("C");
});

test("getDueChords respects limit parameter", () => {
	for (const chord of ["C", "G", "Am", "F", "Dm"]) {
		recordAttempt(chord, true);
		masterySignal.update((m) => ({
			...m,
			[chord]: { ...m[chord], nextReview: Date.now() - 1000 },
		}));
	}
	const due = getDueChords(3);
	expect(due.length).toBeLessThanOrEqual(3);
});

// ── pickQuizChord ──
test("pickQuizChord returns a valid question", () => {
	const q = pickQuizChord();
	if (q) {
		expect(q.chordName).toBeTruthy();
		expect(q.midiNotes).toBeTruthy();
		expect(q.midiNotes.length).toBeGreaterThan(0);
	}
});

// ── pickTransitionPair ──
test("pickTransitionPair returns two different chords", () => {
	const pair = pickTransitionPair();
	expect(pair.from).toBeTruthy();
	expect(pair.to).toBeTruthy();
	expect(pair.from).not.toBe(pair.to);
});

// ── getMasteryHeatmap ──
test("getMasteryHeatmap returns empty for no data", () => {
	expect(getMasteryHeatmap()).toEqual([]);
});

test("getMasteryHeatmap returns data after attempts", () => {
	recordAttempt("C", true);
	recordAttempt("G", false);
	const heatmap = getMasteryHeatmap();
	expect(heatmap.length).toBe(2);
	const cEntry = heatmap.find((h) => h.chord === "C");
	expect(cEntry).toBeTruthy();
	expect(cEntry?.attempts).toBe(1);
});
