"use client";

import { useState } from "react";
import { KPI_DEFS, KPI_IDS, type KpiId, tierOf } from "@/lib/domain";
import { fmt1 } from "@/lib/format";
import { cardScore } from "@/lib/scoring";

export type PlayRow = {
	id: string;
	nombre: string;
	sub: string;
	puntos: Record<KpiId, number | null>;
};

/** Venta takes the typed weight; the other six keep their proportions. */
function defsWith(ventaPct: number) {
	const wv = Math.min(100, Math.max(0, ventaPct)) / 100;
	const rest = (1 - wv) / (1 - KPI_DEFS.venta.peso);
	return Object.fromEntries(
		KPI_IDS.map((k) => [
			k,
			{ ...KPI_DEFS[k], peso: k === "venta" ? wv : KPI_DEFS[k].peso * rest },
		]),
	) as typeof KPI_DEFS;
}

export function WeightPlay({ rows }: { rows: PlayRow[] }) {
	const [raw, setRaw] = useState("30");
	const defs = defsWith(Number(raw) || 0);
	const scored = rows
		.map((r) => ({ ...r, score: cardScore(r.puntos, defs) }))
		.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
	return (
		<>
			<h2>
				<label htmlFor="peso-venta">Si Venta valiera el</label>{" "}
				<input
					id="peso-venta"
					type="number"
					min={0}
					max={100}
					step={5}
					value={raw}
					inputMode="numeric"
					aria-label="peso de venta, en porcentaje"
					onChange={(e) => setRaw(e.target.value)}
				/>{" "}
				<span>%</span> <span>del puntaje</span>
			</h2>
			<div className="answer rows" aria-live="polite">
				{scored.map((r, i) => (
					<div
						className="row"
						key={r.id}
						data-tier={tierOf(r.score) ?? undefined}
					>
						<b>{i + 1}</b>
						<div className="who">
							{r.nombre}, <span>{r.sub}</span>
						</div>
						<div className="pts">{fmt1(r.score)}</div>
					</div>
				))}
			</div>
			<div className="examples">
				{[15, 45, 60].map((x) => (
					<button type="button" key={x} onClick={() => setRaw(String(x))}>
						{x} %
					</button>
				))}
			</div>
			<p className="note">
				Probá cambiar cuánto pesa Venta en el puntaje y mirá cómo se reordena el
				top 10 del mes. Los otros seis KPIs se reparten el resto en la misma
				proporción que hoy. Es solo una prueba: no cambia el ranking real.
			</p>
		</>
	);
}
