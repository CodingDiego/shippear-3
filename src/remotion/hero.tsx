import {
	AbsoluteFill,
	Easing,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import { FiguBody, type FiguData } from "@/components/figu/figu-body";

/** The month's top cards, best first. Plain data, so the Player takes it as inputProps. */
export type HeroProps = { cards: FiguData[] };

// Same 5:7 box as the static card the landing shows before the Player mounts.
export const HERO = {
	width: 600,
	height: 840,
	fps: 30,
	duration: 240,
	card: 290,
	step: 104,
	top: 12,
	// Deal order, back to front: index into `cards` (0 is the best). Nothing is dealt in final order.
	deal: [3, 0, 4, 2, 1],
} as const;

const TILT = [-3, 2.5, -2, 3, -1];
// Sideways offset while dealt; the sort brings every card to the centre.
const SPREAD = [-90, 80, -50, 90, -20];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
// Frames: deal 0-60, count up 45-120, re-sort 125-175, foil sweep 180-215, fade out 224-239.
const SORT = [125, 175] as const;

export function HeroComposition({ cards }: HeroProps) {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const n = Math.min(cards.length, HERO.deal.length);
	const sort = interpolate(frame, SORT, [0, 1], {
		...clamp,
		easing: Easing.inOut(Easing.cubic),
	});
	const sorted = frame >= SORT[1];
	const fade = interpolate(frame, [224, 239], [1, 0], clamp);
	const sweep = interpolate(frame, [180, 215], [-120, 120], {
		...clamp,
		easing: Easing.inOut(Easing.quad),
	});
	const centre = (HERO.width - HERO.card) / 2;

	return (
		<AbsoluteFill
			style={{
				background:
					"radial-gradient(circle at 50% 28%, var(--azul-word) 0%, var(--azul-2) 72%)",
				borderRadius: "var(--radius)",
				overflow: "hidden",
			}}
		>
			<AbsoluteFill style={{ opacity: fade }}>
				{HERO.deal.slice(0, n).map((rank, slot) => {
					const v = cards[rank];
					if (!v) return null;
					const finalSlot = n - 1 - rank;
					const pos = slot + (finalSlot - slot) * sort;
					const rest = HERO.top + pos * HERO.step;
					const enter = spring({
						frame: frame - slot * 7,
						fps,
						config: { damping: 15, stiffness: 110 },
					});
					const y = interpolate(enter, [0, 1], [-HERO.card * 2, rest]);
					const tilt = TILT[slot] * (1 - sort) * enter;
					const x = centre + SPREAD[slot] * (1 - sort);
					const lift = 1 + 0.05 * Math.sin(Math.PI * sort);
					const progress = interpolate(
						frame,
						[45 + slot * 5, 115 + slot * 2],
						[0, 1],
						{ ...clamp, easing: Easing.out(Easing.cubic) },
					);
					const shown = { ...v, score: (v.score ?? 0) * progress };
					const first = rank === 0;
					return (
						<div
							key={v.vendedor.id}
							className="figu"
							data-tier={v.tier ?? undefined}
							data-foil={first && sorted ? "oro" : undefined}
							style={{
								position: "absolute",
								left: x,
								top: y,
								width: HERO.card,
								zIndex: Math.round(y),
								transform: `rotate(${tilt}deg) scale(${lift})`,
								boxShadow:
									"0 18px 30px -12px color-mix(in srgb, var(--ink) 55%, transparent)",
							}}
						>
							<FiguBody v={shown} />
							{first && (
								<span
									aria-hidden="true"
									style={{
										position: "absolute",
										inset: 0,
										zIndex: 3,
										pointerEvents: "none",
										background:
											"linear-gradient(105deg, transparent 38%, color-mix(in srgb, var(--oro-luz) 75%, transparent) 50%, transparent 62%)",
										transform: `translateX(${sweep}%)`,
									}}
								/>
							)}
						</div>
					);
				})}
			</AbsoluteFill>
		</AbsoluteFill>
	);
}
