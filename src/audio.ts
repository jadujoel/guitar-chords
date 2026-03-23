/**
 * Enhanced Audio engine: Sample-based chord playback with
 * strum direction, adjustable speed/volume/reverb, loop, metronome, single-note playback.
 * Uses high-quality MusyngKite OGG samples (CC-BY-SA 3.0).
 */

import { createSignal } from "./state";

// ─── Guitar Tone Definitions ───────────────────────────
export type GuitarTone =
	| "nylon"
	| "steel"
	| "jazz"
	| "clean"
	| "muted"
	| "overdriven"
	| "distortion";

export interface ToneConfig {
	name: string;
	folder: string;
}

export const GUITAR_TONES: Record<GuitarTone, ToneConfig> = {
	nylon: { name: "Nylon", folder: "acoustic_guitar_nylon" },
	steel: { name: "Steel", folder: "acoustic_guitar_steel" },
	jazz: { name: "Jazz", folder: "electric_guitar_jazz" },
	clean: { name: "Clean Electric", folder: "electric_guitar_clean" },
	muted: { name: "Muted Electric", folder: "electric_guitar_muted" },
	overdriven: { name: "Overdriven", folder: "overdriven_guitar" },
	distortion: { name: "Distortion", folder: "distortion_guitar" },
};

// ─── MIDI ↔ Note name mapping ──────────────────────────
const NOTE_NAMES = [
	"C",
	"Db",
	"D",
	"Eb",
	"E",
	"F",
	"Gb",
	"G",
	"Ab",
	"A",
	"Bb",
	"B",
];

export function midiToNoteName(midi: number): string {
	const octave = Math.floor(midi / 12) - 1;
	const note = NOTE_NAMES[midi % 12];
	return `${note}${octave}`;
}

// ─── Sample cache & loader ─────────────────────────────
const _sampleCache = new Map<string, AudioBuffer>();
const _loadingPromises = new Map<string, Promise<AudioBuffer | null>>();

function sampleUrl(folder: string, noteName: string): string {
	return `./sound/${folder}/${noteName}.ogg`;
}

async function loadSample(
	ctx: AudioContext,
	folder: string,
	noteName: string,
): Promise<AudioBuffer | null> {
	const key = `${folder}/${noteName}`;
	const cached = _sampleCache.get(key);
	if (cached) return cached;

	const existing = _loadingPromises.get(key);
	if (existing) return existing;

	const promise = (async () => {
		try {
			const response = await fetch(sampleUrl(folder, noteName));
			if (!response.ok) return null;
			const arrayBuffer = await response.arrayBuffer();
			const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
			_sampleCache.set(key, audioBuffer);
			return audioBuffer;
		} catch {
			return null;
		} finally {
			_loadingPromises.delete(key);
		}
	})();

	_loadingPromises.set(key, promise);
	return promise;
}

// ─── Audio Context & signal chain (lazy initialization) ─
let _audioContext: AudioContext | null = null;
let _masterGain: GainNode | null = null;
let _dryGain: GainNode | null = null;
let _wetGain: GainNode | null = null;
let _initialized = false;

function getMasterGain(): GainNode {
	if (!_masterGain) throw new Error("Audio not initialized");
	return _masterGain;
}

function getCtx(): AudioContext {
	if (!_audioContext) {
		_audioContext = new AudioContext({ sampleRate: 48000 });
	}
	return _audioContext;
}

function ensureInit() {
	if (_initialized) return;
	_initialized = true;
	const ctx = getCtx();

	_masterGain = ctx.createGain();
	_dryGain = ctx.createGain();
	_wetGain = ctx.createGain();
	const convolver = ctx.createConvolver();
	const compressor = ctx.createDynamicsCompressor();

	_masterGain.gain.value = volumeSignal.get();
	_dryGain.gain.value = 1 - reverbSignal.get();
	_wetGain.gain.value = reverbSignal.get();
	compressor.threshold.value = -18;
	compressor.knee.value = 12;
	compressor.ratio.value = 4;

	convolver.buffer = createReverbImpulse(ctx, 1.8, 3.5);

	_masterGain.connect(_dryGain);
	_masterGain.connect(convolver);
	convolver.connect(_wetGain);
	_dryGain.connect(compressor);
	_wetGain.connect(compressor);
	compressor.connect(ctx.destination);

	// React to signal changes
	volumeSignal.subscribe((v) => {
		_masterGain?.gain.setValueAtTime(
			mutedSignal.get() ? 0 : v,
			ctx.currentTime,
		);
	});
	mutedSignal.subscribe((m) => {
		_masterGain?.gain.setValueAtTime(
			m ? 0 : volumeSignal.get(),
			ctx.currentTime,
		);
	});
	reverbSignal.subscribe((v) => {
		_dryGain?.gain.setValueAtTime(1 - v, ctx.currentTime);
		_wetGain?.gain.setValueAtTime(v, ctx.currentTime);
	});

	// Pre-load common guitar range for the default tone
	preloadTone(toneSignal.get());
}

