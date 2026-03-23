/** Entry point — bootstrap the app */
import "./state";
import { App } from "./ui";

App();

// Register service worker
if ("serviceWorker" in navigator) {
	navigator.serviceWorker.register("./sw.js").catch(() => {
		// SW registration failed, app still works
	});
}

// ── "Add to Home Screen" PWA install prompt ──
let deferredPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

window.addEventListener("beforeinstallprompt", (e) => {
	e.preventDefault();
	deferredPrompt = e as BeforeInstallPromptEvent;
	showInstallBanner();
});

function showInstallBanner() {
	if (document.querySelector(".install-banner")) return;
	const banner = document.createElement("div");
	banner.className = "install-banner";
	banner.setAttribute("role", "alert");
	banner.innerHTML = `
		<span>Install Guitar Chords for offline use</span>
		<button class="btn btn-primary install-btn">Install</button>
		<button class="btn btn-icon dismiss-btn" aria-label="Dismiss">✕</button>
	`;
	const installBtn = banner.querySelector(".install-btn") as HTMLButtonElement;
	installBtn.onclick = async () => {
		if (!deferredPrompt) return;
		await deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === "accepted") {
			banner.remove();
		}
		deferredPrompt = null;
	};
	const dismissBtn = banner.querySelector(".dismiss-btn") as HTMLButtonElement;
	dismissBtn.onclick = () => banner.remove();
	document.body.prepend(banner);
}
