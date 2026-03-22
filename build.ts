export async function build() {
	const output = await Bun.build({
		entrypoints: ["src/main.ts"],
		outdir: "dist",
		naming: "[dir]/[name]-[hash].[ext]",
		minify: true,
		sourcemap: "inline",
	});

	if (!output.success) {
		console.error(output.logs);
		throw new Error("Build failed");
	}

	// Build service worker separately (no hashing for SW)
	const swOutput = await Bun.build({
		entrypoints: ["src/sw.ts"],
		outdir: "dist",
		minify: true,
	});

	if (!swOutput.success) {
		console.error(swOutput.logs);
		throw new Error("SW Build failed");
	}

	// Get the hashed JS filename
	const jsFile = output.outputs.find((o) => o.path.endsWith(".js"));
	const jsName = jsFile ? jsFile.path.split("/").pop() : "main.js";

	// Read HTML template and inject hashed filename
	let html = await Bun.file("src/index.html").text();
	html = html.replace("main.js", jsName ?? "main.js");

	await Bun.write("dist/index.html", html);

	// Copy static assets
	await copy("index.css", "manifest.json", "icon-192.svg", "icon-512.svg");

	console.log(`Built successfully: ${jsName}`);
}

async function copy(...files: readonly string[]) {
	for (const file of files) {
		await Bun.write(`dist/${file}`, Bun.file(`src/${file}`));
	}
}

if (import.meta.main) {
	await build();
}
