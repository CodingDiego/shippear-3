"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { HeroProps } from "@/remotion/hero";

const Stage = dynamic(() => import("./hero-player-stage"), { ssr: false });

/**
 * The poster (server-rendered card, same 5:7 box as the composition) is the layout. When the
 * box scrolls into view the Player mounts on top of it; with reduced motion it never does.
 */
export function HeroPlayer({
	cards,
	children,
}: HeroProps & { children: ReactNode }) {
	const host = useRef<HTMLDivElement>(null);
	const [mount, setMount] = useState(false);

	useEffect(() => {
		const el = host.current;
		if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
			return;
		const io = new IntersectionObserver(([e]) => {
			if (!e?.isIntersecting) return;
			setMount(true);
			io.disconnect();
		});
		io.observe(el);
		return () => io.disconnect();
	}, []);

	return (
		<div ref={host} className="hero-stage">
			{children}
			{mount && <Stage cards={cards} />}
		</div>
	);
}
