# Guitar Chords App — Product Requirements Document

**Version:** 1.0
**Created:** 22 March 2026
**Owner:** jadujoel
**Live:** https://jadujoel.github.io/guitar-chords/

---

## Executive Summary

Guitar Chords is a web-based chord viewer and player built with TypeScript, SVGuitar, and WebAudioFont. It currently supports searching, displaying, and playing guitar chords with strum audio, variation selection, save/load to JSON, and localStorage persistence.

This PRD outlines a **12-month roadmap** to transform it from a simple chord viewer into the best guitar chord app on the web — a tool that guitarists at every level reach for daily.

---

## Current State (Baseline)

| Capability | Status |
|---|---|
| Chord search with autocomplete | ✅ |
| SVG chord diagram rendering | ✅ |
| Variation selector per chord | ✅ |
| Audio playback (WebAudioFont strum) | ✅ |
| Save/Load chord sets as JSON | ✅ |
| LocalStorage persistence | ✅ |
| Inline chord replacement | ✅ |
| Dark theme UI (Inter font, purple accent) | ✅ |
| Mobile responsive grid | ✅ |
| PWA / offline support | ❌ |
| User accounts / cloud sync | ❌ |
| Scales / theory reference | ❌ |
| Ukulele / bass / other instruments | ❌ |
| Metronome / tempo tools | ❌ |
| Song/setlist organization | ❌ |
| Custom chord editor | ❌ |
| Fretboard visualization | ❌ |

---

## Vision

> **"Open a browser, search any chord, hear it, see it, learn it — then build songs around it."**

The app will become a free, fast, offline-capable progressive web app that covers chord lookup, audio playback, interactive fretboard exploration, song/setlist building, practice tools, and music theory reference — all without requiring an account.

---

## Target Users

| Persona | Need |
|---|---|
| **Beginner guitarist** | Quick chord lookups, finger placement guidance, audio confirmation |
| **Intermediate player** | Building chord progressions, exploring voicings, practice routines |
| **Gigging musician** | Setlists, quick reference on stage, transpose on the fly |
| **Songwriter** | Chord progression builder, key/scale awareness, export/share |
| **Teacher** | Shareable chord sheets, printable diagrams, student-friendly UI |

---

## Design Principles

1. **Speed first** — sub-100ms interactions; no spinners for local operations.
2. **Offline by default** — full functionality without network after first load.
3. **Zero friction** — no sign-up wall; accounts are optional for cloud sync.
4. **Accessible** — WCAG 2.1 AA; keyboard-navigable; screen-reader friendly.
5. **Instrument-agnostic architecture** — guitar first, but extensible to ukulele, bass, piano.

---

## 12-Month Roadmap

### Phase 1 — Foundation & Polish (Months 1–3)

**Goal:** Production-quality baseline, PWA, testing, and core UX improvements.

#### 1.1 Progressive Web App (Month 1)

- [ ] Add `manifest.json` with icons (192×192, 512×512), theme color, background color
- [ ] Implement a Service Worker with precaching of all static assets (HTML, CSS, JS, font files)
- [ ] Runtime caching strategy for WebAudioFont soundfont data
- [ ] "Add to Home Screen" prompt on mobile
- [ ] Offline fallback page
- [ ] Lighthouse PWA score ≥ 95

#### 1.2 Architecture Refactor (Month 1–2)

- [ ] Extract code into modules: `audio.ts`, `chords.ts`, `ui.ts`, `state.ts`, `utils.ts`
- [ ] Introduce a lightweight reactive state manager (no framework — vanilla signals or pub/sub)
- [ ] Replace imperative DOM creation with a small component pattern (template literals or lightweight lib)
- [ ] Add build step generating hashed filenames for cache-busting
- [ ] Set up Biome for formatting + linting in CI
- [ ] Add `vitest` with unit tests for chord parsing, normalization, and state management
- [ ] Add Playwright end-to-end tests for core flows (search → add → play → remove)
- [ ] Target ≥ 80% code coverage on business logic

