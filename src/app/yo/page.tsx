import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { type CSSProperties, Suspense } from "react";
import "./yo.css";
import { Figu, FiguSkeleton, type Foil } from "@/components/figu/figu";
import { vendedorSesion } from "@/lib/auth/server";
import {
	getDataset,
	getFigusV2,
	getJuegosConfig,
	getMetricas,
	getScoredPeriod,
	getSeasonMeta,
	getTracker,
	reclamables,
} from "@/lib/data/queries";
import {
	CONSTANCIA_ID,
	JUEGO_LABEL,
	JUEGOS,
	type JuegoId,
	PROVINCIA_BY_SLUG,
	provinciaDe,
	type Rareza,
	type Tracker,
	tierOf,
} from "@/lib/domain";
import {
	canalNombre,
	fullName,
	pct,
	periodoLargo,
	sucursalNombre,
} from "@/lib/format";
import { juegoActivo } from "@/lib/games";
import { type ItemReclamo, Reclamos } from "./_components/reclamos";
import { RegistrarVista } from "./_components/registrar-vista";
import { TrackerTabs } from "./_components/tracker-tabs";
import { salirAction } from "./actions";

export const metadata = { title: "Mi mes" };

const RAREZA: Record<Rareza, string> = {
	legendaria: "Legendaria",
	epica: "Épica",
	rara: "Rara",
	comun: "Común",
};
const RAREZA_PLURAL: Record<Rareza, string> = {
	legendaria: "legendarias",
	epica: "épicas",
	rara: "raras",
	comun: "comunes",
};
const PAGINA: Record<JuegoId, string> = {
	liga: "/liga",
	revelacion: "/revelacion",
	album: "/album",
};
const FOIL: Foil[] = ["oro", "plata", "bronce"];

const pts = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const fecha = new Intl.DateTimeFormat("es-AR", {
	day: "numeric",
	month: "long",
	timeZone: "America/Argentina/Buenos_Aires",
});
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Page() {
	return (
		<main className="wrap">
			<Suspense fallback={<YoSkeleton />}>
				<Yo />
			</Suspense>
		</main>
	);
}

