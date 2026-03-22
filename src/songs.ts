/** Songs, setlists, and progression state management */

import { createSignal } from "./state";

// ─── Progression Builder ───────────────────────────────

export interface ProgressionItem {
	chordName: string;
	beats: number;
}

export interface Progression {
	id: string;
	key: string;
	items: ProgressionItem[];
	loop: boolean;
}

export const progressionSignal = createSignal<Progression>({
	id: crypto.randomUUID(),
	key: "C",
	items: [],
	loop: true,
});

// ─── Song & Setlist ────────────────────────────────────

export interface Song {
	id: string;
	title: string;
	artist: string;
	key: string;
	tempo: number;
	timeSignature: string;
	chords: ProgressionItem[];
	lyrics: string;
	createdAt: number;
	updatedAt: number;
}

export interface Setlist {
	id: string;
	name: string;
	songIds: string[];
	createdAt: number;
}

const SONGS_KEY = "guitar-chords-songs";
const SETLISTS_KEY = "guitar-chords-setlists";

const hasDOM =
	typeof window !== "undefined" && typeof localStorage !== "undefined";

function loadSongs(): Song[] {
	if (!hasDOM) return [];
	try {
		const saved = localStorage.getItem(SONGS_KEY);
		return saved ? JSON.parse(saved) : [];
	} catch {
		return [];
	}
}

function loadSetlists(): Setlist[] {
	if (!hasDOM) return [];
	try {
		const saved = localStorage.getItem(SETLISTS_KEY);
		return saved ? JSON.parse(saved) : [];
	} catch {
		return [];
	}
}

export const songsSignal = createSignal<Song[]>(loadSongs());
export const setlistsSignal = createSignal<Setlist[]>(loadSetlists());
export const activeSongSignal = createSignal<Song | null>(null);
export const activeSetlistSignal = createSignal<Setlist | null>(null);

if (hasDOM) {
	songsSignal.subscribe((songs) => {
		localStorage.setItem(SONGS_KEY, JSON.stringify(songs));
	});
	setlistsSignal.subscribe((setlists) => {
		localStorage.setItem(SETLISTS_KEY, JSON.stringify(setlists));
	});
}

// ─── Song CRUD ─────────────────────────────────────────

export function createSong(partial: Partial<Song> = {}): Song {
	const now = Date.now();
	return {
		id: crypto.randomUUID(),
		title: partial.title ?? "Untitled Song",
		artist: partial.artist ?? "",
		key: partial.key ?? "C",
		tempo: partial.tempo ?? 120,
		timeSignature: partial.timeSignature ?? "4/4",
		chords: partial.chords ?? [],
		lyrics: partial.lyrics ?? "",
		createdAt: now,
		updatedAt: now,
	};
}

export function addSong(song: Song) {
	songsSignal.update((songs) => [...songs, song]);
}

export function updateSong(id: string, updates: Partial<Song>) {
	songsSignal.update((songs) =>
		songs.map((s) =>
			s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s,
		),
	);
}

export function deleteSong(id: string) {
	songsSignal.update((songs) => songs.filter((s) => s.id !== id));
	// Also remove from setlists
	setlistsSignal.update((setlists) =>
		setlists.map((sl) => ({
			...sl,
			songIds: sl.songIds.filter((sid) => sid !== id),
		})),
	);
}

export function getSong(id: string): Song | undefined {
	return songsSignal.get().find((s) => s.id === id);
}

// ─── Setlist CRUD ──────────────────────────────────────

export function createSetlist(name: string): Setlist {
	return {
		id: crypto.randomUUID(),
		name,
		songIds: [],
		createdAt: Date.now(),
	};
}

export function addSetlist(setlist: Setlist) {
	setlistsSignal.update((s) => [...s, setlist]);
}

export function deleteSetlist(id: string) {
	setlistsSignal.update((s) => s.filter((sl) => sl.id !== id));
}

