import { beforeEach, expect, test } from "bun:test";
import {
	difficultySignal,
	getChordsForDifficulty,
	getDueChords,
	getMasteryHeatmap,
	masterySignal,
	pickQuizChord,
	pickTransitionPair,
	practiceSignal,
	recordAttempt,
	recordPracticeDay,
	resetQuizHistory,
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
	difficultySignal.set("beginner");
	resetQuizHistory();
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

// ── Difficulty ──
test("difficultySignal defaults to beginner", () => {
	expect(difficultySignal.get()).toBe("beginner");
});

test("getChordsForDifficulty returns beginner pool", () => {
	const chords = getChordsForDifficulty("beginner");
	expect(chords).toContain("C");
	expect(chords).toContain("G");
	expect(chords).toContain("Am");
	expect(chords.length).toBeLessThanOrEqual(10);
});

test("getChordsForDifficulty intermediate has more chords than beginner", () => {
	const beginner = getChordsForDifficulty("beginner");
	const intermediate = getChordsForDifficulty("intermediate");
	expect(intermediate.length).toBeGreaterThan(beginner.length);
});

test("getChordsForDifficulty advanced has more chords than intermediate", () => {
	const intermediate = getChordsForDifficulty("intermediate");
	const advanced = getChordsForDifficulty("advanced");
	expect(advanced.length).toBeGreaterThan(intermediate.length);
});

test("getChordsForDifficulty uses signal when no arg", () => {
	difficultySignal.set("advanced");
	const chords = getChordsForDifficulty();
	expect(chords.length).toBeGreaterThan(
		getChordsForDifficulty("beginner").length,
	);
});

// ── Quiz non-repetition ──
test("pickQuizChord does not repeat same chord consecutively", () => {
	resetQuizHistory();
	const results: string[] = [];
	for (let i = 0; i < 20; i++) {
		const q = pickQuizChord();
		if (q) results.push(q.chordName);
	}
	// Check no two consecutive chords are the same
	for (let i = 1; i < results.length; i++) {
		if (results.length > 2) {
			// With beginner pool (8 chords), consecutive repeats should not happen
			expect(results[i]).not.toBe(results[i - 1]);
		}
	}
});

test("pickQuizChord respects difficulty setting", () => {
	difficultySignal.set("beginner");
	resetQuizHistory();
	const beginnerChords = getChordsForDifficulty("beginner");
	for (let i = 0; i < 10; i++) {
		const q = pickQuizChord();
		if (q) {
			expect(beginnerChords).toContain(q.chordName);
		}
	}
});

test("resetQuizHistory allows previously seen chords again", () => {
	// Pick several chords to fill history
	for (let i = 0; i < 5; i++) pickQuizChord();
	resetQuizHistory();
	// After reset, it should still work fine
	const q = pickQuizChord();
	expect(q).not.toBeNull();
});

// ── Transition pair non-repetition ──
test("pickTransitionPair does not repeat same pair consecutively", () => {
	const pairs: string[] = [];
	for (let i = 0; i < 20; i++) {
		const pair = pickTransitionPair();
		pairs.push(`${pair.from}-${pair.to}`);
	}
	for (let i = 1; i < pairs.length; i++) {
		expect(pairs[i]).not.toBe(pairs[i - 1]);
	}
});
