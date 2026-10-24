import { Suspense } from "react";
import { estadoCierre } from "@/lib/cierre";
import { CSV_COLUMNS } from "@/lib/domain";
import { exigirAdmin } from "../_lib/guard";
import { ReiniciarDemo, SimularCierre } from "./_components/cierre";
import { CsvImport } from "./_components/csv-import";
import { mesAbierto } from "./data";

export const metadata = { title: "Datos" };

export default function DatosPage() {
	return (
		<main className="wrap adm-main">
			<header className="title">
				<h1>Datos</h1>
				<p>
					Cargá resultados desde un CSV, bajá los actuales, cerrá el mes en
					curso o volvé la demo a su estado inicial.
				</p>
			</header>
			<Suspense fallback={<DatosSkeleton />}>
				<Datos />
			</Suspense>
		</main>
	);
}

async function Datos() {
	await exigirAdmin();
	const { periodoId } = await mesAbierto();
	const estado = periodoId ? await estadoCierre(periodoId) : null;
	return (
		<>
			<h2 className="h2">Simular cierre de mes</h2>
			<p className="note adm-lead">
				Completa los días hábiles que faltan del mes en curso con datos
				generados, cierra el mes y calcula sus figus y su Constancia, como lo
				haría el cierre real.
			</p>
			<SimularCierre periodoId={periodoId} estado={estado} />

			<h2 className="h2">Importar CSV</h2>
			<p className="note adm-lead">
				Columnas: <code>{CSV_COLUMNS.join(", ")}</code>. Opcionales:{" "}
				<code>fecha</code> (YYYY-MM-DD, para filas diarias) y <code>plan</code>{" "}
				(kilos objetivo del mes en las filas de venta). Primero se revisa el
				archivo; nada cambia hasta que confirmes.
			</p>
			<CsvImport />

			<h2 className="h2">Exportar CSV</h2>
			<div className="panel adm-csv">
				<p>
					Los resultados mensuales de todos los vendedores, en el mismo formato.
				</p>
				<div className="adm-actions">
					<a className="btn btn-ghost" href="/api/admin/export" download>
						Descargar resultados en CSV
					</a>
				</div>
			</div>

			<h2 className="h2">Reiniciar demo</h2>
			<ReiniciarDemo />
		</>
	);
}

function DatosSkeleton() {
	return (
		<>
			<h2 className="h2">Simular cierre de mes</h2>
			<div className="panel skeleton adm-sk-block" aria-hidden="true" />
			<h2 className="h2">Importar CSV</h2>
			<div className="panel skeleton adm-sk-block" aria-hidden="true" />
		</>
	);
}
