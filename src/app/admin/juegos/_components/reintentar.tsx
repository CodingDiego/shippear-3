"use client";

import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErrorBoundary } from "@/components/error-boundary";

/** Error boundary for the measures queries, with a retry button. */
export function ConReintento({ children }: { children: ReactNode }) {
	return (
		<ErrorBoundary fallback={(reset) => <Reintentar reset={reset} />}>
			{children}
		</ErrorBoundary>
	);
}

function Reintentar({ reset }: { reset: () => void }) {
	const query = useQueryErrorResetBoundary();
	return (
		<div className="panel" role="alert">
			<p>No pudimos cargar las medidas de los juegos.</p>
			<button
				type="button"
				className="btn btn-ghost mt-3"
				onClick={() => {
					query.reset();
					reset();
				}}
			>
				Volver a cargar las medidas
			</button>
		</div>
	);
}
