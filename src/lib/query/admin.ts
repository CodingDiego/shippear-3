import { queryOptions } from "@tanstack/react-query";
import type { EstadoCierre } from "@/lib/cierre/calc";

export type CierreResponse = {
	status: "pending" | "running" | "completed" | "failed" | "cancelled";
	estado: EstadoCierre;
};

export const cierreTerminado = (s: CierreResponse["status"] | undefined) =>
	s === "completed" || s === "failed" || s === "cancelled";

/** Polls a "Simular cierre de mes" run every second until it ends. Admin cookie required. */
export const cierreOptions = (runId: string, periodoId: string) =>
	queryOptions({
		queryKey: ["admin", "cierre", runId, periodoId],
		queryFn: async ({ signal }) => {
			const qs = new URLSearchParams({ periodo: periodoId });
			const res = await fetch(
				`/api/admin/cierre/${encodeURIComponent(runId)}?${qs}`,
				{ signal },
			);
			if (!res.ok) throw new Error(`cierre ${res.status}`);
			return (await res.json()) as CierreResponse;
		},
		staleTime: 0,
		refetchInterval: (q) =>
			cierreTerminado(q.state.data?.status) ? false : 1000,
	});
