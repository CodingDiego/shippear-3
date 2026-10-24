"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useOptimistic, useState, useTransition } from "react";
import {
	JUEGO_LABEL,
	JUEGOS,
	type JuegoId,
	type JuegoIntervalo,
} from "@/lib/domain";
import { periodoLargo } from "@/lib/format";
import { cambiarJuegoGlobal, cambiarJuegoSucursal } from "../actions";
import { JUEGO_CORTO } from "../fmt";

type Props = {
	global: Record<JuegoId, boolean>;
	intervalos: JuegoIntervalo[];
	sucursales: { slug: string; nombre: string }[];
	/** Months an admin may switch from, newest first; the first is the default. */
	meses: string[];
	enCurso: string | null;
};

const cubre = (
	intervalos: JuegoIntervalo[],
	juego: JuegoId,
	sucursal: string,
	mes: string,
) =>
	intervalos.some(
		(i) =>
			i.juego === juego &&
			i.sucursal === sucursal &&
			i.desde <= mes &&
			(i.hasta === null || mes <= i.hasta),
	);

export function Switches({
	global,
	intervalos,
	sucursales,
	meses,
	enCurso,
}: Props) {
	const queryClient = useQueryClient();
	const [mes, setMes] = useState(meses[0] ?? "");
	const [error, setError] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	// Flipped switches show their new state until the refreshed server props arrive.
	const [optimista, marcar] = useOptimistic<
		Record<string, boolean>,
		[string, boolean]
	>({}, (s, [k, v]) => ({ ...s, [k]: v }));

	const cambiar = (
		clave: string,
		activo: boolean,
		accion: () => ReturnType<typeof cambiarJuegoGlobal>,
	) =>
		startTransition(async () => {
			marcar([clave, activo]);
			setError(null);
			const r = await accion();
			if (!r.ok) setError(r.error);
			else await queryClient.invalidateQueries({ queryKey: ["juegos"] });
		});

	return (
		<div className="jg-switches">
			<div className="panel jg-global">
				<p className="jg-sub">En todo el país</p>
				<div className="jg-global-row">
					{JUEGOS.map((j) => {
						const clave = `global:${j}`;
						const on = optimista[clave] ?? global[j];
						return (
							<button
								key={j}
								type="button"
								className="switch"
								aria-pressed={on}
								onClick={() =>
									cambiar(clave, !on, () =>
										cambiarJuegoGlobal({ juego: j, activo: !on }),
									)
								}
							>
								{JUEGO_LABEL[j]}
							</button>
						);
					})}
				</div>
				<p className="note">
					Un juego apagado acá no se ve en ninguna sucursal, aunque esté
					prendido abajo. Las medidas usan la historia de cada sucursal, así que
					no cambian al apagarlo.
				</p>
			</div>

			<div className="panel">
				<div className="jg-mes">
					<label htmlFor="jg-mes" className="jg-sub">
						Por sucursal, a partir de
					</label>
					<select
						id="jg-mes"
						className="select"
						value={mes}
						onChange={(e) => setMes(e.target.value)}
					>
						{meses.map((m) => (
							<option key={m} value={m}>
								{periodoLargo(m)}
								{m === enCurso ? " (en curso)" : ""}
							</option>
						))}
					</select>
				</div>
				{mes !== enCurso && (
					<p className="note jg-aviso">
						Estás cambiando un mes cerrado: eso reescribe la historia que usan
						las medidas de abajo.
					</p>
				)}
				<div className="jg-grid-wrap">
					<table className="table jg-grid">
						<thead>
							<tr>
								<th scope="col">Sucursal</th>
								{JUEGOS.map((j) => (
									<th key={j} scope="col">
										{JUEGO_CORTO[j]}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{sucursales.map((s) => (
								<tr key={s.slug}>
									<th scope="row">{s.nombre}</th>
									{JUEGOS.map((j) => {
										const clave = `${j}|${s.slug}|${mes}`;
										const on =
											optimista[clave] ?? cubre(intervalos, j, s.slug, mes);
										const apagadoPais = !(
											optimista[`global:${j}`] ?? global[j]
										);
										return (
											<td key={j}>
												<button
													type="button"
													className="switch"
													aria-pressed={on}
													data-pais-off={apagadoPais || undefined}
													onClick={() =>
														cambiar(clave, !on, () =>
															cambiarJuegoSucursal({
																juego: j,
																sucursal: s.slug,
																activo: !on,
																periodoId: mes,
															}),
														)
													}
												>
													<span className="sr-only">
														{JUEGO_LABEL[j]} en {s.nombre}
													</span>
												</button>
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<p className="note jg-estado" aria-live="polite">
					{error ?? (pending ? "Guardando…" : "")}
				</p>
			</div>
		</div>
	);
}
