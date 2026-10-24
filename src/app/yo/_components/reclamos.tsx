"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PrizeClaimPlayer } from "@/components/motion/prize-claim";
import { reclamarAction } from "../actions";

export type ItemReclamo = {
	tipo: "figu" | "premio";
	ref: string;
	periodoId: string;
	titulo: string;
	detalle: string;
	rareza?: string;
	/** Claimed items: "24 de octubre". */
	cuando?: string;
};

const clave = (it: ItemReclamo) => `${it.tipo}|${it.ref}`;

export function Reclamos({
	pendientes,
	reclamados,
}: {
	pendientes: ItemReclamo[];
	reclamados: ItemReclamo[];
}) {
	const [, startTransition] = useTransition();
	const [enCurso, setEnCurso] = useState<string | null>(null);
	const [ultimo, setUltimo] = useState<ItemReclamo | null>(null);
	const [error, setError] = useState<string | null>(null);
	const dialogo = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		if (ultimo) dialogo.current?.showModal();
	}, [ultimo]);

	function reclamar(it: ItemReclamo) {
		setError(null);
		setEnCurso(clave(it));
		startTransition(async () => {
			const r = await reclamarAction({
				tipo: it.tipo,
				ref: it.ref,
				periodoId: it.periodoId,
			});
			setEnCurso(null);
			if ("error" in r) setError(r.error);
			else setUltimo(it);
		});
	}

	return (
		<>
			<h2 className="h2">
				Para reclamar <span>{pendientes.length}</span>
			</h2>
			{error && (
				<p className="yo-aviso" role="alert">
					{error}
				</p>
			)}
			{pendientes.length === 0 ? (
				<p className="note">
					No tenés nada para reclamar. Las figus y los premios aparecen acá
					cuando cierra el mes.
				</p>
			) : (
				<ul className="yo-items">
					{pendientes.map((it) => (
						<li key={clave(it)} className="yo-item">
							<Texto it={it} />
							<button
								type="button"
								className="btn"
								disabled={enCurso !== null}
								onClick={() => reclamar(it)}
							>
								{enCurso === clave(it) ? "Reclamando" : "Reclamar"}
							</button>
						</li>
					))}
				</ul>
			)}
			<h2 className="h2">
				Reclamadas <span>{reclamados.length}</span>
			</h2>
			{reclamados.length === 0 ? (
				<p className="note">Todavía no reclamaste nada.</p>
			) : (
				<ul className="yo-items">
					{reclamados.map((it) => (
						<li key={clave(it)} className="yo-item" data-hecho="">
							<Texto it={it} />
							<span className="yo-cuando">Reclamada el {it.cuando}</span>
						</li>
					))}
				</ul>
			)}
			<dialog
				ref={dialogo}
				className="yo-dialogo"
				aria-label="Reclamaste"
				onClose={() => setUltimo(null)}
			>
				{ultimo && (
					<PrizeClaimPlayer
						tipo={ultimo.tipo}
						titulo={ultimo.titulo}
						detalle={ultimo.detalle}
						rareza={ultimo.rareza}
					/>
				)}
				<form method="dialog">
					<button type="submit" className="btn">
						Listo
					</button>
				</form>
			</dialog>
		</>
	);
}

function Texto({ it }: { it: ItemReclamo }) {
	return (
		<span className="yo-item-texto">
			<span className="yo-tag" data-tipo={it.tipo}>
				{it.tipo === "figu" ? (it.rareza ?? "Figu") : "Premio"}
			</span>
			<b>{it.titulo}</b>
			<span>{it.detalle}</span>
		</span>
	);
}
