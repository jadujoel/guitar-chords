import { expect, test } from "bun:test";
import { encodeQR } from "../src/qr";

test("encodeQR returns a 2D boolean array", () => {
	const matrix = encodeQR("Hello");
	expect(Array.isArray(matrix)).toBe(true);
	expect(matrix.length).toBeGreaterThan(0);
	expect(Array.isArray(matrix[0])).toBe(true);
	expect(matrix.length).toBe(matrix[0].length); // Square matrix
});

test("encodeQR produces correct size for version 1", () => {
	// "Hi" is short enough for version 1 (21x21)
	const matrix = encodeQR("Hi");
	expect(matrix.length).toBe(21);
	expect(matrix[0].length).toBe(21);
});

test("encodeQR uses larger version for longer data", () => {
	const short = encodeQR("A");
	const long = encodeQR(
		"This is a much longer string that requires more capacity for encoding",
	);
	expect(long.length).toBeGreaterThan(short.length);
});

test("encodeQR matrix contains only booleans", () => {
	const matrix = encodeQR("test");
	for (const row of matrix) {
		for (const cell of row) {
			expect(typeof cell).toBe("boolean");
		}
	}
});

test("encodeQR has finder patterns in corners", () => {
	const matrix = encodeQR("Test");
	const size = matrix.length;

	// Top-left finder pattern: 7x7 solid border, white inside, 3x3 solid center
	// Verify top-left corner row 0 starts with 7 dark modules
	expect(matrix[0][0]).toBe(true);
	expect(matrix[0][1]).toBe(true);
	expect(matrix[0][2]).toBe(true);
	expect(matrix[0][3]).toBe(true);
	expect(matrix[0][4]).toBe(true);
	expect(matrix[0][5]).toBe(true);
	expect(matrix[0][6]).toBe(true);

	// Top-right finder pattern
	expect(matrix[0][size - 1]).toBe(true);
	expect(matrix[0][size - 7]).toBe(true);

	// Bottom-left finder pattern
	expect(matrix[size - 1][0]).toBe(true);
	expect(matrix[size - 7][0]).toBe(true);
});

test("encodeQR produces different output for different data", () => {
	const a = encodeQR("ABC");
	const b = encodeQR("XYZ");

	// They should be the same size if both fit version 1
	if (a.length === b.length) {
		// But different content
		let hasDifference = false;
		for (let r = 0; r < a.length; r++) {
			for (let c = 0; c < a[r].length; c++) {
				if (a[r][c] !== b[r][c]) {
					hasDifference = true;
					break;
				}
			}
			if (hasDifference) break;
		}
		expect(hasDifference).toBe(true);
	}
});

test("encodeQR produces same output for same data (deterministic)", () => {
	const a = encodeQR("deterministic");
	const b = encodeQR("deterministic");
	expect(a).toEqual(b);
});

test("encodeQR handles URL-like data", () => {
	const matrix = encodeQR("https://example.com/path?query=value#hash");
	expect(matrix.length).toBeGreaterThan(0);
	// Should be a valid square matrix
	expect(matrix.length).toBe(matrix[0].length);
});

test("encodeQR handles empty-ish short strings", () => {
	const matrix = encodeQR("A");
	expect(matrix.length).toBe(21); // Version 1
});
