/**
 * Downloads high-quality guitar samples from the MusyngKite soundfont
 * (via midi-js-soundfonts by gleitz, 761★, MIT/CC-BY-SA 3.0).
 *
 * MusyngKite is derived from a 1.75GB uncompressed soundfont and provides
 * significantly better quality than FluidR3 GM used by WebAudioFont.
 *
 * Instruments downloaded:
 * - acoustic_guitar_nylon (GM program 24)
 * - acoustic_guitar_steel (GM program 25)
 * - electric_guitar_jazz (GM program 26)
 * - electric_guitar_clean (GM program 27)
 * - electric_guitar_muted (GM program 28)
 * - overdriven_guitar (GM program 29)
 * - distortion_guitar (GM program 30)
 *
 * Run: bun scripts/download-samples.ts
 */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = "https://gleitz.github.io/midi-js-soundfonts/MusyngKite";

const INSTRUMENTS = [
	"acoustic_guitar_nylon",
	"acoustic_guitar_steel",
	"electric_guitar_jazz",
	"electric_guitar_clean",
	"electric_guitar_muted",
	"overdriven_guitar",
	"distortion_guitar",
];

const SOUND_DIR = join(import.meta.dir, "..", "sound");

async function downloadAndExtract(instrument: string): Promise<void> {
	const url = `${BASE_URL}/${instrument}-ogg.js`;
	console.log(`Fetching ${instrument}...`);

	const response = await fetch(url);
	if (!response.ok) {
		console.error(`  Failed to fetch ${instrument}: ${response.status}`);
		return;
	}

	const jsText = await response.text();

	// The JS file defines: MIDI.Soundfont.instrument_name = { "C2": "data:audio/ogg;base64,...", ... }
	// Extract the JSON object from the JS
	const objectMatch = jsText.match(/MIDI\.Soundfont\.\w+\s*=\s*(\{[\s\S]*\})/);
	if (!objectMatch) {
		console.error(`  Could not parse soundfont data for ${instrument}`);
		return;
	}

	// Parse the JSON-like object (it's valid JS object literal with string keys)
	// biome-ignore lint/security/noGlobalEval: Parsing soundfont JS data objects
	const noteData: Record<string, string> = eval(`(${objectMatch[1]})`);
	const instrumentDir = join(SOUND_DIR, instrument);
	await mkdir(instrumentDir, { recursive: true });

	let count = 0;
	for (const [noteName, dataUri] of Object.entries(noteData)) {
		// dataUri is like "data:audio/ogg;base64,T2dnUw..."
		const base64Data = dataUri.split(",")[1];
		if (!base64Data) continue;

		const buffer = Buffer.from(base64Data, "base64");
		// Sanitize note name for filename (e.g., "C#4" -> "Cs4")
		const safeNoteName = noteName.replace("#", "s").replace("b", "b");
		const filePath = join(instrumentDir, `${safeNoteName}.ogg`);
		await Bun.write(filePath, new Uint8Array(buffer));
		count++;
	}

	console.log(`  Saved ${count} note samples to sound/${instrument}/`);
}

async function main() {
	console.log("Downloading MusyngKite guitar samples...");
	console.log(
		"Source: https://github.com/gleitz/midi-js-soundfonts (MIT/CC-BY-SA 3.0)\n",
	);

	await mkdir(SOUND_DIR, { recursive: true });

	// Write license file
	await Bun.write(
		join(SOUND_DIR, "LICENSE.md"),
		`# Guitar Sound Samples

## Source
MusyngKite Soundfont via [midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts)

## License
Creative Commons Attribution Share-Alike 3.0
https://creativecommons.org/licenses/by-sa/3.0/

## Original Soundfont
[Musyng Kite](http://www.synthfont.com/SoundFonts/Musyng.sfpack) (1.75 GB uncompressed)
`,
	);

	for (const instrument of INSTRUMENTS) {
		await downloadAndExtract(instrument);
	}

	// Generate a manifest of all available samples
	const manifest: Record<string, string[]> = {};
	for (const instrument of INSTRUMENTS) {
		const dir = join(SOUND_DIR, instrument);
		const glob = new Bun.Glob("*.ogg");
		const files: string[] = [];
		for await (const file of glob.scan(dir)) {
			files.push(file.replace(".ogg", ""));
		}
		files.sort();
		manifest[instrument] = files;
	}

	await Bun.write(
		join(SOUND_DIR, "manifest.json"),
		JSON.stringify(manifest, null, "\t"),
	);

	console.log("\nDone! Manifest written to sound/manifest.json");
	console.log("License info written to sound/LICENSE.md");
}

main().catch(console.error);