#### 1.3 UX & Accessibility Polish (Month 2–3)

- [ ] Full keyboard navigation: Tab through chords, Enter to play, Delete to remove
- [ ] ARIA roles and labels for all interactive elements
- [ ] Screen-reader announcements for chord add/remove actions
- [ ] Focus management: auto-focus input after add; trap focus in modals
- [ ] Drag-and-drop reordering of chord cards (with keyboard alternative: move up/down buttons)
- [ ] Touch gesture support: swipe to remove chord card
- [ ] Light theme toggle with system preference detection (`prefers-color-scheme`)
- [ ] Responsive breakpoints: phone (<640px), tablet (640–1024px), desktop (>1024px)
- [ ] Skeleton loading states for chord diagrams
- [ ] Animated transitions for adding/removing chords (CSS `@keyframes` or WAAPI)
- [ ] Empty state illustration (SVG guitar graphic)
- [ ] Toast notifications for actions (saved, loaded, error) instead of `alert()`

---

### Phase 2 — Interactive Learning & Audio (Months 4–6)

**Goal:** Transform from a static viewer into an interactive learning tool with rich audio.

#### 2.1 Interactive Fretboard (Month 4)

- [ ] Full-neck SVG fretboard component (frets 0–22, 6 strings)
- [ ] Highlight active chord fingering on the fretboard
- [ ] Click a fret/string to hear that individual note
- [ ] Display note names on frets (toggle on/off)
- [ ] Display interval labels (root, 3rd, 5th, 7th) relative to chord root
- [ ] Zoom/scroll for the fretboard on mobile
- [ ] Left-handed mode (mirror fretboard)

#### 2.2 Enhanced Audio Engine (Month 4–5)

- [ ] Strum direction control: down-strum, up-strum, fingerpick pattern
- [ ] Adjustable strum speed (tight → loose)
- [ ] Volume control with mute toggle
- [ ] Reverb wet/dry knob (expose existing reverb params to UI)
- [ ] Multiple guitar tones: nylon, steel acoustic, clean electric, overdriven
- [ ] Arpeggio playback mode (notes one-by-one, slow)
- [ ] Loop playback toggle (repeat chord on interval)

#### 2.3 Metronome & Tempo (Month 5)

- [ ] Built-in metronome with BPM control (40–240)
- [ ] Tap tempo
- [ ] Time signature selector (4/4, 3/4, 6/8, etc.)
- [ ] Visual beat indicator (pulsing dot or bar)
- [ ] Audio click with accent on beat 1
- [ ] Option to auto-strum chords on each beat

#### 2.4 Chord Progression Builder (Month 5–6)

- [ ] Timeline/sequencer strip at top of page
- [ ] Drag chords from the grid into the timeline
- [ ] Set beats-per-chord (1, 2, 4, etc.)
- [ ] Play the full progression with metronome
- [ ] Loop the progression
- [ ] Transpose entire progression up/down by semitones
- [ ] Common progression presets: I–V–vi–IV, ii–V–I, 12-bar blues, etc.
- [ ] Display Roman numeral analysis relative to detected key

#### 2.5 Music Theory Reference Panel (Month 6)

- [ ] Slide-out panel: scales, keys, and chord-scale relationships
- [ ] Select a key → see all diatonic chords (I through vii°)
- [ ] Click any diatonic chord to add it to the viewer
- [ ] Scale diagram overlay on the interactive fretboard
- [ ] Common scales: major, natural/harmonic/melodic minor, pentatonic, blues, modes
- [ ] Chord tone highlighting within scales
- [ ] "What key am I in?" detector: analyze current chords and suggest likely keys

---

### Phase 3 — Songs, Sharing & Multi-Instrument (Months 7–9)

**Goal:** Enable real-world use for practice, gigs, and collaboration.

#### 3.1 Song & Setlist Manager (Month 7)

