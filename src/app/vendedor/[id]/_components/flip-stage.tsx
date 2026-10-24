"use client";

import { type ReactNode, useState } from "react";

export function FlipStage({
	front,
	back,
	reveal,
}: {
	front: ReactNode;
	back: ReactNode;
	/** Drawn over the card the first time the page opens (see CardReveal). */
	reveal?: ReactNode;
}) {
	const [verDorso, setVerDorso] = useState(false);
	return (
		<>
			<div className="stage-host">
				<div className="stage" data-back={verDorso}>
					<div className="inner">
						{front}
						{back}
					</div>
				</div>
				{reveal}
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
