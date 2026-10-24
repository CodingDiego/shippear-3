import Link from "next/link";
import { FiguBody, type FiguData, type Foil, figuLabel } from "./figu-body";

export { FiguBody, type FiguData, type Foil, figuLabel };

type Props = {
	v: FiguData;
	/** Podium and album only. */
	foil?: Foil;
	/** When set, the card is a link to that page. */
	href?: string;
	className?: string;
};

export function Figu({ v, foil, href, className }: Props) {
	const cls = className ? `figu ${className}` : "figu";
	if (href) {
		return (
			<Link
				className={cls}
				href={href}
				data-tier={v.tier ?? undefined}
				data-foil={foil}
				aria-label={`${figuLabel(v)} Abrir la carta.`}
			>
				<FiguBody v={v} />
			</Link>
		);
	}
	return (
		<article
			className={cls}
			data-tier={v.tier ?? undefined}
			data-foil={foil}
			aria-label={figuLabel(v)}
		>
			<FiguBody v={v} />
		</article>
	);
}

/** Same box as the card, so nothing moves when the data arrives. */
export function FiguSkeleton({ className }: { className?: string }) {
	return (
		<div
			className={className ? `figu ${className}` : "figu"}
			data-loading=""
			aria-busy="true"
		>
			<span>Cargando</span>
		</div>
	);
}
