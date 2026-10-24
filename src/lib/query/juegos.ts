import { queryOptions } from "@tanstack/react-query";
import type { JuegosVista } from "@/app/admin/juegos/data";

/** Admin games measures (admin cookie). 401 without a session. */
export const juegosMedidasOptions = () =>
	queryOptions({
		queryKey: ["juegos", "medidas"],
		queryFn: async ({ signal }) => {
			const res = await fetch("/admin/juegos/medidas", { signal });
			if (!res.ok) throw new Error(`juegos ${res.status}`);
			return (await res.json()) as JuegosVista;
		},
		staleTime: 60_000,
	});
