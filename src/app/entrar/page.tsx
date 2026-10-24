import { Suspense } from "react";
import "./entrar.css";
import { getDataset } from "@/lib/data/queries";
import { fullName } from "@/lib/format";
import { EntrarForm } from "./_components/entrar-form";

export const metadata = { title: "Entrar" };

export default function Page() {
	return (
		<main className="wrap en">
			<div className="title">
				<h1>Entrar a mi mes</h1>
				<p>
					Elegí tu sucursal y tu nombre, o escribí tu código. Después poné tu
					PIN.
				</p>
			</div>
			<Suspense fallback={<div className="panel en-form skeleton" />}>
				<Formulario />
			</Suspense>
			<p className="note en-note">
				Es una demo con datos de prueba. Pedile tu PIN a tu jefe de sucursal.
			</p>
		</main>
	);
}

async function Formulario() {
	const d = await getDataset();
	const sucursales = [...d.sucursales]
		.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
		.map(({ slug, nombre }) => ({ slug, nombre }));
	const vendedores = [...d.vendedores]
		.sort((a, b) => a.apellido.localeCompare(b.apellido, "es"))
		.map((v) => ({ id: v.id, nombre: fullName(v), sucursal: v.sucursal }));
	return <EntrarForm sucursales={sucursales} vendedores={vendedores} />;
}
