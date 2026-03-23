import { chords as guitarChords } from "@tombatossals/chords-db/lib/guitar.json";
import { createSignal } from "./state";

export type Instrument = "guitar";

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

/** Get chord database for guitar */
export function getChordDatabase(): Record<
	string,
	{ key: string; suffix: string; positions: unknown[] }[]
> {
	return guitarChords as Record<
		string,
		{ key: string; suffix: string; positions: unknown[] }[]
	>;
}
