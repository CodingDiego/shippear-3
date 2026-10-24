import type { CSSProperties } from "react";
import {
	AbsoluteFill,
	Easing,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

export type PrizeClaimProps = {
	tipo: "figu" | "premio";
	titulo: string;
	detalle: string;
	/** Display label ("Épica"); figus only. */
	rareza?: string;
};

/** About 2 s: fly in, flip, foil sweep, then the text settles. */
export const PRIZE_CLAIM = { fps: 30, duracion: 66, ancho: 360, alto: 480 };

const clamp = {
	extrapolateLeft: "clamp",
	extrapolateRight: "clamp",
} as const;

const cara: CSSProperties = {
	position: "absolute",
	inset: 0,
	borderRadius: 16,
	backfaceVisibility: "hidden",
	overflow: "hidden",
	background: "var(--azul)",
};

export function PrizeClaim({ tipo, titulo, detalle, rareza }: PrizeClaimProps) {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const entrada = spring({
		frame,
		fps,
		config: { damping: 14, stiffness: 120 },
	});
	const giro = interpolate(frame, [12, 32], [180, 0], {
		...clamp,
		easing: Easing.inOut(Easing.cubic),
	});
	const brillo = interpolate(frame, [30, 50], [-120, 120], clamp);
	const texto = spring({
		frame: frame - 38,
		fps,
		config: { damping: 200 },
	});
	const premio = tipo === "premio";

	return (
		<AbsoluteFill
			style={{
				alignItems: "center",
				justifyContent: "center",
				gap: 24,
				background: "var(--azul-tint)",
				fontFamily: "var(--text)",
				color: "var(--ink)",
			}}
		>
			<div style={{ perspective: 1200 }}>
				<div
					style={{
						position: "relative",
						width: 180,
						height: 252,
						transformStyle: "preserve-3d",
						transform: `translateY(${interpolate(entrada, [0, 1], [380, 0])}px) scale(${interpolate(entrada, [0, 1], [0.6, 1])}) rotateY(${giro}deg)`,
					}}
				>
					<div
						style={{
							...cara,
							transform: "rotateY(180deg)",
							display: "grid",
							placeItems: "center",
							color: "var(--on-azul)",
							fontFamily: "var(--display)",
							fontWeight: 900,
							fontSize: 40,
						}}
					>
						Figu
					</div>
					<div style={{ ...cara, padding: 12 }}>
						<div
							style={{
								height: "100%",
								borderRadius: 10,
								background: "var(--bg-2)",
								display: "grid",
								gridTemplateRows: "auto 1fr",
								overflow: "hidden",
							}}
						>
							<div
								style={{
									padding: "8px 12px",
									background: premio ? "var(--oro-luz)" : "var(--azul)",
									color: premio ? "var(--ink)" : "var(--on-azul)",
									fontSize: 13,
									fontWeight: 700,
								}}
							>
								{premio ? "Premio" : (rareza ?? "Figu")}
							</div>
							<div
								style={{
									display: "grid",
									placeItems: "center",
									padding: 12,
									textAlign: "center",
									fontFamily: "var(--display)",
									fontWeight: 800,
									fontSize: 30,
									lineHeight: 1,
									color: "var(--azul)",
								}}
							>
								{premio ? "Premio" : "Figu"}
							</div>
						</div>
						<div
							style={{
								position: "absolute",
								inset: 0,
								background:
									"linear-gradient(105deg, transparent 30%, var(--oro-luz) 50%, transparent 70%)",
								opacity: 0.55,
								transform: `translateX(${brillo}%)`,
							}}
						/>
					</div>
				</div>
			</div>
			<div
				style={{
					textAlign: "center",
					padding: "0 24px",
					opacity: texto,
					transform: `translateY(${(1 - texto) * 16}px)`,
				}}
			>
				<div
					style={{
						fontFamily: "var(--display)",
						fontWeight: 800,
						fontSize: 28,
						lineHeight: 1.05,
						color: "var(--azul)",
					}}
				>
					{titulo}
				</div>
				<div style={{ marginTop: 6, fontSize: 15, color: "var(--ink-2)" }}>
					{detalle}
				</div>
			</div>
		</AbsoluteFill>
	);
}