async function Yo() {
	// verifySession reads Date.now(); without this the prerender flags it.
	await connection();
	const id = await vendedorSesion();
	if (!id) redirect("/entrar");
	const [d, meta] = await Promise.all([getDataset(), getSeasonMeta()]);
	const v = d.vendedores.find((x) => x.id === id);
	if (!v) redirect("/entrar");
	const periodo = meta.enCurso ?? meta.latest;
	const [mes, semana, scored, juegos] = await Promise.all([
		getTracker(id, "mes"),
		getTracker(id, "semana"),
		getScoredPeriod(periodo, "mes"),
		getJuegosConfig(),
	]);
	const sv = scored.vendedores.find((x) => x.vendedor.id === id);
	const provincia = PROVINCIA_BY_SLUG[provinciaDe(v.sucursal) ?? ""]?.nombre;
	const constancia = mes.metricas.find((m) => m.metrica === CONSTANCIA_ID);
	const activos = JUEGOS.filter((j) =>
		juegoActivo(juegos, j, v.sucursal, periodo),
	);
	const foil =
		sv?.puesto != null && sv.puesto <= 3 ? FOIL[sv.puesto - 1] : undefined;

	return (
		<>
			<RegistrarVista />
			<header className="title yo-title">
				<div>
					<h1>{fullName(v)}</h1>
					<p>
						{sucursalNombre(v.sucursal)}
						{provincia ? `, ${provincia}` : ""}. Zona{" "}
						{mayuscula(canalNombre(v.canal))}.
					</p>
				</div>
				<form action={salirAction}>
					<button type="submit" className="btn btn-ghost">
						Salir
					</button>
				</form>
			</header>

			<div className="yo-layout">
				<div className="yo-main">
					<section className="panel yo-panel">
						<TrackerTabs
							mes={<TrackerPanel t={mes} />}
							semana={<TrackerPanel t={semana} />}
						/>
					</section>

					<section className="panel yo-stats">
						<div
							className="stat"
							data-tier={tierOf(constancia?.puntos ?? null) ?? undefined}
						>
							<b>{pct(constancia?.valor ?? null)}</b>
							<span>Constancia, meta {pct(constancia?.objetivo ?? null)}</span>
						</div>
						<p className="note yo-stat-note">
							Mide si vendés parejo: compara tus ventas de cada 30 días de los
							últimos 90.
						</p>
					</section>

					<section className="panel">
						<h2 className="h2 yo-h2-top">
							Tus puestos <span>{periodoLargo(periodo)}</span>
						</h2>
						<div className="yo-puestos">
							<Puesto n={sv?.puesto} de={sv?.de} donde="en el país" />
							<Puesto
								n={sv?.puestoProvincia}
								de={sv?.deProvincia}
								donde="en tu provincia"
							/>
							<Puesto
								n={sv?.puestoSucursal}
								de={sv?.deSucursal}
								donde="en tu sucursal"
							/>
						</div>
					</section>

					{activos.length > 0 && (
						<p className="note">
							Juegos en tu sucursal este mes:{" "}
							{activos.map((j, i) => (
								<span key={j}>
									{i > 0 ? ", " : ""}
									<Link href={PAGINA[j]}>{JUEGO_LABEL[j]}</Link>
								</span>
							))}
							.
						</p>
					)}
				</div>

				<aside className="yo-side">
					<h2 className="h2 yo-h2-top">Tu carta de este mes</h2>
					{sv ? (
						<Figu v={sv} foil={foil} className="yo-figu" />
					) : (
						<p className="note">Todavía no hay datos para tu carta.</p>
					)}
				</aside>
			</div>

			<Suspense fallback={<TemporadaSkeleton />}>
				<Temporada id={id} />
			</Suspense>
		</>
	);
}

function Puesto({
	n,
	de,
	donde,
}: {
	n: number | null | undefined;
	de: number | undefined;
	donde: string;
}) {
	return (
		<div className="stat">
			<b>{n ?? "–"}</b>
			<span>{n ? `de ${de} ${donde}` : `Sin puesto ${donde}`}</span>
		</div>
	);
}

function TrackerPanel({ t }: { t: Tracker }) {
	const del = t.ventana === "mes" ? "del mes" : "de la semana";
	const cierre = t.ventana === "mes" ? "el mes" : "la semana";
	const quedan = t.diasHabiles - t.diasTranscurridos;
	const llego = t.score !== null && t.faltan === 0;
	const barra = {
		"--valor": (t.score ?? 0) / 100,
		"--meta": t.meta / 100,
	} as CSSProperties;

	return (
		<div className="yo-tracker">
			<p className="yo-lead">
				{t.score === null
					? `Todavía no hay datos suficientes ${del}`
					: llego
						? `Llegaste a la meta ${del}`
						: `Te faltan ${pts.format(t.faltan)} puntos para tu meta ${del}`}
			</p>
			<div className="tracker" data-done={llego ? "" : undefined} style={barra}>
				<p className="tracker-label">
					<b>
						{t.score === null ? "Sin datos" : `${pts.format(t.score)} puntos`}
					</b>
					<span>meta {t.meta}</span>
				</p>
				<div className="tracker-bar" />
				<p className="tracker-note">
					{t.proyeccion !== null &&
						`A este ritmo cerrás ${cierre} con ${pts.format(t.proyeccion)} puntos. `}
					{quedan <= 0
						? `Hoy es el último día hábil de ${cierre}.`
						: `Quedan ${quedan} ${quedan === 1 ? "día hábil" : "días hábiles"}.`}
				</p>
			</div>
			{t.sugerencias.length > 0 && (
				<>
					<p className="yo-sug-titulo">
						{llego ? "Para sumar una figu" : "Lo que más te acerca"}
					</p>
					<ul className="yo-sug">
						{t.sugerencias.map((s) => (
							<li key={s.metrica}>{s.texto}</li>
						))}
					</ul>
				</>
			)}
			{t.mensaje ? (
				<p className="yo-aviso">{t.mensaje}</p>
			) : (
				t.inalcanzable && (
					<p className="yo-aviso">
						Con lo que queda {del} no alcanza para la meta. Cada punto que sumes
						igual te sube en el ranking.
					</p>
				)
			)}
		</div>
	);
}

