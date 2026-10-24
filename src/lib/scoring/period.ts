import {
	type Dataset,
	metricasDe,
	type ScoredPeriod,
	type Vista,
} from "../domain";
import { scorePeriodV2 } from "./metricas";

/** v1 entry point: scores over dataset.metricas (or the seven base KPIs), without constancia values. */
export function scorePeriod(
	dataset: Dataset,
	periodoId: string,
	vista: Vista,
): ScoredPeriod {
	return scorePeriodV2(dataset, periodoId, vista, {
		defs: dataset.metricas ?? metricasDe(dataset.defs),
	});
}
