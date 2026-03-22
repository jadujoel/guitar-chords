export type Listener<T> = (value: T) => void;

export interface Signal<T> {
	get(): T;
	set(value: T): void;
	update(fn: (current: T) => T): void;
	subscribe(listener: Listener<T>): () => void;
}

export function createSignal<T>(initialValue: T): Signal<T> {
	let value = initialValue;
	const listeners = new Set<Listener<T>>();

	return {
		get() {
			return value;
		},
		set(newValue: T) {
			value = newValue;
			for (const listener of listeners) {
				listener(value);
			}
		},
		update(fn: (current: T) => T) {
			value = fn(value);
			for (const listener of listeners) {
				listener(value);
			}
		},
		subscribe(listener: Listener<T>) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}

export interface ChordItem {
	name: string;
	variationIndex: number;
}

export type ThemeMode = "dark" | "light";

export interface AppState {
	chords: ChordItem[];
	theme: ThemeMode;
}

const STORAGE_KEY = "guitar-chords-state";
const THEME_KEY = "guitar-chords-theme";

const hasDOM =
	typeof window !== "undefined" && typeof localStorage !== "undefined";

function loadTheme(): ThemeMode {
	if (!hasDOM) return "dark";
	const saved = localStorage.getItem(THEME_KEY);
	if (saved === "light" || saved === "dark") return saved;
	return window.matchMedia("(prefers-color-scheme: light)").matches
		? "light"
		: "dark";
}

function loadChords(): ChordItem[] {
	if (!hasDOM) return [];
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) return JSON.parse(saved);
	} catch {
		// ignore
	}
	return [];
}

export const chordsSignal = createSignal<ChordItem[]>(loadChords());
export const themeSignal = createSignal<ThemeMode>(loadTheme());

if (hasDOM) {
	chordsSignal.subscribe((chords) => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(chords));
	});

	themeSignal.subscribe((theme) => {
		localStorage.setItem(THEME_KEY, theme);
		document.documentElement.setAttribute("data-theme", theme);
	});

	// Initialize theme on document
	document.documentElement.setAttribute("data-theme", themeSignal.get());
}
