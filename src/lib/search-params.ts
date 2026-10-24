import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

// Empty `periodo` means "latest": resolve it with getSeasonMeta().latest.
export const rankingParsers = {
	periodo: parseAsString.withDefault(""),
	vista: parseAsStringLiteral(["mes", "acum", "mix"] as const).withDefault(
		"mes",
	),
	sucursal: parseAsString.withDefault(""),
	canal: parseAsStringLiteral(["plaza", "campaña"] as const),
	view: parseAsStringLiteral(["cartas", "tabla"] as const).withDefault(
		"cartas",
	),
};

export const loadSearchParams = createLoader(rankingParsers);
