"use client";

import { useEffect, useState } from "react";

const LABEL = {
	idle: "Copiar enlace",
	ok: "Enlace copiado",
	fail: "No se pudo copiar",
};

export function CopyLink() {
	const [state, setState] = useState<keyof typeof LABEL>("idle");
	useEffect(() => {
		if (state === "idle") return;
		const t = setTimeout(() => setState("idle"), 2000);
		return () => clearTimeout(t);
	}, [state]);
	return (
		<button
			type="button"
			className="btn btn-ghost"
			onClick={() =>
				navigator.clipboard.writeText(location.href).then(
					() => setState("ok"),
					() => setState("fail"),
				)
			}
		>
			{LABEL[state]}
		</button>
	);
}
