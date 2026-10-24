import Link from "next/link";

export default function NotFound() {
	return (
		<main className="wrap">
			<div className="title">
				<h1>No encontramos esa página.</h1>
				<p>Puede que la carta ya no exista o que el enlace esté mal.</p>
			</div>
			<Link className="btn" href="/ranking">
				Ir al ranking
			</Link>
		</main>
	);
}
