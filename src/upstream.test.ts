import { describe, expect, test } from "bun:test";
import {
	addToMarketplace,
	applyArgs,
	defaultName,
	diffArgs,
	formatUpstreams,
	nextVersion,
	normalizePath,
	parseUpstreamArgs,
	selectUpstreams,
	setVersion,
	treeish,
} from "./upstream";

describe("parseUpstreamArgs", () => {
	test("import with defaults takes the name from the repo", () => {
		expect(
			parseUpstreamArgs(["import", "https://github.com/alexeyw/lot-map.git"]),
		).toEqual({
			command: "import",
			repo: "https://github.com/alexeyw/lot-map.git",
			ref: "main",
			path: ".",
			name: "lot-map",
		});
	});

	test("import with a subfolder takes the name from it", () => {
		expect(
			parseUpstreamArgs([
				"import",
				"git@github.com:x/mods.git",
				"--path",
				"./plugins/Foo/",
				"--ref",
				"v2",
			]),
		).toEqual({
			command: "import",
			repo: "git@github.com:x/mods.git",
			ref: "v2",
			path: "plugins/Foo",
			name: "foo",
		});
	});

	test("import rejects a missing repo, bad name or flag without value", () => {
		expect(() => parseUpstreamArgs(["import"])).toThrow("Uso");
		expect(() =>
			parseUpstreamArgs(["import", "r", "--name", "Bad Name"]),
		).toThrow("Nome inválido");
		expect(() => parseUpstreamArgs(["import", "r", "--ref"])).toThrow(
			"--ref precisa",
		);
	});

	test("upstream status and pull", () => {
		expect(parseUpstreamArgs(["upstream", "status"])).toEqual({
			command: "status",
		});
		expect(parseUpstreamArgs(["upstream", "pull", "a", "b"])).toEqual({
			command: "pull",
			names: ["a", "b"],
		});
		expect(() => parseUpstreamArgs(["upstream", "x"])).toThrow("Uso");
	});
});

describe("paths and names", () => {
	test("normalizePath", () => {
		expect(normalizePath("")).toBe(".");
		expect(normalizePath("./")).toBe(".");
		expect(normalizePath("./a/b/")).toBe("a/b");
	});

	test("defaultName", () => {
		expect(defaultName("https://h/x/Repo.git", ".")).toBe("repo");
		expect(defaultName("r", "plugins/foo")).toBe("foo");
	});

	test("treeish, diff and apply arguments", () => {
		expect(treeish("abc", ".")).toBe("abc");
		expect(treeish("abc", "p/x")).toBe("abc:p/x");
		expect(diffArgs("b", "n", ".")).toEqual([
			"diff",
			"--binary",
			"--full-index",
			"--no-color",
			"b",
			"n",
		]);
		expect(diffArgs("b", "n", "p/x").slice(-5)).toEqual([
			"--relative=p/x",
			"b",
			"n",
			"--",
			"p/x",
		]);
		expect(applyArgs("foo")).toContain("--directory=plugins/foo");
	});
});

describe("selectUpstreams", () => {
	const ups = {
		b: { repo: "r", ref: "main", path: ".", base: "1" },
		a: { repo: "r", ref: "main", path: ".", base: "2" },
	};

	test("all, sorted, when no name is given", () => {
		expect(selectUpstreams(ups, [])).toEqual(["a", "b"]);
	});

	test("fails on unknown names", () => {
		expect(() => selectUpstreams(ups, ["a", "z"])).toThrow("z");
	});
});

describe("versions", () => {
	test("nextVersion bumps the higher of local and upstream", () => {
		expect(nextVersion("1.2.3", "1.2.0")).toBe("1.2.4");
		expect(nextVersion("1.2.3", "1.5.0")).toBe("1.5.1");
		expect(nextVersion(undefined, "0.1.0")).toBe("0.1.1");
		expect(nextVersion("x", undefined)).toBeUndefined();
	});

	test("setVersion keeps the formatting", () => {
		const json = '{\n  "name": "a",\n  "version": "1.0.0",\n  "x": 1\n}\n';
		expect(setVersion(json, "1.0.1")).toBe(
			'{\n  "name": "a",\n  "version": "1.0.1",\n  "x": 1\n}\n',
		);
		expect(setVersion('{"name":"a"}', "0.0.1")).toContain('"version": "0.0.1"');
	});
});

describe("files", () => {
	test("addToMarketplace sorts and does not duplicate", () => {
		const list = [{ name: "c", source: "./plugins/c" }];
		const added = addToMarketplace(list, { name: "a", source: "./plugins/a" });
		expect(added.map((p) => p.name)).toEqual(["a", "c"]);
		expect(addToMarketplace(added, { name: "a", source: "x" })).toBe(added);
	});

	test("formatUpstreams sorts keys", () => {
		const text = formatUpstreams({
			b: { repo: "r", ref: "m", path: ".", base: "1" },
			a: { repo: "r", ref: "m", path: ".", base: "2" },
		});
		expect(Object.keys(JSON.parse(text))).toEqual(["a", "b"]);
		expect(text.endsWith("}\n")).toBe(true);
	});
});
