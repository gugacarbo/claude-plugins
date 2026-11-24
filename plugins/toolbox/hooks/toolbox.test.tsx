import { expect, test } from "claude-code/testing";

for (const surface of ["desktop", "terminal"] as const) {
	test(
		`the band draws the ring and its card on ${surface}`,
		{ options: {} },
		async ($, on) => {
			on("clock.now", () => ({ value: 1_000_000 }));
			const ui = await $.ui.mount({
				plugin: "toolbox",
				surface,
				component: "AbovePrompt",
				props: { hasSurvey: false },
			});
			expect(await ui.find({ key: "close" })).toBeDefined();
			const card = await ui.find({ key: "usage-card" });
			if (surface === "terminal") expect(card).toBeUndefined();
			else expect(card).toBeDefined();
			await ui.press({ key: "usage" });
			await ui.press({ key: "close" });
			expect(await ui.find({ key: "close" })).toBeUndefined();
			await ui.unmount();
		},
	);
}
