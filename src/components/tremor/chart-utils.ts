// Tremor Raw chartUtils, with the palette mapped to the Figu brand tokens (globals.css @theme).

export type ColorUtility = "bg" | "fill" | "text";

export const chartColors = {
	azul: { bg: "bg-azul", fill: "fill-azul", text: "text-azul" },
	oro: { bg: "bg-oro", fill: "fill-oro", text: "text-oro" },
	verde: { bg: "bg-verde-fill", fill: "fill-verde-fill", text: "text-verde" },
	rojo: { bg: "bg-rojo-fill", fill: "fill-rojo-fill", text: "text-rojo" },
	gris: { bg: "bg-bg-4", fill: "fill-bg-4", text: "text-ink-3" },
	plata: { bg: "bg-plata", fill: "fill-plata", text: "text-ink-2" },
} as const satisfies Record<string, Record<ColorUtility, string>>;

export type ChartColor = keyof typeof chartColors;

export const AvailableChartColors = Object.keys(chartColors) as ChartColor[];

export const constructCategoryColors = (
	categories: readonly string[],
	colors: readonly ChartColor[],
): Map<string, ChartColor> =>
	new Map(categories.map((c, i) => [c, colors[i % colors.length]]));

export const getColorClassName = (
	color: ChartColor,
	type: ColorUtility,
): string => chartColors[color]?.[type] ?? chartColors.gris[type];
