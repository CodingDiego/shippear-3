// Pure calendar helpers over "YYYY-MM-DD" strings (UTC, no time zone, no "now").
// Working days are Monday to Saturday; ISO weeks run Monday to Sunday.
import { type Periodo, periodoDe, type Ventana } from "@/lib/domain";

/** Inclusive date range, "YYYY-MM-DD". */
export type Rango = { desde: string; hasta: string };

/** A tracker window and its working-day counts at a reference date. */
export type VentanaMeta = Rango & {
	ventana: Ventana;
	/** Reference date: hoy() for the window in progress. */
	ref: string;
	/** Working days in desde..hasta. */
	diasHabiles: number;
	/** Working days in desde..min(ref, hasta); 0 when ref < desde. */
	diasTranscurridos: number;
};

const MS_DIA = 86_400_000;
const ms = (fecha: string) => Date.parse(`${fecha}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** fecha + n calendar days (n may be negative). */
export function sumarDias(fecha: string, n: number): string {
	return iso(ms(fecha) + n * MS_DIA);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function diaSemana(fecha: string): number {
	return new Date(ms(fecha)).getUTCDay() || 7;
}

/** Monday to Saturday. */
export function esHabil(fecha: string): boolean {
	return diaSemana(fecha) !== 7;
}

/** Working days in r, ascending. */
export function habilesEntre(r: Rango): string[] {
	const out: string[] = [];
	for (let f = r.desde; f <= r.hasta; f = sumarDias(f, 1))
		if (esHabil(f)) out.push(f);
	return out;
}

/** Count of working days in r. */
export function diasHabiles(r: Rango): number {
	return habilesEntre(r).length;
}

/** Working days in r.desde..min(ref, r.hasta); 0 when ref < r.desde. */
export function diasTranscurridos(r: Rango, ref: string): number {
	return diasHabiles({ desde: r.desde, hasta: ref < r.hasta ? ref : r.hasta });
}

/** ISO week containing fecha: id "2026-W43", Monday..Sunday. */
export function semanaIso(fecha: string): Rango & { id: string } {
	const desde = sumarDias(fecha, 1 - diaSemana(fecha));
	// the ISO year is the year of the week's Thursday
	const jueves = sumarDias(desde, 3);
	const anio = jueves.slice(0, 4);
	const semana =
		Math.floor((ms(jueves) - ms(`${anio}-01-01`)) / MS_DIA / 7) + 1;
	return {
		id: `${anio}-W${String(semana).padStart(2, "0")}`,
		desde,
		hasta: sumarDias(desde, 6),
	};
}

/** First..last calendar day of a "YYYY-MM" month. */
export function ventanaMes(periodoId: string): Rango {
	const [y, m] = periodoId.split("-").map(Number);
	return { desde: `${periodoId}-01`, hasta: iso(Date.UTC(y, m, 0)) };
}

/** ISO week (Monday..Sunday) containing fecha. */
export function ventanaSemana(fecha: string): Rango {
	const { desde, hasta } = semanaIso(fecha);
	return { desde, hasta };
}

/** Month or ISO week containing ref, with diasHabiles/diasTranscurridos at ref. */
export function ventanaDe(ventana: Ventana, ref: string): VentanaMeta {
	const r = ventana === "mes" ? ventanaMes(periodoDe(ref)) : ventanaSemana(ref);
	return {
		...r,
		ventana,
		ref,
		diasHabiles: diasHabiles(r),
		diasTranscurridos: diasTranscurridos(r, ref),
	};
}

/** Rolling 30-day window ending at fin: fin-29..fin (calendar days). */
export function rolling30(fin: string): Rango {
	return { desde: sumarDias(fin, -29), hasta: fin };
}

/** The `dias` calendar days ending at ref (ascending, ref last): the ends of the rolling windows. */
export function finesRolling(ref: string, dias = 90): string[] {
	return Array.from({ length: dias }, (_, i) => sumarDias(ref, i - dias + 1));
}

/** Reference date of a period: last day of the month when closed, hoyFecha when enCurso. */
export function fechaReferencia(periodo: Periodo, hoyFecha: string): string {
	return periodo.enCurso ? hoyFecha : ventanaMes(periodo.id).hasta;
}
