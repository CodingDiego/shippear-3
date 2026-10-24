import { ImageResponse } from "next/og";
import { getScoredPeriod, getSeasonMeta } from "@/lib/data/queries";
import { KPI_DEFS, KPI_IDS, type Tier } from "@/lib/domain";
import { fmtScore, fullName, pct, sucursalNombre } from "@/lib/format";

export const alt = "Carta de Figu";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ImageResponse cannot read CSS variables: these mirror the tokens in globals.css.
const TIER: Record<Tier, string> = {
	verde: "#627d47",
	amarillo: "#eed30b",
	rojo: "#b20000",
};
const BG = "#f6f4ee";
const INK = "#313233";
const MUTED = "#4d5864";
const AZUL = "#0e4194";
const FACE = "#ffffff";

export default async function Image({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const { latest } = await getSeasonMeta();
	const period = await getScoredPeriod(latest, "mes");
	const v = period.vendedores.find((x) => x.vendedor.id === id);

	if (!v) {
		return new ImageResponse(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background: BG,
					color: INK,
					fontSize: 120,
					fontWeight: 900,
				}}
			>
				Figu
			</div>,
			size,
		);
	}

	const half = Math.ceil(KPI_IDS.length / 2);
	const col = (ids: readonly (typeof KPI_IDS)[number][]) => (
		<div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
			{ids.map((k) => (
				<div
					key={k}
					style={{ display: "flex", flexDirection: "column", fontSize: 32 }}
				>
					<span style={{ fontWeight: 900 }}>{pct(v.kpis[k].valor)}</span>
					<span style={{ fontSize: 20, color: MUTED }}>
						{KPI_DEFS[k].nombre}
					</span>
				</div>
			))}
		</div>
	);

	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				gap: 80,
				padding: "0 90px",
				background: BG,
				color: INK,
			}}
		>
			<div
				style={{
					width: 380,
					height: 532,
					display: "flex",
					flexDirection: "column",
					borderRadius: 24,
					border: `14px solid ${AZUL}`,
					background: FACE,
					overflow: "hidden",
				}}
			>
				<div
					style={{
						display: "flex",
						height: 28,
						background: v.tier ? TIER[v.tier] : MUTED,
					}}
				/>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						flex: 1,
						padding: "20px 32px",
						justifyContent: "space-between",
					}}
				>
					<div
						style={{
							display: "flex",
							fontSize: 180,
							fontWeight: 900,
							lineHeight: 1,
							color: AZUL,
						}}
					>
						{fmtScore(v.score)}
					</div>
					<div style={{ display: "flex", flexDirection: "column" }}>
						<div style={{ display: "flex", fontSize: 40, fontWeight: 900 }}>
							{fullName(v.vendedor)}
						</div>
						<div style={{ display: "flex", fontSize: 26, color: MUTED }}>
							{sucursalNombre(v.vendedor.sucursal)}
						</div>
					</div>
				</div>
			</div>
			<div style={{ display: "flex", gap: 64 }}>
				{col(KPI_IDS.slice(0, half))}
				{col(KPI_IDS.slice(half))}
			</div>
		</div>,
		size,
	);
}
