import { z } from "zod";

import { getDefaultModel } from "@/lib/ai/gateway";
import {
  createSimulation,
  insertSimulationAgents,
  listSimulations,
} from "@/lib/db/repository";
import { getScenarioByKey, scenarios } from "@/lib/sim/scenarios";
import type { SimulationMode } from "@/lib/sim/types";

const createSimulationSchema = z.object({
  scenarioKey: z.string().min(1),
  mode: z.enum(["unstructured", "structured"]).default("unstructured"),
  model: z.string().min(1).optional(),
  fallbackModels: z.array(z.string()).default([]),
  maxTurns: z.number().int().min(3).max(20).default(8),
});

export async function GET() {
  const simulations = await listSimulations();

  return Response.json({
    simulations,
    scenarios: scenarios.map((scenario) => ({
      key: scenario.key,
      title: scenario.title,
      description: scenario.description,
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createSimulationSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const scenario = getScenarioByKey(payload.scenarioKey);
  const simulationId = crypto.randomUUID();
  const mode: SimulationMode = payload.mode;

  await createSimulation({
    id: simulationId,
    scenarioKey: payload.scenarioKey,
    mode,
    model: payload.model ?? getDefaultModel(),
    fallbackModels: payload.fallbackModels,
    maxTurns: payload.maxTurns,
  });

  await insertSimulationAgents(simulationId, scenario.agents);

  return Response.json(
    {
      simulationId,
      mode,
      scenario: {
        key: scenario.key,
        title: scenario.title,
        options: scenario.decisionOptions,
      },
    },
    { status: 201 },
  );
}
