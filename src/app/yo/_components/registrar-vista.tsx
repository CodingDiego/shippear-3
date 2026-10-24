"use client";

import { useEffect, useRef } from "react";
import { registrarVista } from "../actions";

/** Logs one real "vista" per visit; the ref survives the dev double effect. */
export function RegistrarVista() {
	const hecho = useRef(false);
	useEffect(() => {
		if (hecho.current) return;
		hecho.current = true;
		registrarVista().catch(() => {});
	}, []);
	return null;
}
