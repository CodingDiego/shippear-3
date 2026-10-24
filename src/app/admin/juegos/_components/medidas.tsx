"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BarChart } from "@/components/tremor/bar-chart";
import type { EventoEngagement, JuegoId } from "@/lib/domain";
import { JUEGO_LABEL } from "@/lib/domain";
import { mesNombre, periodoLabel } from "@/lib/format";
import { juegosMedidasOptions } from "@/lib/query/juegos";
import type { JuegoVista } from "../data";
import {
	JUEGO_CORTO,
	num,
	num1,
	pctEntero,
	pctSigno,
	pesos,
	pesosCorto,
	veces,
} from "../fmt";
import type { EfectoConIntervalo } from "../twfe";

type Nivel = "sucursal" | "vendedor";

const incluyeCero = (e: EfectoConIntervalo) =>
	e.lo !== null && e.hi !== null && e.lo <= 0 && e.hi >= 0;

function porEfecto(juegos: JuegoVista[]) {
	const b = (j: JuegoVista) =>
		j.efecto.vendedor.beta ?? Number.NEGATIVE_INFINITY;
	return [...juegos].sort((x, y) => b(y) - b(x));
}

function motivo(j: JuegoVista): string {
	const e = j.efecto.vendedor;
	const partes: string[] = [];
	if (e.beta === null)
		partes.push(
			e.sinControl
				? "Sin grupo de control: todas las sucursales lo tuvieron siempre"
				: "No se puede medir con estos meses",
		);
	else
		partes.push(
			`${pctSigno(e.beta)} de venta por vendedor${incluyeCero(e) ? ", aunque el rango incluye el cero" : ""}`,
		);
	if (j.uso?.tasa != null)
		partes.push(
			`lo usó el ${pctEntero(j.uso.tasa)} de los vendedores habilitados en ${mesNombre(j.uso.periodoId)}`,
		);
	if (j.premios.roi !== null)
		partes.push(
			`cada $ 1 en premios volvió $ ${veces(j.premios.roi)} en margen`,
		);
	return `${partes.join("; ")}.`;
}

export function Resumen() {
	const { data } = useSuspenseQuery(juegosMedidasOptions());
	return (
		<ol className="jg-resumen">
			{porEfecto(data.juegos).map((j, i) => (
				<li key={j.juego} className="panel">
					<b className="jg-puesto">{i + 1}</b>
					<div>
						<p className="jg-nombre">
							{JUEGO_LABEL[j.juego]}
							{!j.activo && (
								<span className="jg-off"> apagado en todo el país</span>
							)}
						</p>
						<p className="jg-motivo">{motivo(j)}</p>
					</div>
				</li>
			))}
		</ol>
	);
}

function frase(j: JuegoVista, nivel: Nivel): string {
	const e = j.efecto[nivel];
	const nombre = JUEGO_CORTO[j.juego];
	if (e.beta === null)
		return e.sinControl
			? `${nombre}: sin grupo de control, no hay meses sin el juego para comparar.`
			: `${nombre}: no se puede medir con estos meses.`;
	const cuanto = `${num1(Math.abs(e.beta) * 100)} % ${e.beta >= 0 ? "más" : "menos"}`;
	const base =
		nivel === "sucursal"
			? `En las sucursales con ${nombre}, los vendedores vendieron ${cuanto} que sin ${nombre}.`
			: `Con ${nombre}, cada vendedor vendió ${cuanto} que en sus meses sin ${nombre}.`;
	const kg =
		nivel === "vendedor" && j.kgPorVendedorMes !== null
			? ` Son unos ${num(j.kgPorVendedorMes)} kg por vendedor por mes.`
			: "";
	return `${base}${kg}`;
}

function detalleRango(e: EfectoConIntervalo, nivel: Nivel): string {
	if (e.lo === null || e.hi === null) return "";
	const unidad =
		nivel === "sucursal" ? "meses de sucursal" : "meses de vendedor";
	const cero = incluyeCero(e)
		? " El rango incluye el cero: no alcanza para decir que mueve la venta."
		: "";
	return `Rango probable (95 %): de ${pctSigno(e.lo)} a ${pctSigno(e.hi)}. Compara ${num(e.tratadas)} ${unidad} con el juego y ${num(e.control)} sin él.${cero}`;
}

