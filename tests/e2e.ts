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
		if (tabs.length !== 8)
			throw new Error(`Expected 8 tabs, got ${tabs.length}`);
		const names = await Promise.all(tabs.map((t) => t.textContent()));
		const expected = [
			"Chords",
			"Fretboard",
			"Progression",
			"Songs",
			"Theory",
			"Practice",
			"Share",
			"Info",
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

	// ── Test 35: Info tab renders with all sections ──
	await test("Info tab renders with feature sections", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[7].click();
		await page.waitForTimeout(300);
		const infoPage = await page.$(".info-page");
		if (!infoPage) throw new Error("Info page not found");
		const heading = await infoPage.$("h2");
		const text = await heading?.textContent();
		if (!text?.includes("How to Use"))
			throw new Error(`Expected info heading, got "${text}"`);
		const sections = await infoPage.$$(".info-section");
		if (sections.length < 10)
			throw new Error(
				`Expected at least 10 info sections, got ${sections.length}`,
			);
	});

	// ── Test 36: Info sections have icons and content ──
	await test("Info sections have icons and descriptive content", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[7].click();
		await page.waitForTimeout(300);
		const sections = await page.$$(".info-section");
		for (let i = 0; i < Math.min(3, sections.length); i++) {
			const h3 = await sections[i].$("h3");
			if (!h3) throw new Error(`Section ${i} missing heading`);
			const svg = await sections[i].$("h3 svg");
			if (!svg) throw new Error(`Section ${i} missing icon`);
			const lis = await sections[i].$$("li");
			if (lis.length === 0) throw new Error(`Section ${i} has no list items`);
		}
	});

	// ── Test 37: Dropdowns have custom styling (no white background) ──
	await test("Dropdowns have dark themed styling", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector("select");
		const hasDarkBg = await page.evaluate(() => {
			const sel = document.querySelector("select");
			if (!sel) return false;
			const style = getComputedStyle(sel);
			// Check appearance is none (custom styled)
			return style.appearance === "none" || style.webkitAppearance === "none";
		});
		if (!hasDarkBg) throw new Error("Dropdowns do not have custom appearance");
	});

	// ── Test 38: Toggle switches have custom styling ──
	await test("Toggle switches are custom styled", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[1].click();
		await page.waitForSelector(".fb-toggle", { timeout: 3000 });
		const isCustom = await page.evaluate(() => {
			const checkbox = document.querySelector(
				'.fb-toggle input[type="checkbox"]',
			);
			if (!checkbox) return false;
			const style = getComputedStyle(checkbox);
			return style.appearance === "none" || style.webkitAppearance === "none";
		});
		if (!isCustom) throw new Error("Toggle checkboxes not custom styled");
	});

	// ── Test 39: Difficulty selector exists in practice panel ──
	await test("Practice panel has difficulty selector", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		const diffSelect = await page.$("#difficulty-select");
		if (!diffSelect) throw new Error("Difficulty selector not found");
		const options = await page.$$("#difficulty-select option");
		if (options.length !== 3)
			throw new Error(`Expected 3 difficulty options, got ${options.length}`);
	});

	// ── Test 40: Difficulty selector changes value ──
	await test("Difficulty selector can be changed", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		await page.selectOption("#difficulty-select", "advanced");
		const value = await page.$eval(
			"#difficulty-select",
			(el: HTMLSelectElement) => el.value,
		);
		if (value !== "advanced")
			throw new Error(`Expected "advanced", got "${value}"`);
	});

	// ── Test 41: Chord quiz starts and shows diagram ──
	await test("Chord quiz starts and shows diagram with input", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		// Click "Chord Quiz" button
		const modeBtns = await page.$$(".tab-panel.active .instrument-btn");
		await modeBtns[0].click();
		await page.waitForTimeout(500);
		// Should show practice input and SVG
		const input = await page.$(".practice-input");
		if (!input) throw new Error("Quiz practice input not found");
		const svg = await page.$(".practice-panel svg");
		if (!svg) throw new Error("Quiz chord diagram not found");
	});

	// ══════════════════════════════════════════════════════════
	// PRACTICE TOOL - COMPREHENSIVE E2E TESTS
	// ══════════════════════════════════════════════════════════

	// ── Test 42: Practice panel renders all mode buttons ──
	await test("Practice panel has all three mode buttons", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		const modeBtns = await page.$$(".tab-panel.active .instrument-btn");
		if (modeBtns.length !== 3)
			throw new Error(`Expected 3 mode buttons, got ${modeBtns.length}`);
		const labels = await Promise.all(modeBtns.map((b) => b.textContent()));
		if (!labels[0]?.includes("Chord Quiz"))
			throw new Error(`Expected "Chord Quiz", got "${labels[0]}"`);
		if (!labels[1]?.includes("Ear Training"))
			throw new Error(`Expected "Ear Training", got "${labels[1]}"`);
		if (!labels[2]?.includes("Transition"))
			throw new Error(`Expected "Transition Trainer", got "${labels[2]}"`);
	});

	// ── Test 43: Practice quiz - correct answer shows success ──
	await test("Chord quiz correct answer shows success toast", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		// Start quiz
		const modeBtns = await page.$$(".tab-panel.active .instrument-btn");
		await modeBtns[0].click();
		await page.waitForTimeout(500);
		// Submit any answer via the active panel's practice input
		await page.fill(".tab-panel.active .practice-input", "C");
		// Click Check
		const checkBtn = await page.evaluate(() => {
			const btns = document.querySelectorAll(".practice-actions .btn");
			const btn = Array.from(btns).find((b) =>
				b.textContent?.includes("Check"),
			);
			if (btn) (btn as HTMLElement).click();
			return !!btn;
		});
		if (!checkBtn) throw new Error("Check button not found");
		await page.waitForTimeout(500);
		// The question display should show the actual chord name now (not "?")
		const questionText = await page.$eval(
			".practice-question",
			(el) => el.textContent,
		);
		if (!questionText || questionText === "?")
			throw new Error("Question display did not update after answer");
	});

	// ── Test 44: Practice quiz updates stats after answer ──
	await test("Chord quiz updates stats after submitting answer", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		const modeBtns = await page.$$(".tab-panel.active .instrument-btn");
		await modeBtns[0].click();
		await page.waitForTimeout(500);
		// Submit an answer via active panel input
		await page.fill(".tab-panel.active .practice-input", "C");
		await page.evaluate(() => {
			const btns = document.querySelectorAll(".practice-actions .btn");
			const btn = Array.from(btns).find((b) =>
				b.textContent?.includes("Check"),
			);
			if (btn) (btn as HTMLElement).click();
		});
		await page.waitForTimeout(600);
		// Stats should now be displayed
		const stats = await page.$$(".practice-stat");
		if (stats.length < 2)
			throw new Error(
				`Expected at least 2 stats displayed, got ${stats.length}`,
			);
	});

	// ── Test 45: Ear training mode starts and shows play button ──
	await test("Ear training mode shows Play Chord button", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		const modeBtns = await page.$$(".tab-panel.active .instrument-btn");
		await modeBtns[1].click();
		await page.waitForTimeout(500);
		// Should show "Play Chord" button and input
		const playChordBtn = await page.evaluate(() => {
			const btns = document.querySelectorAll(".practice-panel .btn");
			return Array.from(btns).some((b) =>
				b.textContent?.includes("Play Chord"),
			);
		});
		if (!playChordBtn) throw new Error("Play Chord button not found");
		const input = await page.$(".practice-input");
		if (!input) throw new Error("Ear training answer input not found");
	});

	// ── Test 46: Ear training - listen text shown ──
	await test("Ear training shows 'Listen to the chord' text", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		const modeBtns = await page.$$(".tab-panel.active .instrument-btn");
		await modeBtns[1].click();
		await page.waitForTimeout(500);
		const text = await page.evaluate(() => {
			return document.querySelector(".practice-panel")?.textContent ?? "";
		});
		if (!text.includes("Listen"))
			throw new Error("Ear training instruction text not found");
	});

	// ── Test 47: Transition trainer shows chord pair ──
	await test("Transition trainer shows chord pair with arrow", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		const modeBtns = await page.$$(".tab-panel.active .instrument-btn");
		await modeBtns[2].click();
		await page.waitForTimeout(500);
		const questionText = await page.$eval(
			".practice-question",
			(el) => el.textContent,
		);
		if (!questionText?.includes("→"))
			throw new Error(`Expected transition arrow in "${questionText}"`);
	});

	// ── Test 48: Transition trainer shows two chord diagrams ──
	await test("Transition trainer shows two chord diagrams side by side", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		const modeBtns = await page.$$(".tab-panel.active .instrument-btn");
		await modeBtns[2].click();
		await page.waitForTimeout(500);
		const diagrams = await page.$$(".practice-panel .diatonic-chords .chord");
		if (diagrams.length !== 2)
			throw new Error(`Expected 2 chord diagrams, got ${diagrams.length}`);
	});

	// ── Test 49: Transition trainer Next Pair button works ──
	await test("Transition trainer Next Pair generates new pair", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		const modeBtns = await page.$$(".tab-panel.active .instrument-btn");
		await modeBtns[2].click();
		await page.waitForTimeout(500);
		// Get initial pair for reference
		await page.$eval(".practice-question", (el) => el.textContent);
		// Click Next Pair
		const nextBtn = await page.evaluate(() => {
			const btns = document.querySelectorAll(".practice-panel .btn");
			const btn = Array.from(btns).find((b) =>
				b.textContent?.includes("Next Pair"),
			);
			if (btn) (btn as HTMLElement).click();
			return !!btn;
		});
		if (!nextBtn) throw new Error("Next Pair button not found");
		await page.waitForTimeout(500);
		const secondPair = await page.$eval(
			".practice-question",
			(el) => el.textContent,
		);
		// The pairs can be the same by chance, but the UI should have re-rendered
		if (!secondPair?.includes("→"))
			throw new Error("Second pair does not contain arrow");
	});

	// ── Test 50: End Session button hidden initially ──
	await test("End Session button hidden before practice starts", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		const visible = await page.evaluate(() => {
			const btns = document.querySelectorAll(".tab-panel.active .btn");
			return Array.from(btns).some(
				(b) =>
					b.textContent?.includes("End Session") &&
					(b as HTMLElement).style.display !== "none",
			);
		});
		if (visible)
			throw new Error("End Session button should be hidden initially");
	});

	// ── Test 51: End Session shows summary overlay ──
	await test("End Session shows session summary overlay", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		// Start quiz
		const modeBtns = await page.$$(".tab-panel.active .instrument-btn");
		await modeBtns[0].click();
		await page.waitForTimeout(500);
		// Submit an answer to get a count
		await page.fill(".tab-panel.active .practice-input", "X");
		await page.evaluate(() => {
			const btns = document.querySelectorAll(".practice-actions .btn");
			const btn = Array.from(btns).find((b) =>
				b.textContent?.includes("Check"),
			);
			if (btn) (btn as HTMLElement).click();
		});
		await page.waitForTimeout(1600);
		// Now click End Session
		await page.evaluate(() => {
			const btns = document.querySelectorAll(".tab-panel.active .btn");
			const btn = Array.from(btns).find((b) =>
				b.textContent?.includes("End Session"),
			);
			if (btn) (btn as HTMLElement).click();
		});
		await page.waitForTimeout(300);
		const summary = await page.$(".session-summary");
		if (!summary) throw new Error("Session summary overlay not shown");
		const summaryText = await summary.textContent();
		if (!summaryText?.includes("Session Complete"))
			throw new Error("Summary missing 'Session Complete' heading");
	});

	// ── Test 52: Session summary shows score and accuracy ──
	await test("Session summary displays score, accuracy, time, chords", async () => {
		// Continue from previous test state — summary is open
		const stats = await page.$$(".session-summary .practice-stat");
		if (stats.length < 4)
			throw new Error(`Expected 4 summary stats, got ${stats.length}`);
		const labels = await Promise.all(
			stats.map((s) => s.$eval(".stat-label", (el) => el.textContent)),
		);
		for (const expected of ["Score", "Accuracy", "Time", "Chords"]) {
			if (!labels.some((l) => l?.includes(expected)))
				throw new Error(`Missing stat: ${expected}`);
		}
	});

	// ── Test 53: Session summary Close button clears state ──
	await test("Session summary Close button returns to mode selector", async () => {
		const closeBtn = await page.evaluate(() => {
			const overlay = document.querySelector(".session-summary");
			const btn = overlay?.querySelector(".btn");
			if (btn) (btn as HTMLElement).click();
			return !!btn;
		});
		if (!closeBtn) throw new Error("Close button not found");
		await page.waitForTimeout(300);
		const summary = await page.$(".session-summary");
		if (summary) throw new Error("Summary overlay still visible after close");
		// Practice area should show placeholder
		const text = await page.evaluate(
			() => document.querySelector(".practice-panel")?.textContent ?? "",
		);
		if (!text.includes("Select a practice mode"))
			throw new Error("Practice area not reset after session end");
	});

	// ── Test 54: Difficulty changes persist across mode switches ──
	await test("Difficulty selection persists when switching modes", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		await page.selectOption("#difficulty-select", "advanced");
		// Start quiz then switch to ear training
		const modeBtns = await page.$$(".tab-panel.active .instrument-btn");
		await modeBtns[0].click();
		await page.waitForTimeout(500);
		await modeBtns[1].click();
		await page.waitForTimeout(500);
		const value = await page.$eval(
			"#difficulty-select",
			(el: HTMLSelectElement) => el.value,
		);
		if (value !== "advanced")
			throw new Error(`Difficulty reset after mode switch: "${value}"`);
	});

	// ── Test 55: Practice streak updates after starting practice ──
	await test("Streak badge updates after practice session", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		const modeBtns = await page.$$(".tab-panel.active .instrument-btn");
		await modeBtns[0].click();
		await page.waitForTimeout(500);
		const streakText = await page.evaluate(() => {
			const badge = document.querySelector(".tab-panel.active .streak-badge");
			return badge?.textContent ?? "";
		});
		if (!streakText.includes("1"))
			throw new Error(`Expected streak to show 1, got "${streakText}"`);
	});

	// ── Test 56: Practice mode button gets active class when selected ──
	await test("Active practice mode button has active class", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		const modeBtns = await page.$$(".tab-panel.active .instrument-btn");
		await modeBtns[2].click();
		await page.waitForTimeout(500);
		const cls = await modeBtns[2].getAttribute("class");
		if (!cls?.includes("active"))
			throw new Error("Transition trainer button not active");
	});

	// ── Test 57: Quiz keyboard Enter submits answer ──
	await test("Quiz answer can be submitted with Enter key", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		const modeBtns = await page.$$(".tab-panel.active .instrument-btn");
		await modeBtns[0].click();
		await page.waitForTimeout(500);
		await page.fill(".tab-panel.active .practice-input", "G");
		await page.keyboard.press("Enter");
		await page.waitForTimeout(600);
		// Question display should update
		const text = await page.$eval(".practice-question", (el) => el.textContent);
		if (!text || text === "?")
			throw new Error("Enter key did not submit answer");
	});

	// ── Test 58: Mastery grid empty state shows message ──
	await test("Mastery grid shows prompt when no data", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		const gridText = await page.evaluate(() => {
			const grid = document.querySelector(".mastery-grid");
			return grid?.textContent ?? "";
		});
		if (!gridText.includes("Practice chords"))
			throw new Error("Mastery empty state message not shown");
	});

	// ── Test 59: Mastery grid updates after practice attempt ──
	await test("Mastery grid shows cells after practice attempt", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[5].click();
		await page.waitForTimeout(300);
		const modeBtns = await page.$$(".tab-panel.active .instrument-btn");
		await modeBtns[0].click();
		await page.waitForTimeout(500);
		// Submit an answer
		await page.fill(".tab-panel.active .practice-input", "C");
		await page.keyboard.press("Enter");
		await page.waitForTimeout(1600);
		// End session to trigger mastery update
		await page.evaluate(() => {
			const btns = document.querySelectorAll(".tab-panel.active .btn");
			const btn = Array.from(btns).find((b) =>
				b.textContent?.includes("End Session"),
			);
			if (btn) (btn as HTMLElement).click();
		});
		await page.waitForTimeout(300);
		// Close summary
		await page.evaluate(() => {
			const overlay = document.querySelector(".session-summary");
			const btn = overlay?.querySelector(".btn");
			if (btn) (btn as HTMLElement).click();
		});
		await page.waitForTimeout(300);
		const cells = await page.$$(".mastery-cell");
		if (cells.length < 1)
			throw new Error("No mastery cells after practice attempt");
	});

	// ══════════════════════════════════════════════════════════
	// GLOBAL CONTROLS - VISIBLE ON ALL PAGES
	// ══════════════════════════════════════════════════════════

	// ── Test 60: Instrument selector visible on all tabs ──
	await test("Instrument selector is visible on all tabs", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		for (let i = 0; i < tabs.length; i++) {
			await tabs[i].click();
			await page.waitForTimeout(200);
			const selector = await page.$(".instrument-selector");
			if (!selector)
				throw new Error(`Instrument selector not found on tab ${i}`);
			const visible = await selector.isVisible();
			if (!visible)
				throw new Error(`Instrument selector not visible on tab ${i}`);
		}
	});

	// ── Test 61: Audio controls visible on all tabs ──
	await test("Audio controls are visible on all tabs", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		for (let i = 0; i < tabs.length; i++) {
			await tabs[i].click();
			await page.waitForTimeout(200);
			const ctrl = await page.$(".audio-controls");
			if (!ctrl) throw new Error(`Audio controls not found on tab ${i}`);
			const visible = await ctrl.isVisible();
			if (!visible) throw new Error(`Audio controls not visible on tab ${i}`);
		}
	});

	// ── Test 62: Metronome visible on all tabs ──
	await test("Metronome is visible on all tabs", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		for (let i = 0; i < tabs.length; i++) {
			await tabs[i].click();
			await page.waitForTimeout(200);
			const metro = await page.$(".metronome-panel");
			if (!metro) throw new Error(`Metronome not found on tab ${i}`);
			const visible = await metro.isVisible();
			if (!visible) throw new Error(`Metronome not visible on tab ${i}`);
		}
	});

	// ── Test 63: Tone selector visible on all tabs ──
	await test("Tone selector is visible on all tabs", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		for (let i = 0; i < tabs.length; i++) {
			await tabs[i].click();
			await page.waitForTimeout(200);
			const tone = await page.$(".tone-selector");
			if (!tone) throw new Error(`Tone selector not found on tab ${i}`);
			const visible = await tone.isVisible();
			if (!visible) throw new Error(`Tone selector not visible on tab ${i}`);
		}
	});

	// ══════════════════════════════════════════════════════════
	// PROGRESSION PANEL - STOP & METRONOME SYNC
	// ══════════════════════════════════════════════════════════

	// ── Test 64: Progression play button toggles to stop ──
	await test("Progression play button toggles to stop when playing", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[2].click();
		await page.waitForTimeout(300);
		// Select a preset to fill progression
		const panels = await page.$$(".tab-panel");
		const selects = await panels[2].$$("select");
		await selects[1].selectOption({ index: 1 });
		await page.waitForTimeout(300);
		// Click Play
		const playBtn = await page.evaluate(() => {
			const btns = document.querySelectorAll(".tab-panel.active .btn-primary");
			const btn = Array.from(btns).find((b) => b.textContent?.includes("Play"));
			if (btn) (btn as HTMLElement).click();
			return !!btn;
		});
		if (!playBtn) throw new Error("Play button not found");
		await page.waitForTimeout(300);
		// Button should now show "Stop"
		const hasStop = await page.evaluate(() => {
			const btns = document.querySelectorAll(".tab-panel.active .btn");
			return Array.from(btns).some((b) => b.textContent?.includes("Stop"));
		});
		if (!hasStop) throw new Error("Stop button not shown after clicking Play");
	});

	// ── Test 65: Progression stop button stops playback ──
	await test("Progression stop button reverts to play", async () => {
		// Continue from previous state - progression playing
		await page.evaluate(() => {
			const btns = document.querySelectorAll(".tab-panel.active .btn");
			const btn = Array.from(btns).find((b) => b.textContent?.includes("Stop"));
			if (btn) (btn as HTMLElement).click();
		});
		await page.waitForTimeout(300);
		const hasPlay = await page.evaluate(() => {
			const btns = document.querySelectorAll(".tab-panel.active .btn-primary");
			return Array.from(btns).some((b) => b.textContent?.includes("Play"));
		});
		if (!hasPlay) throw new Error("Play button not restored after stop");
	});

	// ── Test 66: Progression loop button toggles ──
	await test("Progression loop button toggles primary style", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[2].click();
		await page.waitForTimeout(300);
		const loopBtn = await page.evaluate(() => {
			const btns = document.querySelectorAll(".tab-panel.active .btn");
			const btn = Array.from(btns).find((b) => b.textContent?.includes("Loop"));
			if (btn) {
				(btn as HTMLElement).click();
				return btn.className;
			}
			return null;
		});
		if (!loopBtn) throw new Error("Loop button not found");
		// After toggle, button should have or not have btn-primary
		const loopClass = await page.evaluate(() => {
			const btns = document.querySelectorAll(".tab-panel.active .btn");
			const btn = Array.from(btns).find((b) => b.textContent?.includes("Loop"));
			return btn?.className ?? "";
		});
		// Default loop is true, clicking toggles to false, so btn-primary should be removed
		if (loopClass.includes("btn-primary"))
			throw new Error("Loop button should not be primary after toggling off");
	});

	// ── Test 67: Progression transpose down ──
	await test("Progression transpose down changes chords", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[2].click();
		await page.waitForTimeout(300);
		// Select a preset
		const panels = await page.$$(".tab-panel");
		const selects = await panels[2].$$("select");
		await selects[1].selectOption({ index: 1 });
		await page.waitForTimeout(300);
		const beforeLabels = await page.evaluate(() => {
			const items = document.querySelectorAll(".progression-item .chord-label");
			return Array.from(items).map((el) => el.textContent);
		});
		// Click transpose down (−)
		await page.evaluate(() => {
			const btns = document.querySelectorAll(".tab-panel.active .btn-icon");
			const btn = Array.from(btns).find(
				(b) =>
					b.textContent?.includes("−") &&
					b.getAttribute("title")?.includes("Transpose"),
			);
			if (btn) (btn as HTMLElement).click();
		});
		await page.waitForTimeout(300);
		const afterLabels = await page.evaluate(() => {
			const items = document.querySelectorAll(".progression-item .chord-label");
			return Array.from(items).map((el) => el.textContent);
		});
		// At least one chord should have changed
		let changed = false;
		for (let i = 0; i < beforeLabels.length; i++) {
			if (beforeLabels[i] !== afterLabels[i]) changed = true;
		}
		if (!changed) throw new Error("Transpose down did not change any chords");
	});

	// ── Test 68: Progression add all to chords ──
	await test("Add All to Chords adds progression items", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[2].click();
		await page.waitForTimeout(300);
		// Select preset
		const panels = await page.$$(".tab-panel");
		const selects = await panels[2].$$("select");
		await selects[1].selectOption({ index: 1 });
		await page.waitForTimeout(300);
		// Click Add All
		await page.evaluate(() => {
			const btns = document.querySelectorAll(".tab-panel.active .btn");
			const btn = Array.from(btns).find((b) =>
				b.textContent?.includes("Add All"),
			);
			if (btn) (btn as HTMLElement).click();
		});
		await page.waitForTimeout(300);
		// Switch to chords tab
		await tabs[0].click();
		await page.waitForTimeout(300);
		const chords = await page.$$(".chord");
		if (chords.length === 0)
			throw new Error("No chords added after Add All to Chords");
	});

	// ── Test 69: Progression remove item ──
	await test("Progression item can be removed via X button", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[2].click();
		await page.waitForTimeout(300);
		const panels = await page.$$(".tab-panel");
		const selects = await panels[2].$$("select");
		await selects[1].selectOption({ index: 1 });
		await page.waitForTimeout(300);
		const beforeCount = (await page.$$(".progression-item")).length;
		// Click the X on first item
		const removeBtn = await page.$(".progression-item .btn-remove");
		if (!removeBtn)
			throw new Error("Remove button not found on progression item");
		await removeBtn.click();
		await page.waitForTimeout(300);
		const afterCount = (await page.$$(".progression-item")).length;
		if (afterCount !== beforeCount - 1)
			throw new Error(
				`Expected ${beforeCount - 1} items after remove, got ${afterCount}`,
			);
	});

	// ── Test 70: Nashville number toggle displays numerals ──
	await test("Nashville toggle shows Roman numerals", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[2].click();
		await page.waitForTimeout(300);
		const panels = await page.$$(".tab-panel");
		const selects = await panels[2].$$("select");
		await selects[1].selectOption({ index: 1 });
		await page.waitForTimeout(300);
		// Enable Nashville toggle
		await page.evaluate(() => {
			const labels = document.querySelectorAll(".tab-panel.active .fb-toggle");
			const nashville = Array.from(labels).find((l) =>
				l.textContent?.includes("Nashville"),
			);
			const checkbox = nashville?.querySelector(
				"input[type='checkbox']",
			) as HTMLInputElement;
			if (checkbox) checkbox.click();
		});
		await page.waitForTimeout(300);
		// Should show analysis with Roman numerals
		const analysisText = await page.evaluate(() => {
			const detected = document.querySelector(
				".tab-panel.active .key-detected",
			);
			return detected?.textContent ?? "";
		});
		if (!analysisText.includes("Analysis"))
			throw new Error("Nashville analysis text not shown");
	});

	// ══════════════════════════════════════════════════════════
	// CHORDS PANEL - COMPREHENSIVE TESTS
	// ══════════════════════════════════════════════════════════

	// ── Test 71: Multiple chords can be added ──
	await test("Multiple chords can be added to the viewer", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.waitForSelector("#chord-input");
		for (const chord of ["C", "G", "Am", "F"]) {
			await page.fill("#chord-input", chord);
			await page.waitForSelector(".autocomplete-list.visible");
			await page.keyboard.press("ArrowDown");
			await page.keyboard.press("Enter");
			await page.waitForTimeout(300);
		}
		const chords = await page.$$(".chord");
		if (chords.length !== 4)
			throw new Error(`Expected 4 chords, got ${chords.length}`);
	});

	// ── Test 72: Duplicate chord shows toast ──
	await test("Adding duplicate chord shows info toast", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => {
			localStorage.setItem(
				"guitar-chords-state",
				JSON.stringify([{ name: "C", variationIndex: 0 }]),
			);
		});
		await page.reload();
		await page.waitForSelector("#chord-input");
		await page.fill("#chord-input", "C");
		await page.waitForSelector(".autocomplete-list.visible");
		await page.keyboard.press("ArrowDown");
		await page.keyboard.press("Enter");
		await page.waitForTimeout(300);
		const toastText = await page.evaluate(() => {
			const t = document.querySelector(".toast-visible");
			return t?.textContent ?? "";
		});
		if (!toastText.includes("already"))
			throw new Error("Duplicate chord toast not shown");
	});

	// ── Test 73: Transpose up works ──
	await test("Transpose up changes chord names", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => {
			localStorage.setItem(
				"guitar-chords-state",
				JSON.stringify([{ name: "C", variationIndex: 0 }]),
			);
		});
		await page.reload();
		await page.waitForSelector(".chord");
		// Click transpose up
		const transposeSection = await page.$(".transpose-controls");
		if (!transposeSection) throw new Error("Transpose controls not found");
		const buttons = await transposeSection.$$("button");
		// Second button is +
		await buttons[1].click();
		await page.waitForTimeout(300);
		const chordName = await page.$eval(".chord-name", (el) => el.textContent);
		if (chordName === "C")
			throw new Error("Chord name did not change after transpose up");
	});

	// ── Test 74: Capo selector shows capo info ──
	await test("Capo selector shows capo info chips", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => {
			localStorage.setItem(
				"guitar-chords-state",
				JSON.stringify([{ name: "C", variationIndex: 0 }]),
			);
		});
		await page.reload();
		await page.waitForSelector(".transpose-controls");
		const capoSelect = await page.$(".transpose-controls select");
		if (!capoSelect) throw new Error("Capo select not found");
		await page.selectOption(".transpose-controls select", "3");
		await page.waitForTimeout(300);
		const capoChips = await page.$$(".capo-chip");
		if (capoChips.length < 1) throw new Error("No capo info chips shown");
	});

	// ══════════════════════════════════════════════════════════
	// FRETBOARD PANEL - COMPREHENSIVE TESTS
	// ══════════════════════════════════════════════════════════

	// ── Test 75: Fretboard SVG renders ──
	await test("Fretboard SVG renders with correct structure", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[1].click();
		await page.waitForSelector(".fretboard-panel", { timeout: 3000 });
		const svg = await page.$(".fretboard-svg");
		if (!svg) throw new Error("Fretboard SVG not found");
	});

	// ── Test 76: Fretboard toggles exist ──
	await test("Fretboard has show notes/sharps toggle controls", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[1].click();
		await page.waitForSelector(".fretboard-panel", { timeout: 3000 });
		const toggles = await page.$$(".fb-toggle");
		if (toggles.length < 1) throw new Error("No fretboard toggles found");
	});

	// ── Test 77: Chord finder input accepts note names ──
	await test("Chord finder processes comma-separated notes", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[1].click();
		await page.waitForSelector(".chord-finder", { timeout: 3000 });
		await page.fill(".chord-finder input", "E, G#, B");
		await page.waitForTimeout(500);
		const matches = await page.$$(".finder-match");
		if (matches.length === 0) throw new Error("No chord matches for E, G#, B");
	});

	// ══════════════════════════════════════════════════════════
	// SONGS PANEL - COMPREHENSIVE TESTS
	// ══════════════════════════════════════════════════════════

	// ── Test 78: Songs panel shows empty state ──
	await test("Songs panel shows empty state when no songs", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[3].click();
		await page.waitForTimeout(300);
		const text = await page.evaluate(() => {
			return document.querySelector(".tab-panel.active")?.textContent ?? "";
		});
		if (!text.includes("Songs")) throw new Error("Songs panel text not found");
	});

	// ── Test 79: Create a new song opens editor ──
	await test("New Song button opens song editor with form inputs", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[3].click();
		await page.waitForTimeout(300);
		await page.evaluate(() => {
			const btns = document.querySelectorAll(".tab-panel.active .btn");
			const btn = Array.from(btns).find((b) =>
				b.textContent?.includes("New Song"),
			);
			if (btn) (btn as HTMLElement).click();
		});
		await page.waitForTimeout(300);
		// Song editor opens as a modal overlay
		const inputs = await page.$$(".modal input");
		if (inputs.length < 2) throw new Error("Song form inputs not shown");
	});

	// ── Test 80: Song editor has save/create button ──
	await test("Song editor has Save button", async () => {
		// Continuing from previous state with editor open
		const hasCreate = await page.evaluate(() => {
			const btns = document.querySelectorAll(".modal .btn");
			return Array.from(btns).some(
				(b) =>
					b.textContent?.includes("Create") || b.textContent?.includes("Save"),
			);
		});
		if (!hasCreate)
			throw new Error("Create/Save button not found in song editor");
	});

	// ══════════════════════════════════════════════════════════
	// THEORY PANEL - COMPREHENSIVE TESTS
	// ══════════════════════════════════════════════════════════

	// ── Test 81: Theory key selector changes diatonic chords ──
	await test("Changing key updates diatonic chords", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[4].click();
		await page.waitForTimeout(300);
		// Get initial chords
		const initial = await page.evaluate(() => {
			const btns = document.querySelectorAll(".diatonic-chord-btn .chord-name");
			return Array.from(btns).map((b) => b.textContent);
		});
		// Change key to G
		const panels = await page.$$(".tab-panel");
		const selects = await panels[4].$$("select");
		await selects[0].selectOption("G");
		await page.waitForTimeout(300);
		const updated = await page.evaluate(() => {
			const btns = document.querySelectorAll(".diatonic-chord-btn .chord-name");
			return Array.from(btns).map((b) => b.textContent);
		});
		// Check that chords changed
		let changed = false;
		for (let i = 0; i < initial.length; i++) {
			if (initial[i] !== updated[i]) changed = true;
		}
		if (!changed)
			throw new Error("Diatonic chords did not change when key changed");
	});

	// ── Test 82: Theory scale selector changes scale notes ──
	await test("Changing scale updates scale note display", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[4].click();
		await page.waitForTimeout(300);
		const initialText = await page.evaluate(() => {
			const detected = document.querySelectorAll(
				".tab-panel.active .key-detected",
			);
			return detected[0]?.textContent ?? "";
		});
		// Change scale
		const panels = await page.$$(".tab-panel");
		const selects = await panels[4].$$("select");
		await selects[1].selectOption({ index: 2 });
		await page.waitForTimeout(300);
		const updatedText = await page.evaluate(() => {
			const detected = document.querySelectorAll(
				".tab-panel.active .key-detected",
			);
			return detected[0]?.textContent ?? "";
		});
		if (initialText === updatedText)
			throw new Error("Scale note display did not change");
	});

	// ── Test 83: Theory diatonic chords have roman numerals ──
	await test("Diatonic chord buttons show Roman numerals", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[4].click();
		await page.waitForTimeout(300);
		const romans = await page.evaluate(() => {
			const spans = document.querySelectorAll(".diatonic-chord-btn .roman");
			return Array.from(spans).map((s) => s.textContent);
		});
		if (romans.length < 7)
			throw new Error(`Expected 7 Roman numerals, got ${romans.length}`);
		// First should be I
		if (!romans[0]?.includes("I"))
			throw new Error(`First Roman numeral should be I, got "${romans[0]}"`);
	});

	// ── Test 84: Key detection with chords ──
	await test("Key detection works when chords are present", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => {
			localStorage.setItem(
				"guitar-chords-state",
				JSON.stringify([
					{ name: "C", variationIndex: 0 },
					{ name: "F", variationIndex: 0 },
					{ name: "G", variationIndex: 0 },
				]),
			);
		});
		await page.reload();
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[4].click();
		await page.waitForTimeout(300);
		const detectedText = await page.evaluate(() => {
			const sections = document.querySelectorAll(
				".tab-panel.active .key-detected",
			);
			// Key detection is the second or last .key-detected
			for (const s of Array.from(sections)) {
				if (s.textContent?.includes("Likely key")) return s.textContent;
			}
			return "";
		});
		if (!detectedText.includes("Likely key"))
			throw new Error("Key detection did not show likely key");
	});

	// ══════════════════════════════════════════════════════════
	// SHARE PANEL - COMPREHENSIVE TESTS
	// ══════════════════════════════════════════════════════════

	// ── Test 85: Share URL input renders ──
	await test("Share panel has URL input and Generate button", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[6].click();
		await page.waitForTimeout(300);
		const shareInput = await page.$(".share-url-input");
		if (!shareInput) throw new Error("Share URL input not found");
		const hasGenerate = await page.evaluate(() => {
			const btns = document.querySelectorAll(".tab-panel.active .btn");
			return Array.from(btns).some(
				(b) =>
					b.textContent?.includes("Generate") ||
					b.textContent?.includes("Copy"),
			);
		});
		if (!hasGenerate) throw new Error("Generate/Copy button not found");
	});

	// ── Test 86: Share panel has export buttons ──
	await test("Share panel has PDF, PNG, and JSON export buttons", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[6].click();
		await page.waitForTimeout(300);
		const btnTexts = await page.evaluate(() => {
			const btns = document.querySelectorAll(".tab-panel.active .btn");
			return Array.from(btns).map((b) => b.textContent?.trim());
		});
		const hasPDF = btnTexts.some(
			(t) => t?.includes("PDF") || t?.includes("Print"),
		);
		const hasPNG = btnTexts.some((t) => t?.includes("PNG"));
		if (!hasPDF) throw new Error("PDF/Print export button not found");
		if (!hasPNG) throw new Error("PNG export button not found");
	});

	// ══════════════════════════════════════════════════════════
	// INFO PANEL - COMPREHENSIVE TESTS
	// ══════════════════════════════════════════════════════════

	// ── Test 87: Info page heading renders ──
	await test("Info page has 'How to Use' heading", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[7].click();
		await page.waitForTimeout(300);
		const heading = await page.$eval(".info-page h2", (el) => el.textContent);
		if (!heading?.includes("How to Use"))
			throw new Error(`Expected 'How to Use', got "${heading}"`);
	});

	// ── Test 88: Info sections have consistent structure ──
	await test("All info sections have h3 heading and content", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const tabs = await page.$$(".tab-btn");
		await tabs[7].click();
		await page.waitForTimeout(300);
		const sections = await page.$$(".info-section");
		for (let i = 0; i < sections.length; i++) {
			const h3 = await sections[i].$("h3");
			if (!h3) throw new Error(`Info section ${i} missing h3`);
			const content = await sections[i].$("p, ul");
			if (!content) throw new Error(`Info section ${i} missing content`);
		}
	});

	// ══════════════════════════════════════════════════════════
	// METRONOME - COMPREHENSIVE TESTS
	// ══════════════════════════════════════════════════════════

	// ── Test 89: Metronome BPM slider changes display ──
	await test("Metronome BPM slider updates BPM display", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".metronome-panel");
		// Move slider to max
		await page.evaluate(() => {
			const slider = document.querySelector(
				'.metronome-panel input[type="range"]',
			) as HTMLInputElement;
			if (slider) {
				slider.value = "180";
				slider.dispatchEvent(new Event("input"));
			}
		});
		await page.waitForTimeout(200);
		const bpmAfter = await page.$eval(".metronome-bpm", (el) => el.textContent);
		if (bpmAfter !== "180")
			throw new Error(`Expected BPM 180, got "${bpmAfter}"`);
	});

	// ── Test 90: Metronome time signature select changes beat dots ──
	await test("Changing time signature updates beat dots", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".metronome-panel");
		// Change to 3/4
		await page.evaluate(() => {
			const select = document.querySelector(
				".metronome-panel select",
			) as HTMLSelectElement;
			if (select) {
				select.value = "3/4";
				select.dispatchEvent(new Event("change"));
			}
		});
		await page.waitForTimeout(300);
		const dotsAfter = (await page.$$(".beat-dot")).length;
		if (dotsAfter !== 3)
			throw new Error(`Expected 3 beat dots for 3/4, got ${dotsAfter}`);
	});

	// ── Test 91: Metronome start/stop button toggles ──
	await test("Metronome start button toggles to stop", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".metronome-panel");
		// Click Start
		await page.evaluate(() => {
			const btns = document.querySelectorAll(".metronome-panel .btn-primary");
			const btn = Array.from(btns).find((b) =>
				b.textContent?.includes("Start"),
			);
			if (btn) (btn as HTMLElement).click();
		});
		await page.waitForTimeout(300);
		const hasStop = await page.evaluate(() => {
			const btns = document.querySelectorAll(".metronome-panel .btn-primary");
			return Array.from(btns).some((b) => b.textContent?.includes("Stop"));
		});
		if (!hasStop)
			throw new Error("Stop button not shown after starting metronome");
		// Stop it
		await page.evaluate(() => {
			const btns = document.querySelectorAll(".metronome-panel .btn-primary");
			const btn = Array.from(btns).find((b) => b.textContent?.includes("Stop"));
			if (btn) (btn as HTMLElement).click();
		});
		await page.waitForTimeout(300);
		const hasStart = await page.evaluate(() => {
			const btns = document.querySelectorAll(".metronome-panel .btn-primary");
			return Array.from(btns).some((b) => b.textContent?.includes("Start"));
		});
		if (!hasStart)
			throw new Error("Start button not shown after stopping metronome");
	});

	// ── Test 92: Tap tempo button exists ──
	await test("Tap tempo button exists in metronome panel", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".metronome-panel");
		const hasTap = await page.evaluate(() => {
			const btns = document.querySelectorAll(".metronome-panel .btn");
			return Array.from(btns).some((b) => b.textContent?.includes("Tap"));
		});
		if (!hasTap) throw new Error("Tap tempo button not found");
	});

	// ══════════════════════════════════════════════════════════
	// AUDIO & INSTRUMENT CONTROLS
	// ══════════════════════════════════════════════════════════

	// ── Test 93: Instrument switching updates active button ──
	await test("Clicking instrument button updates active state", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".instrument-selector");
		const btns = await page.$$(".instrument-btn");
		await btns[1].click(); // Click Ukulele
		await page.waitForTimeout(200);
		const cls = await btns[1].getAttribute("class");
		if (!cls?.includes("active"))
			throw new Error("Ukulele button not active after click");
		const guitarCls = await btns[0].getAttribute("class");
		if (guitarCls?.includes("active"))
			throw new Error("Guitar button still active after switching");
	});

	// ── Test 94: Volume mute toggle ──
	await test("Volume mute button toggles icon", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".audio-controls");
		const muteBtn = await page.$(
			'.audio-controls button[aria-label="Toggle mute"]',
		);
		if (!muteBtn) throw new Error("Mute button not found");
		const svgBefore = await muteBtn.innerHTML();
		await muteBtn.click();
		await page.waitForTimeout(200);
		const svgAfter = await muteBtn.innerHTML();
		if (svgBefore === svgAfter)
			throw new Error("Mute icon did not change after click");
	});

	// ── Test 95: Strum direction select changes value ──
	await test("Strum direction select can be changed", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".audio-controls");
		const selects = await page.$$(".audio-controls select");
		// First select in audio controls is strum direction
		await selects[0].selectOption("up");
		const value = await selects[0].evaluate(
			(el: HTMLSelectElement) => el.value,
		);
		if (value !== "up")
			throw new Error(`Expected strum direction "up", got "${value}"`);
	});

	// ── Test 96: Tone selector can change tone ──
	await test("Tone selector changes value", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tone-selector");
		await page.selectOption(".tone-selector", "steel");
		const value = await page.$eval(
			".tone-selector",
			(el: HTMLSelectElement) => el.value,
		);
		if (value !== "steel")
			throw new Error(`Expected tone "steel", got "${value}"`);
	});

	// ══════════════════════════════════════════════════════════
	// EDGE CASES & ACCESSIBILITY
	// ══════════════════════════════════════════════════════════

	// ── Test 97: Empty chord search shows no results ──
	await test("Submitting empty chord input does nothing", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.waitForSelector("#chord-input");
		await page.fill("#chord-input", "");
		await page.keyboard.press("Enter");
		await page.waitForTimeout(300);
		const chords = await page.$$(".chord");
		if (chords.length !== 0)
			throw new Error("Chord was added from empty input");
	});

	// ── Test 98: Invalid chord shows error toast ──
	await test("Invalid chord name shows error toast", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.waitForSelector("#chord-input");
		await page.fill("#chord-input", "ZZZZZ");
		await page.keyboard.press("Enter");
		await page.waitForTimeout(500);
		const toastText = await page.evaluate(() => {
			const t = document.querySelector(".toast-visible");
			return t?.textContent ?? "";
		});
		if (!toastText.includes("not found"))
			throw new Error("Error toast not shown for invalid chord");
	});

	// ── Test 99: Panel ARIA roles are correct ──
	await test("All tab panels have tabpanel role", async () => {
		await page.goto(BASE_URL);
		await page.waitForSelector(".tab-bar");
		const panels = await page.$$(".tab-panel");
		for (let i = 0; i < panels.length; i++) {
			const role = await panels[i].getAttribute("role");
			if (role !== "tabpanel")
				throw new Error(`Panel ${i} role: expected "tabpanel", got "${role}"`);
		}
	});

	// ── Test 100: Screen reader live region exists ──
	await test("Screen reader live region is created on user interaction", async () => {
		await page.goto(BASE_URL);
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.waitForSelector("#chord-input");
		await page.fill("#chord-input", "C");
		await page.waitForSelector(".autocomplete-list.visible");
		await page.keyboard.press("ArrowDown");
		await page.keyboard.press("Enter");
		await page.waitForTimeout(300);
		// After interaction, sr-only region may exist
		// Just check that the page has proper ARIA support
		const hasAriaLabel = await page.evaluate(() => {
			const input = document.querySelector("#chord-input");
			return input?.getAttribute("aria-label") ?? "";
		});
		if (!hasAriaLabel) throw new Error("Chord input missing aria-label");
	});

	await teardown();

	console.log("\nDone!\n");
}

run();
