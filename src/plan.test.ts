import { describe, expect, test } from "bun:test";
import { parseArgs, plan } from "./plan";

const market = {
	name: "mk",
	plugins: [
		{ name: "a", source: "./plugins/a" },
		{ name: "b", source: "./plugins/b" },
	],
};

describe("plan", () => {
	test("install adds marketplace and every plugin when nothing exists", () => {
		expect(plan("install", market, "/repo", [], [])).toEqual([
			["plugin", "marketplace", "add", "/repo"],
			["plugin", "install", "a@mk", "--scope", "user"],
			["plugin", "install", "b@mk", "--scope", "user"],
		]);
	});

	test("install skips what is already there", () => {
		expect(
			plan(
				"install",
				market,
				"/repo",
				[{ name: "mk" }],
				[{ id: "a@mk", enabled: true }],
			),
		).toEqual([["plugin", "install", "b@mk", "--scope", "user"]]);
	});

	test("update refreshes marketplace and installed plugins, re-enables disabled", () => {
		expect(
			plan(
				"update",
				market,
				"/repo",
				[{ name: "mk" }],
				[
					{ id: "a@mk", enabled: false },
					{ id: "b@mk", enabled: true },
				],
			),
		).toEqual([
			["plugin", "marketplace", "update", "mk"],
			["plugin", "update", "a@mk"],
			["plugin", "enable", "a@mk"],
			["plugin", "update", "b@mk"],
		]);
	});

	test("status plans nothing", () => {
		expect(plan("status", market, "/repo", [], [])).toEqual([]);
	});
});

describe("parseArgs", () => {
	test("defaults to install", () => {
		expect(parseArgs([])).toEqual({
			command: "install",
			remote: false,
			dryRun: false,
		});
	});

	test("reads flags", () => {
		expect(parseArgs(["update", "--remote", "--dry-run"])).toEqual({
			command: "update",
			remote: true,
			dryRun: true,
		});
	});

	test("rejects unknown commands", () => {
		expect(() => parseArgs(["nope"])).toThrow("Comando desconhecido");
	});
});
