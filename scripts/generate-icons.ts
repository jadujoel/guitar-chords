/** Generate PWA icons as SVG */
function generateIcon(size: number): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
		<rect width="${size}" height="${size}" rx="${size * 0.15}" fill="#0f0f0f"/>
		<text x="${size / 2}" y="${size * 0.7}" text-anchor="middle" font-size="${size * 0.55}" font-family="sans-serif">🎸</text>
	</svg>`;
}

await Bun.write("src/icon-192.svg", generateIcon(192));
await Bun.write("src/icon-512.svg", generateIcon(512));

console.log("Generated icon SVGs");
