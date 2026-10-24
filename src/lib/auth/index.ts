// Custom auth, no libraries (SPEC-V2 "Auth"). Web Crypto only, so it runs in proxy.ts,
// route handlers and server actions alike. The secret is passed in (env.AUTH_SECRET).

/** Seller session cookie: "<vendedorId>.<exp>.<sig>". */
export const SESSION_COOKIE = "figu_s";
/** Admin session cookie: "admin.<exp>.<sig>". */
export const ADMIN_COOKIE = "figu_a";
export const ADMIN_SUB = "admin";
/** Seconds. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
/** Seconds. */
export const ADMIN_MAX_AGE = 60 * 60 * 12;

export type Sesion = {
	/** vendedorId or ADMIN_SUB; never contains ".". */
	sub: string;
	/** Expiry, unix seconds. */
	exp: number;
};

const enc = new TextEncoder();

const hmacKey = (secret: string) =>
	crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);

const toB64url = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/, "");

function fromB64url(s: string): Uint8Array<ArrayBuffer> | null {
	if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
	try {
		const bin = atob(s.replaceAll("-", "+").replaceAll("_", "/"));
		return Uint8Array.from(bin, (c) => c.charCodeAt(0));
	} catch {
		return null;
	}
}

/** Cookie flags for both session cookies. */
export function cookieOptions(maxAgeSec: number, appEnv: string) {
	return {
		httpOnly: true,
		sameSite: "lax" as const,
		secure: appEnv !== "development",
		path: "/",
		maxAge: maxAgeSec,
	};
}

/**
 * Token "<sub>.<exp>.<sig>", exp = floor(nowMs / 1000) + maxAgeSec,
 * sig = base64url(HMAC-SHA256(secret, "<sub>.<exp>")). Cookie: httpOnly, sameSite "lax",
 * secure outside development, path "/", maxAge = maxAgeSec (see cookieOptions).
 */
export async function signSession(
	sub: string,
	maxAgeSec: number,
	secret: string,
	nowMs: number = Date.now(),
): Promise<string> {
	if (!sub || sub.includes(".")) throw new Error("sub inválido");
	const payload = `${sub}.${Math.floor(nowMs / 1000) + maxAgeSec}`;
	const sig = await crypto.subtle.sign(
		"HMAC",
		await hmacKey(secret),
		enc.encode(payload),
	);
	return `${payload}.${toB64url(new Uint8Array(sig))}`;
}

/** Valid signature (crypto.subtle.verify) and exp > now, else null. Never throws on bad input. */
export async function verifySession(
	token: string | undefined,
	secret: string,
	nowMs: number = Date.now(),
): Promise<Sesion | null> {
	if (!token || !secret) return null;
	const parts = token.split(".");
	if (parts.length !== 3) return null;
	const [sub, expStr, sigStr] = parts;
	if (!sub || !/^\d{1,12}$/.test(expStr)) return null;
	const sig = fromB64url(sigStr);
	if (!sig) return null;
	try {
		const ok = await crypto.subtle.verify(
			"HMAC",
			await hmacKey(secret),
			sig,
			enc.encode(`${sub}.${expStr}`),
		);
		const exp = Number(expStr);
		return ok && exp > Math.floor(nowMs / 1000) ? { sub, exp } : null;
	} catch {
		return null;
	}
}

/** 6 digits from HMAC-SHA256(secret, "pin:" + id), zero-padded. Nothing stored. */
export async function pinDe(id: string, secret: string): Promise<string> {
	const mac = await crypto.subtle.sign(
		"HMAC",
		await hmacKey(secret),
		enc.encode(`pin:${id}`),
	);
	const n = new DataView(mac).getUint32(0) % 1_000_000;
	return String(n).padStart(6, "0");
}

/** Constant-time compare. false when passcode is unset (admin login disabled). */
export function checkAdminPasscode(
	input: string,
	passcode: string | undefined,
): boolean {
	if (!passcode) return false;
	const a = enc.encode(input);
	const b = enc.encode(passcode);
	// Loop over the longer input so timing reveals only the max length.
	let diff = a.length ^ b.length;
	for (let i = 0; i < Math.max(a.length, b.length); i++)
		diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
	return diff === 0;
}
