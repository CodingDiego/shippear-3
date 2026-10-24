import { FiguSkeleton } from "@/components/figu/figu";
import { ResortSkeleton } from "./resort-skeleton";

export function ControlsSkeleton() {
	return (
		<div aria-hidden="true">
			<div className="rk-controls">
				<span className="skeleton tabs" style={{ width: 288, height: 44 }} />
				<span className="skeleton select" style={{ width: 150 }} />
			</div>
			<div className="rk-controls">
				<span className="skeleton seg" style={{ width: 230 }} />
				<span className="skeleton select" style={{ width: 110 }} />
				<span className="skeleton seg" style={{ width: 168 }} />
				<span className="skeleton select" style={{ width: 150 }} />
				<span className="skeleton seg rk-end" style={{ width: 128 }} />
			</div>
		</div>
	);
}

function Rows({ n }: { n: number }) {
	return (
		<div className="rows">
			{Array.from({ length: n }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
				<div className="row" data-loading="" key={i}>
					<b>0</b>
					<div className="who">
						Nombre<span> sucursal</span>
					</div>
					<div className="pts">00</div>
				</div>
			))}
		</div>
	);
}

/** Vendedores in cartas view by default; `resort` reserves the País-scope animation. */
export function GridSkeleton({
	view,
	entidad = "vendedores",
	resort = true,
}: {
	view: "cartas" | "tabla";
	entidad?: "vendedores" | "sucursales" | "provincias";
	resort?: boolean;
}) {
	if (entidad !== "vendedores") {
		return (
			<div aria-busy="true">
				<h2 className="h2">Posiciones</h2>
				<Rows n={entidad === "provincias" ? 10 : 16} />
			</div>
		);
	}
	return (
		<div aria-busy="true">
			{resort && <ResortSkeleton />}
			<h2 className="h2">Podio</h2>
			<div className="podium">
				{[0, 1, 2].map((i) => (
					<FiguSkeleton key={i} />
				))}
			</div>
			<h2 className="h2">Todas las cartas</h2>
			{view === "tabla" ? (
				<Rows n={24} />
			) : (
				<div className="grid-figus">
					{Array.from({ length: 24 }, (_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
						<FiguSkeleton key={i} />
					))}
				</div>
			)}
		</div>
	);
}
