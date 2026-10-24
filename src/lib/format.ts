import {
	type KpiDef,
	PERIODO_BY_ID,
	SUCURSAL_BY_SLUG,
	type Vendedor,
} from "@/lib/domain";
import { attainment } from "@/lib/scoring";

const es = new Intl.NumberFormat("es-AR", {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});

/** Card score: whole number, "—" when null. */
export const fmtScore = (n: number | null) =>
	n === null ? "—" : String(Math.round(n));

/** One decimal, es-AR ("88,4"). */
export const fmt1 = (n: number | null) => (n === null ? "—" : es.format(n));

/** Ratio as a percentage: "104%" on cards, "104 %" in prose. */
export const pct = (ratio: number | null, space = false) =>
	ratio === null ? "—" : `${Math.round(ratio * 100)}${space ? " %" : "%"}`;

/** Below target for its direction. */
export const kpiBad = (def: KpiDef, valor: number | null) =>
	valor !== null && attainment(def, valor) < 1;

/** "M. Ledesma" */
export const shortName = (v: Pick<Vendedor, "nombre" | "apellido">) =>
	`${v.nombre[0]}. ${v.apellido}`;

export const fullName = (v: Pick<Vendedor, "nombre" | "apellido">) =>
	`${v.nombre} ${v.apellido}`;

export const sucursalNombre = (slug: string) =>
	SUCURSAL_BY_SLUG[slug]?.nombre ?? slug;

// The case calls them plaza (the branch's own city) and campaña (the towns around it); the UI says what they are.
const CANAL_NOMBRE: Record<string, string> = {
	plaza: "ciudad",
	campaña: "rural",
};
export const canalNombre = (canal: string) => CANAL_NOMBRE[canal] ?? canal;

/** "Sep 26" */
export const periodoLabel = (id: string) => PERIODO_BY_ID[id]?.label ?? id;

const MESES_LARGO = [
	"enero",
	"febrero",
	"marzo",
	"abril",
	"mayo",
	"junio",
	"julio",
	"agosto",
	"septiembre",
	"octubre",
	"noviembre",
	"diciembre",
];
/** "septiembre de 2026" */
export const periodoLargo = (id: string) => {
	const [y, m] = id.split("-");
	return `${MESES_LARGO[Number(m) - 1]} de ${y}`;
};
/** "septiembre" */
export const mesNombre = (id: string) =>
	MESES_LARGO[Number(id.split("-")[1]) - 1];
