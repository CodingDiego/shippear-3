"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useRef, useState } from "react";
import { HERO, HeroComposition, type HeroProps } from "@/remotion/hero";

/** The Remotion Player itself; loaded on demand by HeroPlayer so it stays out of the first bundle. */
export default function HeroPlayerStage({ cards }: HeroProps) {
	const ref = useRef<PlayerRef>(null);
	// Fade in on the frame after mount, so the poster hands over to the table smoothly.
	const [shown, setShown] = useState(false);
	useEffect(() => {
		// autoPlay alone left the clock at frame 0 in some loads; start it explicitly too.
		ref.current?.play();
		(window as unknown as { __hero?: unknown }).__hero = ref.current;
		const id = requestAnimationFrame(() => setShown(true));
		return () => cancelAnimationFrame(id);
	}, []);

	return (
		<div className="hero-player" data-playing={shown} aria-hidden="true">
			<Player
				ref={ref}
				component={HeroComposition}
				inputProps={{ cards }}
				durationInFrames={HERO.duration}
				fps={HERO.fps}
				compositionWidth={HERO.width}
				compositionHeight={HERO.height}
				style={{ width: "100%", height: "100%" }}
				autoPlay
				loop
				controls={false}
				clickToPlay={false}
				spaceKeyToPlayOrPause={false}
				numberOfSharedAudioTags={0}
				acknowledgeRemotionLicense
			/>
		</div>
	);
}