- [ ] Create named "Songs" — a chord progression + metadata (title, artist, key, tempo, time sig)
- [ ] Lyrics view: paste lyrics and annotate chords above words (ChordPro-style)
- [ ] Auto-scroll lyrics at adjustable speed for hands-free playing
- [ ] Create "Setlists" — ordered collections of songs
- [ ] Setlist performance mode: full-screen, large text, swipe between songs
- [ ] Estimated setlist duration based on song tempos

#### 3.2 Transpose & Capo (Month 7–8)

- [ ] Global transpose: shift all chords in a song by ±N semitones
- [ ] Capo selector: set capo position and show resulting chord shapes
- [ ] Display both "sounds like" and "play as" chord names
- [ ] Nashville number system toggle (display chords as 1, 4, 5, etc.)

#### 3.3 Sharing & Export (Month 8)

- [ ] Share a chord set or song via URL (state encoded in URL hash or short-link)
- [ ] Export chord sheet as PDF (clean printable layout)
- [ ] Export chord sheet as PNG image
- [ ] Export ChordPro format (.cho file)
- [ ] Import ChordPro files
- [ ] Copy chord diagram as SVG to clipboard
- [ ] QR code generation for quick sharing to another device

#### 3.4 Multi-Instrument Support (Month 8–9)

- [ ] Instrument selector: Guitar (default), Ukulele, Bass, Mandolin
- [ ] Ukulele chord database integration (`@tombatossals/chords-db` includes ukulele)
- [ ] Bass chord/scale diagrams (4-string fretboard)
- [ ] Mandolin chord diagrams (4 double-string courses)
- [ ] Instrument-specific audio samples
- [ ] Tuning selector per instrument (standard, drop D, open G, DADGAD, etc.)
- [ ] Custom tuning input

#### 3.5 Chord Finder / Reverse Lookup (Month 9)

