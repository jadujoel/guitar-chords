/** Practice tools: quiz, ear training, chord transition, streak tracking */

import { getChordData } from "./chords";
import { createSignal } from "./state";

// ─── Practice State ────────────────────────────────────

export interface PracticeSession {
	startTime: number;
	chordsAttempted: string[];
	correctCount: number;
	totalCount: number;
	mode: PracticeMode;
}

export type PracticeMode = "quiz" | "ear" | "transition" | "none";

export const practiceSignal = createSignal<PracticeSession>({
	startTime: 0,
	chordsAttempted: [],
	correctCount: 0,
	totalCount: 0,
	mode: "none",
});

// ─── Streak Tracking ───────────────────────────────────

const STREAK_KEY = "guitar-chords-streak";
const MASTERY_KEY = "guitar-chords-mastery";

const hasDOM =
	typeof window !== "undefined" && typeof localStorage !== "undefined";

export interface StreakData {
	currentStreak: number;
	longestStreak: number;
	lastPracticeDate: string;
	totalSessions: number;
}

function loadStreak(): StreakData {
	if (!hasDOM) {
		return {
			currentStreak: 0,
			longestStreak: 0,
			lastPracticeDate: "",
			totalSessions: 0,
		};
	}
	try {
		const saved = localStorage.getItem(STREAK_KEY);
		return saved
			? JSON.parse(saved)
			: {
					currentStreak: 0,
					longestStreak: 0,
					lastPracticeDate: "",
					totalSessions: 0,
				};
	} catch {
		return {
			currentStreak: 0,
			longestStreak: 0,
			lastPracticeDate: "",
			totalSessions: 0,
		};
	}
}

export const streakSignal = createSignal<StreakData>(loadStreak());

if (hasDOM) {
	streakSignal.subscribe((data) => {
		localStorage.setItem(STREAK_KEY, JSON.stringify(data));
	});
}

function getTodayStr(): string {
	return new Date().toISOString().split("T")[0];
}

function getYesterdayStr(): string {
	const d = new Date();
	d.setDate(d.getDate() - 1);
	return d.toISOString().split("T")[0];
}

export function recordPracticeDay() {
	const today = getTodayStr();
	const yesterday = getYesterdayStr();

	streakSignal.update((data) => {
		if (data.lastPracticeDate === today) {
			return data; // Already recorded today
		}
		let newStreak: number;
		if (data.lastPracticeDate === yesterday) {
			newStreak = data.currentStreak + 1;
		} else {
			newStreak = 1;
		}
		return {
			currentStreak: newStreak,
			longestStreak: Math.max(data.longestStreak, newStreak),
			lastPracticeDate: today,
			totalSessions: data.totalSessions + 1,
		};
	});
}

// ─── Chord Mastery (spaced repetition) ─────────────────

export interface ChordMastery {
	[chordName: string]: {
		level: number; // 0-5 mastery
		nextReview: number; // timestamp
		attempts: number;
		correct: number;
	};
}

function loadMastery(): ChordMastery {
	if (!hasDOM) return {};
	try {
		const saved = localStorage.getItem(MASTERY_KEY);
		return saved ? JSON.parse(saved) : {};
	} catch {
		return {};
	}
}

export const masterySignal = createSignal<ChordMastery>(loadMastery());

if (hasDOM) {
	masterySignal.subscribe((data) => {
		localStorage.setItem(MASTERY_KEY, JSON.stringify(data));
	});
}

export function recordAttempt(chordName: string, correct: boolean) {
	masterySignal.update((mastery) => {
		const existing = mastery[chordName] ?? {
			level: 0,
			nextReview: 0,
			attempts: 0,
			correct: 0,
		};

		let newLevel: number;
		if (correct) {
			newLevel = Math.min(5, existing.level + 1);
		} else {
			newLevel = Math.max(0, existing.level - 1);
		}

		// Spaced repetition intervals (hours)
		const intervals = [1, 4, 12, 24, 72, 168];
		const nextReview = Date.now() + (intervals[newLevel] ?? 168) * 3600 * 1000;

		return {
			...mastery,
			[chordName]: {
				level: newLevel,
				nextReview,
				attempts: existing.attempts + 1,
				correct: existing.correct + (correct ? 1 : 0),
			},
		};
	});
}

/** Get chords that are due for review, sorted by priority */
export function getDueChords(limit = 10): string[] {
	const mastery = masterySignal.get();
	const now = Date.now();

	const due = Object.entries(mastery)
		.filter(([, data]) => data.nextReview <= now)
		.sort(([, a], [, b]) => a.level - b.level)
		.map(([name]) => name);

	return due.slice(0, limit);
}

// ─── Difficulty Levels ─────────────────────────────────

export type Difficulty = "beginner" | "intermediate" | "advanced";

const DIFFICULTY_KEY = "guitar-chords-difficulty";

