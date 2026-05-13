import { createClient } from "@libsql/client";

import { schemaStatements } from "@/lib/db/schema";

const dbUrl = process.env.DATABASE_URL ?? "file:./local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

export const db = createClient({
  url: dbUrl,
  authToken,
});

let initialized = false;

export async function ensureDatabase() {
  if (initialized) {
    return;
  }

  for (const statement of schemaStatements) {
    await db.execute(statement);
  }

  // Additive migration: existing databases created before moderator_prompt
  // was added won't have the column. ALTER TABLE ADD COLUMN is idempotent
  // via the "duplicate column" error we swallow.
  try {
    await db.execute("ALTER TABLE simulations ADD COLUMN moderator_prompt TEXT");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/duplicate column/i.test(msg)) throw err;
  }

  initialized = true;
}
