import { beforeEach, expect, test } from "bun:test";
import {
	addSetlist,
	addSong,
	addSongToSetlist,
	createSetlist,
	createSong,
	deleteSetlist,
	deleteSong,
	exportChordPro,
	getSong,
	importChordPro,
	parseChordPro,
	progressionSignal,
	removeSongFromSetlist,
	setlistsSignal,
	songsSignal,
	updateSong,
} from "../src/songs";

beforeEach(() => {
	songsSignal.set([]);
	setlistsSignal.set([]);
});

// ── createSong ──
test("createSong creates a song with defaults", () => {
	const song = createSong();
	expect(song.id).toBeTruthy();
	expect(song.title).toBe("Untitled Song");
	expect(song.key).toBe("C");
	expect(song.tempo).toBe(120);
	expect(song.chords).toEqual([]);
});

test("createSong uses provided values", () => {
	const song = createSong({
		title: "My Song",
		artist: "Me",
		key: "G",
		tempo: 140,
	});
	expect(song.title).toBe("My Song");
	expect(song.artist).toBe("Me");
	expect(song.key).toBe("G");
	expect(song.tempo).toBe(140);
});

// ── Song CRUD ──
test("addSong adds to signal", () => {
	const song = createSong({ title: "Test" });
	addSong(song);
	expect(songsSignal.get()).toHaveLength(1);
	expect(songsSignal.get()[0].title).toBe("Test");
});

test("getSong retrieves by id", () => {
	const song = createSong({ title: "Findable" });
	addSong(song);
	const found = getSong(song.id);
	expect(found).toBeTruthy();
	expect(found?.title).toBe("Findable");
});

test("getSong returns undefined for missing id", () => {
	expect(getSong("nonexistent")).toBeUndefined();
});

test("updateSong updates fields", () => {
	const song = createSong({ title: "Old" });
	addSong(song);
	updateSong(song.id, { title: "New", tempo: 160 });
	const updated = getSong(song.id);
	expect(updated?.title).toBe("New");
	expect(updated?.tempo).toBe(160);
});

test("deleteSong removes from signal", () => {
	const song = createSong();
	addSong(song);
	expect(songsSignal.get()).toHaveLength(1);
	deleteSong(song.id);
	expect(songsSignal.get()).toHaveLength(0);
});

// ── Setlist CRUD ──
test("createSetlist creates with name", () => {
	const sl = createSetlist("My Set");
	expect(sl.name).toBe("My Set");
	expect(sl.songIds).toEqual([]);
});

test("addSetlist and deleteSetlist work", () => {
	const sl = createSetlist("Set 1");
	addSetlist(sl);
	expect(setlistsSignal.get()).toHaveLength(1);
	deleteSetlist(sl.id);
	expect(setlistsSignal.get()).toHaveLength(0);
});

test("addSongToSetlist adds song id", () => {
	const sl = createSetlist("Set");
	addSetlist(sl);
	const song = createSong();
	addSong(song);
	addSongToSetlist(sl.id, song.id);
	const updated = setlistsSignal.get().find((s) => s.id === sl.id)!;
	expect(updated.songIds).toContain(song.id);
});

test("removeSongFromSetlist removes song id", () => {
	const sl = createSetlist("Set");
	addSetlist(sl);
	const song = createSong();
	addSong(song);
	addSongToSetlist(sl.id, song.id);
	removeSongFromSetlist(sl.id, song.id);
	const updated = setlistsSignal.get().find((s) => s.id === sl.id)!;
	expect(updated.songIds).not.toContain(song.id);
});

test("deleteSong also removes from setlists", () => {
	const sl = createSetlist("Set");
	addSetlist(sl);
	const song = createSong();
	addSong(song);
	addSongToSetlist(sl.id, song.id);
	deleteSong(song.id);
	const updated = setlistsSignal.get().find((s) => s.id === sl.id)!;
	expect(updated.songIds).not.toContain(song.id);
});

// ── ChordPro ──
test("parseChordPro parses lines with chords", () => {
	const result = parseChordPro("[Am]Hello [G]World");
	expect(result.length).toBeGreaterThan(0);
	const firstLine = result[0];
	expect(firstLine.type).toBe("lyrics");
	expect(firstLine.chords).toBeTruthy();
	expect(firstLine.chords?.length).toBe(2);
});

test("parseChordPro handles directives", () => {
	const result = parseChordPro("{title: My Song}");
	expect(result.length).toBeGreaterThan(0);
	expect(result[0].type).toBe("directive");
});

test("exportChordPro produces valid output", () => {
	const song = createSong({
		title: "Test Song",
		artist: "Artist",
		key: "G",
		tempo: 100,
		lyrics: "Hello world",
	});
	const output = exportChordPro(song);
	expect(output).toContain("{title: Test Song}");
	expect(output).toContain("{artist: Artist}");
	expect(output).toContain("{key: G}");
	expect(output).toContain("Hello world");
});

test("importChordPro extracts metadata", () => {
	const text = `{title: My Song}
{artist: Me}
{key: D}
{tempo: 130}
[D]Hello [A]world`;
	const result = importChordPro(text);
	expect(result.title).toBe("My Song");
	expect(result.artist).toBe("Me");
	expect(result.key).toBe("D");
	expect(result.tempo).toBe(130);
});

test("importChordPro extracts chords", () => {
	const text = "[Am]Hello [G]World [F]Test";
	const result = importChordPro(text);
	expect(result.chords).toBeTruthy();
	expect(result.chords?.length).toBeGreaterThan(0);
});

// ── progressionSignal ──
test("progressionSignal has initial state", () => {
	const prog = progressionSignal.get();
	expect(prog.items).toEqual([]);
	expect(prog.loop).toBe(true);
});
