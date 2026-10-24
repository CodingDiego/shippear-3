import { FiguSkeleton } from "@/components/figu/figu";

export function ControlsSkeleton() {
	return (
		<div className="rk-controls" aria-hidden="true">
			<span className="skeleton select" style={{ width: 110 }} />
			<span className="skeleton seg" style={{ width: 168 }} />
			<span className="skeleton select" style={{ width: 210 }} />
			<span className="skeleton select" style={{ width: 150 }} />
			<span className="skeleton seg rk-end" style={{ width: 128 }} />
		</div>
	);
}

export function GridSkeleton({ view }: { view: "cartas" | "tabla" }) {
	return (
		<div aria-busy="true">
			<h2 className="h2">Podio</h2>
			<div className="podium">
				{[0, 1, 2].map((i) => (
					<FiguSkeleton key={i} />
				))}
			</div>
			<h2 className="h2">Todas las cartas</h2>
			{view === "tabla" ? (
				<div className="rows">
					{Array.from({ length: 24 }, (_, i) => (
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
