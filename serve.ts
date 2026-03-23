import { build } from "./build";

const server = Bun.serve({
	hostname: "127.0.0.1",
	port: Number(process.env.PORT ?? 0),
	async fetch(request) {
		if (request.method !== "GET") {
			return new Response("Method Not Allowed", { status: 405 });
		}
		let pathname = new URL(request.url).pathname;

		// Serve sound samples directly from project root
		if (pathname.startsWith("/sound/")) {
			const file = Bun.file(pathname.slice(1));
			if (!(await file.exists())) {
				return new Response("Not Found", { status: 404 });
			}
			return new Response(file, {
				headers: { "Cache-Control": "public, max-age=86400" },
			});
		}

		if (pathname === "/") {
			await build();
			pathname = "dist/index.html";
		} else {
			pathname = `dist${pathname}`;
		}
		const file = Bun.file(pathname);
		if (!(await file.exists())) {
			return new Response("Not Found", { status: 404 });
		}

		return new Response(Bun.file(pathname));
	},
});

console.log(`Server running at http://${server.hostname}:${server.port}/`);
