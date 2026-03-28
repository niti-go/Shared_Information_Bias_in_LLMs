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

  initialized = true;
}
