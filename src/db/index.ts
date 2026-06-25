import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString, {
	// Single connection for now; pool config lands at HARDEN.* if needed.
	max: 10,
	// Defensive on the :5432 session pooler; forward-safe if a :6543
	// transaction pooler is ever introduced (ADR-0024 §Decision Outcome #8).
	prepare: false,
});

export const db = drizzle(client, { schema });
export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
