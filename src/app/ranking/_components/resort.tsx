import { RankingResortPlayer } from "@/components/motion/ranking-resort";
import { getScoredPeriod } from "@/lib/data/queries";
import type { ScoredPeriod, Vista } from "@/lib/domain";
import { shortName } from "@/lib/format";
import { byPuesto } from "@/lib/query/ranking";
import type { FilaResort } from "@/remotion/ranking-resort";
import { ResortHeading } from "./resort-skeleton";

const top5 = (p: ScoredPeriod): FilaResort[] =>
	p.vendedores
		.filter((v) => v.puesto !== null && v.score !== null)
		.sort(byPuesto)
		.slice(0, 5)
		.map((v) => ({
			id: v.vendedor.id,
			nombre: shortName(v.vendedor),
			score: Math.round(v.score ?? 0),
		}));

export async function Resort({
	periodo,
	periodos,
	vista,
}: {
	periodo: string;
	periodos: string[];
	vista: Vista;
}) {
	const previo = periodos[periodos.indexOf(periodo) - 1];
	if (!previo) return null;
	const [antes, despues] = await Promise.all([
		getScoredPeriod(previo, vista),
		getScoredPeriod(periodo, vista),
	]);
	return (
		<div>
			<ResortHeading de={previo} a={periodo} />
			<RankingResortPlayer antes={top5(antes)} despues={top5(despues)} />
		</div>
	);
}
