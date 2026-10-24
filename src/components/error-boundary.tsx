"use client";

import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Component, type ReactNode } from "react";

type Props = {
	fallback: (reset: () => void) => ReactNode;
	children: ReactNode;
};

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
	state = { error: null as Error | null };

	static getDerivedStateFromError(error: Error) {
		return { error };
	}

	reset = () => this.setState({ error: null });

	render() {
		return this.state.error
			? this.props.fallback(this.reset)
			: this.props.children;
	}
}

export function QueryErrorFallback({ reset }: { reset: () => void }) {
	const query = useQueryErrorResetBoundary();
	return (
		<div className="panel" role="alert">
			<p>No pudimos cargar el ranking.</p>
			<button
				type="button"
				className="btn-ghost mt-3"
				onClick={() => {
					query.reset();
					reset();
				}}
			>
				Reintentar
			</button>
		</div>
	);
}
