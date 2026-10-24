"use client";

import { useActionState, useState } from "react";
import {
	JUEGO_LABEL,
	JUEGOS,
	type JuegoId,
	PERIODOS,
	type Premio,
} from "@/lib/domain";
import { periodoLargo } from "@/lib/format";
import { guardarPremio, type Resultado } from "../actions";

const pesos = new Intl.NumberFormat("es-AR", {
	style: "currency",
	currency: "ARS",
	maximumFractionDigits: 0,
});

type Borrador = {
	juego: JuegoId;
	periodoId: string;
	descripcion: string;
	costoArs: string;
};

export function PremiosAdmin({
	premios,
	mesInicial,
}: {
	premios: Premio[];
	mesInicial: string;
}) {
	const [res, accion, enviando] = useActionState<Resultado, FormData>(
		guardarPremio,
		{ error: null },
	);
	const [b, setB] = useState<Borrador>({
		juego: "liga",
		periodoId: mesInicial,
		descripcion: "",
		costoArs: "",
	});
	// The form edits whatever prize already exists for the chosen game and month.
	const elegir = (juego: JuegoId, periodoId: string) => {
		const p = premios.find(
			(x) => x.juego === juego && x.periodoId === periodoId,
		);
		setB({
			juego,
			periodoId,
			descripcion: p?.descripcion ?? "",
			costoArs: p ? String(p.costoArs) : "",
		});
	};
	const existe = premios.some(
		(x) => x.juego === b.juego && x.periodoId === b.periodoId,
	);
	const total = premios.reduce((t, p) => t + p.costoArs, 0);
	const ordenados = [...premios].sort(
		(x, y) =>
			y.periodoId.localeCompare(x.periodoId) || x.juego.localeCompare(y.juego),
	);

	return (
		<>
			<div className="adm-stats panel">
				<div className="stat">
					<b>{pesos.format(total)}</b>
					<span>costo total de {premios.length} premios</span>
				</div>
				{JUEGOS.map((j) => (
					<div className="stat" key={j}>
						<b>
							{pesos.format(
								premios
									.filter((p) => p.juego === j)
									.reduce((t, p) => t + p.costoArs, 0),
							)}
						</b>
						<span>{JUEGO_LABEL[j]}</span>
					</div>
				))}
			</div>

			<h2 className="h2" id="editar">
				{existe ? "Cambiar un premio" : "Cargar un premio"}
			</h2>
			<form action={accion} className="panel adm-form">
				<label className="adm-field">
					<span>Juego</span>
					<select
						className="select"
						name="juego"
						value={b.juego}
						onChange={(e) => elegir(e.target.value as JuegoId, b.periodoId)}
					>
						{JUEGOS.map((j) => (
							<option key={j} value={j}>
								{JUEGO_LABEL[j]}
							</option>
						))}
					</select>
				</label>
				<label className="adm-field">
					<span>Mes</span>
					<select
						className="select"
						name="periodoId"
						value={b.periodoId}
						onChange={(e) => elegir(b.juego, e.target.value)}
					>
						{[...PERIODOS].reverse().map((p) => (
							<option key={p.id} value={p.id}>
								{periodoLargo(p.id)}
							</option>
						))}
					</select>
				</label>
				<label className="adm-field adm-span">
					<span>Premio, igual para cada sucursal donde corre el juego</span>
					<input
						className="adm-input"
						name="descripcion"
						required
						minLength={3}
						maxLength={160}
						value={b.descripcion}
						onChange={(e) => setB({ ...b, descripcion: e.target.value })}
						placeholder="Una caja de productos La Virginia para cada ganador"
					/>
				</label>
				<label className="adm-field">
					<span>Costo total del mes ($)</span>
					<input
						className="adm-input"
						name="costoArs"
						type="number"
						min={0}
						step={1}
						required
						value={b.costoArs}
						onChange={(e) => setB({ ...b, costoArs: e.target.value })}
					/>
				</label>
				<div className="adm-actions">
					<button type="submit" className="btn" disabled={enviando}>
						{enviando
							? "Guardando…"
							: existe
								? "Reemplazar el premio"
								: "Guardar el premio"}
					</button>
				</div>
				{res.error && (
					<p className="adm-error adm-span" role="alert">
						{res.error}
					</p>
				)}
				{res.ok && (
					<p className="adm-ok adm-span" role="status">
						{res.ok}
					</p>
				)}
			</form>

			<h2 className="h2">
				Premios cargados <span>{premios.length}</span>
			</h2>
			<div className="adm-scroll panel">
				<table className="table adm-premios">
					<thead>
						<tr>
							<th>Mes y juego</th>
							<th>Premio</th>
							<th>Costo</th>
							<th>
								<span className="sr-only">Acción</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{ordenados.map((p) => (
							<tr key={p.id}>
								<td className="adm-cap">
									{periodoLargo(p.periodoId)}
									<small className="adm-sub">{JUEGO_LABEL[p.juego]}</small>
								</td>
								<td>
									{p.descripcion}
									{p.simulado && (
										<small className="adm-sub">
											Premio simulado de la demo
										</small>
									)}
								</td>
								<td>{pesos.format(p.costoArs)}</td>
								<td>
									<button
										type="button"
										className="btn btn-ghost"
										onClick={() => {
											elegir(p.juego, p.periodoId);
											document.getElementById("editar")?.scrollIntoView();
										}}
									>
										Cambiar
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}
