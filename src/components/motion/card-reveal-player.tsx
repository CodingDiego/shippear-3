"use client";

import { Player } from "@remotion/player";
import { useEffect, useRef } from "react";
import {
	CardRevealComposition,
	type CardRevealProps,
	REVEAL,
} from "@/remotion/card-reveal";

/** Plays the reveal once and reports when it ends. */
export default function CardRevealPlayer({
	card,
	foil,
	onEnded,
}: CardRevealProps & { onEnded: () => void }) {
	const ref = useRef<React.ComponentRef<typeof Player>>(null);
	const done = useRef(onEnded);
	done.current = onEnded;

	useEffect(() => {
		const player = ref.current;
		if (!player) return;
		const end = () => done.current();
		player.addEventListener("ended", end);
		return () => player.removeEventListener("ended", end);
	}, []);

	return (
		<Player
			ref={ref}
			component={CardRevealComposition}
			inputProps={{ card, foil }}
			durationInFrames={REVEAL.duration}
			fps={REVEAL.fps}
			compositionWidth={REVEAL.width}
			compositionHeight={REVEAL.height}
			style={{ width: "100%", height: "100%" }}
			autoPlay
			initiallyMuted
			controls={false}
			clickToPlay={false}
			spaceKeyToPlayOrPause={false}
			numberOfSharedAudioTags={0}
			acknowledgeRemotionLicense
		/>
	);
}
