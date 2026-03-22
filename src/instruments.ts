/** Multi-instrument support: guitar, ukulele, bass, mandolin */

import { chords as guitarChords } from "@tombatossals/chords-db/lib/guitar.json";
import { createSignal } from "./state";

export type Instrument = "guitar" | "ukulele" | "bass" | "mandolin";

export interface InstrumentConfig {
	name: string;
	strings: number;
	tuning: number[]; // MIDI notes for open strings, low to high
	frets: number;
	tuningName: string;
}

export const INSTRUMENTS: Record<Instrument, InstrumentConfig> = {
	guitar: {
		name: "Guitar",
		strings: 6,
		tuning: [40, 45, 50, 55, 59, 64], // E2 A2 D3 G3 B3 E4
		frets: 22,
		tuningName: "Standard",
	},
	ukulele: {
		name: "Ukulele",
		strings: 4,
		tuning: [67, 60, 64, 69], // G4 C4 E4 A4
		frets: 15,
		tuningName: "Standard (GCEA)",
	},
	bass: {
		name: "Bass",
		strings: 4,
		tuning: [28, 33, 38, 43], // E1 A1 D2 G2
		frets: 22,
		tuningName: "Standard",
	},
	mandolin: {
		name: "Mandolin",
		strings: 4,
		tuning: [55, 62, 69, 76], // G3 D4 A4 E5
		frets: 17,
		tuningName: "Standard (GDAE)",
	},
};

export const GUITAR_TUNINGS: Record<string, number[]> = {
	Standard: [40, 45, 50, 55, 59, 64],
	"Drop D": [38, 45, 50, 55, 59, 64],
	"Open G": [38, 43, 50, 55, 59, 62],
	"Open D": [38, 45, 50, 54, 57, 62],
	DADGAD: [38, 45, 50, 55, 57, 62],
	"Half Step Down": [39, 44, 49, 54, 58, 63],
};

export const instrumentSignal = createSignal<Instrument>("guitar");
export const tuningSignal = createSignal<number[]>(INSTRUMENTS.guitar.tuning);

instrumentSignal.subscribe((inst) => {
	tuningSignal.set(INSTRUMENTS[inst].tuning);
});

export function getInstrumentConfig(): InstrumentConfig {
	return INSTRUMENTS[instrumentSignal.get()];
}

/** Get chord database for current instrument */
export function getChordDatabase(): Record<
	string,
	{ key: string; suffix: string; positions: unknown[] }[]
> {
	const inst = instrumentSignal.get();
	// Only guitar has full chord DB from the package
	if (inst === "guitar") {
		return guitarChords as Record<
			string,
			{ key: string; suffix: string; positions: unknown[] }[]
		>;
	}
	// For other instruments, return empty - users can create custom chords
	return {};
}
