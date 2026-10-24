"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
	RankingResort,
	type RankingResortProps,
	RESORT,
} from "@/remotion/ranking-resort";

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
	const mq = window.matchMedia(QUERY);
	mq.addEventListener("change", cb);
	return () => mq.removeEventListener("change", cb);
};

/** The slide from last month's top 5 to this month's. Reduced motion shows the final frame. */
export function RankingResortPlayer(props: RankingResortProps) {
	const ref = useRef<PlayerRef>(null);
	const box = useRef<HTMLDivElement>(null);
	const reduced = useSyncExternalStore(
		subscribe,
		() => window.matchMedia(QUERY).matches,
		() => false,
	);

	// Start once the animation is on screen, not while it sits below the fold.
	useEffect(() => {
		const el = box.current;
		if (reduced || !el) return;
		const io = new IntersectionObserver(
			([e]) => {
				if (!e.isIntersecting) return;
				ref.current?.play();
				io.disconnect();
			},
			{ threshold: 0.6 },
		);
		io.observe(el);
		return () => io.disconnect();
	}, [reduced]);

	return (
		<div>
			{/* The Player draws pixels; this list is what a screen reader gets. */}
			<ol className="sr-only">
				{props.despues.map((f) => (
					<li key={f.id}>
						{f.nombre}, {f.score} puntos
					</li>
				))}
			</ol>
			<div ref={box} aria-hidden="true" className="rk-resort">
				<Player
					// A new key remounts, so the setting is honoured when it changes.
					key={reduced ? "quieto" : "anima"}
					ref={ref}
					component={RankingResort}
					inputProps={props}
					durationInFrames={RESORT.duration}
					fps={RESORT.fps}
					compositionWidth={RESORT.width}
					compositionHeight={RESORT.height}
					initialFrame={reduced ? RESORT.duration - 1 : 0}
					moveToBeginningWhenEnded={false}
					controls={false}
					initiallyMuted
					clickToPlay={false}
					acknowledgeRemotionLicense
					style={{ width: "100%" }}
				/>
			</div>
			<div className="rk-replay">
				{!reduced && (
					<button
						type="button"
						className="btn btn-ghost"
						onClick={() => {
							ref.current?.seekTo(0);
							ref.current?.play();
						}}
					>
						Ver de nuevo
					</button>
				)}
			</div>
		</div>
	);
}
