/** Practice tools: quiz, ear training, chord transition, streak tracking */

import { allChordNames, getChordData } from "./chords";
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

// ─── Quiz Mode ─────────────────────────────────────────

export interface QuizQuestion {
	chordName: string;
	midiNotes: number[];
}

/** Pick a random chord suitable for quiz, prioritizing due chords */
export function pickQuizChord(): QuizQuestion | null {
	const due = getDueChords(5);
	let candidates: string[];

	if (due.length > 0) {
		candidates = due;
	} else {
		// Pick from common chords
		const common = ["A", "Am", "B", "Bm", "C", "D", "Dm", "E", "Em", "F", "G"];
		candidates = common.filter((c) => allChordNames.includes(c));
	}

	if (candidates.length === 0) return null;

	const chordName = candidates[Math.floor(Math.random() * candidates.length)];
	const data = getChordData(chordName, 0);
	if (!data) return null;

	return { chordName, midiNotes: data.midiNotes };
}

// ─── Chord Transition Trainer ──────────────────────────

export interface TransitionPair {
	from: string;
	to: string;
}

export function pickTransitionPair(): TransitionPair {
	const common = ["A", "Am", "C", "D", "Dm", "E", "Em", "F", "G"];
	const from = common[Math.floor(Math.random() * common.length)];
	let to = from;
	while (to === from) {
		to = common[Math.floor(Math.random() * common.length)];
	}
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
