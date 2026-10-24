import { queryOptions } from "@tanstack/react-query";
import type {
	Canal,
	ScoredProvincia,
	ScoredSucursal,
	ScoredVendedor,
	Tracker,
	Ventana,
	Vista,
} from "@/lib/domain";

export type RankingParams = {
	periodo: string;
	vista: Vista;
	/** Sucursal scope (slug); "" = no filter. */
	sucursal: string;
	canal: Canal | null;
	/** Province scope (slug); "" or absent = nacional. */
	provincia?: string;
};

export type RankingResponse = {
	periodoId: string;
	vista: Vista;
	/** Vendedores in the period before the scope/canal filter. */
	de: number;
	/** In scope, by puesto (the filtered order equals the in-scope rank). */
	vendedores: ScoredVendedor[];
	/** In the province scope when set, else every sucursal; by puesto. */
	sucursales: ScoredSucursal[];
	/** Every province, ranked nationally. */
	provincias: ScoredProvincia[];
};

export const rankingOptions = (p: RankingParams) =>
	queryOptions({
		queryKey: ["ranking", p],
		queryFn: async ({ signal }) => {
			const qs = new URLSearchParams({
				periodo: p.periodo,
				vista: p.vista,
				sucursal: p.sucursal,
				canal: p.canal ?? "",
				provincia: p.provincia ?? "",
			});
			const res = await fetch(`/api/ranking?${qs}`, { signal });
			if (!res.ok) throw new Error(`ranking ${res.status}`);
			return (await res.json()) as RankingResponse;
		},
		staleTime: 60_000,
	});

export type TrackerResponse = Tracker;

/** The logged-in seller's tracker (seller from the cookie). 401 without a session. */
export const trackerOptions = (ventana: Ventana) =>
	queryOptions({
		queryKey: ["tracker", ventana],
		queryFn: async ({ signal }) => {
			const res = await fetch(`/api/tracker?ventana=${ventana}`, { signal });
			if (!res.ok) throw new Error(`tracker ${res.status}`);
			return (await res.json()) as TrackerResponse;
		},
		staleTime: 60_000,
	});
