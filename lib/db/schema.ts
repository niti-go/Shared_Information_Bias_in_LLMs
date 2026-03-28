export const schemaStatements = [
  `
  CREATE TABLE IF NOT EXISTS simulations (
    id TEXT PRIMARY KEY,
    scenario_key TEXT NOT NULL,
    mode TEXT NOT NULL,
    model TEXT NOT NULL,
    fallback_models_json TEXT NOT NULL,
    state TEXT NOT NULL,
    turn_index INTEGER NOT NULL DEFAULT 0,
    max_turns INTEGER NOT NULL DEFAULT 8,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS simulation_agents (
    id TEXT PRIMARY KEY,
    simulation_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    private_clue TEXT NOT NULL,
    FOREIGN KEY(simulation_id) REFERENCES simulations(id)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS simulation_events (
    id TEXT PRIMARY KEY,
    simulation_id TEXT NOT NULL,
    turn_index INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    agent_id TEXT,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(simulation_id) REFERENCES simulations(id)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS votes (
    id TEXT PRIMARY KEY,
    simulation_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    option_value TEXT NOT NULL,
    rationale TEXT NOT NULL,
    turn_index INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(simulation_id) REFERENCES simulations(id)
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    simulation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    message_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(simulation_id) REFERENCES simulations(id)
  );
  `,
];
