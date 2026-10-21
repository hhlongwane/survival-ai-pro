import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
  throw new Error(
    "Database not connected yet! On Vercel: click Storage -> Create Database -> Neon Postgres -> Connect Project -> Redeploy."
  );
}

const isLocalHost =
  databaseUrl.includes("127.0.0.1") ||
  databaseUrl.includes("localhost") ||
  databaseUrl.includes("@postgres:");

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ...(isLocalHost ? {} : { ssl: { rejectUnauthorized: false } }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
