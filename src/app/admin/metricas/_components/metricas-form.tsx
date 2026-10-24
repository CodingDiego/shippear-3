"use client";

import { useState, useTransition } from "react";
import { efectivo, type MetricaDef } from "@/lib/domain";
import { fmt1 } from "@/lib/format";
import { guardarMetricas, type Resultado } from "../actions";

type Fila = { activa: boolean; peso: string; objetivo: string };

const TIPO: Record<MetricaDef["tipo"], string> = {
	base: "del caso",
	derivada: "calculada",
	custom: "propia",
};

const aFila = (m: MetricaDef): Fila => ({
	activa: m.activa,
	peso: String(m.peso),
	objetivo: String(Math.round(m.objetivo * 1000) / 10),
});

const numero = (s: string) => {
	const n = Number(s.replace(",", "."));
	return Number.isFinite(n) && s.trim() !== "" ? n : null;
};

export function MetricasForm({ metricas }: { metricas: MetricaDef[] }) {
	const [filas, setFilas] = useState(() =>
		Object.fromEntries(metricas.map((m) => [m.id, aFila(m)])),
	);
	const [res, setRes] = useState<Resultado>({ error: null });
	const [guardando, startTransition] = useTransition();

	const vivas = metricas.map((m) => ({
		...m,
		activa: filas[m.id].activa,
		peso: numero(filas[m.id].peso) ?? 0,
	}));
	const pesos = efectivo(vivas);
	const suma = Object.values(pesos).reduce((a, b) => a + b, 0);
	const invalidas = metricas.filter(
		(m) =>
			numero(filas[m.id].peso) === null ||
			numero(filas[m.id].objetivo) === null,
	);

	const cambiar = (id: string, patch: Partial<Fila>) => {
		setFilas((f) => ({ ...f, [id]: { ...f[id], ...patch } }));
		setRes({ error: null });
	};

	const guardar = () =>
		startTransition(async () => {
			setRes(
				await guardarMetricas(
					metricas.map((m) => ({
						id: m.id,
						activa: filas[m.id].activa,
						peso: numero(filas[m.id].peso) ?? 0,
						objetivo: (numero(filas[m.id].objetivo) ?? 0) / 100,
					})),
				),
			);
		});

	return (
		<div className="panel adm-met">
			<div className="adm-met-head" aria-hidden="true">
				<span>Métrica</span>
				<span>Peso</span>
				<span>Pesa</span>
				<span>Objetivo</span>
				<span>Mejor si es</span>
			</div>
			<ul className="adm-met-list">
				{metricas.map((m) => {
					const f = filas[m.id];
					const ef = pesos[m.id];
					return (
						<li
							key={m.id}
							className="adm-met-row"
							data-off={!f.activa || undefined}
						>
							<div className="adm-met-name">
								<button
									type="button"
									className="switch"
									aria-pressed={f.activa}
									onClick={() => cambiar(m.id, { activa: !f.activa })}
								>
									<span>
										{m.nombre}
										<small>
											{TIPO[m.tipo]}
											{m.unidad ? `, en ${m.unidad}` : ""}
										</small>
									</span>
								</button>
							</div>
							<label className="adm-field">
								<span>Peso</span>
								<input
									className="adm-input"
									inputMode="decimal"
									value={f.peso}
									aria-invalid={numero(f.peso) === null || undefined}
									onChange={(e) => cambiar(m.id, { peso: e.target.value })}
								/>
							</label>
							<p className="adm-field adm-ef">
								<span>Pesa</span>
								<b>{ef === undefined ? "No suma" : `${fmt1(ef * 100)} %`}</b>
							</p>
							<label className="adm-field">
								<span>Objetivo (%)</span>
								<input
									className="adm-input"
									inputMode="decimal"
									value={f.objetivo}
									aria-invalid={numero(f.objetivo) === null || undefined}
									onChange={(e) => cambiar(m.id, { objetivo: e.target.value })}
								/>
							</label>
							<p className="adm-field">
								<span>Mejor si es</span>
								{m.direccion === "mayor" ? "Más alto" : "Más bajo"}
							</p>
						</li>
					);
				})}
			</ul>
			<div className="adm-met-foot">
				<p className="note">
					{suma > 0
						? `Las métricas activas suman ${fmt1(suma * 100)} %. Cada peso se divide por la suma de los pesos activos.`
						: "Ninguna métrica activa tiene peso: el puntaje no se puede calcular."}
				</p>
				<button
					type="button"
					className="btn"
					disabled={guardando || invalidas.length > 0 || suma === 0}
					onClick={guardar}
				>
					{guardando ? "Guardando…" : "Guardar métricas"}
				</button>
			</div>
			{res.error && (
				<p className="adm-error" role="alert">
					{res.error}
				</p>
			)}
			{res.ok && (
				<p className="adm-ok" role="status">
					{res.ok}
				</p>
			)}
		</div>
	);
}