- [ ] "What chord is this?" — click frets on the fretboard to input a shape
- [ ] App identifies the chord name(s) matching the fingering
- [ ] Show enharmonic equivalents (e.g., Db = C#)
- [ ] Display all names a given voicing could be (e.g., Am7 = C6)

---

### Phase 4 — Practice, Community & Scale (Months 10–12)

**Goal:** Build habit-forming practice tools, optional cloud sync, and community features.

#### 4.1 Practice Tools (Month 10)

- [ ] Chord quiz mode: app shows a chord name, user must find it on fretboard
- [ ] Ear training mode: app plays a chord, user must identify it
- [ ] Chord transition trainer: rapidly switch between two chords with metronome
- [ ] Streak tracker: consecutive days practiced
- [ ] Practice timer with session summary (chords practiced, total time)
- [ ] Spaced repetition system for difficult chords
- [ ] Progress dashboard: chord mastery heatmap

#### 4.2 User Accounts & Cloud Sync (Month 10–11)

- [ ] Optional sign-up (email/password + OAuth: Google, GitHub)
- [ ] Cloud storage for songs, setlists, and preferences
- [ ] Sync across devices via cloud
- [ ] Merge conflict resolution for offline edits
- [ ] Data export: download all user data as JSON
- [ ] Account deletion with full data wipe
- [ ] Continue working fully offline without an account

#### 4.3 Community & Discovery (Month 11–12)

- [ ] Public song library: browse community-submitted chord sheets
- [ ] Search songs by title, artist, key, difficulty
- [ ] Upvote/flag system for quality control
- [ ] "Featured progressions" on home page
- [ ] Embed widget: `<iframe>` snippet to embed a chord diagram on external sites
- [ ] API endpoint for chord diagram generation (SVG response)

#### 4.4 Performance & Infrastructure (Month 11–12)

- [ ] Bundle size audit: target <150KB gzipped initial load
- [ ] Code-split audio engine (lazy-load soundfonts on first play)
- [ ] Edge-deploy static assets (Cloudflare Pages or similar CDN)
- [ ] Preload critical fonts and above-the-fold CSS
- [ ] Core Web Vitals targets: LCP <1.5s, FID <50ms, CLS <0.05
- [ ] Automated Lighthouse CI in GitHub Actions (block PRs that regress scores)
- [ ] Error tracking (lightweight client-side reporter)
- [ ] Analytics (privacy-respecting, e.g., Plausible or self-hosted Umami)

#### 4.5 Advanced Chord Features (Month 12)

- [ ] Custom chord editor: draw your own chord diagram, name it, save it
- [ ] Chord voicing comparison: see multiple voicings side-by-side with audio
- [ ] CAGED system visualizer: highlight C/A/G/E/D shapes across the neck
- [ ] Chord substitution suggestions (e.g., "try Cmaj9 instead of C")
- [ ] Voice leading advisor: suggest smoothest transitions between chords
- [ ] Partial capo support
- [ ] Alternate fingering suggestions based on hand size preference

---

## Success Metrics

| Metric | Month 3 Target | Month 6 Target | Month 12 Target |
|---|---|---|---|
| Lighthouse Performance | ≥ 95 | ≥ 95 | ≥ 98 |
| Lighthouse PWA | ≥ 95 | ≥ 95 | 100 |
| Lighthouse Accessibility | ≥ 90 | ≥ 95 | 100 |
| Initial bundle size (gzip) | < 250KB | < 200KB | < 150KB |
| Unit test coverage | ≥ 80% | ≥ 85% | ≥ 90% |
| E2E test coverage (flows) | 5 core flows | 15 flows | 30 flows |
| Chord database size | ~2,400 (current) | ~2,400 + ukulele | + bass, mandolin |
| Monthly active users | Baseline | 2× baseline | 10× baseline |
| Avg. session duration | Baseline | +30% | +60% |

---

## Technical Decisions & Constraints

| Decision | Rationale |
|---|---|
| **No framework (vanilla TS)** | Keep bundle tiny; the app is interaction-heavy but not deeply nested. Re-evaluate at Phase 3 if complexity demands it. |
| **Bun for build/dev** | Already in place; fast builds, native TS support. |
| **WebAudioFont for sound** | Already working; supports multiple instruments. Supplement with recorded samples in Phase 2. |
| **SVGuitar for diagrams** | Mature, SVG-based, customizable. Extend with custom fretboard component in Phase 2. |
| **GitHub Pages hosting** | Free, fast, CI-integrated. Move to Cloudflare Pages if edge caching or functions are needed. |
| **No backend until Phase 4** | All features through Phase 3 run entirely client-side. Backend only for accounts/community. |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Scope creep across phases | Delayed delivery | Strict phase gates; ship each phase before starting next |
| WebAudioFont latency on mobile | Poor playback UX | Pre-decode all notes at startup (already done); fall back to `<audio>` elements if needed |
| Chord database gaps | Missing chords frustrate users | Allow custom chord creation early; accept community contributions |
| Bundle size growth | Slow load times | Continuous bundle audits; aggressive code-splitting; lazy-load instruments |
| Accessibility regressions | Exclude users | Automated axe-core checks in CI; manual screen-reader testing quarterly |
| No backend = no sync | Users lose data on device change | Emphasize JSON export; add cloud sync in Phase 4 |

---

## Out of Scope (for this year)

- Native mobile apps (iOS/Android) — PWA covers mobile use cases
- Tablature editor / sheet music notation
- Real-time collaborative editing (multiplayer)
- Video/audio recording within the app
- Monetization / premium tiers (focus on growth first)
- AI-generated chord progressions (evaluate for Year 2)

---

## Appendix: Quarterly Milestones

| Quarter | Milestone | Key Deliverable |
|---|---|---|
| **Q2 2026** (M1–3) | Production-Ready PWA | Offline-capable app with tests, a11y, and polished UX |
| **Q3 2026** (M4–6) | Interactive Learning Tool | Fretboard, enhanced audio, metronome, progression builder, theory panel |
| **Q4 2026** (M7–9) | Songs & Sharing Platform | Song/setlist manager, transpose/capo, export/share, multi-instrument |
| **Q1 2027** (M10–12) | Practice & Community | Practice tools, cloud sync, community library, performance hardening |
