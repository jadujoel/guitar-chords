import { describe, expect, test } from "bun:test";
import { assert } from "../src/utils";

describe("assert", () => {
	test("does not throw for truthy values", () => {
		expect(() => assert(true)).not.toThrow();
		expect(() => assert(1)).not.toThrow();
		expect(() => assert("hello")).not.toThrow();
		expect(() => assert({})).not.toThrow();
		expect(() => assert([])).not.toThrow();
	});

	test("throws for falsy values", () => {
		expect(() => assert(false)).toThrow("Assertion failed");
		expect(() => assert(null)).toThrow("Assertion failed");
		expect(() => assert(undefined)).toThrow("Assertion failed");
		expect(() => assert(0)).toThrow("Assertion failed");
		expect(() => assert("")).toThrow("Assertion failed");
	});

	test("throws with custom message", () => {
		expect(() => assert(false, "custom error")).toThrow("custom error");
	});

	test("narrows type after assertion", () => {
		const value: string | null = "hello";
		assert(value);
		// TypeScript should allow this without error
		const _len: number = value.length;
		expect(_len).toBe(5);
	});
});
