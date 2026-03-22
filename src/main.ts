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
