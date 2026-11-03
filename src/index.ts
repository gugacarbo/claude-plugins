import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	type InstalledPlugin,
	type KnownMarketplace,
	type Marketplace,
	parseArgs,
	plan,
} from "./plan";
import { syncUiToPlugins } from "./sync-ui";

const REPO = "gugacarbo/claude-plugins";
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

async function claude(args: string[]): Promise<string> {
	const proc = Bun.spawn(["claude", ...args], {
		stdout: "pipe",
		stderr: "inherit",
	});
	const out = await new Response(proc.stdout).text();
	if ((await proc.exited) !== 0) {
		throw new Error(`claude ${args.join(" ")} falhou`);
	}
	return out;
}

async function main(): Promise<void> {
	const { command, remote, dryRun } = parseArgs(Bun.argv.slice(2));
	const marketplace: Marketplace = await Bun.file(
		join(ROOT, ".claude-plugin/marketplace.json"),
	).json();
	const known: KnownMarketplace[] = JSON.parse(
		await claude(["plugin", "marketplace", "list", "--json"]),
	);
	const installed: InstalledPlugin[] = JSON.parse(
		await claude(["plugin", "list", "--json"]),
	);

	if (command === "status") {
		for (const p of marketplace.plugins) {
			const id = `${p.name}@${marketplace.name}`;
			const found = installed.find((i) => i.id === id);
			process.stdout.write(
				`${id}: ${found ? (found.enabled ? "ativo" : "desativado") : "não instalado"}\n`,
			);
		}
		return;
	}

	if (!dryRun) {
		const sync = await syncUiToPlugins();
		if (sync.plugins.length > 0)
			process.stdout.write(
				`Sincronizei packages/ui para ${sync.plugins.join(", ")} (${sync.files} arquivo${sync.files === 1 ? "" : "s"}).\n`,
			);
	}

	const steps = plan(
		command,
		marketplace,
		remote ? REPO : ROOT,
		known,
		installed,
	);
	if (steps.length === 0) {
		process.stdout.write("Nada a fazer: tudo instalado.\n");
	}
	for (const step of steps) {
		process.stdout.write(`$ claude ${step.join(" ")}\n`);
		if (!dryRun) await claude(step);
	}
	if (steps.length > 0 && !dryRun) {
		process.stdout.write(
			"Pronto. Abra uma nova sessão do Claude Code para carregar as mudanças.\n",
		);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