function loadDifficulty(): Difficulty {
	if (!hasDOM) return "beginner";
	try {
		const saved = localStorage.getItem(DIFFICULTY_KEY);
		if (
			saved === "beginner" ||
			saved === "intermediate" ||
			saved === "advanced"
		)
			return saved;
		return "beginner";
	} catch {
		return "beginner";
	}
}

export const difficultySignal = createSignal<Difficulty>(loadDifficulty());

if (hasDOM) {
	difficultySignal.subscribe((d) => {
		localStorage.setItem(DIFFICULTY_KEY, d);
	});
}

const CHORD_POOLS: Record<Difficulty, string[]> = {
	beginner: ["A", "Am", "C", "D", "Dm", "E", "Em", "G"],
	intermediate: [
		"A",
		"Am",
		"B",
		"Bm",
		"C",
		"D",
		"Dm",
		"E",
		"Em",
		"F",
		"G",
		"A7",
		"D7",
		"E7",
		"G7",
		"Am7",
		"Dm7",
		"Em7",
		"Cmaj7",
		"Fmaj7",
	],
	advanced: [
		"A",
		"Am",
		"B",
		"Bm",
		"C",
		"D",
		"Dm",
		"E",
		"Em",
		"F",
		"G",
		"A7",
		"B7",
		"C7",
		"D7",
		"E7",
		"F7",
		"G7",
		"Am7",
		"Bm7",
		"Cm7",
		"Dm7",
		"Em7",
		"Amaj7",
		"Cmaj7",
		"Dmaj7",
		"Fmaj7",
		"Gmaj7",
		"Asus4",
		"Dsus4",
		"Esus4",
		"Asus2",
		"Dsus2",
		"Cadd9",
		"Gadd9",
		"F#m",
		"C#m",
		"G#m",
		"Bb",
		"Eb",
	],
};

export function getChordsForDifficulty(difficulty?: Difficulty): string[] {
	const d = difficulty ?? difficultySignal.get();
	return CHORD_POOLS[d].filter((c) => getChordData(c, 0) !== null);
}

// ─── Quiz Mode ─────────────────────────────────────────

export interface QuizQuestion {
	chordName: string;
	midiNotes: number[];
}

/** Recent chord history to prevent repetition */
let recentQuizChords: string[] = [];

/** Reset recent chord history (call when starting a new session) */
export function resetQuizHistory() {
	recentQuizChords = [];
}

/** Pick a random chord suitable for quiz, avoiding recent repeats */
export function pickQuizChord(): QuizQuestion | null {
	const due = getDueChords(5);
	const pool = getChordsForDifficulty();
	let candidates: string[];

	if (due.length > 0) {
		// Filter due chords to those in the current difficulty pool
		candidates = due.filter((c) => pool.includes(c));
		if (candidates.length === 0) candidates = due;
	} else {
		candidates = pool;
	}

	if (candidates.length === 0) return null;

	// Remove recently used chords to avoid repetition
	const historySize = Math.min(Math.floor(candidates.length / 2), 3);
	const recentSet = new Set(recentQuizChords.slice(-historySize));
	let filtered = candidates.filter((c) => !recentSet.has(c));
	if (filtered.length === 0) filtered = candidates;

	const chordName = filtered[Math.floor(Math.random() * filtered.length)];
	const data = getChordData(chordName, 0);
	if (!data) return null;

	recentQuizChords.push(chordName);
	// Keep history bounded
	if (recentQuizChords.length > 10)
		recentQuizChords = recentQuizChords.slice(-10);

	return { chordName, midiNotes: data.midiNotes };
}

// ─── Chord Transition Trainer ──────────────────────────

export interface TransitionPair {
	from: string;
	to: string;
}

let lastTransitionPair: TransitionPair | null = null;

export function pickTransitionPair(): TransitionPair {
	const pool = getChordsForDifficulty();
	const candidates =
		pool.length >= 2 ? pool : ["A", "Am", "C", "D", "Dm", "E", "Em", "F", "G"];

	let from: string;
	let to: string;
	let attempts = 0;
	do {
		from = candidates[Math.floor(Math.random() * candidates.length)];
		to = candidates[Math.floor(Math.random() * candidates.length)];
		attempts++;
	} while (
		(to === from ||
			(lastTransitionPair &&
				from === lastTransitionPair.from &&
				to === lastTransitionPair.to)) &&
		attempts < 20
	);

	lastTransitionPair = { from, to };
	return { from, to };
}

/** Generate a mastery heatmap suitable for display */
export function getMasteryHeatmap(): {
	chord: string;
	level: number;
	attempts: number;
}[] {
	const mastery = masterySignal.get();
	return Object.entries(mastery).map(([chord, data]) => ({
		chord,
		level: data.level,
		attempts: data.attempts,
	}));
}
