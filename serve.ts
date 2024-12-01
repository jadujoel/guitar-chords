import { build } from './build'

const server = Bun.serve({
  hostname: "127.0.0.1",
  async fetch(request, server) {
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405 })
    }
    let pathname = new URL(request.url).pathname
    if (pathname === "/") {
      await build()
      pathname = "dist/index.html"
    } else {
      pathname = `dist${pathname}`
    }
    const file = Bun.file(pathname)
    if (!await file.exists()) {
      return new Response("Not Found", { status: 404 })
    }

    return new Response(Bun.file(pathname))
  }
})

console.log(`Server running at http://${server.hostname}:${server.port}/`)
