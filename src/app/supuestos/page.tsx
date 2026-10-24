import type { Metadata } from "next";
import Link from "next/link";
import {
	KPI_DEFS,
	KPI_IDS,
	TIER_LABEL,
	TIER_MIN,
	type Tier,
	TOPE,
} from "@/lib/domain";
import { fmt1, pct } from "@/lib/format";

export const metadata: Metadata = { title: "Supuestos" };

const tope = Math.round(TOPE * 100);

const CALCULO = [
	"Cada KPI es una división: por ejemplo, kilos vendidos sobre kilos de objetivo. El acumulado suma los dos números desde octubre, el primer mes del año comercial.",
	`El cumplimiento compara el valor con el objetivo: valor sobre objetivo cuando más es mejor (Venta), objetivo sobre valor cuando menos es mejor (Pedidos no entregados). Pasar del ${tope} % no suma más.`,
	`El cumplimiento se pasa a puntos de 0 a 100: llegar al ${tope} % da 100 puntos y cumplir el objetivo justo da ${fmt1(100 / TOPE)}.`,
	"El puntaje de la carta es el promedio de los puntos de cada KPI según su peso. Si a un vendedor le falta un KPI, su peso se reparte entre los demás; si le falta más de la mitad del peso, la carta queda sin puntaje.",
	"Hay tres vistas: Mes (solo ese mes), Acumulado (desde octubre) y Combinada (mitad del mes y mitad del acumulado).",
	"Si dos vendedores empatan, se mira el puntaje con todos sus decimales; si siguen empatados, los puntos de Venta, después los del siguiente KPI con más peso, y al final el código del vendedor.",
];

const ASUMIDO = [
	"Productividad: el caso la define como pedidos sobre visitas, pero su carta de ejemplo muestra 3,8, que parece pedidos por día. Usamos el porcentaje de visitas con pedido.",
	"Lanzamientos: el caso cuenta los clientes que todavía no compraron los lanzamientos, pero lo pinta como si más fuera mejor. Mostramos lo contrario, los clientes que sí compraron, para que más sea mejor.",
	`El tope de ${tope} % lo leemos como el cumplimiento máximo que cuenta: vender el doble del objetivo vale lo mismo que el ${tope} %.`,
	`Niveles: Arriba desde ${TIER_MIN.verde} puntos, En carrera desde ${TIER_MIN.amarillo} y Abajo por debajo. Los cortes se pueden cambiar.`,
	'Zona: el caso llama "plaza" a los vendedores de la ciudad de la sucursal y "campaña" a los que recorren los pueblos de alrededor. En la app los mostramos como Ciudad y Rural; en el CSV siguen siendo plaza y campaña.',
];

const MODOS = [
	[
		"Liga",
		"Gana el mejor promedio mensual del año. Para competir hacen falta nueve meses con datos, o tres de cada cuatro meses desde el alta para quien entró después. Una sucursal compite con el promedio de sus vendedores que califican, si son al menos tres. Hay además un premio por KPI: el mejor promedio de puntos en ese KPI.",
	],
	[
		"Revelación",
		"Cuatro premios a la mejora contra el mes anterior: más puntos ganados; más avance sobre lo que le faltaba para llegar a 100 (subir de 90 a 95 cuenta más que de 50 a 55); más meses seguidos subiendo, desde tres; y el mayor ascenso desde su peor puesto del año, con al menos seis meses de datos.",
	],
	[
		"Álbum",
		"Cumplir el objetivo de un KPI en el mes da su figu. La rareza depende de cuántos vendedores lo cumplieron ese mes, comparado con el resto de los KPI y meses de la temporada: el 5 % más difícil es legendaria, el siguiente 20 %, épica, el siguiente 35 %, rara, y el resto, común. Cumplir el mismo KPI tres meses seguidos la vuelve holográfica. Los tres mejores del país en ese KPI reciben la edición dorada, plateada o de bronce.",
	],
] as const;

const CSV_EJEMPLO = `vendedor,nombre,apellido,sucursal,canal,alta,periodo,kpi,num,den
V001,Fabián,Ledesma,rosario,plaza,2025-10,2026-09,venta,10400,10000
V001,Fabián,Ledesma,rosario,plaza,2025-10,2026-09,no_comp,6,100
V002,Julia,Rivas,caba,plaza,2025-10,2026-09,venta,10600,10000`;