function Efecto({ juegos }: { juegos: JuegoVista[] }) {
	const [nivel, setNivel] = useState<Nivel>("sucursal");
	const data = juegos.map((j) => ({
		juego: JUEGO_CORTO[j.juego],
		"Venta extra": (j.efecto[nivel].beta ?? 0) * 100,
	}));
	return (
		<section aria-labelledby="jg-efecto">
			<h2 className="h2" id="jg-efecto">
				Efecto en la venta
			</h2>
			{/* biome-ignore lint/a11y/useSemanticElements: .tabs is a styled group of toggle buttons */}
			<div className="tabs" role="group" aria-label="Nivel">
				<button
					type="button"
					aria-pressed={nivel === "sucursal"}
					onClick={() => setNivel("sucursal")}
				>
					Por sucursal
				</button>
				<button
					type="button"
					aria-pressed={nivel === "vendedor"}
					onClick={() => setNivel("vendedor")}
				>
					Por vendedor
				</button>
			</div>
			<div className="panel jg-chart">
				<BarChart
					data={data}
					index="juego"
					categories={["Venta extra"]}
					colors={["azul"]}
					layout="vertical"
					yAxisWidth={84}
					showLegend={false}
					valueFormatter={(v) => pctSigno(v / 100)}
					aria-label={`Venta extra con cada juego, ${nivel === "sucursal" ? "por sucursal" : "por vendedor"}`}
				/>
				<ul className="jg-frases">
					{juegos.map((j) => (
						<li key={j.juego}>
							<p>{frase(j, nivel)}</p>
							<p className="note">{detalleRango(j.efecto[nivel], nivel)}</p>
						</li>
					))}
				</ul>
				<p className="note">
					Venta = kilos vendidos sobre el plan de kilos del mes. Se compara cada{" "}
					{nivel === "sucursal" ? "sucursal" : "vendedor"} consigo mismo en
					meses con y sin el juego, descontando lo que pasó en todo el país ese
					mes.
				</p>
			</div>
		</section>
	);
}

const EVENTOS: { id: EventoEngagement; label: string; plural: string }[] = [
	{ id: "vista", label: "Vistas", plural: "veces que abrieron el juego" },
	{
		id: "interaccion",
		label: "Interacciones",
		plural: "acciones dentro del juego",
	},
	{ id: "reclamo", label: "Reclamos", plural: "figus y premios reclamados" },
];

function Uso({ juegos }: { juegos: JuegoVista[] }) {
	const [juego, setJuego] = useState<JuegoId>(juegos[0]?.juego ?? "liga");
	const [evento, setEvento] = useState<EventoEngagement>("vista");
	const j = juegos.find((x) => x.juego === juego) ?? juegos[0];
	const ev = EVENTOS.find((e) => e.id === evento) ?? EVENTOS[0];
	const data = j.eventos.map((m) => ({
		mes: `${periodoLabel(m.periodoId)}${m.enCurso ? " (en curso)" : ""}`,
		Simulado: m[evento].simulado,
		Real: m[evento].real,
	}));
	return (
		<section aria-labelledby="jg-uso">
			<h2 className="h2" id="jg-uso">
				Uso por mes
			</h2>
			<div className="jg-controles">
				{/* biome-ignore lint/a11y/useSemanticElements: .tabs is a styled group of toggle buttons */}
				<div className="tabs" role="group" aria-label="Juego">
					{juegos.map((x) => (
						<button
							key={x.juego}
							type="button"
							aria-pressed={x.juego === juego}
							onClick={() => setJuego(x.juego)}
						>
							{JUEGO_CORTO[x.juego]}
						</button>
					))}
				</div>
				{/* biome-ignore lint/a11y/useSemanticElements: .seg is a styled group of toggle buttons */}
				<div className="seg" role="group" aria-label="Qué contar">
					{EVENTOS.map((e) => (
						<button
							key={e.id}
							type="button"
							aria-pressed={e.id === evento}
							onClick={() => setEvento(e.id)}
						>
							{e.label}
						</button>
					))}
				</div>
			</div>
			<div className="panel jg-chart">
				<BarChart
					data={data}
					index="mes"
					categories={["Simulado", "Real"]}
					colors={["plata", "azul"]}
					type="stacked"
					valueFormatter={num}
					yAxisWidth={48}
					aria-label={`${ev.label} de ${JUEGO_LABEL[j.juego]} por mes, simulado y real`}
				/>
				<p className="note">
					{ev.label}: {ev.plural}. Gris es historia simulada para la demo; azul
					es uso real desde esta app.
				</p>
				{j.uso && (
					<div className="jg-stats">
						<div className="stat">
							<b>{pctEntero(j.uso.tasa)}</b>
							<span>
								de los vendedores habilitados lo usó en{" "}
								{mesNombre(j.uso.periodoId)}
							</span>
						</div>
						<div className="stat">
							<b>{pctEntero(j.uso.retencion)}</b>
							<span>de los que lo usaron el mes anterior volvió a usarlo</span>
						</div>
						<div className="stat">
							<b>
								{j.uso.eventosPorActivo === null
									? "sin datos"
									: num1(j.uso.eventosPorActivo)}
							</b>
							<span>
								vistas, interacciones y reclamos por vendedor que lo usó
							</span>
						</div>
					</div>
				)}
			</div>
		</section>
	);
}

