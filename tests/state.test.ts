import { describe, expect, test } from "bun:test";
import { createSignal } from "../src/state";

describe("createSignal", () => {
	test("returns initial value", () => {
		const signal = createSignal(42);
		expect(signal.get()).toBe(42);
	});

	test("sets new value", () => {
		const signal = createSignal("hello");
		signal.set("world");
		expect(signal.get()).toBe("world");
	});

	test("updates value with function", () => {
		const signal = createSignal(10);
		signal.update((v) => v + 5);
		expect(signal.get()).toBe(15);
	});

	test("notifies subscribers on set", () => {
		const signal = createSignal(0);
		const values: number[] = [];
		signal.subscribe((v) => values.push(v));
		signal.set(1);
		signal.set(2);
		expect(values).toEqual([1, 2]);
	});

	test("notifies subscribers on update", () => {
		const signal = createSignal(0);
		const values: number[] = [];
		signal.subscribe((v) => values.push(v));
		signal.update((v) => v + 1);
		signal.update((v) => v + 1);
		expect(values).toEqual([1, 2]);
	});

	test("unsubscribe stops notifications", () => {
		const signal = createSignal(0);
		const values: number[] = [];
		const unsub = signal.subscribe((v) => values.push(v));
		signal.set(1);
		unsub();
		signal.set(2);
		expect(values).toEqual([1]);
	});

	test("multiple subscribers all receive updates", () => {
		const signal = createSignal("a");
		const a: string[] = [];
		const b: string[] = [];
		signal.subscribe((v) => a.push(v));
		signal.subscribe((v) => b.push(v));
		signal.set("b");
		expect(a).toEqual(["b"]);
		expect(b).toEqual(["b"]);
	});

	test("works with array values", () => {
		const signal = createSignal<number[]>([]);
		signal.update((arr) => [...arr, 1]);
		signal.update((arr) => [...arr, 2]);
		expect(signal.get()).toEqual([1, 2]);
	});

	test("works with object values", () => {
		const signal = createSignal({ count: 0 });
		signal.update((obj) => ({ ...obj, count: obj.count + 1 }));
		expect(signal.get()).toEqual({ count: 1 });
	});
});