const COLUMNAS = [
	["vendedor", "código estable"],
	["nombre", "nombre de pila"],
	["apellido", "apellido"],
	["sucursal", "slug, uno de los 16"],
	["canal", "plaza (ciudad) o campaña (rural)"],
	["alta", "primer mes con datos, AAAA-MM"],
	["periodo", "AAAA-MM"],
	["kpi", "uno de los siete ids"],
	["num", "numerador"],
	["den", "denominador"],
];

const TIER_CLASS: Record<Tier, string> = {
	verde: "bg-verde-bg text-verde",
	amarillo: "bg-amarillo-bg text-amarillo",
	rojo: "bg-rojo-bg text-rojo",
};

export default function Supuestos() {
	return (
		<main className="wrap pb-16">
			<header className="title">
				<h1>Supuestos del puntaje</h1>
				<p>
					<b>
						Cómo pasamos del scorecard a las cartas, y qué tuvimos que suponer.
					</b>{" "}
					Pesos, objetivos y niveles se cambian desde la administración, sin
					tocar código.
				</p>
			</header>

			<h2 className="h2">Cómo se calcula el puntaje</h2>
			<ol className="note grid list-decimal gap-2 pl-5">
				{CALCULO.map((t) => (
					<li key={t}>{t}</li>
				))}
			</ol>

			<h2 className="h2">Los siete KPIs</h2>
			<div className="overflow-x-auto">
				<table className="table">
					<thead>
						<tr>
							<th>KPI</th>
							<th>Peso</th>
							<th>Objetivo</th>
							<th>Mejor</th>
							<th className="text-left!">Numerador</th>
							<th className="text-left!">Denominador</th>
						</tr>
					</thead>
					<tbody>
						{KPI_IDS.map((id) => {
							const d = KPI_DEFS[id];
							return (
								<tr key={id}>
									<td>
										<Link href={`/kpi/${id}`}>{d.nombre}</Link>
									</td>
									<td>{pct(d.peso)}</td>
									<td>{pct(d.objetivo)}</td>
									<td>{d.direccion === "mayor" ? "más" : "menos"}</td>
									<td className="text-left!">{d.num}</td>
									<td className="text-left!">{d.den}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			<h2 className="h2">Niveles</h2>
			<p className="note">
				{TIER_LABEL.verde} desde {TIER_MIN.verde} puntos, {TIER_LABEL.amarillo}{" "}
				desde {TIER_MIN.amarillo}, {TIER_LABEL.rojo} por debajo. Son nuestros;
				el caso no los fija.
			</p>
			<p className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
				{(["verde", "amarillo", "rojo"] as const).map((t) => (
					<span key={t} className={`rounded-ui px-3 py-1 ${TIER_CLASS[t]}`}>
						{TIER_LABEL[t]}
					</span>
				))}
			</p>

			<h2 className="h2">Lo que asumimos y hay que confirmar</h2>
			<ul className="note grid list-disc gap-2 pl-5">
				{ASUMIDO.map((t) => (
					<li key={t}>{t}</li>
				))}
			</ul>

			<h2 className="h2">Modos de juego</h2>
			<div className="grid gap-4">
				{MODOS.map(([nombre, texto]) => (
					<p key={nombre} className="note">
						<b className="text-ink">{nombre}.</b> {texto}
					</p>
				))}
			</div>

			<h2 className="h2" id="csv">
				Formato del CSV
			</h2>
			<p className="note">
				Formato largo, una fila por vendedor, mes y KPI. Separador coma o punto
				y coma, decimales con punto o coma. El generador exporta el mismo
				formato, así que un export real del scorecard lo reemplaza.
			</p>
			<pre className="panel mt-3 mb-4 overflow-x-auto font-mono text-[13px] leading-relaxed">
				{CSV_EJEMPLO}
			</pre>
			<div className="overflow-x-auto">
				<table className="table">
					<thead>
						<tr>
							<th>Columna</th>
							<th className="text-left!">Qué es</th>
						</tr>
					</thead>
					<tbody>
						{COLUMNAS.map(([col, que]) => (
							<tr key={col}>
								<td>
									<code>{col}</code>
								</td>
								<td className="text-left!">{que}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</main>
	);
}
