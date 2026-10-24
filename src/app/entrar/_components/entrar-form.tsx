"use client";

import { useActionState, useState } from "react";
import { entrar } from "../actions";

type Opcion = { id: string; nombre: string; sucursal: string };

export function EntrarForm({
	sucursales,
	vendedores,
}: {
	sucursales: { slug: string; nombre: string }[];
	vendedores: Opcion[];
}) {
	const [estado, action, pending] = useActionState(entrar, null);
	const [sucursal, setSucursal] = useState("");
	const [codigo, setCodigo] = useState("");
	const delSucursal = vendedores.filter((v) => v.sucursal === sucursal);

	return (
		<form action={action} className="panel en-form">
			<label className="en-field">
				<span>Sucursal</span>
				<select
					className="select"
					value={sucursal}
					onChange={(e) => {
						setSucursal(e.target.value);
						setCodigo("");
					}}
				>
					<option value="">Elegí tu sucursal</option>
					{sucursales.map((s) => (
						<option key={s.slug} value={s.slug}>
							{s.nombre}
						</option>
					))}
				</select>
			</label>
			<label className="en-field">
				<span>Vendedor</span>
				<select
					className="select"
					value={delSucursal.some((v) => v.id === codigo) ? codigo : ""}
					disabled={!sucursal}
					onChange={(e) => setCodigo(e.target.value)}
				>
					<option value="">
						{sucursal ? "Elegí tu nombre" : "Primero elegí la sucursal"}
					</option>
					{delSucursal.map((v) => (
						<option key={v.id} value={v.id}>
							{v.nombre}
						</option>
					))}
				</select>
			</label>
			<label className="en-field">
				<span>O escribí tu código</span>
				<input
					className="en-input"
					name="codigo"
					value={codigo}
					onChange={(e) => setCodigo(e.target.value.toUpperCase())}
					placeholder="V001"
					autoComplete="off"
					autoCapitalize="characters"
					spellCheck={false}
					maxLength={5}
					required
				/>
			</label>
			<label className="en-field">
				<span>PIN de 6 números</span>
				<input
					className="en-input"
					name="pin"
					type="password"
					inputMode="numeric"
					pattern="\d{6}"
					maxLength={6}
					autoComplete="one-time-code"
					aria-invalid={estado ? true : undefined}
					aria-describedby={estado ? "en-error" : undefined}
					required
				/>
			</label>
			{estado && (
				<p className="en-error" id="en-error" role="alert">
					{estado.error}
				</p>
			)}
			<button type="submit" className="btn" disabled={pending}>
				{pending ? "Entrando" : "Entrar a mi mes"}
			</button>
		</form>
	);
}
