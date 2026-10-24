"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CardBack, type CardRevealProps } from "@/remotion/card-reveal";

const Back = () => <CardBack />;
const RevealPlayer = dynamic(() => import("./card-reveal-player"), {
	ssr: false,
	loading: Back,
});

/**
 * Sits over the real card. The server renders the card back (so the front never flashes),
 * then the Player flips it and counts the score up once, and the cover goes away. With
 * reduced motion the cover goes away at once. Needs a positioned parent of the card's size.
 */
export function CardReveal(props: CardRevealProps) {
	const [fase, setFase] = useState<"cubierta" | "jugando" | "fin">("cubierta");

	useEffect(() => {
		const quieto = window.matchMedia("(prefers-reduced-motion: reduce)");
		setFase(quieto.matches ? "fin" : "jugando");
	}, []);

	if (fase === "fin") return null;
	return (
		<div className="reveal-cover" aria-hidden="true">
			{fase === "jugando" ? (
				<RevealPlayer {...props} onEnded={() => setFase("fin")} />
			) : (
				<CardBack />
			)}
		</div>
	);
}
