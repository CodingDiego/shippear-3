"use client";

import { type ReactNode, useState } from "react";

/** Both windows are rendered on the server; the tabs only choose which one shows. */
export function TrackerTabs({
	mes,
	semana,
}: {
	mes: ReactNode;
	semana: ReactNode;
}) {
	const [ventana, setVentana] = useState<"mes" | "semana">("mes");
	return (
		<>
			<div className="tabs">
				<button
					type="button"
					aria-pressed={ventana === "mes"}
					onClick={() => setVentana("mes")}
				>
					Mes
				</button>
				<button
					type="button"
					aria-pressed={ventana === "semana"}
					onClick={() => setVentana("semana")}
				>
					Semana
				</button>
			</div>
			<div hidden={ventana !== "mes"}>{mes}</div>
			<div hidden={ventana !== "semana"}>{semana}</div>
		</>
	);
}