export function addSongToSetlist(setlistId: string, songId: string) {
	setlistsSignal.update((setlists) =>
		setlists.map((sl) =>
			sl.id === setlistId ? { ...sl, songIds: [...sl.songIds, songId] } : sl,
		),
	);
}

export function removeSongFromSetlist(setlistId: string, songId: string) {
	setlistsSignal.update((setlists) =>
		setlists.map((sl) =>
			sl.id === setlistId
				? { ...sl, songIds: sl.songIds.filter((id) => id !== songId) }
				: sl,
		),
	);
}

/** Estimate setlist duration in minutes */
export function estimateSetlistDuration(setlistId: string): number {
	const setlist = setlistsSignal.get().find((s) => s.id === setlistId);
	if (!setlist) return 0;
	const songs = songsSignal.get();
	let totalBeats = 0;
	for (const songId of setlist.songIds) {
		const song = songs.find((s) => s.id === songId);
		if (song) {
			const chordBeats = song.chords.reduce((sum, c) => sum + c.beats, 0);
			totalBeats += Math.max(chordBeats, 16); // min 16 beats per song
		}
	}
	const avgBpm = 120;
	return totalBeats / avgBpm;
}

// ─── ChordPro Parser ──────────────────────────────────

export interface ChordProLine {
	type: "lyrics" | "directive";
	text: string;
	chords?: { position: number; chord: string }[];
}

export function parseChordPro(input: string): ChordProLine[] {
	const lines: ChordProLine[] = [];
	for (const raw of input.split("\n")) {
		const trimmed = raw.trim();

		// Directive lines like {title: My Song}
		if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
			lines.push({ type: "directive", text: trimmed.slice(1, -1) });
			continue;
		}

		// Parse [chord] markers in lyrics
		const chords: { position: number; chord: string }[] = [];
		let plainText = "";
		let i = 0;
		while (i < trimmed.length) {
			if (trimmed[i] === "[") {
				const end = trimmed.indexOf("]", i);
				if (end > i) {
					chords.push({
						position: plainText.length,
						chord: trimmed.slice(i + 1, end),
					});
					i = end + 1;
					continue;
				}
			}
			plainText += trimmed[i];
			i++;
		}

		lines.push({ type: "lyrics", text: plainText, chords });
	}
	return lines;
}

/** Export song data as ChordPro format */
export function exportChordPro(song: Song): string {
	const lines: string[] = [];
	lines.push(`{title: ${song.title}}`);
	if (song.artist) lines.push(`{artist: ${song.artist}}`);
	lines.push(`{key: ${song.key}}`);
	lines.push(`{tempo: ${song.tempo}}`);
	lines.push("");

	if (song.lyrics) {
		lines.push(song.lyrics);
	} else {
		for (const chord of song.chords) {
			lines.push(`[${chord.chordName}]`);
		}
	}

	return lines.join("\n");
}

/** Import from ChordPro text */
export function importChordPro(text: string): Partial<Song> {
	const parsed = parseChordPro(text);
	const song: Partial<Song> = {};
	const chords: ProgressionItem[] = [];
	const lyricsLines: string[] = [];

	for (const line of parsed) {
		if (line.type === "directive") {
			const [key, ...valueParts] = line.text.split(":");
			const value = valueParts.join(":").trim();
			switch (key.trim().toLowerCase()) {
				case "title":
				case "t":
					song.title = value;
					break;
				case "artist":
					song.artist = value;
					break;
				case "key":
					song.key = value;
					break;
				case "tempo":
					song.tempo = Number.parseInt(value, 10) || 120;
					break;
			}
		} else {
			if (line.chords) {
				for (const c of line.chords) {
					chords.push({ chordName: c.chord, beats: 4 });
				}
			}
			if (line.text) lyricsLines.push(line.text);
		}
	}

	song.chords = chords;
	song.lyrics = lyricsLines.join("\n");
	return song;
}
