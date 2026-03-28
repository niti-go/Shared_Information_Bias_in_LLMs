import {
  convertToModelMessages,
  createIdGenerator,
  generateObject,
  type UIMessage,
} from "ai";
import { z } from "zod";

import {
  getDefaultModel,
  getGatewayProviderOptions,
  resolveGatewayModel,
} from "@/lib/ai/gateway";
import {
  appendEvent,
  getSimulation,
  incrementSimulationTurn,
  insertMessage,
  listEvents,
  listMessages,
  listSimulationAgents,
  listVotes,
  setSimulationState,
  upsertVote,
} from "@/lib/db/repository";
import { validateSimulationMessages } from "@/lib/sim/messages";
import { getScenarioByKey } from "@/lib/sim/scenarios";
import { simulationTurnSchema } from "@/lib/sim/tools";
import type { SimulationMode, SimulationRecord } from "@/lib/sim/types";

const nextMessageId = createIdGenerator({ prefix: "msg", size: 14 });

function asTextMessage(role: "system" | "user" | "assistant", text: string): UIMessage {
  return {
    id: nextMessageId(),
    role,
    parts: [{ type: "text", text }],
  };
}

function modeInstruction(mode: SimulationMode) {
  if (mode === "structured") {
    return "You are in structured mode. Surface overlooked information before converging.";
  }
  return "You are in unstructured mode. Debate freely while aiming for a final decision.";
}

function getMockTurn(
  simulation: SimulationRecord,
  activeAgent: { displayName: string; privateClue: string },
) {
  if (simulation.turnIndex >= simulation.maxTurns - 1) {
    return {
      message: `${activeAgent.displayName}: Based on our evidence, I am ready to vote for South Market.`,
      action: "cast_vote" as const,
      cast_vote: {
        option: "South Market",
        rationale: "The combined evidence points to long-term impact in South Market.",
      },
    };
  }

  if (simulation.turnIndex % 2 === 0) {
    return {
      message: `${activeAgent.displayName}: I want to add a unique consideration from my notes.`,
      action: "reveal_unique_clue" as const,
      reveal_unique_clue: {
        clue: activeAgent.privateClue,
      },
    };
  }

  return {
    message: `${activeAgent.displayName}: I agree we should compare options against long-term outcomes before finalizing.`,
    action: "message" as const,
  };
}

function majorityVote(votes: Awaited<ReturnType<typeof listVotes>>) {
  if (votes.length === 0) {
    return null;
  }

  const counts = new Map<string, number>();
  for (const vote of votes) {
    counts.set(vote.option, (counts.get(vote.option) ?? 0) + 1);
  }

  let winner: string | null = null;
  let max = -1;
  for (const [option, count] of counts.entries()) {
    if (count > max) {
      winner = option;
      max = count;
    }
  }
  return winner;
}

async function buildPrompt(simulation: SimulationRecord, speakerId: string): Promise<UIMessage> {
  const scenario = getScenarioByKey(simulation.scenarioKey);
  const agents = await listSimulationAgents(simulation.id);
  const speaker = agents.find((agent) => agent.id === speakerId);

  if (!speaker) {
    throw new Error("Could not resolve active speaker.");
  }

  const events = await listEvents(simulation.id);
  const transcript = events
    .filter((event) => event.type === "message")
    .slice(-8)
    .map((event) => {
      const speakerName = String(event.payload.speakerName ?? event.agentId ?? "Agent");
      const text = String(event.payload.message ?? "");
      return `${speakerName}: ${text}`;
    })
    .join("\n");

  return asTextMessage(
    "user",
    [
      `You are ${speaker.displayName} (${speaker.role}).`,
      modeInstruction(simulation.mode),
      `Scenario: ${scenario.title}`,
      `Description: ${scenario.description}`,
      `Decision options: ${scenario.decisionOptions.join(", ")}`,
      `Shared clues: ${scenario.sharedClues.join(" | ")}`,
      `Your private clue: ${speaker.privateClue}`,
      "Recent transcript:",
      transcript || "(no prior messages)",
      "Return one action with a concise message.",
      "If you cast a vote, include a rationale.",
      "If you reveal a clue, keep it faithful to your private clue.",
    ].join("\n"),
  );
}

