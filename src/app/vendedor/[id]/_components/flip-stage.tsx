"use client";

import { type ReactNode, useState } from "react";

export function FlipStage({
	front,
	back,
}: {
	front: ReactNode;
	back: ReactNode;
}) {
	const [verDorso, setVerDorso] = useState(false);
	return (
		<>
			<div className="stage" data-back={verDorso}>
				<div className="inner">
					{front}
					{back}
				</div>
			</div>
			<div>
				<button
					type="button"
					className="btn btn-ghost"
					aria-pressed={verDorso}
					onClick={() => setVerDorso((b) => !b)}
				>
					{verDorso ? "Ver el frente" : "Ver el dorso"}
				</button>
			</div>
		</>
	);
}
