"use client";

import { useActionState } from "react";
import { entrar } from "../actions";

export function LoginForm() {
	const [estado, accion, enviando] = useActionState(entrar, { error: null });
	return (
		<form action={accion} className="panel adm-login">
			<label htmlFor="clave">Clave de administración</label>
			<input
				id="clave"
				name="clave"
				type="password"
				autoComplete="current-password"
				required
				className="adm-input"
			/>
			{estado.error && (
				<p className="adm-error" role="alert">
					{estado.error}
				</p>
			)}
			<button type="submit" className="btn" disabled={enviando}>
				{enviando ? "Entrando…" : "Entrar a la administración"}
			</button>
		</form>
	);
}
