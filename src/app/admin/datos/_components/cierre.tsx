"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import type { EstadoCierre } from "@/lib/cierre/calc";
import { mesNombre } from "@/lib/format";
import {
	type CierreResponse,
	cierreOptions,
	cierreTerminado,
} from "@/lib/query/admin";
import { iniciarCierre, reiniciarDemo, verCierre } from "../actions";

type Corrida = { runId: string; periodoId: string };

const ESTADO_RUN: Record<CierreResponse["status"], string> = {
	pending: "En cola",
	running: "Corriendo",
	completed: "Terminó",
	failed: "Falló",
	cancelled: "Se canceló",
};

export function Pasos({
	estado,
	status,
}: {
	estado: EstadoCierre;
	status?: CierreResponse["status"];
}) {
	const pasos = [
		[
			estado.pasos.dias,
			`Días hábiles con datos: ${estado.diasConDatos} de ${estado.diasHabiles}`,
		],
		[
			estado.pasos.cerrado,
			`Resultados de ${mesNombre(estado.periodoId)} cerrados`,
		],
		[estado.pasos.constancias, "Constancia recalculada al último día del mes"],
	] as const;
	return (
		<div className="adm-pasos">
			{status && (
				<p className="stamp" role="status">
					Estado de la corrida: {ESTADO_RUN[status]}
				</p>
			)}
			<ol>
				{pasos.map(([hecho, texto]) => (
					<li key={texto} data-hecho={hecho || undefined}>
						<span aria-hidden="true">{hecho ? "✓" : "·"}</span>
						{texto}
						<span className="sr-only">{hecho ? ", hecho" : ", pendiente"}</span>
					</li>
				))}
			</ol>
		</div>
	);
}

function Progreso({ corrida }: { corrida: Corrida }) {
	const { data } = useSuspenseQuery(
		cierreOptions(corrida.runId, corrida.periodoId),
	);
	const avisado = useRef(false);
	const fin = cierreTerminado(data.status);
	useEffect(() => {
		// The workflow revalidates with stale-while-revalidate; this shows the closed month now.
		if (fin && !avisado.current) {
			avisado.current = true;
			void verCierre();
		}
	}, [fin]);
	return (
		<>
			<Pasos estado={data.estado} status={data.status} />
			{data.status === "failed" && (
				<p className="adm-error" role="alert">
					El cierre se cortó. Cada paso se puede repetir sin duplicar datos:
					volvé a simular el cierre.
				</p>
			)}
		</>
	);
}

export function SimularCierre({
	periodoId,
	estado,
}: {
	periodoId: string | null;
	estado: EstadoCierre | null;
}) {
	const [corrida, setCorrida] = useState<Corrida | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [iniciando, startTransition] = useTransition();

	const iniciar = () =>
		startTransition(async () => {
			setError(null);
			const r = await iniciarCierre();
			if (r.error !== null) setError(r.error);
			else setCorrida({ runId: r.runId, periodoId: r.periodoId });
		});

	return (
		<div className="panel adm-cierre">
			{corrida ? (
				<ErrorBoundary
					fallback={(reset) => (
						<div role="alert">
							<p className="adm-error">No pudimos leer el avance del cierre.</p>
							<button type="button" className="btn btn-ghost" onClick={reset}>
								Volver a consultar
							</button>
						</div>
					)}
				>
					<Suspense
						fallback={
							estado ? <Pasos estado={estado} status="pending" /> : null
						}
					>
						<Progreso corrida={corrida} />
					</Suspense>
				</ErrorBoundary>
			) : periodoId && estado ? (
				<>
					<Pasos estado={estado} />
					<div className="adm-actions">
						<button
							type="button"
							className="btn"
							disabled={iniciando}
							onClick={iniciar}
						>
							{iniciando ? "Iniciando…" : `Cerrar ${mesNombre(periodoId)}`}
						</button>
					</div>
				</>
			) : (
				<p className="note">
					No hay un mes en curso: el último ya está cerrado. Reiniciá la demo
					para volver a abrir el mes.
				</p>
			)}
			{error && (
				<p className="adm-error" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}

export function ReiniciarDemo() {
	const [confirmando, setConfirmando] = useState(false);
	const [hecho, setHecho] = useState(false);
	const [reiniciando, startTransition] = useTransition();
	const reiniciar = () =>
		startTransition(async () => {
			await reiniciarDemo();
			setConfirmando(false);
			setHecho(true);
		});
	return (
		<div className="panel adm-csv">
			{confirmando ? (
				<>
					<p>
						Se borran todos los datos, los reclamos y los cambios de métricas,
						juegos y premios, y se vuelven a generar los de la demo. Tarda cerca
						de dos minutos.
					</p>
					<div className="adm-actions">
						<button
							type="button"
							className="btn"
							disabled={reiniciando}
							onClick={reiniciar}
						>
							{reiniciando
								? "Reiniciando, no cierres la página…"
								: "Sí, reiniciar la demo"}
						</button>
						<button
							type="button"
							className="btn btn-ghost"
							disabled={reiniciando}
							onClick={() => setConfirmando(false)}
						>
							Cancelar
						</button>
					</div>
				</>
			) : (
				<>
					{hecho && (
						<p className="adm-ok" role="status">
							Demo reiniciada: el mes en curso está abierto de nuevo.
						</p>
					)}
					<div className="adm-actions">
						<button
							type="button"
							className="btn btn-ghost"
							onClick={() => {
								setHecho(false);
								setConfirmando(true);
							}}
						>
							Reiniciar demo
						</button>
					</div>
				</>
			)}
		</div>
	);
}
