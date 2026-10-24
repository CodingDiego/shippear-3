import { KPI_DEFS, KPI_IDS, type ScoredVendedor } from "@/lib/domain";
import { mesNombre, pct } from "@/lib/format";
import type { Figu } from "@/lib/modes";

/** Back of the card: rank per KPI and the month's stickers. Decorative, the front carries the label. */
export function Dorso({
	v,
	figusMes,
}: {
	v: ScoredVendedor;
	figusMes: Figu[];
}) {
	const n = figusMes.length;
	return (
		<div className="dorso" aria-hidden="true">
			<h3>
				Puesto por KPI
				<small>
					de {v.de}, {mesNombre(v.periodoId)}
				</small>
			</h3>
			<ol>
				{KPI_IDS.map((k) => (
					<li key={k}>
						<span>{KPI_DEFS[k].nombre}</span>
						<b>{v.kpis[k].puesto ?? "–"}</b>
						<small>{pct(v.kpis[k].valor, true)}</small>
					</li>
				))}
			</ol>
			<div className="medals">
				{figusMes.slice(0, 7).map((f) => (
					<i
						key={`${f.kpi}-${f.ambito}`}
						className="sticker"
						data-m={f.medalla}
						data-holo={f.holografica ? "" : undefined}
						style={{ width: "6cqi" }}
					/>
				))}
				{n > 0 ? `${n} figus este mes` : "Sin figus este mes"}
			</div>
		</div>
	);
}
