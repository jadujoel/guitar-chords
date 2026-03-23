/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = "guitar-chords-v2";

// __JS_FILE__ is replaced by the build script with the actual hashed filename
const PRECACHE_URLS = [
	"./",
	"./index.html",
	"./index.css",
	"./__JS_FILE__",
	"./manifest.json",
];

const AUDIO_CACHE = "guitar-chords-audio-v1";

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
	);
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key !== CACHE_NAME && key !== AUDIO_CACHE)
						.map((key) => caches.delete(key)),
				),
			),
	);
	self.clients.claim();
});

self.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url);

	// Runtime cache for local sound samples (OGG files)
	if (
		url.origin === self.location.origin &&
		url.pathname.startsWith("/sound/")
	) {
		event.respondWith(
			caches.open(AUDIO_CACHE).then((cache) =>
				cache.match(event.request).then(
					(cached) =>
						cached ||
						fetch(event.request).then((response) => {
							cache.put(event.request, response.clone());
							return response;
						}),
				),
			),
		);
		return;
	}

	// Cache-first for same-origin
	if (url.origin === self.location.origin) {
		event.respondWith(
			caches.match(event.request).then(
				(cached) =>
					cached ||
					fetch(event.request).catch(
						() =>
							new Response(
								"<html><body><h1>Offline</h1><p>Guitar Chords is not available offline yet. Please connect to the internet and reload.</p></body></html>",
								{
									headers: { "Content-Type": "text/html" },
								},
							),
					),
			),
		);
		return;
	}

	// Network-first for external
	event.respondWith(
		fetch(event.request).catch(() =>
			caches
				.match(event.request)
				.then((cached) => cached || new Response("Offline", { status: 503 })),
		),
	);
});

export {};
