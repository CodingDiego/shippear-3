import Link from "next/link";
import { Suspense } from "react";
import { env } from "@/env";
import { getJuegosConfig, getSeasonMeta } from "@/lib/data/queries";
import { JUEGO_LABEL, JUEGOS } from "@/lib/domain";
import { mesNombre } from "@/lib/format";
import { LoginForm } from "./_components/login-form";
import { adminSesion } from "./_lib/guard";

export const metadata = { title: "Administración" };

export default function AdminPage() {
	return (
		<main className="wrap adm-main">
			<Suspense fallback={<ResumenSkeleton />}>
				<AdminHome />
			</Suspense>
		</main>
	);
}

async function AdminHome() {
	if (!(await adminSesion()))
		return (
			<>
				<header className="title">
					<h1>Administración</h1>
					<p>
						Métricas, juegos, premios y datos de la demo. Entrá con la clave de
						administración.
					</p>
				</header>
				{env.ADMIN_PASSCODE ? (
					<LoginForm />
				) : (
					<p className="panel adm-login">
						La administración está desactivada en este entorno.
					</p>
				)}
			</>
		);
	return <Resumen />;
}

async function Resumen() {
	const [meta, juegos] = await Promise.all([
		getSeasonMeta(),
		getJuegosConfig(),
	]);
	const activos = JUEGOS.filter((j) => juegos.global[j]);
	return (
		<>
			<header className="title">
				<h1>Resumen</h1>
				<p>
					{activos.length === 0
						? "No hay juegos prendidos."
						: `Juegos prendidos: ${activos.map((j) => JUEGO_LABEL[j]).join(", ")}.`}
				</p>
			</header>
			<div className="adm-stats panel">
				<div className="stat">
					<b>{meta.vendedores}</b>
					<span>vendedores</span>
				</div>
				<div className="stat">
					<b>{meta.sucursales}</b>
					<span>sucursales</span>
				</div>
				<div className="stat">
					<b className="adm-cap">
						{meta.enCurso ? mesNombre(meta.enCurso) : "Ninguno"}
					</b>
					<span>mes en curso</span>
				</div>
				<div className="stat">
					<b>
						{activos.length} de {JUEGOS.length}
					</b>
					<span>juegos activos</span>
				</div>
				<div className="stat">
					<b className="adm-cap">
						{meta.latest ? mesNombre(meta.latest) : "Ninguno"}
					</b>
					<span>último mes cerrado</span>
				</div>
			</div>
			<ul className="adm-links">
				<li>
					<Link href="/admin/metricas">Métricas</Link>
					<span>
						Pesos, objetivos, meta del mes y puntaje de cada vendedor.
					</span>
				</li>
				<li>
					<Link href="/admin/juegos">Juegos</Link>
					<span>
						Prender y apagar juegos por sucursal, y cómo rinde cada uno.
					</span>
				</li>
				<li>
					<Link href="/admin/premios">Premios</Link>
					<span>Qué se gana en cada juego y mes, y cuánto cuesta.</span>
				</li>
				<li>
					<Link href="/admin/datos">Datos</Link>
					<span>
						Importar y exportar CSV, cerrar el mes en curso, reiniciar la demo.
					</span>
				</li>
			</ul>
		</>
	);
}

function ResumenSkeleton() {
	return (
		<>
			<header className="title">
				<h1>Administración</h1>
				<p>
					<span className="skeleton adm-sk-line" />
				</p>
			</header>
			<div className="adm-stats panel skeleton" aria-hidden="true">
				{["a", "b", "c", "d", "e"].map((k) => (
					<div className="stat" key={k}>
						<b>00</b>
						<span>cargando</span>
					</div>
				))}
			</div>
		</>
	);
}
