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
		await page.selectOption(".variation-selector", "1");
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

	await teardown();

	console.log("\nDone!\n");
}

run();
