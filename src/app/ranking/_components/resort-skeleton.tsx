import { mesNombre } from "@/lib/format";

export function ResortHeading({ de, a }: { de?: string; a?: string }) {
	return (
		<h2 className="h2">
			Así cambió el top 5 contra el mes anterior
			{de && a && (
				<span>
					{mesNombre(de)} a {mesNombre(a)}
				</span>
			)}
		</h2>
	);
}

/** Same footprint as the loaded block, so nothing moves when the Player arrives. */
export function ResortSkeleton() {
	return (
		<div aria-hidden="true">
			<ResortHeading />
			<div className="rk-resort skeleton" />
			<div className="rk-replay" />
		</div>
	);
}
