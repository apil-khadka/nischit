import { Pool } from "pg";
import { drainOutboxOnce } from "./worker.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for the worker");

const pool = new Pool({ connectionString: databaseUrl, max: 2 });
if (process.env.NODE_ENV === "production") {
  const result = await pool.query<{ rolsuper: boolean; rolbypassrls: boolean; owns_tables: boolean }>(
    "SELECT rolsuper, rolbypassrls, EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user) AS owns_tables FROM pg_roles WHERE rolname = current_user",
  );
  const role = result.rows[0];
  if (!role || role.rolsuper || role.rolbypassrls || role.owns_tables) {
    throw new Error("Production DATABASE_URL must use a non-owner role without SUPERUSER or BYPASSRLS");
  }
}
let stopping = false;
let draining = false;

async function drainOnce() {
  if (draining) return;
  draining = true;
  try {
    const count = await drainOutboxOnce(pool);
    if (count > 0) console.info(JSON.stringify({ service: "nischit-worker", event: "outbox.drained", count }));
  } catch (error) {
    console.error(JSON.stringify({ service: "nischit-worker", event: "outbox.poll_failed", message: error instanceof Error ? error.message : "unknown" }));
  } finally {
    draining = false;
  }
}

const timer = setInterval(() => {
  if (!stopping) void drainOnce();
}, 2000);
await drainOnce();
console.info(JSON.stringify({ service: "nischit-worker", event: "started" }));

async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  await pool.end();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
