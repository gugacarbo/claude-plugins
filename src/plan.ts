export type Marketplace = {
	name: string;
	plugins: { name: string; source: string }[];
};

export type InstalledPlugin = { id: string; enabled: boolean };
export type KnownMarketplace = { name: string };

export type Command = "install" | "update" | "status";

/** Lists the `claude` invocations a command needs, given the current state. */
export function plan(
	command: Command,
	marketplace: Marketplace,
	source: string,
	known: KnownMarketplace[],
	installed: InstalledPlugin[],
): string[][] {
	const steps: string[][] = [];
	const hasMarketplace = known.some((m) => m.name === marketplace.name);

	if (command === "status") return steps;

	if (!hasMarketplace) {
		steps.push(["plugin", "marketplace", "add", source]);
	} else if (command === "update") {
		steps.push(["plugin", "marketplace", "update", marketplace.name]);
	}

	for (const plugin of marketplace.plugins) {
		const id = `${plugin.name}@${marketplace.name}`;
		const current = installed.find((p) => p.id === id);
		if (!current) {
			steps.push(["plugin", "install", id, "--scope", "user"]);
		} else if (command === "update") {
			steps.push(["plugin", "update", id]);
		}
		if (current && !current.enabled) {
			steps.push(["plugin", "enable", id]);
		}
	}
	return steps;
}

export function parseArgs(argv: string[]): {
	command: Command;
	remote: boolean;
	dryRun: boolean;
} {
	const command = (argv.find((a) => !a.startsWith("-")) ??
		"install") as Command;
	if (!["install", "update", "status"].includes(command)) {
		throw new Error(
			`Comando desconhecido: ${command} (use install, update ou status)`,
		);
	}
	return {
		command,
		remote: argv.includes("--remote"),
		dryRun: argv.includes("--dry-run"),
	};
}
