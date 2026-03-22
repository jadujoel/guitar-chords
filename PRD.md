# Guitar Chords — Product Requirements Document

## Overview

Guitar Chords is a browser-based tool for guitarists to look up, arrange, and play chord progressions. It runs entirely client-side with no backend, and is deployable as a static site.

Live: https://jadujoel.github.io/guitar-chords/

---

## Goals

1. Allow any guitarist (beginner or advanced) to quickly look up chord fingerings.
2. Enable building, saving, and sharing chord progressions.
3. Provide audio playback of individual chords and full progressions.
4. Work offline-friendly — no server required after initial load.

---

## Features

### 1. Chord Search & Autocomplete ✅

- Full-text search for chords by name (e.g., `Am`, `Cmaj7`, `F#m`).
- Dropdown autocomplete list with styled root + suffix display.
- Keyboard navigation (↑ ↓ Enter Escape) in the dropdown.
- Case-insensitive matching.

### 2. Add / Remove Chords ✅

- Add a chord to the progression with the **Add** button or pressing Enter.
- Duplicate chords (same name) are not allowed in the list.
- Remove a chord with the ✕ button on the card.

### 3. Chord Diagram Display ✅

- SVG fretboard diagram rendered by `svguitar` for each chord.
- Finger positions, barre chords, muted strings, open strings, and base fret shown.
- Dark-themed diagrams matching the app colour scheme.

### 4. Variation Selector ✅

- Each chord card has a dropdown to cycle through different voicings/positions.
- The selected variation is remembered in state.

### 5. Individual Chord Audio Playback ✅

- **Play** button on each chord card plays the chord audio.
- Notes are strummed (staggered 30–50 ms per string) for realism.
- Audio is routed through a reverb convolver and dynamics compressor.
- Acoustic guitar sound via WebAudioFont (`_tone_0250_FluidR3_GM_sf2_file`).

### 6. Chord Progression Playback ✅

- **Play All** button in the toolbar plays through all chords in sequence.
- Becomes a **Stop** button while playing; clicking stops playback.
- **BPM** number input controls tempo (range 20–300, default 80).
- Each chord is held for **4 beats** (configurable via beats-per-chord).
- **Loop** toggle: when enabled, progression restarts after the last chord.
- The currently playing chord card is visually highlighted.
- Playback adapts if the chord list changes mid-play (e.g., a chord is removed).

### 7. Drag & Drop Reordering ✅

- Chord cards are draggable to reorder within the grid.
- Visual feedback: dragged card dims; drop-target card highlights with an accent border.
- State and localStorage are updated after every drop.

### 8. Inline Chord Replace ✅

- Pencil icon on each card enters inline replace mode.
- An input with autocomplete appears inside the card.
- Confirming replaces the chord name in-place (variation resets to 0).
- Escape or ✕ cancels without changing the chord.

### 9. Persist State ✅

- Chord list (names + selected variations) is persisted to `localStorage`.
- State is restored on next visit.
- On `beforeunload` the state is saved.

### 10. Save / Load JSON ✅

- **Save** downloads the current chord list as `chords.json`.
- **Load** imports a previously saved JSON file and restores the progression.

### 11. URL Sharing ✅

- **Share** button encodes the current chord progression in the page URL as `?chords=Am,F,C,G`.
- The link is copied to the clipboard; a toast notification confirms the copy.
- On page load, if a `?chords=` query param is present it pre-populates the chord list (overrides localStorage).
- Chord names are URI-encoded to support sharps (`#`) and other special characters.

---

## Non-Functional Requirements

| Requirement | Target |
|---|---|
| Runtime dependencies | `@tombatossals/chords-db`, `lucide`, `svguitar` (all client-side) |
| Audio engine | Web Audio API — no external audio library required at runtime |
| Bundler | Bun (`bun build.ts`) |
| Type safety | TypeScript strict mode — `npx tsc --noEmit` passes without errors |
| Code quality | Biome formatter + linter (`npx biome check src/`) |
| Performance | Page load < 3 s on a broadband connection |
| Browser support | Chrome 90+, Firefox 88+, Safari 15+, Edge 90+ |
| Offline | Functional after first load (chords DB is bundled; only audio font CDN) |
| Accessibility | Keyboard navigable toolbar and autocomplete dropdowns |
| Responsive | Works on screens ≥ 360 px wide |

---

## Technical Architecture

```
src/
  index.html   — single HTML shell
  index.ts     — all application logic (vanilla TS, no framework)
  index.css    — all styles
build.ts       — Bun build script → dist/
serve.ts       — local dev server (builds on request)
PRD.md         — this document
biome.json     — Biome formatter + linter config
```

### State Model

```typescript
interface ChordItem {
  name: string;          // e.g. "Am", "Cmaj7"
  variationIndex: number; // index into chord.positions[]
}
```

Global playback state lives in module scope within `App()`:

```typescript
let chordsState: ChordItem[];
let isPlaying: boolean;
let loopEnabled: boolean;
let bpm: number;         // beats per minute
let playbackIndex: number;
```

### Audio Pipeline

```
WebAudioFontPlayer → gain → dryGain ─────────────────► compressor → destination
                         └──► convolver (reverb) → wetGain ─┘
```

---

## Out of Scope (Future Ideas)

- Transposing the entire progression by semitones
- Exporting chord sheets as PDF / PNG
- Chord-theory suggestions (e.g., "chords that sound good after Am")
- Mobile touch-drag reordering
- Multiple tabs / song sections
- MIDI output
