import { createIdGenerator, type UIMessage } from "ai";

import { db, ensureDatabase } from "@/lib/db/client";
import type {
  EventType,
  SimulationEventRecord,
  SimulationMode,
  SimulationRecord,
  SimulationState,
  VoteRecord,
} from "@/lib/sim/types";

const nextMessageId = createIdGenerator({ prefix: "msg", size: 14 });

function nowIso() {
  return new Date().toISOString();
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

type SqlRow = Record<string, unknown>;

function rowToSimulation(row: SqlRow): SimulationRecord {
  return {
    id: String(row.id),
    scenarioKey: String(row.scenario_key),
    mode: row.mode as SimulationMode,
    model: String(row.model),
    fallbackModels: parseJson<string[]>(row.fallback_models_json, []),
    state: row.state as SimulationState,
    turnIndex: Number(row.turn_index),
    maxTurns: Number(row.max_turns),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToEvent(row: SqlRow): SimulationEventRecord {
  return {
    id: String(row.id),
    simulationId: String(row.simulation_id),
    turnIndex: Number(row.turn_index),
    type: row.event_type as EventType,
    agentId: row.agent_id ? String(row.agent_id) : null,
    payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
    createdAt: String(row.created_at),
  };
}

function rowToVote(row: SqlRow): VoteRecord {
  return {
    id: String(row.id),
    simulationId: String(row.simulation_id),
    agentId: String(row.agent_id),
    option: String(row.option_value),
    rationale: String(row.rationale),
    turnIndex: Number(row.turn_index),
    createdAt: String(row.created_at),
  };
}

export async function createSimulation(input: {
  id: string;
  scenarioKey: string;
  mode: SimulationMode;
  model: string;
  fallbackModels: string[];
  maxTurns: number;
}) {
  await ensureDatabase();

  const timestamp = nowIso();

  await db.execute({
    sql: `
      INSERT INTO simulations (
        id, scenario_key, mode, model, fallback_models_json, state, turn_index, max_turns, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      input.id,
      input.scenarioKey,
      input.mode,
      input.model,
      JSON.stringify(input.fallbackModels),
      "created",
      0,
      input.maxTurns,
      timestamp,
      timestamp,
    ],
  });
}

export async function insertSimulationAgents(
  simulationId: string,
  agents: Array<{
    id: string;
    displayName: string;
    role: string;
    privateClue: string;
  }>,
) {
  await ensureDatabase();

  for (const agent of agents) {
    await db.execute({
      sql: `
        INSERT INTO simulation_agents (
          id, simulation_id, agent_id, display_name, role, private_clue
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [
        crypto.randomUUID(),
        simulationId,
        agent.id,
        agent.displayName,
        agent.role,
        agent.privateClue,
      ],
    });
  }
}

export async function listSimulations(): Promise<SimulationRecord[]> {
  await ensureDatabase();

  const result = await db.execute({
    sql: "SELECT * FROM simulations ORDER BY created_at DESC",
  });

  return result.rows.map((row) => rowToSimulation(row as SqlRow));
}

export async function getSimulation(simulationId: string): Promise<SimulationRecord | null> {
  await ensureDatabase();

  const result = await db.execute({
    sql: "SELECT * FROM simulations WHERE id = ? LIMIT 1",
    args: [simulationId],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToSimulation(result.rows[0] as SqlRow);
}

export async function setSimulationState(
  simulationId: string,
  state: SimulationState,
  turnIndex?: number,
) {
  await ensureDatabase();

  if (typeof turnIndex === "number") {
    await db.execute({
      sql: "UPDATE simulations SET state = ?, turn_index = ?, updated_at = ? WHERE id = ?",
      args: [state, turnIndex, nowIso(), simulationId],
    });
    return;
  }

  await db.execute({
    sql: "UPDATE simulations SET state = ?, updated_at = ? WHERE id = ?",
    args: [state, nowIso(), simulationId],
  });
}

export async function incrementSimulationTurn(simulationId: string) {
  await ensureDatabase();

  await db.execute({
    sql: "UPDATE simulations SET turn_index = turn_index + 1, updated_at = ? WHERE id = ?",
    args: [nowIso(), simulationId],
  });
}

export async function appendEvent(input: {
  simulationId: string;
  turnIndex: number;
  type: EventType;
  agentId?: string | null;
  payload: Record<string, unknown>;
}) {
  await ensureDatabase();

  await db.execute({
    sql: `
      INSERT INTO simulation_events (
        id, simulation_id, turn_index, event_type, agent_id, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      crypto.randomUUID(),
      input.simulationId,
      input.turnIndex,
      input.type,
      input.agentId ?? null,
      JSON.stringify(input.payload),
      nowIso(),
    ],
  });
}

export async function listEvents(simulationId: string): Promise<SimulationEventRecord[]> {
  await ensureDatabase();

  const result = await db.execute({
    sql: `
      SELECT * FROM simulation_events
      WHERE simulation_id = ?
      ORDER BY turn_index ASC, created_at ASC
    `,
    args: [simulationId],
  });

  return result.rows.map((row) => rowToEvent(row as SqlRow));
}

export async function upsertVote(input: {
  simulationId: string;
  agentId: string;
  option: string;
  rationale: string;
  turnIndex: number;
}) {
  await ensureDatabase();

  await db.execute({
    sql: "DELETE FROM votes WHERE simulation_id = ? AND agent_id = ?",
    args: [input.simulationId, input.agentId],
  });

  await db.execute({
    sql: `
      INSERT INTO votes (
        id, simulation_id, agent_id, option_value, rationale, turn_index, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      crypto.randomUUID(),
      input.simulationId,
      input.agentId,
      input.option,
      input.rationale,
      input.turnIndex,
      nowIso(),
    ],
  });
}

export async function listVotes(simulationId: string): Promise<VoteRecord[]> {
  await ensureDatabase();

  const result = await db.execute({
    sql: "SELECT * FROM votes WHERE simulation_id = ? ORDER BY created_at ASC",
    args: [simulationId],
  });

  return result.rows.map((row) => rowToVote(row as SqlRow));
}

export async function listSimulationAgents(simulationId: string) {
  await ensureDatabase();

  const result = await db.execute({
    sql: `
      SELECT agent_id, display_name, role, private_clue
      FROM simulation_agents
      WHERE simulation_id = ?
      ORDER BY display_name ASC
    `,
    args: [simulationId],
  });

  return result.rows.map((row) => ({
    id: String(row.agent_id),
    displayName: String(row.display_name),
    role: String(row.role),
    privateClue: String(row.private_clue),
  }));
}

export async function insertMessage(simulationId: string, message: UIMessage) {
  await ensureDatabase();

  await db.execute({
    sql: `
      INSERT INTO messages (id, simulation_id, role, message_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    args: [
      String(message.id ?? nextMessageId()),
      simulationId,
      String(message.role),
      JSON.stringify(message),
      nowIso(),
    ],
  });
}

export async function listMessages(simulationId: string): Promise<UIMessage[]> {
  await ensureDatabase();

  const result = await db.execute({
    sql: "SELECT message_json FROM messages WHERE simulation_id = ? ORDER BY created_at ASC",
    args: [simulationId],
  });

  return result.rows
    .map((row) => parseJson<UIMessage | null>(row.message_json, null))
    .filter((row): row is UIMessage => row !== null);
}
