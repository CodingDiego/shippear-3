// Pure parts of the month close (and of the seed's Constancia), no DB.
import {
	type ConstanciaFila,
	type KpiDiario,
	type Periodo,
	periodoDe,
} from "@/lib/domain";
import { constancia, type FilaDiaria, serieRolling } from "@/lib/scoring";
import { habilesEntre, ventanaMes } from "@/lib/time";

/**
 * Reference date of a period for Constancia: the month's last day when closed; the last
 * date with data in the month when in progress (null when the month has no data yet).
 */
export function refConstancia(
	periodo: Periodo,
	ultimaDelMes: string | null,
): string | null {
	return periodo.enCurso ? ultimaDelMes : ventanaMes(periodo.id).hasta;
}

/**
 * Constancia for every seller x period from the daily rows (only venta is read). Sellers
 * without enough rolling points, or a month in progress without data, get valor null.
 */
export function constanciasDe(
	vendedorIds: readonly string[],
	diarios: readonly KpiDiario[],
	periodos: readonly Periodo[],
): ConstanciaFila[] {
	const venta = new Map<string, FilaDiaria[]>();
	const ultima = new Map<string, string>();
	for (const r of diarios) {
		if (r.kpi !== "venta") continue;
		const xs = venta.get(r.vendedorId);
		const fila = { fecha: r.fecha, num: r.num, den: r.den };
		if (xs) xs.push(fila);
		else venta.set(r.vendedorId, [fila]);
		const p = periodoDe(r.fecha);
		if (r.fecha > (ultima.get(p) ?? "")) ultima.set(p, r.fecha);
	}
	return periodos.flatMap((p) => {
		const ref = refConstancia(p, ultima.get(p.id) ?? null);
		return vendedorIds.map((vendedorId) => ({
			vendedorId,
			periodoId: p.id,
			fecha: ref,
			valor:
				ref === null
					? null
					: constancia(serieRolling(venta.get(vendedorId) ?? [], ref)),
		}));
	});
}

/** Daily rows of periodoId after the last stored date (all of the month when ultima is null). */
export function diasRestantes(
	diarios: readonly KpiDiario[],
	periodoId: string,
	ultima: string | null,
): KpiDiario[] {
	return diarios.filter(
		(r) =>
			periodoDe(r.fecha) === periodoId && (ultima === null || r.fecha > ultima),
	);
}

export type EstadoCierre = {
	periodoId: string;
	/** periodos.en_curso; false once cerrarPeriodo ran. */
	enCurso: boolean;
	/** Last date with daily rows in the month, or null. */
	ultimaFecha: string | null;
	diasHabiles: number;
	/** Working days up to ultimaFecha. */
	diasConDatos: number;
	/** Steps done, in workflow order. */
	pasos: {
		dias: boolean;
		cerrado: boolean;
		constancias: boolean;
	};
	listo: boolean;
};

/** Pure assembly of estadoCierre from what the DB reports. */
export function estadoDe(input: {
	periodoId: string;
	enCurso: boolean;
	ultimaFecha: string | null;
	/** Every constancia row of the period was computed at the month's last day. */
	constanciasAlCierre: boolean;
}): EstadoCierre {
	const habiles = habilesEntre(ventanaMes(input.periodoId));
	const u = input.ultimaFecha;
	const diasConDatos = u === null ? 0 : habiles.filter((d) => d <= u).length;
	const dias = diasConDatos === habiles.length;
	const cerrado = !input.enCurso;
	const constancias = cerrado && input.constanciasAlCierre;
	return {
		periodoId: input.periodoId,
		enCurso: input.enCurso,
		ultimaFecha: u,
		diasHabiles: habiles.length,
		diasConDatos,
		pasos: { dias, cerrado, constancias },
		listo: dias && cerrado && constancias,
	};
}
