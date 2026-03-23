import { type Browser, chromium, type Page } from "playwright";

const BASE_URL = "http://127.0.0.1:3000";

let browser: Browser;
let page: Page;

async function setup() {
	browser = await chromium.launch();
	page = await browser.newPage();
}

async function teardown() {
	await browser.close();
}

async function test(name: string, fn: () => Promise<void>) {
	try {
		await fn();
		console.log(`  ✓ ${name}`);
	} catch (err) {
		console.error(`  ✗ ${name}`);
		console.error(`    ${err}`);
		process.exitCode = 1;
	}
}

async function run() {
	console.log("\nE2E Tests\n");

	await setup();

	// ── Test 1: Page loads with empty state ──
	await test("Page loads with empty state", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".empty-state");
		const text = await page.textContent(".empty-state");
		if (!text?.includes("No chords yet"))
			throw new Error("Empty state not shown");
	});

	// ── Test 2: Search and add chord ──
	await test("Search and add chord via autocomplete", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.waitForSelector("#chord-input");
		await page.fill("#chord-input", "C");
		await page.waitForSelector(".autocomplete-list.visible");
		const items = await page.$$(".autocomplete-item");
		if (items.length === 0) throw new Error("No autocomplete items shown");
		// Click the first item
		await items[0].click();
		await page.waitForSelector(".chord");
		const chords = await page.$$(".chord");
		if (chords.length !== 1)
			throw new Error(`Expected 1 chord, got ${chords.length}`);
	});

	// ── Test 3: Play chord ──
	await test("Play chord button exists and is clickable", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => {
			localStorage.setItem(
				"guitar-chords-state",
				JSON.stringify([{ name: "C", variationIndex: 0 }]),
			);
		});
		await page.reload();
		await page.waitForSelector(".btn-play");
		await page.click(".btn-play");
		// No error means audio play was attempted
	});

	// ── Test 4: Remove chord ──
	await test("Remove chord via X button", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => {
			localStorage.setItem(
				"guitar-chords-state",
				JSON.stringify([{ name: "C", variationIndex: 0 }]),
			);
		});
		await page.reload();
		await page.waitForSelector(".chord");

		// Click the remove button (X icon)
		const removeBtn = await page.$(
			'.chord-top-actions button[aria-label="Remove C"]',
		);
		if (!removeBtn) throw new Error("Remove button not found");
		await removeBtn.click();

		// Wait for animation to finish
		await page.waitForTimeout(500);
		const chords = await page.$$(".chord");
		if (chords.length !== 0)
			throw new Error(`Expected 0 chords after remove, got ${chords.length}`);
	});

	// ── Test 5: Theme toggle ──
	await test("Theme toggle switches between dark and light", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".theme-toggle");

		const initialTheme = await page.getAttribute("html", "data-theme");
		await page.click(".theme-toggle");
		const newTheme = await page.getAttribute("html", "data-theme");
		if (initialTheme === newTheme) throw new Error("Theme did not change");
		if (newTheme !== "light" && newTheme !== "dark")
			throw new Error(`Unexpected theme: ${newTheme}`);
	});

	// ── Test 6: Keyboard navigation ──
	await test("Keyboard: Enter on input adds chord", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.waitForSelector("#chord-input");
		await page.fill("#chord-input", "G");
		await page.waitForSelector(".autocomplete-list.visible");
		// ArrowDown to first item, then Enter to select and add
		await page.keyboard.press("ArrowDown");
		await page.keyboard.press("Enter");
		await page.waitForSelector(".chord");
		const chords = await page.$$(".chord");
		if (chords.length !== 1)
			throw new Error(`Expected 1 chord, got ${chords.length}`);
	});

	// ── Test 7: Toast notification appears ──
	await test("Toast notification appears on add", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.waitForSelector("#chord-input");
		await page.fill("#chord-input", "D");
		await page.waitForSelector(".autocomplete-list.visible");
		await page.keyboard.press("ArrowDown");
		await page.keyboard.press("Enter");
		await page.waitForSelector(".toast-visible", { timeout: 2000 });
	});

	// ── Test 8: Variation selector works ──
	await test("Variation selector changes chord display", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => {
			localStorage.setItem(
				"guitar-chords-state",
				JSON.stringify([{ name: "C", variationIndex: 0 }]),
			);
		});
		await page.reload();
		await page.waitForSelector(".variation-selector");
		const options = await page.$$(".variation-selector option");
		if (options.length < 2) throw new Error("Not enough variation options");
		await page.selectOption(".variation-selector >> nth=0", { index: 1 });
		// Chord should re-render
		await page.waitForSelector(".chord");
	});

	// ── Test 9: LocalStorage persistence ──
	await test("Chords persist across page reloads", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => {
			localStorage.setItem(
				"guitar-chords-state",
				JSON.stringify([
					{ name: "C", variationIndex: 0 },
					{ name: "G", variationIndex: 0 },
				]),
			);
		});
		await page.reload();
		await page.waitForSelector(".chord");
		const chords = await page.$$(".chord");
		if (chords.length !== 2)
			throw new Error(`Expected 2 chords, got ${chords.length}`);
	});

	// ── Test 10: Empty state shows when no chords ──
	await test("Empty state shows guitar illustration", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.waitForSelector(".empty-state");
		const svg = await page.$(".empty-state svg");
		if (!svg) throw new Error("No SVG illustration in empty state");
	});

	// ══════════════════════════════════════════════════════════
	// NEW FEATURE TESTS
	// ══════════════════════════════════════════════════════════

	// ── Test 11: Tab navigation ──
	await test("Tab bar renders with all tabs", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		if (tabs.length !== 7)
			throw new Error(`Expected 7 tabs, got ${tabs.length}`);
		const names = await Promise.all(tabs.map((t) => t.textContent()));
		const expected = [
			"Chords",
			"Fretboard",
			"Progression",
			"Songs",
			"Theory",
			"Practice",
			"Share",
		];
		for (let i = 0; i < expected.length; i++) {
			if (names[i]?.trim() !== expected[i])
				throw new Error(
					`Tab ${i}: expected "${expected[i]}", got "${names[i]}"`,
				);
		}
	});

	// ── Test 12: Tab switching ──
	await test("Clicking a tab switches the active panel", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const panels = await page.$$(".tab-panel");
		// Initially first panel is active
		const firstActive = await panels[0].getAttribute("class");
		if (!firstActive?.includes("active"))
			throw new Error("First panel not active initially");

		// Click "Theory" tab (index 4)
		const tabs = await page.$$(".tab-btn");
		await tabs[4].click();

		// Now the 5th panel should be active, first inactive
		const firstClass = await panels[0].getAttribute("class");
		const theoryClass = await panels[4].getAttribute("class");
		if (firstClass?.includes("active"))
			throw new Error("Chords panel still active");
		if (!theoryClass?.includes("active"))
			throw new Error("Theory panel not active");

		// The clicked tab should have active class
		const tabClass = await tabs[4].getAttribute("class");
		if (!tabClass?.includes("active"))
			throw new Error("Theory tab button not active");
	});

	// ── Test 13: Instrument selector ──
	await test("Instrument selector renders with buttons", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".instrument-selector");
		const btns = await page.$$(".instrument-btn");
		if (btns.length < 4)
			throw new Error(
				`Expected at least 4 instrument buttons, got ${btns.length}`,
			);
		// Guitar should be active by default
		const guitarClass = await btns[0].getAttribute("class");
		if (!guitarClass?.includes("active"))
			throw new Error("Guitar not active by default");
	});

	// ── Test 14: Audio controls render ──
	await test("Audio controls render with volume and strum", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".audio-controls");
		const groups = await page.$$(".audio-control-group");
		if (groups.length < 3)
			throw new Error(
				`Expected at least 3 audio control groups, got ${groups.length}`,
			);
		// Volume slider
		const slider = await page.$('.audio-controls input[type="range"]');
		if (!slider) throw new Error("Volume slider not found");
		// Strum direction select
		const strumSelect = await page.$(".audio-controls select");
		if (!strumSelect) throw new Error("Strum direction select not found");
	});

	// ── Test 15: Metronome panel renders ──
	await test("Metronome panel renders with BPM and controls", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".metronome-panel");
		const bpm = await page.$(".metronome-bpm");
		if (!bpm) throw new Error("BPM display not found");
		const bpmText = await bpm.textContent();
		if (!bpmText || Number.isNaN(Number(bpmText)))
			throw new Error(`Invalid BPM text: ${bpmText}`);
		// Beat dots
		const dots = await page.$$(".beat-dot");
		if (dots.length < 2)
			throw new Error(`Expected beat dots, got ${dots.length}`);
		// Tap button
		const tapBtn = await page.evaluate(() => {
			const btns = document.querySelectorAll(".metronome-panel .btn");
			return Array.from(btns).some((b) => b.textContent?.includes("Tap"));
		});
		if (!tapBtn) throw new Error("Tap button not found");
	});

	// ── Test 16: Fretboard tab ──
	await test("Fretboard tab shows fretboard and chord finder", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		// Click Fretboard tab
		const tabs = await page.$$(".tab-btn");
		await tabs[1].click();
		await page.waitForSelector(".fretboard-panel", { timeout: 3000 });
		// Chord finder section
		const finder = await page.$(".chord-finder");
		if (!finder) throw new Error("Chord finder section not found");
		const finderInput = await page.$(".chord-finder input");
		if (!finderInput) throw new Error("Chord finder input not found");
	});

	// ── Test 17: Chord finder interaction ──
	await test("Chord finder identifies chord from notes", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[1].click();
		await page.waitForSelector(".chord-finder input", { timeout: 3000 });
		await page.fill(".chord-finder input", "C, E, G");
		await page.waitForTimeout(500);
		const matches = await page.$$(".finder-match");
		if (matches.length === 0) throw new Error("No chord matches found");
		const firstName = await page.$eval(
			".finder-match .match-name",
			(el) => el.textContent,
		);
		if (!firstName?.includes("C"))
			throw new Error(`Expected C-related chord, got "${firstName}"`);
	});

	// ── Test 18: Progression panel ──
	await test("Progression panel renders with key and preset selectors", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[2].click();
		// Wait for content
		await page.waitForTimeout(300);
		const panels = await page.$$(".tab-panel");
		// heading
		const heading = await panels[2].$("h2");
		const text = await heading?.textContent();
		if (!text?.includes("Progression"))
			throw new Error(`Expected Progression heading, got "${text}"`);
		// Key select
		const selects = await panels[2].$$("select");
		if (selects.length < 2)
			throw new Error("Expected at least 2 selects (key and preset)");
		// Progression strip
		const strip = await panels[2].$(".progression-strip");
		if (!strip) throw new Error("Progression strip not found");
	});

	// ── Test 19: Preset progression fills strip ──
	await test("Selecting a preset fills the progression strip", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[2].click();
		await page.waitForTimeout(300);
		const panels = await page.$$(".tab-panel");
		const selects = await panels[2].$$("select");
		// Second select is the preset
		await selects[1].selectOption({ index: 1 });
		await page.waitForTimeout(300);
		const items = await panels[2].$$(".progression-item");
		if (items.length === 0)
			throw new Error("Progression strip empty after preset selection");
	});

	// ── Test 20: Songs panel ──
	await test("Songs panel renders with header and buttons", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[3].click();
		await page.waitForTimeout(300);
		const panels = await page.$$(".tab-panel");
		const heading = await panels[3].$("h2");
		const text = await heading?.textContent();
		if (!text?.includes("Songs"))
			throw new Error(`Expected Songs heading, got "${text}"`);
		// New Song button
		const hasBtnText = await panels[3].evaluate((el) => {
			return Array.from(el.querySelectorAll(".btn")).some((b) =>
				b.textContent?.includes("New Song"),
			);
		});
		if (!hasBtnText) throw new Error("New Song button not found");
	});

	// ── Test 21: Theory panel diatonic chords ──
	await test("Theory panel shows diatonic chords for selected key", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[4].click();
		await page.waitForTimeout(300);
		const panels = await page.$$(".tab-panel");
		const heading = await panels[4].$("h2");
		const text = await heading?.textContent();
		if (!text?.includes("Theory"))
			throw new Error(`Expected Theory heading, got "${text}"`);
		// Should show diatonic chords
		const diatonicBtns = await panels[4].$$(".diatonic-chord-btn");
		if (diatonicBtns.length < 7)
			throw new Error(
				`Expected at least 7 diatonic chord buttons, got ${diatonicBtns.length}`,
			);
	});

	// ── Test 22: Theory key detection shows message ──
	await test("Theory panel shows key detection section", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[4].click();
		await page.waitForTimeout(300);
		const keyDetected = await page.$(".key-detected");
		if (!keyDetected) throw new Error("Key detection section not found");
	});

	// ── Test 23: Practice panel ──
	await test("Practice panel shows modes and streak", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		const panels = await page.$$(".tab-panel");
		const heading = await panels[5].$("h2");
		const text = await heading?.textContent();
		if (!text?.includes("Practice"))
			throw new Error(`Expected Practice heading, got "${text}"`);
		// Streak badge
		const streak = await panels[5].$(".streak-badge");
		if (!streak) throw new Error("Streak badge not found");
		// Mode buttons (Chord Quiz, Ear Training, Transition Trainer)
		const modeBtns = await panels[5].$$(".instrument-btn");
		if (modeBtns.length < 3)
			throw new Error(
				`Expected 3 practice mode buttons, got ${modeBtns.length}`,
			);
	});

	// ── Test 24: Share panel ──
	await test("Share panel renders with URL sharing and export", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[6].click();
		await page.waitForTimeout(300);
		const panels = await page.$$(".tab-panel");
		const heading = await panels[6].$("h2");
		const text = await heading?.textContent();
		if (!text?.includes("Share"))
			throw new Error(`Expected Share heading, got "${text}"`);
		// URL input and generate
		const shareInput = await panels[6].$(".share-url-input");
		if (!shareInput) throw new Error("Share URL input not found");
		// Export buttons (Print/PDF, PNG, JSON)
		const btns = await panels[6].$$(".btn");
		if (btns.length < 4)
			throw new Error(
				`Expected at least 4 share/export buttons, got ${btns.length}`,
			);
	});

	// ── Test 25: Transpose chord ──
	await test("Transpose controls exist in chords panel", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		// Check for transpose controls
		const transposeSection = await page.$(".transpose-controls");
		if (!transposeSection) {
			// May use a different selector; check for transpose buttons
			const found = await page.evaluate(() => {
				const btns = document.querySelectorAll("button");
				return Array.from(btns).some(
					(b) =>
						b.title?.includes("Transpose") ||
						b.textContent?.includes("Transpose"),
				);
			});
			if (!found) throw new Error("No transpose controls found");
		}
	});

	// ── Test 26: Diatonic chord click adds to chords ──
	await test("Clicking a diatonic chord adds it", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		// Go to Theory tab
		await tabs[4].click();
		await page.waitForTimeout(300);
		const panels = await page.$$(".tab-panel");
		const diatonicBtns = await panels[4].$$(".diatonic-chord-btn");
		if (diatonicBtns.length === 0) throw new Error("No diatonic chord buttons");
		// Click first diatonic chord
		await diatonicBtns[0].click();
		// Switch to Chords tab to check
		await tabs[0].click();
		await page.waitForTimeout(300);
		const chords = await page.$$(".chord");
		if (chords.length < 1)
			throw new Error(
				"Expected at least 1 chord after clicking diatonic chord",
			);
	});

	// ── Test 27: Mastery heatmap section exists ──
	await test("Practice panel has mastery heatmap section", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		const masteryGrid = await page.$(".mastery-grid");
		if (!masteryGrid)
			throw new Error("Mastery grid not found in practice panel");
	});

	// ── Test 28: Tab ARIA attributes ──
	await test("Tabs have correct ARIA attributes", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabBar = await page.$(".tab-bar");
		const role = await tabBar?.getAttribute("role");
		if (role !== "tablist")
			throw new Error(`Tab bar role: expected "tablist", got "${role}"`);

		const tabs = await page.$$(".tab-btn");
		for (const tab of tabs) {
			const tabRole = await tab.getAttribute("role");
			if (tabRole !== "tab")
				throw new Error(`Tab button role: expected "tab", got "${tabRole}"`);
		}

		const panels = await page.$$(".tab-panel");
		for (const panel of panels) {
			const panelRole = await panel.getAttribute("role");
			if (panelRole !== "tabpanel")
				throw new Error(`Panel role: expected "tabpanel", got "${panelRole}"`);
		}
	});

	// ══════════════════════════════════════════════════════════
	// NEW FEATURE E2E TESTS
	// ══════════════════════════════════════════════════════════

	// ── Test 29: Tone selector renders ──
	await test("Tone selector shows all guitar tones", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tone-selector");
		const options = await page.$$(".tone-selector option");
		if (options.length < 4)
			throw new Error(
				`Expected at least 4 tone options, got ${options.length}`,
			);
	});

	// ── Test 30: Nashville number toggle exists in progression panel ──
	await test("Nashville number toggle exists in progression panel", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[2].click();
		await page.waitForTimeout(300);
		const found = await page.evaluate(() => {
			const labels = document.querySelectorAll("label");
			return Array.from(labels).some((l) =>
				l.textContent?.includes("Nashville"),
			);
		});
		if (!found)
			throw new Error("Nashville number toggle not found in progression panel");
	});

	// ── Test 31: Fretboard note click shows chord finder chips ──
	await test("Fretboard note click activates chord finding", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[1].click();
		await page.waitForSelector(".fretboard-panel", { timeout: 3000 });
		// Click a note on the fretboard SVG
		const noteGroup = await page.$(".fb-note-group");
		if (!noteGroup) throw new Error("No fretboard note groups found");
		await noteGroup.click();
		await page.waitForTimeout(500);
		// Check if selected notes section appeared
		const selectedDiv = await page.$(".selected-notes");
		if (!selectedDiv)
			throw new Error(
				"Selected notes area not found after clicking fretboard note",
			);
	});

	// ── Test 32: Practice end session button appears during practice ──
	await test("Practice mode shows End Session button", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => {
			localStorage.setItem(
				"guitar-chords-state",
				JSON.stringify([
					{ name: "C", variationIndex: 0 },
					{ name: "G", variationIndex: 0 },
				]),
			);
		});
		await page.reload();
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		// Start Chord Quiz
		const modeBtns = await page.$$(".tab-panel.active .instrument-btn");
		if (modeBtns.length === 0) throw new Error("No mode buttons found");
		await modeBtns[0].click();
		await page.waitForTimeout(500);
		// End Session button should be visible
		const found = await page.evaluate(() => {
			const btns = document.querySelectorAll(".tab-panel.active .btn");
			return Array.from(btns).some((b) =>
				b.textContent?.includes("End Session"),
			);
		});
		if (!found) throw new Error("End Session button not shown during practice");
	});

	// ── Test 33: Songs tab can create a new song ──
	await test("Songs tab new song form renders", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[3].click();
		await page.waitForTimeout(300);
		// Click New Song button
		const newSongBtn = await page.evaluate(() => {
			const btns = document.querySelectorAll(".tab-panel.active .btn");
			const btn = Array.from(btns).find((b) =>
				b.textContent?.includes("New Song"),
			);
			if (btn) (btn as HTMLElement).click();
			return !!btn;
		});
		if (!newSongBtn) throw new Error("New Song button not found");
		await page.waitForTimeout(300);
		// Song form should be visible
		const inputs = await page.$$(".tab-panel.active input");
		if (inputs.length === 0) throw new Error("No inputs found in song form");
	});

	// ── Test 34: QR code renders in share panel ──
	await test("QR code renders in share panel", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => {
			localStorage.setItem(
				"guitar-chords-state",
				JSON.stringify([{ name: "C", variationIndex: 0 }]),
			);
		});
		await page.reload();
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[6].click();
		await page.waitForTimeout(300);
		// Generate share URL first
		await page.evaluate(() => {
			const btns = document.querySelectorAll(".tab-panel.active .btn");
			const btn = Array.from(btns).find(
				(b) =>
					b.textContent?.includes("Generate") ||
					b.textContent?.includes("Copy"),
			);
			if (btn) (btn as HTMLElement).click();
			return !!btn;
		});
		await page.waitForTimeout(300);
		// QR code is SVG
		const qrSvg = await page.$(".tab-panel.active svg");
		if (!qrSvg) throw new Error("QR code SVG not found in share panel");
	});

	await teardown();

	console.log("\nDone!\n");
}

run();