function Premios({
	juegos,
	valorKgArs,
}: {
	juegos: JuegoVista[];
	valorKgArs: number;
}) {
	const data = juegos.map((j) => ({
		juego: JUEGO_CORTO[j.juego],
		"Costo de premios": j.premios.costoArs,
		"Valor de los kilos extra": j.premios.valorArs ?? 0,
	}));
	const simulado = juegos.some((j) => j.premios.simulado);
	return (
		<section aria-labelledby="jg-premios">
			<h2 className="h2" id="jg-premios">
				Lo que cuestan los premios y lo que dejan
			</h2>
			<div className="panel jg-chart">
				<div className="jg-tabla-wrap">
					<table className="table">
						<thead>
							<tr>
								<th scope="col">Juego</th>
								<th scope="col">Kilos extra</th>
								<th scope="col">Valor de esos kilos</th>
								<th scope="col">Costo de premios</th>
								<th scope="col">Retorno</th>
							</tr>
						</thead>
						<tbody>
							{juegos.map((j) => (
								<tr key={j.juego}>
									<th scope="row">{JUEGO_LABEL[j.juego]}</th>
									<td>
										{j.premios.kgExtra === null
											? "sin datos"
											: `${num(j.premios.kgExtra)} kg`}
									</td>
									<td>
										{j.premios.valorArs === null
											? "sin datos"
											: pesos(j.premios.valorArs)}
									</td>
									<td>{pesos(j.premios.costoArs)}</td>
									<td>
										{j.premios.roi === null
											? "sin datos"
											: `${veces(j.premios.roi)} veces`}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<BarChart
					data={data}
					index="juego"
					categories={["Costo de premios", "Valor de los kilos extra"]}
					colors={["oro", "azul"]}
					valueFormatter={pesosCorto}
					yAxisWidth={72}
					aria-label="Costo de los premios y valor de los kilos extra de cada juego"
				/>
				<p className="note">
					Kilos extra = kilos de más por vendedor por mes con el juego, por la
					cantidad de meses de vendedor con el juego. Cada kilo vale{" "}
					{pesos(valorKgArs)} de margen. Retorno = valor de los kilos extra
					sobre el costo de los premios.
					{simulado && " Los premios cargados para la demo son simulados."}
				</p>
			</div>
		</section>
	);
}

export function Detalle() {
	const { data } = useSuspenseQuery(juegosMedidasOptions());
	return (
		<>
			<Efecto juegos={data.juegos} />
			<Uso juegos={data.juegos} />
			<Premios juegos={data.juegos} valorKgArs={data.valorKgArs} />
		</>
	);
}
