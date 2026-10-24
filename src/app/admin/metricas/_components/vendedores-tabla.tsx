"use client";

import { useState } from "react";
import { PROVINCIAS, SUCURSALES, tierOf } from "@/lib/domain";
import { fmt1, fmtScore, pct, sucursalNombre } from "@/lib/format";

export type FilaVendedor = {
	id: string;
	nombre: string;
	sucursal: string;
	provincia: string;
	score: number | null;
	constancia: number | null;
};

const media = (xs: number[]) =>
	xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

export function VendedoresTabla({
	filas,
	meta,
	mes,
}: {
	filas: FilaVendedor[];
	meta: number;
	mes: string;
}) {
	const [provincia, setProvincia] = useState("");
	const [sucursal, setSucursal] = useState("");
	const sucursales = SUCURSALES.filter(
		(s) => !provincia || s.provincia === provincia,
	);
	const visibles = filas.filter(
		(f) =>
			(!provincia || f.provincia === provincia) &&
			(!sucursal || f.sucursal === sucursal),
	);
	const porSucursal = sucursales
		.filter((s) => !sucursal || s.slug === sucursal)
		.map((s) => {
			const de = visibles.filter((f) => f.sucursal === s.slug);
			const scores = de.flatMap((f) => (f.score === null ? [] : [f.score]));
			return {
				slug: s.slug,
				vendedores: de.length,
				score: media(scores),
				enMeta: scores.filter((x) => x >= meta).length,
				constancia: media(
					de.flatMap((f) => (f.constancia === null ? [] : [f.constancia])),
				),
			};
		})
		.filter((s) => s.vendedores > 0)
		.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

	return (
		<>
			<div className="adm-filtros">
				<label className="adm-field">
					<span>Provincia</span>
					<select
						className="select"
						value={provincia}
						onChange={(e) => {
							setProvincia(e.target.value);
							setSucursal("");
						}}
					>
						<option value="">Todas</option>
						{PROVINCIAS.map((p) => (
							<option key={p.slug} value={p.slug}>
								{p.nombre}
							</option>
						))}
					</select>
				</label>
				<label className="adm-field">
					<span>Sucursal</span>
					<select
						className="select"
						value={sucursal}
						onChange={(e) => setSucursal(e.target.value)}
					>
						<option value="">Todas</option>
						{sucursales.map((s) => (
							<option key={s.slug} value={s.slug}>
								{s.nombre}
							</option>
						))}
					</select>
				</label>
			</div>

			<h3 className="h2">
				Promedio por sucursal <span>{mes}</span>
			</h3>
			<div className="adm-scroll panel">
				<table className="table">
					<thead>
						<tr>
							<th>Sucursal</th>
							<th>Vendedores</th>
							<th>Puntaje promedio</th>
							<th>En la meta</th>
							<th>Constancia promedio</th>
						</tr>
					</thead>
					<tbody>
						{porSucursal.map((s) => (
							<tr key={s.slug}>
								<td>{sucursalNombre(s.slug)}</td>
								<td>{s.vendedores}</td>
								<td className={s.score === null ? "" : `t-${tierOf(s.score)}`}>
									{fmt1(s.score)}
								</td>
								<td>{s.enMeta}</td>
								<td>{pct(s.constancia)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<h3 className="h2">
				Vendedores <span>{visibles.length}</span>
			</h3>
			<div className="adm-scroll adm-tall panel">
				<table className="table">
					<thead>
						<tr>
							<th>Vendedor</th>
							<th>Puntaje del mes</th>
							<th>Meta</th>
							<th>Le faltan</th>
							<th>Constancia</th>
						</tr>
					</thead>
					<tbody>
						{visibles.map((f) => (
							<tr key={f.id}>
								<td>
									{f.nombre}
									<small className="adm-sub">
										{sucursalNombre(f.sucursal)}
									</small>
								</td>
								<td className={f.score === null ? "" : `t-${tierOf(f.score)}`}>
									<b>{fmtScore(f.score)}</b>
								</td>
								<td>{meta}</td>
								<td>
									{f.score === null
										? "Sin datos"
										: f.score >= meta
											? "Llegó"
											: `${fmt1(meta - f.score)} puntos`}
								</td>
								<td>{pct(f.constancia)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}
