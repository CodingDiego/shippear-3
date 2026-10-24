import "./figu.css";
import {
	KPI_DEFS,
	KPI_IDS,
	type ScoredVendedor,
	TIER_LABEL,
} from "@/lib/domain";
import {
	canalNombre,
	fmtScore,
	kpiBad,
	pct,
	shortName,
	sucursalNombre,
} from "@/lib/format";

export type Foil = "oro" | "plata" | "bronce";

/** Plain data the card needs; a ScoredVendedor satisfies it. */
export type FiguData = Pick<
	ScoredVendedor,
	"vendedor" | "score" | "tier" | "puesto" | "de" | "puestoSucursal" | "kpis"
>;

export function figuLabel(v: FiguData) {
	return `${shortName(v.vendedor)}, ${fmtScore(v.score)} puntos, puesto ${v.puesto ?? "sin"} de ${v.de}.`;
}

/** Card contents only: no next/* imports, so the Remotion compositions and the studio can reuse it. */
export function FiguBody({ v }: { v: FiguData }) {
	return (
		<>
			<span className="figu-head">
				<span className="figu-score">
					{fmtScore(v.score)}
					<small>Puntaje</small>
				</span>
				<span className="figu-side">
					<span className="figu-rank">
						<b>#{v.puesto ?? "–"}</b> / {v.de}
					</span>
					<span className="figu-tier">
						{v.tier ? TIER_LABEL[v.tier] : "Sin datos"}
					</span>
				</span>
			</span>
			<span className="figu-name">
				{shortName(v.vendedor)}
				<small>
					{sucursalNombre(v.vendedor.sucursal)}, {canalNombre(v.vendedor.canal)}
				</small>
			</span>
			<span className="figu-kpis">
				{KPI_IDS.map((k) => (
					<span
						key={k}
						className={kpiBad(KPI_DEFS[k], v.kpis[k].valor) ? "bad" : undefined}
					>
						<b>{pct(v.kpis[k].valor)}</b>
						<span>{KPI_DEFS[k].corto}</span>
					</span>
				))}
				<span>
					<b>#{v.puestoSucursal ?? "–"}</b>
					<span>EN SUC</span>
				</span>
			</span>
		</>
	);
}
