"use client";

import { useActionState } from "react";
import { type Ajustes, TIER_MIN } from "@/lib/domain";
import { agregarMetrica, guardarAjustes, type Resultado } from "../actions";

const inicial: Resultado = { error: null };

function Mensaje({ res }: { res: Resultado }) {
	if (res.error)
		return (
			<p className="adm-error" role="alert">
				{res.error}
			</p>
		);
	if (res.ok)
		return (
			<p className="adm-ok" role="status">
				{res.ok}
			</p>
		);
	return null;
}

export function AjustesForm({ ajustes }: { ajustes: Ajustes }) {
	const [res, accion, enviando] = useActionState(guardarAjustes, inicial);
	return (
		<form action={accion} className="panel adm-form">
			<label className="adm-field">
				<span>Meta del mes (puntos)</span>
				<input
					className="adm-input"
					name="meta_puntos"
					type="number"
					min={1}
					max={100}
					step={1}
					defaultValue={ajustes.meta_puntos}
					required
				/>
			</label>
			<label className="adm-field">
				<span>Margen por kilo vendido ($)</span>
				<input
					className="adm-input"
					name="valor_kg_ars"
					type="number"
					min={0}
					step={1}
					defaultValue={ajustes.valor_kg_ars}
					required
				/>
			</label>
			<p className="note adm-span">
				Niveles de la carta: Arriba desde {TIER_MIN.verde} puntos, En carrera
				desde {TIER_MIN.amarillo}, Abajo por debajo. Los niveles son fijos; la
				meta es lo que ve cada vendedor en su seguimiento.
			</p>
			<div className="adm-span adm-actions">
				<button type="submit" className="btn" disabled={enviando}>
					{enviando ? "Guardando…" : "Guardar meta y margen"}
				</button>
			</div>
			<Mensaje res={res} />
		</form>
	);
}

export function NuevaMetricaForm() {
	const [res, accion, enviando] = useActionState(agregarMetrica, inicial);
	return (
		<form action={accion} className="panel adm-form">
			<label className="adm-field">
				<span>Nombre</span>
				<input
					className="adm-input"
					name="nombre"
					required
					minLength={3}
					maxLength={40}
					placeholder="Exhibiciones armadas"
				/>
			</label>
			<label className="adm-field">
				<span>Unidad</span>
				<input
					className="adm-input"
					name="unidad"
					required
					maxLength={20}
					placeholder="exhibiciones"
				/>
			</label>
			<label className="adm-field">
				<span>Qué se cuenta</span>
				<input
					className="adm-input"
					name="num"
					required
					minLength={3}
					maxLength={80}
					placeholder="exhibiciones armadas"
				/>
			</label>
			<label className="adm-field">
				<span>Sobre qué total</span>
				<input
					className="adm-input"
					name="den"
					required
					minLength={3}
					maxLength={80}
					placeholder="exhibiciones pedidas"
				/>
			</label>
			<label className="adm-field">
				<span>Peso</span>
				<input
					className="adm-input"
					name="peso"
					type="number"
					min={0}
					max={10}
					step={0.01}
					defaultValue={0.05}
					required
				/>
			</label>
			<label className="adm-field">
				<span>Objetivo (%)</span>
				<input
					className="adm-input"
					name="objetivo"
					type="number"
					min={0}
					max={1000}
					step={0.1}
					defaultValue={90}
					required
				/>
			</label>
			<label className="adm-field">
				<span>Mejor si es</span>
				<select className="select" name="direccion" defaultValue="mayor">
					<option value="mayor">Más alto</option>
					<option value="menor">Más bajo</option>
				</select>
			</label>
			<label className="adm-field">
				<span>Sugerencia al vendedor</span>
				<input
					className="adm-input"
					name="accion"
					maxLength={80}
					placeholder="Armá {n} exhibiciones más"
				/>
			</label>
			<p className="note adm-span">
				En la sugerencia, {"{n}"} se reemplaza por la cantidad que le falta al
				vendedor. Si la dejás vacía se usa «Sumá {"{n}"}» y lo que se cuenta. La
				métrica suma puntos cuando lleguen sus datos por CSV.
			</p>
			<label className="adm-span adm-check">
				<input type="checkbox" name="activa" /> Activarla ya
			</label>
			<div className="adm-span adm-actions">
				<button type="submit" className="btn" disabled={enviando}>
					{enviando ? "Agregando…" : "Agregar métrica"}
				</button>
			</div>
			<Mensaje res={res} />
		</form>
	);
}
