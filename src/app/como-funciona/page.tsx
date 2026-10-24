import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./flow.css";

export const metadata: Metadata = { title: "Cómo funciona" };

const ROLES = [
	{
		nombre: "Gerencia comercial",
		texto:
			"Abre el ranking el primer día hábil del mes: el podio del país, cada provincia y cada sucursal. Compara el mes contra el acumulado del año y decide qué juegos activar en cada sucursal.",
	},
	{
		nombre: "Jefe de sucursal",
		texto:
			"Ve a su equipo ordenado por puntaje, el puesto de cada uno en la sucursal, la provincia y el país, y en qué KPI está flojo cada vendedor.",
	},
	{
		nombre: "Vendedor",
		texto:
			"Entra con su código y su PIN. Ve cuántos puntos le faltan para la meta del mes y de la semana, qué hacer para llegar, y reclama las figus que ganó.",
	},
];

type Tone = "oro" | "verde" | "amarillo" | "rojo";

function Title({ left, right }: { left: string; right: string }) {
	return (
		<div className="flow-t">
			{left} <span>{right}</span>
		</div>
	);
}

function Line({ children }: { children: ReactNode }) {
	return <div className="flow-line">{children}</div>;
}

function Mini({ tones }: { tones: Tone[] }) {
	return (
		<div className="flow-mini" aria-hidden="true">
			{tones.map((t, i) => (
				<i key={String(i)} data-t={t} />
			))}
		</div>
	);
}

const STEPS: {
	titulo: string;
	href: string;
	texto: string;
	screen: ReactNode;
}[] = [
	{
		titulo: "El vendedor sigue su meta",
		href: "/entrar",
		texto:
			"Durante el mes, cada vendedor ve su puntaje de hoy, cuánto le falta para la meta y tres acciones concretas para llegar. También ve si viene vendiendo parejo o a los saltos.",
		screen: (
			<>
				<Title left="Tu mes" right="Faltan 7 días" />
				<Line>
					Te faltan <b>12 puntos</b> para la meta
				</Line>
				<Line>Vendé 120 kg más</Line>
				<Line>Conseguí que 3 clientes más compren</Line>
			</>
		),
	},
	{
		titulo: "Administración cierra el mes",
		href: "/admin",
		texto:
			"Al terminar el mes, administración sube el CSV del scorecard. Para la demo, un botón simula el cierre con datos de prueba. Los rankings y las figus se recalculan en el momento.",
		screen: (
			<>
				<Title left="Administración" right="Octubre 2026" />
				<div className="flow-drop">
					Arrastrá el CSV del scorecard, o elegí un archivo
				</div>
				<Line>Una fila por vendedor, mes y KPI</Line>
				<span className="btn btn-ghost">Simular cierre de mes</span>
			</>
		),
	},
	{
		titulo: "La gerencia mira el podio",
		href: "/ranking",
		texto:
			"Las tres mejores cartas del mes y el resto debajo, para todo el país, una provincia o una sucursal. Se puede ver solo el mes, el acumulado del año o una combinación de los dos.",
		screen: (
			<>
				<Title left="Ranking del país" right="139 cartas" />
				<Mini tones={["oro", "verde", "verde", "amarillo"]} />
				<Line>
					Primer puesto <b>99,7</b>
				</Line>
				<Line>
					Segundo puesto <b>99,4</b>
				</Line>
			</>
		),
	},
	{
		titulo: "El jefe de sucursal compara",
		href: "/ranking/sucursal/cordoba",
		texto:
			"El jefe de Córdoba ve a sus vendedores, el promedio de la sucursal contra el de la empresa y el puesto de cada uno.",
		screen: (
			<>
				<Title left="Córdoba" right="Sucursal 6 de 16" />
				<Line>Promedio 78; la empresa, 76</Line>
				<Mini tones={["verde", "amarillo", "amarillo", "rojo"]} />
			</>
		),
	},
	{
		titulo: "Cualquiera abre una carta",
		href: "/vendedor/V001",
		texto:
			"Cada carta muestra el puntaje, de dónde sale cada punto, la evolución mes a mes y las figus del vendedor. El enlace se puede compartir.",
		screen: (
			<>
				<Title left="Carta" right="Puesto 1 de 139" />
				<Line>
					Venta 104 % <b>94,5</b>
				</Line>
				<Line>
					Lanzamientos 88 % <b>100</b>
				</Line>
				<span className="btn">Copiar enlace</span>
			</>
		),
	},
	{
		titulo: "Los juegos corren solos",
		href: "/liga",
		texto:
			"Liga anual, Revelación del mes y Álbum se arman solos con cada mes cargado. La gerencia los activa o los apaga por sucursal y compara cuál mueve más las ventas.",
		screen: (
			<>
				<Title left="Juegos" right="16 sucursales" />
				<Line>
					Liga anual <b>activa</b>
				</Line>
				<Line>
					Álbum <b>activo en 12</b>
				</Line>
				<Line>
					Revelación <b>activa en 8</b>
				</Line>
			</>
		),
	},
];

export default function ComoFunciona() {
	return (
		<main className="wrap">
			<header className="title">
				<h1 style={{ fontSize: "clamp(32px, 4vw, 52px)", lineHeight: 1 }}>
					Un mes con Figu
				</h1>
				<p style={{ fontSize: 16, maxWidth: "62ch", marginTop: 14 }}>
					<b>Figu tiene tres usuarios.</b> La gerencia comercial y los jefes de
					sucursal miran los rankings; cada vendedor sigue su propia meta.
					Administración carga los datos del mes y maneja los juegos. El caso no
					dice quién usa la app: esta es nuestra propuesta.
				</p>
			</header>

			<ul className="flow-who">
				{ROLES.map((r) => (
					<li key={r.nombre} className="panel">
						<h2>{r.nombre}</h2>
						<p>{r.texto}</p>
					</li>
				))}
			</ul>

			<ol className="flow-steps">
				{STEPS.map((s) => (
					<li key={s.titulo} className="flow-step">
						<div>
							<h2>
								<Link href={s.href}>{s.titulo}</Link>
							</h2>
							<p>{s.texto}</p>
						</div>
						<div className="flow-screen" aria-hidden="true">
							{s.screen}
						</div>
					</li>
				))}
			</ol>
		</main>
	);
}
