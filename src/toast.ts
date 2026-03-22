/** Toast notification system */

type ToastType = "success" | "error" | "info";

let container: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement {
	if (container) return container;
	container = document.createElement("div");
	container.className = "toast-container";
	container.setAttribute("aria-live", "polite");
	container.setAttribute("aria-atomic", "true");
	document.body.appendChild(container);
	return container;
}

export function toast(
	message: string,
	type: ToastType = "info",
	durationMs = 3000,
) {
	const c = getContainer();
	const el = document.createElement("div");
	el.className = `toast toast-${type}`;
	el.setAttribute("role", "status");
	el.textContent = message;
	c.appendChild(el);

	// Trigger enter animation
	requestAnimationFrame(() => el.classList.add("toast-visible"));

	setTimeout(() => {
		el.classList.remove("toast-visible");
		el.classList.add("toast-exit");
		el.addEventListener("transitionend", () => el.remove(), { once: true });
		// Fallback removal
		setTimeout(() => el.remove(), 500);
	}, durationMs);
}