export async function runSimulationStep(simulationId: string) {
  const simulation = await getSimulation(simulationId);
  if (!simulation) {
    throw new Error("Simulation not found.");
  }

  if (simulation.state === "completed") {
    return await summarizeSimulation(simulation.id);
  }

  if (simulation.state === "created") {
    await setSimulationState(simulation.id, "running");
    await appendEvent({
      simulationId: simulation.id,
      turnIndex: simulation.turnIndex,
      type: "state_transition",
      payload: { from: "created", to: "running" },
    });
  }

  const refreshed = await getSimulation(simulation.id);
  if (!refreshed) {
    throw new Error("Simulation not found after state update.");
  }

  if (refreshed.turnIndex >= refreshed.maxTurns) {
    await setSimulationState(refreshed.id, "voting");
    await appendEvent({
      simulationId: refreshed.id,
      turnIndex: refreshed.turnIndex,
      type: "state_transition",
      payload: { from: refreshed.state, to: "voting", reason: "max_turns_reached" },
    });
    return await summarizeSimulation(refreshed.id);
  }

  const agents = await listSimulationAgents(refreshed.id);
  const activeAgent = agents[refreshed.turnIndex % agents.length];
  const promptMessage = await buildPrompt(refreshed, activeAgent.id);

  const storedMessages = await listMessages(refreshed.id);
  const validatedMessages = await validateSimulationMessages([
    ...storedMessages,
    promptMessage,
  ]);

  const shouldUseMockModel = !process.env.AI_GATEWAY_API_KEY;

  const response = shouldUseMockModel
    ? {
        object: getMockTurn(refreshed, activeAgent),
        providerMetadata: {},
      }
    : await generateObject({
        model: resolveGatewayModel(refreshed.model || getDefaultModel()),
        providerOptions: getGatewayProviderOptions({
          simulationId: refreshed.id,
          scenarioKey: refreshed.scenarioKey,
          mode: refreshed.mode,
          fallbackModels: refreshed.fallbackModels,
        }),
        messages: await convertToModelMessages(validatedMessages),
        schema: simulationTurnSchema,
        temperature: 0.7,
      });

  await insertMessage(refreshed.id, promptMessage);

  const assistantMessage = asTextMessage("assistant", response.object.message);
  await insertMessage(refreshed.id, assistantMessage);

  const generationId = response.providerMetadata?.gateway?.generationId;

  await appendEvent({
    simulationId: refreshed.id,
    turnIndex: refreshed.turnIndex,
    type: "message",
    agentId: activeAgent.id,
    payload: {
      speakerName: activeAgent.displayName,
      speakerRole: activeAgent.role,
      message: response.object.message,
      generationId: typeof generationId === "string" ? generationId : null,
      action: response.object.action,
    },
  });

  if (
    response.object.action === "reveal_unique_clue" &&
    response.object.reveal_unique_clue
  ) {
    await appendEvent({
      simulationId: refreshed.id,
      turnIndex: refreshed.turnIndex,
      type: "tool_reveal_unique_clue",
      agentId: activeAgent.id,
      payload: {
        clue: response.object.reveal_unique_clue.clue,
      },
    });
  }

  if (response.object.action === "cast_vote" && response.object.cast_vote) {
    await upsertVote({
      simulationId: refreshed.id,
      agentId: activeAgent.id,
      option: response.object.cast_vote.option,
      rationale: response.object.cast_vote.rationale,
      turnIndex: refreshed.turnIndex,
    });

    await appendEvent({
      simulationId: refreshed.id,
      turnIndex: refreshed.turnIndex,
      type: "tool_cast_vote",
      agentId: activeAgent.id,
      payload: {
        option: response.object.cast_vote.option,
        rationale: response.object.cast_vote.rationale,
      },
    });
  }

  await incrementSimulationTurn(refreshed.id);

  const afterTurn = await getSimulation(refreshed.id);
  if (afterTurn && afterTurn.turnIndex >= afterTurn.maxTurns) {
    await setSimulationState(afterTurn.id, "voting");
    await appendEvent({
      simulationId: afterTurn.id,
      turnIndex: afterTurn.turnIndex,
      type: "state_transition",
      payload: { from: "running", to: "voting", reason: "max_turns_reached" },
    });
  }

  return await summarizeSimulation(refreshed.id);
}

export async function finalizeSimulationVote(simulationId: string) {
  const simulation = await getSimulation(simulationId);
  if (!simulation) {
    throw new Error("Simulation not found.");
  }

  const votes = await listVotes(simulation.id);
  const consensus = majorityVote(votes);

  await setSimulationState(simulation.id, "completed");
  await appendEvent({
    simulationId: simulation.id,
    turnIndex: simulation.turnIndex,
    type: "state_transition",
    payload: { from: simulation.state, to: "completed", consensus },
  });

  return await summarizeSimulation(simulation.id);
}

export async function summarizeSimulation(simulationId: string) {
  const simulation = await getSimulation(simulationId);
  if (!simulation) {
    throw new Error("Simulation not found.");
  }

  const scenario = getScenarioByKey(simulation.scenarioKey);
  const events = await listEvents(simulation.id);
  const votes = await listVotes(simulation.id);

  const uniqueInfoCount = events.filter(
    (event) => event.type === "tool_reveal_unique_clue",
  ).length;

  const consensus = majorityVote(votes);

  return {
    simulation,
    metrics: {
      uniqueInfoMentions: uniqueInfoCount,
      votesCount: votes.length,
      consensus,
      optimalDecision: scenario.optimalDecision,
      isConsensusOptimal: consensus ? consensus === scenario.optimalDecision : false,
    },
  };
}

export const stepRequestSchema = z.object({
  runUntilVoting: z.boolean().optional(),
});
