/** Audio engine: WebAudioFont-based chord playback with routing and reverb */

const audioContext = new AudioContext({ sampleRate: 48000 });
const player = new WebAudioFontPlayer();
const notarget = audioContext.createGain();
const sf2File = _tone_0250_FluidR3_GM_sf2_file;
const sf2FileName = "_tone_0250_FluidR3_GM_sf2_file";

// Audio routing: player → gain → dry/wet split → compressor → destination
const masterGain = audioContext.createGain();
const dryGain = audioContext.createGain();
const wetGain = audioContext.createGain();
const convolver = audioContext.createConvolver();
const compressor = audioContext.createDynamicsCompressor();

masterGain.gain.value = 0.55;
dryGain.gain.value = 0.75;
wetGain.gain.value = 0.25;
compressor.threshold.value = -18;
compressor.knee.value = 12;
compressor.ratio.value = 4;

convolver.buffer = createReverbImpulse(audioContext, 1.8, 3.5);

masterGain.connect(dryGain);
masterGain.connect(convolver);
convolver.connect(wetGain);
dryGain.connect(compressor);
wetGain.connect(compressor);
compressor.connect(audioContext.destination);

player.loader.decodeAfterLoading(audioContext, sf2FileName);
for (let i = 0; i < 128; i++) {
	player.queueWaveTable(audioContext, notarget, sf2File, 0, i, 1.5);
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
	if (audioContext.state === "suspended") {
		audioContext.resume();
	}
}

export function playChord(midiNotes: number[]) {
	resumeAudio();
	const now = audioContext.currentTime;
	const strumInterval = 0.03 + Math.random() * 0.02;

	for (let i = 0; i < midiNotes.length; i++) {
		const time = now + i * strumInterval;
		const velocity = 0.65 + Math.random() * 0.35;
		player.queueWaveTable(
			audioContext,
			masterGain,
			sf2File,
			time,
			midiNotes[i],
			2.5,
			velocity,
		);
	}
}
