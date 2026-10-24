import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import {
	FiguBody,
	type FiguData,
	type Foil,
} from "@/components/figu/figu-body";

export type CardRevealProps = { card: FiguData; foil?: Foil };

// Same 5:7 box as the card it reveals.
export const REVEAL = {
	width: 500,
	height: 700,
	fps: 30,
	duration: 78,
} as const;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Back of the card: also the server-rendered cover that hides the real card until the Player takes over. */
export function CardBack() {
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "var(--azul)",
				borderRadius: "var(--radius)",
				containerType: "inline-size",
				display: "grid",
				boxSizing: "border-box",
				padding: "3.6%",
			}}
		>
			<div
				style={{
					display: "grid",
					placeItems: "center",
					border: "2px solid var(--azul-word)",
					borderRadius: "calc(var(--radius) - 5px)",
					fontFamily: "var(--display)",
					fontWeight: 900,
					fontSize: "42cqi",
					letterSpacing: "-0.02em",
					color: "var(--azul-word)",
				}}
			>
				FIGU
			</div>
		</div>
	);
}

export function CardRevealComposition({ card, foil }: CardRevealProps) {
	const frame = useCurrentFrame();
	// Hold the back, turn it over, then count the score up.
	const flip = interpolate(frame, [8, 34], [180, 0], {
		...clamp,
		easing: Easing.out(Easing.cubic),
	});
	const lift = interpolate(frame, [8, 21, 34], [1, 1.05, 1], clamp);
	const progress = interpolate(frame, [30, 64], [0, 1], {
		...clamp,
		easing: Easing.out(Easing.cubic),
	});
	const face = {
		position: "absolute",
		inset: 0,
		backfaceVisibility: "hidden",
	} as const;
	return (
		<AbsoluteFill style={{ perspective: 1400 }}>
			<div
				style={{
					width: "100%",
					height: "100%",
					transformStyle: "preserve-3d",
					transform: `scale(${lift}) rotateY(${flip}deg)`,
				}}
			>
				<div
					className="figu"
					data-tier={card.tier ?? undefined}
					data-foil={foil}
					style={{ ...face, width: "100%", height: "100%" }}
				>
					<FiguBody v={{ ...card, score: (card.score ?? 0) * progress }} />
				</div>
				<div style={{ ...face, transform: "rotateY(180deg)" }}>
					<CardBack />
				</div>
			</div>
		</AbsoluteFill>
	);
}
