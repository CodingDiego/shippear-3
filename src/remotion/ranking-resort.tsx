import { Easing, interpolate, useCurrentFrame } from "remotion";

export type FilaResort = { id: string; nombre: string; score: number };
export type RankingResortProps = { antes: FilaResort[]; despues: FilaResort[] };

export const RESORT = {
	width: 720,
	// 5 rows plus the padding around them.
	height: 364,
	fps: 30,
	duration: 90,
	row: 60,
	gap: 8,
	pad: 16,
	// Frames: hold the old order, slide, then show the change chips.
	start: 15,
	end: 60,
} as const;

const SLOT = RESORT.row + RESORT.gap;
const MEDAL = ["var(--oro)", "var(--plata)", "var(--bronce)"];

type Fila = {
	id: string;
	nombre: string;
	from: number | null;
	to: number | null;
	scoreFrom: number;
	scoreTo: number;
};

function filas(antes: FilaResort[], despues: FilaResort[]): Fila[] {
	const ids = [...new Set([...antes, ...despues].map((f) => f.id))];
	return ids.map((id) => {
		const a = antes.findIndex((f) => f.id === id);
		const d = despues.findIndex((f) => f.id === id);
		const fa = antes[a];
		const fd = despues[d];
		return {
			id,
			nombre: (fd ?? fa).nombre,
			from: a < 0 ? null : a,
			to: d < 0 ? null : d,
			// Newcomers count up from zero; leavers keep their last score.
			scoreFrom: fa?.score ?? 0,
			scoreTo: fd?.score ?? fa.score,
		};
	});
}

function chip(from: number | null, to: number | null) {
	if (to === null) return null;
	if (from === null) return { texto: "entra", color: "var(--azul)" };
	if (to < from) return { texto: `sube ${from - to}`, color: "var(--verde)" };
	if (to > from) return { texto: `baja ${to - from}`, color: "var(--rojo)" };
	return null;
}

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export function RankingResort({ antes, despues }: RankingResortProps) {
	const frame = useCurrentFrame();
	const { start, end, pad, row } = RESORT;
	const t = interpolate(frame, [start, end], [0, 1], {
		easing: Easing.inOut(Easing.cubic),
		...clamp,
	});
	const chipIn = interpolate(frame, [end - 5, end + 15], [0, 1], {
		easing: Easing.out(Easing.cubic),
		...clamp,
	});

	return (
		<div
			style={{
				width: RESORT.width,
				height: RESORT.height,
				position: "relative",
				background: "var(--bg-2)",
				fontFamily: "var(--text)",
				color: "var(--ink)",
				overflow: "hidden",
			}}
		>
			{filas(antes, despues).map((f) => {
				// Newcomers rise from just below the list; leavers sink out of it.
				const from = f.from ?? 5;
				const to = f.to ?? 5;
				const slot = from + (to - from) * t;
				const puesto = Math.min(5, Math.round(slot)) + 1;
				const opacity = f.from === null ? t : f.to === null ? 1 - t : 1;
				const score = Math.round(f.scoreFrom + (f.scoreTo - f.scoreFrom) * t);
				const c = chip(f.from, f.to);
				return (
					<div
						key={f.id}
						style={{
							position: "absolute",
							left: pad,
							right: pad,
							top: pad + slot * SLOT,
							height: row,
							opacity,
							display: "flex",
							alignItems: "center",
							gap: 16,
							padding: "0 16px",
							borderRadius: 8,
							background: "var(--bg)",
						}}
					>
						<span
							style={{
								width: 36,
								height: 36,
								borderRadius: 18,
								flex: "none",
								display: "grid",
								placeItems: "center",
								fontFamily: "var(--display)",
								fontWeight: 800,
								fontSize: 20,
								background: MEDAL[puesto - 1] ?? "var(--bg-3)",
							}}
						>
							{puesto}
						</span>
						<span
							style={{
								flex: 1,
								minWidth: 0,
								fontSize: 24,
								fontWeight: 700,
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							{f.nombre}
						</span>
						{c && (
							<span
								style={{
									fontSize: 20,
									fontWeight: 600,
									color: c.color,
									opacity: chipIn,
									transform: `translateX(${(1 - chipIn) * 12}px)`,
								}}
							>
								{c.texto}
							</span>
						)}
						<span
							style={{
								width: 56,
								textAlign: "right",
								fontFamily: "var(--display)",
								fontWeight: 800,
								fontSize: 30,
								color: "var(--azul)",
							}}
						>
							{score}
						</span>
					</div>
				);
			})}
		</div>
	);
}