async function Temporada({ id }: { id: string }) {
	const [figus, claims, defs] = await Promise.all([
		getFigusV2(),
		reclamables(id),
		getMetricas(),
	]);
	const mias = figus.filter((f) => f.vendedorId === id);
	const nombre = new Map(defs.map((m) => [m.id, m.nombre]));
	const porRareza = (Object.keys(RAREZA) as Rareza[])
		.map((r) => [r, mias.filter((f) => f.rareza === r).length] as const)
		.filter(([, n]) => n > 0);
	const holo = mias.filter((f) => f.holografica).length;

	const item = (r: (typeof claims.pendientes)[number]): ItemReclamo => {
		const base = { tipo: r.tipo, ref: r.ref, periodoId: r.periodoId };
		const mesTexto = mayuscula(periodoLargo(r.periodoId));
		if (r.tipo === "figu") {
			const f = r.figu;
			return {
				...base,
				titulo: `Figu de ${nombre.get(f.metrica) ?? f.metrica}`,
				detalle: [
					mesTexto,
					f.holografica ? "holográfica" : "",
					f.medalla ? `edición ${f.medalla}` : "",
				]
					.filter(Boolean)
					.join(", "),
				rareza: RAREZA[f.rareza],
			};
		}
		return {
			...base,
			titulo: r.premio.descripcion,
			detalle: `${JUEGO_LABEL[r.juego]}, ${periodoLargo(r.periodoId)}${r.premio.simulado ? ", premio de prueba" : ""}`,
		};
	};

	return (
		<div className="yo-temporada">
			<section className="panel">
				<div className="stat">
					<b>{mias.length}</b>
					<span>figus ganadas esta temporada</span>
				</div>
				{mias.length > 0 && (
					<p className="note yo-stat-note">
						{porRareza
							.map(
								([r, n]) =>
									`${n} ${n === 1 ? RAREZA[r].toLowerCase() : RAREZA_PLURAL[r]}`,
							)
							.join(", ")}
						{holo > 0
							? `. ${holo} ${holo === 1 ? "holográfica" : "holográficas"}.`
							: "."}
					</p>
				)}
			</section>
			<section className="yo-claims">
				<Reclamos
					pendientes={claims.pendientes.map(item)}
					reclamados={claims.reclamados.map((r) => ({
						...item(r),
						cuando: fecha.format(new Date(r.reclamadoAt)),
					}))}
				/>
			</section>
		</div>
	);
}

function TemporadaSkeleton() {
	return (
		<div className="yo-temporada">
			<div className="panel skeleton" style={{ height: 120 }} />
			<div className="yo-claims">
				<h2 className="h2">Para reclamar</h2>
				<div className="skeleton" style={{ height: 220 }} />
			</div>
		</div>
	);
}

function YoSkeleton() {
	return (
		<>
			<header className="title yo-title">
				<div>
					<h1 className="skeleton">Cargando tu mes</h1>
					<p className="skeleton">Cargando</p>
				</div>
			</header>
			<div className="yo-layout">
				<div className="yo-main">
					<div className="panel skeleton" style={{ height: 300 }} />
					<div className="panel skeleton" style={{ height: 110 }} />
					<div className="panel skeleton" style={{ height: 140 }} />
				</div>
				<aside className="yo-side">
					<h2 className="h2 yo-h2-top">Tu carta de este mes</h2>
					<FiguSkeleton className="yo-figu" />
				</aside>
			</div>
			<TemporadaSkeleton />
		</>
	);
}
