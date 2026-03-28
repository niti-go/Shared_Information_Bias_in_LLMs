export type SimulationMode = "unstructured" | "structured";

export type SimulationState = "created" | "running" | "voting" | "completed";

export type EventType =
  | "system"
  | "message"
  | "tool_reveal_unique_clue"
  | "tool_cast_vote"
  | "state_transition";

export interface ScenarioAgent {
  id: string;
  displayName: string;
  role: string;
  privateClue: string;
}

export interface ScenarioDefinition {
  key: string;
  title: string;
  description: string;
  decisionOptions: string[];
  sharedClues: string[];
  agents: ScenarioAgent[];
  optimalDecision: string;
}

export interface SimulationRecord {
  id: string;
  scenarioKey: string;
  mode: SimulationMode;
  model: string;
  fallbackModels: string[];
  state: SimulationState;
  turnIndex: number;
  maxTurns: number;
  createdAt: string;
  updatedAt: string;
}

export interface SimulationEventRecord {
  id: string;
  simulationId: string;
  turnIndex: number;
  type: EventType;
  agentId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface VoteRecord {
  id: string;
  simulationId: string;
  agentId: string;
  option: string;
  rationale: string;
  turnIndex: number;
  createdAt: string;
}
