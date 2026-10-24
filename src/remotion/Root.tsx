import { Composition } from "remotion";
import { periodo } from "@/lib/modes/fixtures";
import { CardRevealComposition, REVEAL } from "./card-reveal";
import { HERO, HeroComposition } from "./hero";
import { PRIZE_CLAIM, PrizeClaim } from "./prize-claim";
import { RankingResort, RESORT } from "./ranking-resort";

// Studio defaults: a hand-built month, so the studio needs no database.
const mes = periodo(
	"2026-09",
	[99.7, 99.4, 98.7, 97.4, 96.5].map((score, i) => ({
		id: `V00${i + 1}`,
		score,
	})),
).vendedores;

const filas = mes.map((v) => ({
	id: v.vendedor.id,
	nombre: `${v.vendedor.nombre[0]}. ${v.vendedor.apellido}`,
	score: v.score ?? 0,
}));

export function RemotionRoot() {
	return (
		<>
			<Composition
				id="hero"
				component={HeroComposition}
				durationInFrames={HERO.duration}
				fps={HERO.fps}
				width={HERO.width}
				height={HERO.height}
				defaultProps={{ cards: mes }}
			/>
			<Composition
				id="card-reveal"
				component={CardRevealComposition}
				durationInFrames={REVEAL.duration}
				fps={REVEAL.fps}
				width={REVEAL.width}
				height={REVEAL.height}
				defaultProps={{ card: mes[0], foil: "oro" as const }}
			/>
			<Composition
				id="prize-claim"
				component={PrizeClaim}
				durationInFrames={PRIZE_CLAIM.duracion}
				fps={PRIZE_CLAIM.fps}
				width={PRIZE_CLAIM.ancho}
				height={PRIZE_CLAIM.alto}
				defaultProps={{
					tipo: "figu" as const,
					titulo: "Venta",
					detalle: "Septiembre",
					rareza: "Épica",
				}}
			/>
			<Composition
				id="ranking-resort"
				component={RankingResort}
				durationInFrames={RESORT.duration}
				fps={RESORT.fps}
				width={RESORT.width}
				height={RESORT.height}
				defaultProps={{
					antes: [...filas].reverse(),
					despues: filas,
				}}
			/>
		</>
	);
}
