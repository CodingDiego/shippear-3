import type { JuegoId } from "@/lib/domain";

/** Short names for the grid header and chart axes. */
export const JUEGO_CORTO: Record<JuegoId, string> = {
	liga: "Liga",
	revelacion: "Revelación",
	album: "Álbum",
};

const uno = new Intl.NumberFormat("es-AR", {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});
const entero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const dos = new Intl.NumberFormat("es-AR", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});
const ars = new Intl.NumberFormat("es-AR", {
	style: "currency",
	currency: "ARS",
	maximumFractionDigits: 0,
});
const arsCorto = new Intl.NumberFormat("es-AR", {
	style: "currency",
	currency: "ARS",
	notation: "compact",
	maximumFractionDigits: 1,
});

/** Attainment points as a signed percent: 0.035 → "+3,5 %". */
export const pctSigno = (x: number) =>
	`${x > 0 ? "+" : x < 0 ? "−" : ""}${uno.format(Math.abs(x) * 100)} %`;
/** 0.62 → "62 %" */
export const pctEntero = (x: number | null) =>
	x === null ? "sin datos" : `${entero.format(x * 100)} %`;
export const num = (x: number) => entero.format(x);
export const num1 = (x: number) => uno.format(x);
export const pesos = (x: number) => ars.format(x);
export const pesosCorto = (x: number) => arsCorto.format(x);
export const veces = (x: number) => dos.format(x);
