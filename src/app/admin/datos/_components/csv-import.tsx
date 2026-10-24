"use client";

import { useState, useTransition } from "react";
import { periodoLargo } from "@/lib/format";
import { type Revision, revisarCsv } from "../actions";

const n = new Intl.NumberFormat("es-AR");

export function CsvImport() {
	// The File lives in state: React resets a form after an action, and the same file is
	// sent twice (review, then apply).
	const [archivo, setArchivo] = useState<File | null>(null);
	const [rev, setRev] = useState<Revision>({ estado: "vacio" });
	const [enviando, startTransition] = useTransition();

	const enviar = (aplicar: boolean) =>
		startTransition(async () => {
			if (!archivo) return;
			const fd = new FormData();
			fd.set("archivo", archivo);
			if (aplicar) fd.set("aplicar", "si");
			setRev(await revisarCsv(rev, fd));
		});

	return (
		<div className="panel adm-csv">
			<label className="adm-field">
				<span>Archivo CSV</span>
				<input
					type="file"
					accept=".csv,text/csv"
					className="adm-file"
					onChange={(e) => {
						setArchivo(e.target.files?.[0] ?? null);
						setRev({ estado: "vacio" });
					}}
				/>
			</label>
			<div className="adm-actions">
				<button
					type="button"
					className="btn btn-ghost"
					disabled={!archivo || enviando}
					onClick={() => enviar(false)}
				>
					{enviando && rev.estado !== "listo"
						? "Revisando…"
						: "Revisar el archivo"}
				</button>
			</div>

			{rev.estado === "error" && (
				<div className="adm-error" role="alert">
					<p>{rev.mensaje}</p>
					{rev.errores.length > 0 && (
						<ul className="adm-errores">
							{rev.errores.slice(0, 10).map((e) => (
								<li key={`${e.row}-${e.message}`}>
									Fila {e.row}: {e.message}
								</li>
							))}
						</ul>
					)}
				</div>
			)}

			{(rev.estado === "listo" || rev.estado === "aplicado") && (
				<div className="adm-resumen" role="status">
					<p>
						<b>{rev.archivo}</b>: {n.format(rev.vendedores)} vendedores,{" "}
						{n.format(rev.mensuales)} filas mensuales
						{rev.diarias > 0 && `, ${n.format(rev.diarias)} filas diarias`}
						{rev.planes > 0 && `, ${n.format(rev.planes)} planes de venta`}.
						{rev.meses.length > 0 &&
							` Meses: de ${periodoLargo(rev.meses[0])} a ${periodoLargo(rev.meses.at(-1) ?? rev.meses[0])}.`}
					</p>
					{rev.estado === "listo" ? (
						<>
							<p className="note">
								Al aplicarlo se reemplazan todos los vendedores y sus
								resultados, y se borran los reclamos y la actividad de los
								juegos.
							</p>
							<div className="adm-actions">
								<button
									type="button"
									className="btn"
									disabled={enviando}
									onClick={() => enviar(true)}
								>
									{enviando
										? "Reemplazando…"
										: "Reemplazar los datos con este archivo"}
								</button>
							</div>
						</>
					) : (
						<p className="adm-ok">Listo: los datos ya son los del archivo.</p>
					)}
				</div>
			)}
		</div>
	);
}
