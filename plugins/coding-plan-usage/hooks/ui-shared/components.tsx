import type { ChangedImage, Ui } from "./types";

export const BOX_W = 260;
export const BOX_H = 180;

export const STATUS_LABEL = {
	added: ["green", "adicionada"],
	modified: ["yellow", "alterada"],
	deleted: ["red", "removida"],
} as const;

export function pictureView(
	{ Box, Text, Svg }: Ui,
	label: string,
	pic: ChangedImage["before"] | ChangedImage["after"],
	alt: string,
) {
	if (!pic) return null;
	return (
		<Box flexDirection="column">
			<Text dimColor>{label}</Text>
			{"missing" in pic ? (
				<Text dimColor>{pic.missing}</Text>
			) : Svg ? (
				<Svg
					source={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOX_W} ${BOX_H}" width="${BOX_W}" height="${BOX_H}"><image href="${pic.uri}" width="${BOX_W}" height="${BOX_H}" preserveAspectRatio="xMidYMid meet"/></svg>`}
					alt={alt}
					width={BOX_W}
					height={BOX_H}
				/>
			) : (
				<Text dimColor>(imagem não exibida no terminal)</Text>
			)}
		</Box>
	);
}

export function imagesView(ui: Ui, images: ChangedImage[] | undefined) {
	const { Box, Text } = ui;
	if (!images) return <Text dimColor>Carregando imagens…</Text>;
	if (images.length === 0)
		return <Text dimColor>Nenhuma imagem alterada.</Text>;
	return (
		<Box flexDirection="column" gap={1}>
			{images.map((img) => {
				const [color, label] = STATUS_LABEL[img.status];
				return (
					<Box key={`img-${img.path}`} flexDirection="column">
						<Text>
							<Text color={color}>{label}</Text> {img.path}
						</Text>
						<Box flexDirection="row" gap={2}>
							{pictureView(ui, "antes", img.before, `${img.path}, antes`)}
							{pictureView(ui, "depois", img.after, `${img.path}, depois`)}
						</Box>
					</Box>
				);
			})}
		</Box>
	);
}

export function tabsView(
	{ Box, Button }: Ui,
	props: {
		tab: "files" | "images";
		images: number;
		onSelect: (tab: "files" | "images") => void;
	},
) {
	const { tab, images, onSelect } = props;
	return (
		<Box flexDirection="row" gap={1}>
			<Button
				key="tab-files"
				label="Arquivos"
				variant={tab === "files" ? "primary" : "secondary"}
				onPress={() => onSelect("files")}
			/>
			<Button
				key="tab-images"
				label={`Imagens (${images})`}
				variant={tab === "images" ? "primary" : "secondary"}
				onPress={() => onSelect("images")}
			/>
		</Box>
	);
}