/** Pre-fetch samples for the guitar-relevant MIDI range (40-88 ≈ E2–E6) */
async function preloadTone(tone: GuitarTone): Promise<void> {
	const ctx = getCtx();
	const folder = GUITAR_TONES[tone].folder;
	const promises: Promise<AudioBuffer | null>[] = [];
	for (let midi = 40; midi <= 88; midi++) {
		promises.push(loadSample(ctx, folder, midiToNoteName(midi)));
	}
	await Promise.all(promises);
}

// ─── Audio State (signals for UI binding) ───────────────
export const volumeSignal = createSignal(0.55);
export const reverbSignal = createSignal(0.25);
export const strumSpeedSignal = createSignal(0.03);
export const mutedSignal = createSignal(false);
export type StrumDirection = "down" | "up" | "fingerpick" | "arpeggio";
export const strumDirectionSignal = createSignal<StrumDirection>("down");
export const loopSignal = createSignal(false);
export const bpmSignal = createSignal(120);
export const toneSignal = createSignal<GuitarTone>("nylon");

function getActiveFolder(): string {
	return GUITAR_TONES[toneSignal.get()].folder;
}

export async function loadTone(tone: GuitarTone): Promise<void> {
	toneSignal.set(tone);
	await preloadTone(tone);
}

function createReverbImpulse(
	ctx: AudioContext,
	duration: number,
	decay: number,
): AudioBuffer {
	const length = ctx.sampleRate * duration;
	const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
	for (let ch = 0; ch < 2; ch++) {
		const data = impulse.getChannelData(ch);
		for (let i = 0; i < length; i++) {
			data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
		}
	}
	return impulse;
}

export function resumeAudio() {
	ensureInit();
	const ctx = getCtx();
	if (ctx.state === "suspended") {
		ctx.resume();
	}
}

/** Play a sample-based note at a specific time with velocity envelope */
function playSampleAt(
	ctx: AudioContext,
	buffer: AudioBuffer,
	time: number,
	duration: number,
	velocity: number,
) {
	const source = ctx.createBufferSource();
	source.buffer = buffer;

	const gain = ctx.createGain();
	gain.gain.setValueAtTime(velocity, time);
	// Natural decay envelope
	gain.gain.setValueAtTime(
		velocity,
		time + Math.min(duration * 0.8, buffer.duration * 0.8),
	);
	gain.gain.linearRampToValueAtTime(
		0,
		time + Math.min(duration, buffer.duration),
	);

	source.connect(gain);
	gain.connect(getMasterGain());
	source.start(time);
	source.stop(time + Math.min(duration, buffer.duration));
}

/** Play a single MIDI note (for fretboard clicks) */
export function playNote(midi: number, duration = 1.5, velocity = 0.7) {
	resumeAudio();
	const ctx = getCtx();
	const folder = getActiveFolder();
	const noteName = midiToNoteName(midi);

	// Try cached first for instant playback
	const cached = _sampleCache.get(`${folder}/${noteName}`);
	if (cached) {
		playSampleAt(ctx, cached, ctx.currentTime, duration, velocity);
		return;
	}

	// Load and play async
	loadSample(ctx, folder, noteName).then((buffer) => {
		if (buffer) {
			playSampleAt(ctx, buffer, ctx.currentTime, duration, velocity);
		}
	});
}

/** Play a chord with current strum settings */
export function playChord(midiNotes: number[]) {
	resumeAudio();
	const ctx = getCtx();
	const now = ctx.currentTime;
	const direction = strumDirectionSignal.get();
	const baseInterval = strumSpeedSignal.get();
	const folder = getActiveFolder();

	let orderedNotes: number[];
	switch (direction) {
		case "up":
			orderedNotes = [...midiNotes].reverse();
			break;
		case "fingerpick":
			orderedNotes = fingerpickPattern(midiNotes);
			break;
		case "arpeggio":
			orderedNotes = [...midiNotes];
			break;
		default:
			orderedNotes = [...midiNotes];
	}

	const interval =
		direction === "arpeggio" ? 0.2 : baseInterval + Math.random() * 0.02;
	const duration = direction === "arpeggio" ? 1.0 : 2.5;

	for (let i = 0; i < orderedNotes.length; i++) {
		const time = now + i * interval;
		const velocity = 0.65 + Math.random() * 0.35;
		const noteName = midiToNoteName(orderedNotes[i]);

		const cached = _sampleCache.get(`${folder}/${noteName}`);
		if (cached) {
			playSampleAt(ctx, cached, time, duration, velocity);
		} else {
			loadSample(ctx, folder, noteName).then((buffer) => {
				if (buffer) {
					playSampleAt(ctx, buffer, ctx.currentTime, duration, velocity);
				}
			});
		}
	}
}

function fingerpickPattern(notes: number[]): number[] {
	if (notes.length <= 2) return notes;
	const bass = notes.slice(0, 2);
	const treble = notes.slice(2);
	const result: number[] = [];
	result.push(bass[0]);
	if (treble.length > 0) result.push(treble[treble.length - 1]);
	if (treble.length > 1) result.push(treble[0]);
	if (bass.length > 1) result.push(bass[1]);
	for (let i = 1; i < treble.length - 1; i++) result.push(treble[i]);
	return result;
}

