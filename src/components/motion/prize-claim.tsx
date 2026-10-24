"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
	PRIZE_CLAIM,
	PrizeClaim,
	type PrizeClaimProps,
} from "@/remotion/prize-claim";

const REDUCIDO = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
	const m = matchMedia(REDUCIDO);
	m.addEventListener("change", cb);
	return () => m.removeEventListener("change", cb);
};
const reducido = () => matchMedia(REDUCIDO).matches;

/** Plays the claim once; with reduced motion it shows the final frame, still. */
export function PrizeClaimPlayer(props: PrizeClaimProps) {
	const quieto = useSyncExternalStore(subscribe, reducido, () => true);
	const ultimo = PRIZE_CLAIM.duracion - 1;
	const ref = useRef<PlayerRef>(null);
	// Our own effect instead of autoPlay: Player's autoplay is one-shot and a dev
	// StrictMode remount leaves it paused on frame 0.
	useEffect(() => {
		const p = ref.current;
		if (!p) return;
		if (quieto) p.seekTo(ultimo);
		else if (!p.isPlaying()) p.play();
	}, [quieto, ultimo]);
	return (
		<Player
			ref={ref}
			component={PrizeClaim}
			inputProps={props}
			durationInFrames={PRIZE_CLAIM.duracion}
			fps={PRIZE_CLAIM.fps}
			compositionWidth={PRIZE_CLAIM.ancho}
			compositionHeight={PRIZE_CLAIM.alto}
			initialFrame={quieto ? ultimo : 0}
			numberOfSharedAudioTags={0}
			moveToBeginningWhenEnded={false}
			controls={false}
			acknowledgeRemotionLicense
			style={{ width: "100%", aspectRatio: "3 / 4" }}
		/>
	);
}
