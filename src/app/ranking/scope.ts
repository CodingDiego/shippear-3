import {
	createLoader,
	type inferParserType,
	parseAsString,
	parseAsStringLiteral,
} from "nuqs/server";
import { PROVINCIA_BY_SLUG, SUCURSAL_BY_SLUG } from "@/lib/domain";
import type { RankingParams } from "@/lib/query/options";
import { rankingParsers } from "@/lib/search-params";

export const SCOPES = ["pais", "provincia", "sucursal"] as const;
export const ENTIDADES = ["vendedores", "sucursales", "provincias"] as const;
export type Scope = (typeof SCOPES)[number];
export type Entidad = (typeof ENTIDADES)[number];

export const SCOPE_LABEL: Record<Scope, string> = {
	pais: "País",
	provincia: "Provincia",
	sucursal: "Sucursal",
};
export const ENTIDAD_LABEL: Record<Entidad, string> = {
	vendedores: "Vendedores",
	sucursales: "Sucursales",
	provincias: "Provincias",
};
// Provincias are only compared nationally; inside one sucursal there is nothing else to rank.
const ENTIDADES_DE: Record<Scope, readonly Entidad[]> = {
	pais: ENTIDADES,
	provincia: ["vendedores", "sucursales"],
	sucursal: ["vendedores"],
};

// Rosario's province and sucursal: the starting point when a scope has nothing picked yet.
const PROVINCIA_INICIAL = "santa-fe";
const SUCURSAL_INICIAL = "rosario";

export const scopeParsers = {
	...rankingParsers,
	scope: parseAsStringLiteral(SCOPES).withDefault("pais"),
	entidad: parseAsStringLiteral(ENTIDADES).withDefault("vendedores"),
	provincia: parseAsString.withDefault(""),
};
export const loadScopeParams = createLoader(scopeParsers);
export type ScopeParams = inferParserType<typeof scopeParsers>;

export const nombreProvincia = (slug: string) =>
	PROVINCIA_BY_SLUG[slug]?.nombre ?? slug;

/** What the URL means once unknown or missing values are replaced. */
export function alcance(sp: ScopeParams) {
	// Old links used ?sucursal= alone.
	const scope: Scope =
		sp.scope === "pais" && Object.hasOwn(SUCURSAL_BY_SLUG, sp.sucursal)
			? "sucursal"
			: sp.scope;
	const entidades = ENTIDADES_DE[scope];
	return {
		scope,
		provincia: Object.hasOwn(PROVINCIA_BY_SLUG, sp.provincia)
			? sp.provincia
			: PROVINCIA_INICIAL,
		sucursal: Object.hasOwn(SUCURSAL_BY_SLUG, sp.sucursal)
			? sp.sucursal
			: SUCURSAL_INICIAL,
		entidades,
		entidad: entidades.includes(sp.entidad)
			? sp.entidad
			: ("vendedores" as const),
	};
}

/** The /api/ranking query for a URL. The server prefetch and the browser build the same key. */
export function consulta(
	sp: ScopeParams,
	periodos: string[],
	latest: string,
): RankingParams {
	const a = alcance(sp);
	return {
		periodo: periodos.includes(sp.periodo) ? sp.periodo : latest,
		vista: sp.vista,
		sucursal: a.scope === "sucursal" ? a.sucursal : "",
		provincia: a.scope === "provincia" ? a.provincia : "",
		// The zona filter only applies to vendedores.
		canal: a.entidad === "vendedores" ? sp.canal : null,
	};
}

/** "todo el país", "Santa Fe" or "Rosario": where the ranking is read. */
export function ambito(sp: ScopeParams) {
	const a = alcance(sp);
	if (a.scope === "provincia") return nombreProvincia(a.provincia);
	if (a.scope === "sucursal") return SUCURSAL_BY_SLUG[a.sucursal].nombre;
	return "todo el país";
}