// ─── Loop playback ─────────────────────────────────────
let loopTimer: ReturnType<typeof setInterval> | null = null;
let loopNotes: number[] = [];

export function startLoop(midiNotes: number[]) {
	stopLoop();
	loopNotes = midiNotes;
	loopSignal.set(true);
	playChord(loopNotes);
	const ms = (60 / bpmSignal.get()) * 4 * 1000;
	loopTimer = setInterval(() => playChord(loopNotes), ms);
}

export function stopLoop() {
	if (loopTimer) {
		clearInterval(loopTimer);
		loopTimer = null;
	}
	loopSignal.set(false);
}

// ─── Metronome ─────────────────────────────────────────
export type TimeSignature = "4/4" | "3/4" | "6/8" | "2/4" | "5/4" | "7/8";

export interface MetronomeState {
	playing: boolean;
	bpm: number;
	timeSignature: TimeSignature;
	currentBeat: number;
}

export const metronomeSignal = createSignal<MetronomeState>({
	playing: false,
	bpm: 120,
	timeSignature: "4/4",
	currentBeat: 0,
});

let metronomeTimer: ReturnType<typeof setInterval> | null = null;
let metronomeBeatCallback: ((beat: number, isAccent: boolean) => void) | null =
	null;

function parseTimeSignature(ts: TimeSignature): {
	beats: number;
	subDiv: number;
} {
	const [beats, subDiv] = ts.split("/").map(Number);
	return { beats, subDiv };
}

function createClickBuffer(
	ctx: AudioContext,
	frequency: number,
	duration: number,
): AudioBuffer {
	const length = ctx.sampleRate * duration;
	const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < length; i++) {
		const t = i / ctx.sampleRate;
		data[i] = Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 40) * 0.5;
	}
	return buffer;
}

let _accentClick: AudioBuffer | null = null;
let _normalClick: AudioBuffer | null = null;

function playClick(accent: boolean) {
	ensureInit();
	const ctx = getCtx();
	if (!_accentClick) _accentClick = createClickBuffer(ctx, 1200, 0.05);
	if (!_normalClick) _normalClick = createClickBuffer(ctx, 800, 0.04);
	const source = ctx.createBufferSource();
	source.buffer = accent ? _accentClick : _normalClick;
	const gain = ctx.createGain();
	gain.gain.value = 0.6;
	source.connect(gain);
	gain.connect(ctx.destination);
	source.start();
}

export function onMetronomeBeat(cb: (beat: number, isAccent: boolean) => void) {
	metronomeBeatCallback = cb;
}

export function startMetronome() {
	stopMetronome();
	const state = metronomeSignal.get();
	const { beats } = parseTimeSignature(state.timeSignature);
	let currentBeat = 0;

	const tick = () => {
		const isAccent = currentBeat === 0;
		playClick(isAccent);
		metronomeSignal.update((s) => ({ ...s, playing: true, currentBeat }));
		metronomeBeatCallback?.(currentBeat, isAccent);
		currentBeat = (currentBeat + 1) % beats;
	};

	tick();
	const ms = 60000 / metronomeSignal.get().bpm;
	metronomeTimer = setInterval(tick, ms);
	metronomeSignal.update((s) => ({ ...s, playing: true }));
}

export function stopMetronome() {
	if (metronomeTimer) {
		clearInterval(metronomeTimer);
		metronomeTimer = null;
	}
	metronomeSignal.update((s) => ({ ...s, playing: false, currentBeat: 0 }));
}

export function setMetronomeBpm(bpm: number) {
	const clamped = Math.max(40, Math.min(240, bpm));
	metronomeSignal.update((s) => ({ ...s, bpm: clamped }));
	bpmSignal.set(clamped);
	if (metronomeSignal.get().playing) startMetronome();
}

export function setTimeSignature(ts: TimeSignature) {
	metronomeSignal.update((s) => ({ ...s, timeSignature: ts }));
	if (metronomeSignal.get().playing) startMetronome();
}

// ─── Tap Tempo ─────────────────────────────────────────
const tapTimes: number[] = [];

export function tapTempo(): number {
	const now = performance.now();
	tapTimes.push(now);
	while (tapTimes.length > 8) tapTimes.shift();
	if (tapTimes.length < 2) return metronomeSignal.get().bpm;

	const lastGap = tapTimes[tapTimes.length - 1] - tapTimes[tapTimes.length - 2];
	if (lastGap > 2000) {
		tapTimes.length = 0;
		tapTimes.push(now);
		return metronomeSignal.get().bpm;
	}

	let totalInterval = 0;
	for (let i = 1; i < tapTimes.length; i++) {
		totalInterval += tapTimes[i] - tapTimes[i - 1];
	}
	const bpm = Math.round(60000 / (totalInterval / (tapTimes.length - 1)));
	setMetronomeBpm(bpm);
	return bpm;
}

export function getAudioContext(): AudioContext {
	ensureInit();
	return getCtx();
}
