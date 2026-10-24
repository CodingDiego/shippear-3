"use client";

import { Player } from "@remotion/player";
import { useEffect, useState } from "react";
import { HERO, HeroComposition, type HeroProps } from "@/remotion/hero";

/** The Remotion Player itself; loaded on demand by HeroPlayer so it stays out of the first bundle. */
export default function HeroPlayerStage({ cards }: HeroProps) {
	// Fade in on the frame after mount, so the poster hands over to the table smoothly.
	const [shown, setShown] = useState(false);
	useEffect(() => {
		const id = requestAnimationFrame(() => setShown(true));
		return () => cancelAnimationFrame(id);
	}, []);

	return (
		<div className="hero-player" data-playing={shown} aria-hidden="true">
			<Player
				component={HeroComposition}
				inputProps={{ cards }}
				durationInFrames={HERO.duration}
				fps={HERO.fps}
				compositionWidth={HERO.width}
				compositionHeight={HERO.height}
				style={{ width: "100%", height: "100%" }}
				autoPlay
				loop
				// No audio: muted keeps the Player from waiting on a blocked AudioContext, which froze it at frame 0.
				initiallyMuted
				controls={false}
				clickToPlay={false}
				spaceKeyToPlayOrPause={false}
				numberOfSharedAudioTags={0}
				acknowledgeRemotionLicense
			/>
		</div>
	);
}
