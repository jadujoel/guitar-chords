export async function build() {
  const output = await Bun.build({
    entrypoints: ["src/index.js"],
    outdir: "dist",
    minify: true,
    sourcemap: 'inline',
  })

  await copy(
    "index.html",
    "index.css"
  )

  if (!output.success) {
    console.error(output.logs)
    throw new Error("Build failed")
  }
}

async function copy(...files: readonly string[]) {
  for (const file of files) {
    await Bun.write(`dist/${file}`, Bun.file(`src/${file}`))
  }
}

if (import.meta.main) {
  await build()
}
