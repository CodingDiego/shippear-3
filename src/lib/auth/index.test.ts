// @vitest-environment node
import { describe, expect, test } from "vitest";
import {
	ADMIN_SUB,
	checkAdminPasscode,
	cookieOptions,
	pinDe,
	signSession,
	verifySession,
} from "./index";

const SECRET = "s".repeat(32);
const NOW = 1_790_000_000_000;

describe("session tokens", () => {
	test("round-trips sub and exp", async () => {
		const t = await signSession("V001", 60, SECRET, NOW);
		expect(t.split(".")).toHaveLength(3);
		expect(await verifySession(t, SECRET, NOW)).toEqual({
			sub: "V001",
			exp: NOW / 1000 + 60,
		});
	});

	test("rejects tampered sub, exp and signature", async () => {
		const t = await signSession("V001", 60, SECRET, NOW);
		const [, exp, sig] = t.split(".");
		expect(await verifySession(`V002.${exp}.${sig}`, SECRET, NOW)).toBeNull();
		expect(
			await verifySession(`V001.${Number(exp) + 999}.${sig}`, SECRET, NOW),
		).toBeNull();
		const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
		expect(
			await verifySession(`V001.${exp}.${flipped}`, SECRET, NOW),
		).toBeNull();
		expect(
			await verifySession(`${ADMIN_SUB}.${exp}.${sig}`, SECRET, NOW),
		).toBeNull();
	});

	test("rejects expired tokens", async () => {
		const t = await signSession("V001", 60, SECRET, NOW);
		expect(await verifySession(t, SECRET, NOW + 59_000)).not.toBeNull();
		expect(await verifySession(t, SECRET, NOW + 60_000)).toBeNull();
	});

	test("rejects a wrong secret", async () => {
		const t = await signSession("V001", 60, SECRET, NOW);
		expect(await verifySession(t, "x".repeat(32), NOW)).toBeNull();
	});

	test("never throws on garbage", async () => {
		for (const bad of [
			undefined,
			"",
			"a.b",
			"a.b.c.d",
			"V1.12.%%%",
			"V1.x.AA",
			".1.AA",
		])
			expect(await verifySession(bad, SECRET, NOW)).toBeNull();
	});

	test("refuses a sub with a dot", async () => {
		await expect(signSession("a.b", 60, SECRET)).rejects.toThrow();
	});
});

describe("pinDe", () => {
	test("stable, 6 digits, differs by id and secret", async () => {
		const a = await pinDe("V001", SECRET);
		expect(a).toMatch(/^\d{6}$/);
		expect(await pinDe("V001", SECRET)).toBe(a);
		const otros = await Promise.all(
			["V002", "V003", "V004"].map((id) => pinDe(id, SECRET)),
		);
		expect(otros).not.toContain(a);
		expect(await pinDe("V001", "x".repeat(32))).not.toBe(a);
	});
});

describe("checkAdminPasscode", () => {
	test("matches only the exact passcode", () => {
		expect(checkAdminPasscode("clave-secreta", "clave-secreta")).toBe(true);
		expect(checkAdminPasscode("clave-secret", "clave-secreta")).toBe(false);
		expect(checkAdminPasscode("clave-secretb", "clave-secreta")).toBe(false);
		expect(checkAdminPasscode("", "clave-secreta")).toBe(false);
	});

	test("disabled when unset", () => {
		expect(checkAdminPasscode("", undefined)).toBe(false);
		expect(checkAdminPasscode("x", "")).toBe(false);
	});
});

test("cookieOptions: secure outside development", () => {
	expect(cookieOptions(60, "development")).toEqual({
		httpOnly: true,
		sameSite: "lax",
		secure: false,
		path: "/",
		maxAge: 60,
	});
	expect(cookieOptions(60, "preview").secure).toBe(true);
	expect(cookieOptions(60, "production").secure).toBe(true);
});
