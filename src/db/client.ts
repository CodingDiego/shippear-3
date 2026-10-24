import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/env";
import * as schema from "./schema";

const make = () => drizzle(neon(env.DATABASE_URL), { schema });

// Cached on globalThis in dev so HMR does not create a client per reload.
const g = globalThis as unknown as { __db?: ReturnType<typeof make> };

export const db = g.__db ?? make();
if (process.env.NODE_ENV !== "production") g.__db = db;

export { schema };
