import { describe, expect, test } from "vitest";
import { HOY } from "@/lib/domain";
import {
	diaSemana,
	diasHabiles,
	diasTranscurridos,
	esHabil,
	fechaReferencia,
	finesRolling,
	habilesEntre,
	rolling30,
	semanaIso,
	sumarDias,
	ventanaDe,
	ventanaMes,
	ventanaSemana,
} from ".";

describe("day arithmetic", () => {
	test("sumarDias crosses months, years and leap days", () => {
		expect(sumarDias("2026-10-31", 1)).toBe("2026-11-01");
		expect(sumarDias("2026-01-01", -1)).toBe("2025-12-31");
		expect(sumarDias("2028-02-28", 1)).toBe("2028-02-29");
		expect(sumarDias("2026-10-24", 0)).toBe("2026-10-24");
	});
	test("diaSemana is ISO (Mon 1 .. Sun 7), HOY is a Saturday", () => {
		expect(diaSemana(HOY)).toBe(6);
		expect(diaSemana("2026-10-25")).toBe(7);
		expect(diaSemana("2026-10-19")).toBe(1);
		expect(esHabil(HOY)).toBe(true);
		expect(esHabil("2026-10-25")).toBe(false);
	});
});

describe("working days", () => {
	test("month starting on a Sunday (Nov 2026) has 25 working days", () => {
		const nov = ventanaMes("2026-11");
		expect(nov).toEqual({ desde: "2026-11-01", hasta: "2026-11-30" });
		expect(diasHabiles(nov)).toBe(25);
		expect(habilesEntre(nov)[0]).toBe("2026-11-02");
		expect(diasTranscurridos(nov, "2026-11-01")).toBe(0);
	});
	test("diasTranscurridos clamps to the range", () => {
		const oct = ventanaMes("2026-10");
		expect(diasHabiles(oct)).toBe(27);
		expect(diasTranscurridos(oct, "2026-09-30")).toBe(0);
		expect(diasTranscurridos(oct, HOY)).toBe(21);
		expect(diasTranscurridos(oct, "2026-12-01")).toBe(27);
	});
	test("ventanaMes knows February lengths", () => {
		expect(ventanaMes("2026-02").hasta).toBe("2026-02-28");
		expect(ventanaMes("2028-02").hasta).toBe("2028-02-29");
	});
});

describe("ISO weeks", () => {
	test("HOY on a Saturday: week 43, 6 of 6 working days elapsed", () => {
		expect(semanaIso(HOY)).toEqual({
			id: "2026-W43",
			desde: "2026-10-19",
			hasta: "2026-10-25",
		});
		const w = ventanaDe("semana", HOY);
		expect(w).toMatchObject({
			ventana: "semana",
			ref: HOY,
			desde: "2026-10-19",
			hasta: "2026-10-25",
			diasHabiles: 6,
			diasTranscurridos: 6,
		});
	});
	test("week crossing months", () => {
		expect(ventanaSemana("2026-11-01")).toEqual({
			desde: "2026-10-26",
			hasta: "2026-11-01",
		});
		expect(ventanaSemana("2026-10-26")).toEqual(ventanaSemana("2026-11-01"));
	});
	test("ISO year boundaries", () => {
		expect(semanaIso("2026-01-01").id).toBe("2026-W01");
		expect(semanaIso("2025-12-29").id).toBe("2026-W01");
		expect(semanaIso("2027-01-01").id).toBe("2026-W53");
		expect(semanaIso("2027-01-04").id).toBe("2027-W01");
	});
	test("ventanaDe mes at HOY", () => {
		expect(ventanaDe("mes", HOY)).toMatchObject({
			desde: "2026-10-01",
			hasta: "2026-10-31",
			diasHabiles: 27,
			diasTranscurridos: 21,
		});
	});
});

describe("rolling windows and reference dates", () => {
	test("rolling30 is fin-29..fin", () => {
		expect(rolling30("2026-10-24")).toEqual({
			desde: "2026-09-25",
			hasta: "2026-10-24",
		});
	});
	test("finesRolling: 90 ascending days ending at ref", () => {
		const f = finesRolling(HOY);
		expect(f).toHaveLength(90);
		expect(f.at(-1)).toBe(HOY);
		expect(f[0]).toBe(sumarDias(HOY, -89));
		expect(finesRolling(HOY, 3)).toEqual([
			"2026-10-22",
			"2026-10-23",
			"2026-10-24",
		]);
	});
	test("fechaReferencia: last day when closed, hoy when in progress", () => {
		const sep = { id: "2026-09", label: "Sep 26", pesoMes: 0.5 };
		expect(fechaReferencia(sep, HOY)).toBe("2026-09-30");
		expect(fechaReferencia({ ...sep, id: "2026-10", enCurso: true }, HOY)).toBe(
			HOY,
		);
	});
});
