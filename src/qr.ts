/**
 * Minimal QR Code encoder – byte mode, error correction level M, versions 1–10.
 * No external dependencies. Returns a boolean[][] matrix suitable for SVG rendering.
 */

// ─── GF(256) arithmetic for Reed-Solomon ────────────────

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
{
	let x = 1;
	for (let i = 0; i < 255; i++) {
		GF_EXP[i] = x;
		GF_LOG[x] = i;
		x = x << 1;
		if (x & 0x100) x ^= 0x11d;
	}
	for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
}

function gfMul(a: number, b: number): number {
	if (a === 0 || b === 0) return 0;
	return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsEncode(data: Uint8Array, nsym: number): Uint8Array {
	// Build generator polynomial
	const gen = new Uint8Array(nsym + 1);
	gen[0] = 1;
	for (let i = 0; i < nsym; i++) {
		for (let j = nsym; j > 0; j--) {
			gen[j] = gen[j] ^ gfMul(gen[j - 1], GF_EXP[i]);
		}
	}

	const result = new Uint8Array(nsym);
	for (let i = 0; i < data.length; i++) {
		const coef = data[i] ^ result[0];
		// Shift result left
		for (let j = 0; j < nsym - 1; j++) result[j] = result[j + 1];
		result[nsym - 1] = 0;
		if (coef !== 0) {
			for (let j = 0; j < nsym; j++) {
				result[j] = result[j] ^ gfMul(gen[j + 1], coef);
			}
		}
	}
	return result;
}

// ─── Version parameters (EC level M) ───────────────────

interface VersionInfo {
	totalCodewords: number;
	ecPerBlock: number;
	blocks: number; // group 1 blocks
	dataPerBlock1: number;
	blocks2: number; // group 2 blocks (0 or more)
	dataPerBlock2: number;
	alignmentPatterns: number[];
}

// Version 1–10, EC level M
const VERSIONS: VersionInfo[] = [
	{
		totalCodewords: 26,
		ecPerBlock: 10,
		blocks: 1,
		dataPerBlock1: 16,
		blocks2: 0,
		dataPerBlock2: 0,
		alignmentPatterns: [],
	},
	{
		totalCodewords: 44,
		ecPerBlock: 16,
		blocks: 1,
		dataPerBlock1: 28,
		blocks2: 0,
		dataPerBlock2: 0,
		alignmentPatterns: [18],
	},
	{
		totalCodewords: 70,
		ecPerBlock: 26,
		blocks: 1,
		dataPerBlock1: 44,
		blocks2: 0,
		dataPerBlock2: 0,
		alignmentPatterns: [22],
	},
	{
		totalCodewords: 100,
		ecPerBlock: 18,
		blocks: 2,
		dataPerBlock1: 32,
		blocks2: 0,
		dataPerBlock2: 0,
		alignmentPatterns: [26],
	},
	{
		totalCodewords: 134,
		ecPerBlock: 24,
		blocks: 2,
		dataPerBlock1: 43,
		blocks2: 0,
		dataPerBlock2: 0,
		alignmentPatterns: [30],
	},
	{
		totalCodewords: 172,
		ecPerBlock: 16,
		blocks: 4,
		dataPerBlock1: 27,
		blocks2: 0,
		dataPerBlock2: 0,
		alignmentPatterns: [34],
	},
	{
		totalCodewords: 196,
		ecPerBlock: 18,
		blocks: 4,
		dataPerBlock1: 31,
		blocks2: 0,
		dataPerBlock2: 0,
		alignmentPatterns: [6, 22, 38],
	},
	{
		totalCodewords: 242,
		ecPerBlock: 22,
		blocks: 2,
		dataPerBlock1: 38,
		blocks2: 2,
		dataPerBlock2: 39,
		alignmentPatterns: [6, 24, 42],
	},
	{
		totalCodewords: 292,
		ecPerBlock: 22,
		blocks: 3,
		dataPerBlock1: 36,
		blocks2: 2,
		dataPerBlock2: 37,
		alignmentPatterns: [6, 26, 46],
	},
	{
		totalCodewords: 346,
		ecPerBlock: 26,
		blocks: 2,
		dataPerBlock1: 43,
		blocks2: 4,
		dataPerBlock2: 44,
		alignmentPatterns: [6, 28, 50],
	},
];

function versionSize(v: number): number {
	return 17 + v * 4;
}

// ─── Data encoding (byte mode) ─────────────────────────

function encodeData(data: string, version: number): Uint8Array {
	const vi = VERSIONS[version - 1];
	const totalData =
		vi.blocks * vi.dataPerBlock1 + vi.blocks2 * vi.dataPerBlock2;
	const bytes = new TextEncoder().encode(data);

	// Mode indicator (0100 = byte) + character count
	const bits: number[] = [];
	function pushBits(value: number, length: number) {
		for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
	}

	pushBits(0b0100, 4); // Byte mode
	const ccLen = version <= 9 ? 8 : 16;
	pushBits(bytes.length, ccLen);

	for (const b of bytes) pushBits(b, 8);

	// Terminator
	const capacity = totalData * 8;
	const terminatorLen = Math.min(4, capacity - bits.length);
	for (let i = 0; i < terminatorLen; i++) bits.push(0);

	// Pad to byte boundary
	while (bits.length % 8 !== 0) bits.push(0);

	// Pad bytes
	const padBytes = [0xec, 0x11];
	let padIdx = 0;
	while (bits.length < capacity) {
		pushBits(padBytes[padIdx % 2], 8);
		padIdx++;
	}

	// Convert bits to bytes
	const result = new Uint8Array(totalData);
	for (let i = 0; i < totalData; i++) {
		let byte = 0;
		for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
		result[i] = byte;
	}

	return result;
}

// ─── Error correction and interleaving ─────────────────

function computeCodewords(data: Uint8Array, version: number): Uint8Array {
	const vi = VERSIONS[version - 1];
	const blocks: Uint8Array[] = [];
	const ecBlocks: Uint8Array[] = [];
	let offset = 0;

	// Group 1
	for (let i = 0; i < vi.blocks; i++) {
		const block = data.slice(offset, offset + vi.dataPerBlock1);
		blocks.push(block);
		ecBlocks.push(rsEncode(block, vi.ecPerBlock));
		offset += vi.dataPerBlock1;
	}

	// Group 2
	for (let i = 0; i < vi.blocks2; i++) {
		const block = data.slice(offset, offset + vi.dataPerBlock2);
		blocks.push(block);
		ecBlocks.push(rsEncode(block, vi.ecPerBlock));
		offset += vi.dataPerBlock2;
	}

	// Interleave data codewords
	const result: number[] = [];
	const maxDataLen = Math.max(vi.dataPerBlock1, vi.dataPerBlock2);
	for (let i = 0; i < maxDataLen; i++) {
		for (const block of blocks) {
			if (i < block.length) result.push(block[i]);
		}
	}

	// Interleave EC codewords
	for (let i = 0; i < vi.ecPerBlock; i++) {
		for (const block of ecBlocks) {
			result.push(block[i]);
		}
	}

	return new Uint8Array(result);
}

// ─── Matrix construction ───────────────────────────────

type Matrix = (boolean | null)[][];

function createMatrix(size: number): Matrix {
	return Array.from({ length: size }, () => Array(size).fill(null));
}

function setModule(matrix: Matrix, row: number, col: number, value: boolean) {
	if (row >= 0 && row < matrix.length && col >= 0 && col < matrix.length) {
		matrix[row][col] = value;
	}
}

function addFinderPattern(matrix: Matrix, row: number, col: number) {
	for (let r = -1; r <= 7; r++) {
		for (let c = -1; c <= 7; c++) {
			const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
			const inBorder = r === 0 || r === 6 || c === 0 || c === 6;
			const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
			const val = inOuter && (inBorder || inInner);
			setModule(matrix, row + r, col + c, val);
		}
	}
}

function addAlignmentPattern(matrix: Matrix, row: number, col: number) {
	for (let r = -2; r <= 2; r++) {
		for (let c = -2; c <= 2; c++) {
			const val =
				r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
			setModule(matrix, row + r, col + c, val);
		}
	}
}

function addTimingPatterns(matrix: Matrix) {
	const size = matrix.length;
	for (let i = 8; i < size - 8; i++) {
		const val = i % 2 === 0;
		if (matrix[6][i] === null) matrix[6][i] = val;
		if (matrix[i][6] === null) matrix[i][6] = val;
	}
}

function reserveFormatArea(matrix: Matrix) {
	const size = matrix.length;
	// Around top-left finder
	for (let i = 0; i <= 8; i++) {
		if (matrix[8][i] === null) matrix[8][i] = false;
		if (matrix[i][8] === null) matrix[i][8] = false;
	}
	// Around top-right finder
	for (let i = 0; i <= 7; i++) {
		if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = false;
	}
	// Around bottom-left finder
	for (let i = 0; i <= 7; i++) {
		if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = false;
	}
	// Dark module
	matrix[size - 8][8] = true;
}

function placeData(matrix: Matrix, codewords: Uint8Array) {
	const size = matrix.length;
	const bits: number[] = [];
	for (const byte of codewords) {
		for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
	}

	let bitIdx = 0;
	let upward = true;

	for (let right = size - 1; right >= 1; right -= 2) {
		// Skip timing pattern column
		if (right === 6) right = 5;

		const rows = upward
			? Array.from({ length: size }, (_, i) => size - 1 - i)
			: Array.from({ length: size }, (_, i) => i);

		for (const row of rows) {
			for (const col of [right, right - 1]) {
				if (col < 0) continue;
				if (matrix[row][col] === null) {
					matrix[row][col] = bitIdx < bits.length ? bits[bitIdx] === 1 : false;
					bitIdx++;
				}
			}
		}
		upward = !upward;
	}
}

// ─── Masking ───────────────────────────────────────────

type MaskFn = (row: number, col: number) => boolean;

const MASK_FUNCTIONS: MaskFn[] = [
	(r, c) => (r + c) % 2 === 0,
	(r) => r % 2 === 0,
	(_, c) => c % 3 === 0,
	(r, c) => (r + c) % 3 === 0,
	(r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
	(r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
	(r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
	(r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function isReserved(
	reserveMask: boolean[][],
	row: number,
	col: number,
): boolean {
	return reserveMask[row][col];
}

function applyMask(
	matrix: Matrix,
	reserveMask: boolean[][],
	maskIdx: number,
): Matrix {
	const size = matrix.length;
	const result = matrix.map((row) => [...row]);
	const fn = MASK_FUNCTIONS[maskIdx];

	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			if (!isReserved(reserveMask, r, c) && fn(r, c)) {
				result[r][c] = !result[r][c];
			}
		}
	}
	return result;
}

function calcPenalty(matrix: (boolean | null)[][]): number {
	const size = matrix.length;
	let penalty = 0;

	// Rule 1: runs of 5+ same color
	for (let r = 0; r < size; r++) {
		let count = 1;
		for (let c = 1; c < size; c++) {
			if (matrix[r][c] === matrix[r][c - 1]) {
				count++;
			} else {
				if (count >= 5) penalty += count - 2;
				count = 1;
			}
		}
		if (count >= 5) penalty += count - 2;
	}
	for (let c = 0; c < size; c++) {
		let count = 1;
		for (let r = 1; r < size; r++) {
			if (matrix[r][c] === matrix[r - 1][c]) {
				count++;
			} else {
				if (count >= 5) penalty += count - 2;
				count = 1;
			}
		}
		if (count >= 5) penalty += count - 2;
	}

	// Rule 2: 2x2 blocks
	for (let r = 0; r < size - 1; r++) {
		for (let c = 0; c < size - 1; c++) {
			const v = matrix[r][c];
			if (
				v === matrix[r][c + 1] &&
				v === matrix[r + 1][c] &&
				v === matrix[r + 1][c + 1]
			) {
				penalty += 3;
			}
		}
	}

	// Rule 4: proportion of dark modules
	let darkCount = 0;
	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			if (matrix[r][c]) darkCount++;
		}
	}
	const total = size * size;
	const pct = (darkCount / total) * 100;
	const prev5 = Math.floor(pct / 5) * 5;
	const next5 = prev5 + 5;
	penalty += Math.min(Math.abs(prev5 - 50) / 5, Math.abs(next5 - 50) / 5) * 10;

	return penalty;
}

// ─── Format information ────────────────────────────────

// EC level M = 00, mask patterns 000–111
// Pre-computed format strings (15-bit BCH encoded with mask 101010000010010)
const FORMAT_STRINGS: number[] = [
	0x5412, // M, mask 0
	0x5125, // M, mask 1
	0x5e7c, // M, mask 2
	0x5b4b, // M, mask 3
	0x45f9, // M, mask 4
	0x40ce, // M, mask 5
	0x4f97, // M, mask 6
	0x4aa0, // M, mask 7
];

function writeFormatInfo(matrix: (boolean | null)[][], maskIdx: number) {
	const size = matrix.length;
	const formatBits = FORMAT_STRINGS[maskIdx];

	// Horizontal: bits 0-7 at row 8, cols 0-7 (skip col 6)
	// Bits 8-14 at row 8, cols size-8 to size-1
	const hPositions = [
		[8, 0],
		[8, 1],
		[8, 2],
		[8, 3],
		[8, 4],
		[8, 5],
		[8, 7],
		[8, 8],
		[8, size - 8],
		[8, size - 7],
		[8, size - 6],
		[8, size - 5],
		[8, size - 4],
		[8, size - 3],
		[8, size - 2],
	];

	// Vertical: bits 0-5 at rows size-1 to size-6, col 8
	// Bit 6 at row size-7, col 8
	// Bits 7-14 at rows 8,5,4,3,2,1,0, col 8
	const vPositions = [
		[size - 1, 8],
		[size - 2, 8],
		[size - 3, 8],
		[size - 4, 8],
		[size - 5, 8],
		[size - 6, 8],
		[size - 7, 8],
		[8, 8],
		[5, 8],
		[4, 8],
		[3, 8],
		[2, 8],
		[1, 8],
		[0, 8],
	];

	for (let i = 0; i < 15; i++) {
		const bit = ((formatBits >> i) & 1) === 1;
		if (i < hPositions.length) {
			const [r, c] = hPositions[i];
			matrix[r][c] = bit;
		}
		if (i < vPositions.length) {
			const [r, c] = vPositions[i];
			matrix[r][c] = bit;
		}
	}
}

// ─── Main encoder ──────────────────────────────────────

function chooseVersion(data: string): number {
	const byteLen = new TextEncoder().encode(data).length;
	for (let v = 1; v <= 10; v++) {
		const vi = VERSIONS[v - 1];
		const totalData =
			vi.blocks * vi.dataPerBlock1 + vi.blocks2 * vi.dataPerBlock2;
		// 4 mode bits + 8/16 count bits + data
		const ccLen = v <= 9 ? 8 : 16;
		const overhead = Math.ceil((4 + ccLen) / 8);
		if (byteLen + overhead <= totalData) return v;
	}
	return 10; // Truncate if too long
}

export function encodeQR(data: string): boolean[][] {
	const version = chooseVersion(data);
	const size = versionSize(version);
	const vi = VERSIONS[version - 1];

	// 1. Encode data
	const dataCodewords = encodeData(data, version);

	// 2. Add error correction
	const codewords = computeCodewords(dataCodewords, version);

	// 3. Build matrix with patterns
	const matrix = createMatrix(size);

	// Finder patterns
	addFinderPattern(matrix, 0, 0);
	addFinderPattern(matrix, 0, size - 7);
	addFinderPattern(matrix, size - 7, 0);

	// Alignment patterns
	if (vi.alignmentPatterns.length > 0) {
		const positions = vi.alignmentPatterns;
		if (positions.length <= 1) {
			// Single alignment pattern center
			const pos = positions[0];
			// Don't overlap with finder patterns
			if (pos > 8 || (pos > 8 && pos < size - 8)) {
				addAlignmentPattern(matrix, pos, pos);
			}
		} else {
			// Multiple alignment pattern positions
			for (const r of positions) {
				for (const c of positions) {
					// Skip if overlaps with finder patterns
					if (r <= 8 && c <= 8) continue;
					if (r <= 8 && c >= size - 8) continue;
					if (r >= size - 8 && c <= 8) continue;
					addAlignmentPattern(matrix, r, c);
				}
			}
		}
	}

	// Timing patterns
	addTimingPatterns(matrix);

	// Reserve format area
	reserveFormatArea(matrix);

	// Create reserve mask (true for any cell that has been set)
	const reserveMask = matrix.map((row) => row.map((cell) => cell !== null));

	// 4. Place data
	placeData(matrix, codewords);

	// 5. Try all masks and pick best
	let bestMask = 0;
	let bestPenalty = Number.POSITIVE_INFINITY;

	for (let m = 0; m < 8; m++) {
		const masked = applyMask(matrix, reserveMask, m);
		writeFormatInfo(masked, m);
		const pen = calcPenalty(masked);
		if (pen < bestPenalty) {
			bestPenalty = pen;
			bestMask = m;
		}
	}

	// Apply best mask
	const finalMatrix = applyMask(matrix, reserveMask, bestMask);
	writeFormatInfo(finalMatrix, bestMask);

	// Convert to boolean[][]
	return finalMatrix.map((row) => row.map((cell) => cell === true));
}
