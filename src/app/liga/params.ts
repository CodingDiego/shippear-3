import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const MODOS = ["nacional", "provincia"] as const;
export type Modo = (typeof MODOS)[number];

export const ligaParsers = {
	modo: parseAsStringLiteral(MODOS).withDefault("nacional"),
	provincia: parseAsString.withDefault(""),
};
export const loadLigaParams = createLoader(ligaParsers);
