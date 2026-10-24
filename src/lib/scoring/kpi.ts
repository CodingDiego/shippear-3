import { type KpiDef, TOPE } from "../domain";

export function kpiValue(
	r: { num: number; den: number } | undefined,
): number | null {
	return r && r.den > 0 ? r.num / r.den : null;
}

/** Ratio against target, clamped to [0, TOPE]. menor with valor 0 is the cap. */
export function attainment(
	def: Pick<KpiDef, "direccion" | "objetivo">,
	valor: number,
): number {
	const a =
		def.direccion === "mayor"
			? valor / def.objetivo
			: valor === 0
				? TOPE
				: def.objetivo / valor;
	return Math.min(TOPE, Math.max(0, a));
}

export function puntos(att: number): number {
	return (100 * att) / TOPE;
}
