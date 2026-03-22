import { expect, test } from "bun:test";
import {
	checkShareUrl,
	decodeShareUrl,
	encodeShareUrl,
	exportSongJSON,
} from "../src/sharing";
import { createSong } from "../src/songs";
import type { ChordItem } from "../src/state";

// ── encodeShareUrl / decodeShareUrl ──
test("encodeShareUrl produces a URL string", () => {
	const chords: ChordItem[] = [
		{ name: "C", variationIndex: 0 },
		{ name: "G", variationIndex: 1 },
	];
	const url = encodeShareUrl(chords);
	expect(url).toContain("#share=");
});

test("decodeShareUrl roundtrips with encodeShareUrl", () => {
	const chords: ChordItem[] = [
		{ name: "Am", variationIndex: 0 },
		{ name: "F", variationIndex: 2 },
	];
	const url = encodeShareUrl(chords);
	const hash = url.split("#")[1];
	const decoded = decodeShareUrl(`#${hash}`);
	expect(decoded).toEqual(chords);
});

test("decodeShareUrl returns null for invalid hash", () => {
	expect(decodeShareUrl("#share=invalid!!!")).toBeNull();
});

test("decodeShareUrl returns null for empty hash", () => {
	expect(decodeShareUrl("")).toBeNull();
});

test("decodeShareUrl handles empty chords array", () => {
	const chords: ChordItem[] = [];
	const url = encodeShareUrl(chords);
	const hash = url.split("#")[1];
	const decoded = decodeShareUrl(`#${hash}`);
	expect(decoded).toEqual([]);
});

// ── checkShareUrl ──
test("checkShareUrl returns null when no hash", () => {
	// In test environment, window.location.hash is ""
	expect(checkShareUrl()).toBeNull();
});

// ── exportSongJSON ──
test("exportSongJSON produces valid JSON", () => {
	const song = createSong({ title: "Test", artist: "Artist" });
	const json = exportSongJSON(song);
	const parsed = JSON.parse(json);
	expect(parsed.title).toBe("Test");
	expect(parsed.artist).toBe("Artist");
});
