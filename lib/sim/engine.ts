import {
  convertToModelMessages,
  createIdGenerator,
  generateObject,
  generateText,
  Output,
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
import { maybeRunModerator } from "@/lib/sim/moderator";
import { getScenarioByKey } from "@/lib/sim/scenarios";
import { simulationTurnSchema } from "@/lib/sim/tools";
import type { SimulationMode, SimulationRecord } from "@/lib/sim/types";
import { runVotingRound } from "@/lib/sim/voting";

const nextMessageId = createIdGenerator({ prefix: "msg", size: 14 });

function asTextMessage(
  role: "system" | "user" | "assistant",
  text: string,
): UIMessage {
  return {
    id: nextMessageId(),
    role,
    parts: [{ type: "text", text }],
  };
}

function modeInstruction(_mode: SimulationMode): string {
  return "You are in an open group discussion. Debate freely and aim to reach a well-reasoned decision.";
}

function getMockTurn(
  simulation: SimulationRecord,
  activeAgent: { displayName: string; privateClue: string },
  turnIndex: number,
) {
  if (turnIndex >= simulation.maxTurns - 1) {
    return {
      message: `Based on everything we've discussed, I'm ready to cast my vote.`,
      action: "cast_vote" as const,
      cast_vote: {
        option: getScenarioByKey(simulation.scenarioKey).optimalDecision,
        rationale:
          "The combined evidence from the discussion points clearly to this option.",
      },
    };
  }

  if (turnIndex % 3 === 1) {
    return {
      message: `I'd like to share a specific piece of analysis from my area of expertise that I think is critical here. ${activeAgent.privateClue}`,
      action: "message" as const,
    };
  }

  return {
    message: `Thank you for that perspective. I think we should weigh the long-term implications carefully before coming to any conclusions.`,
    action: "message" as const,
  };
}

function majorityVote(votes: Awaited<ReturnType<typeof listVotes>>) {
  if (votes.length === 0) return null;
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

async function buildAgentPrompt(
  simulation: SimulationRecord,
  speakerId: string,
): Promise<UIMessage> {
  const scenario = getScenarioByKey(simulation.scenarioKey);
  const agents = await listSimulationAgents(simulation.id);
  const speaker = agents.find((a) => a.id === speakerId);
  if (!speaker) throw new Error("Could not resolve active speaker.");

  const events = await listEvents(simulation.id);

  // Include both agent messages and moderator interventions in the transcript
  const transcript = events
    .filter((e) => e.type === "message" || e.type === "moderator_intervention")
    .slice(-10)
    .map((e) => {
      if (e.type === "moderator_intervention") {
        return `[Moderator]: ${String(e.payload.message ?? "")}`;
      }
      const name = String(e.payload.speakerName ?? e.agentId ?? "Agent");
      return `${name}: ${String(e.payload.message ?? "")}`;
    })
    .join("\n");

  const turnProgress = `(Turn ${simulation.turnIndex + 1} of ${simulation.maxTurns})`;

  return asTextMessage(
    "user",
    [
      `You are ${speaker.displayName}, serving as ${speaker.role}. ${turnProgress}`,
      modeInstruction(simulation.mode),
      "",
      `Scenario: ${scenario.title}`,
      `Context: ${scenario.description}`,
      `Decision options: ${scenario.decisionOptions.join(" | ")}`,
      "",
      "Information available to you:",
      scenario.sharedClues.map((c) => `  • ${c}`).join("\n"),
      `  • ${speaker.privateClue}`,
      "",
      "Recent discussion:",
      transcript || "(no prior messages — you may open the discussion)",
      "",
      "Instructions:",
      "  • Choose one action: 'message' (discuss) or 'cast_vote' (if you are ready to commit).",
      "  • If you choose cast_vote, your 'option' must match one of the decision options exactly.",
      "  • Write a concise, natural message (2–5 sentences) as yourself in this role.",
    ].join("\n"),
  );
}

export async function runSimulationStep(simulationId: string) {
  const simulation = await getSimulation(simulationId);
  if (!simulation) throw new Error("Simulation not found.");

  if (simulation.state === "completed") {
    return summarizeSimulation(simulation.id);
  }

  if (simulation.state === "voting") {
    return summarizeSimulation(simulation.id);
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
  if (!refreshed) throw new Error("Simulation not found after state update.");

  if (refreshed.turnIndex >= refreshed.maxTurns) {
    await setSimulationState(refreshed.id, "voting");
    await appendEvent({
      simulationId: refreshed.id,
      turnIndex: refreshed.turnIndex,
      type: "state_transition",
      payload: {
        from: refreshed.state,
        to: "voting",
        reason: "max_turns_reached",
      },
    });
    return summarizeSimulation(refreshed.id);
  }

  const agents = await listSimulationAgents(refreshed.id);
  const activeAgent = agents[refreshed.turnIndex % agents.length];
  const promptMessage = await buildAgentPrompt(refreshed, activeAgent.id);

  const storedMessages = await listMessages(refreshed.id);
  const validatedMessages = await validateSimulationMessages([
    ...storedMessages,
    promptMessage,
  ]);

  const response = await generateText({
    model: resolveGatewayModel(refreshed.model || getDefaultModel()),
    providerOptions: getGatewayProviderOptions({
      simulationId: refreshed.id,
      scenarioKey: refreshed.scenarioKey,
      mode: refreshed.mode,
      fallbackModels: refreshed.fallbackModels,
    }),
    messages: await convertToModelMessages(validatedMessages),
    output: Output.object({ schema: simulationTurnSchema }),
    temperature: 0.8,
  });

  await insertMessage(refreshed.id, promptMessage);
  await insertMessage(
    refreshed.id,
    asTextMessage("assistant", response.output.message),
  );

  const meta = response.providerMetadata as
    | Record<string, Record<string, unknown>>
    | undefined;
  const generationId = meta?.gateway?.generationId;

  await appendEvent({
    simulationId: refreshed.id,
    turnIndex: refreshed.turnIndex,
    type: "message",
    agentId: activeAgent.id,
    payload: {
      speakerName: activeAgent.displayName,
      speakerRole: activeAgent.role,
      message: response.output.message,
      action: response.output.action,
      generationId: typeof generationId === "string" ? generationId : null,
    },
  });

  if (response.output.action === "cast_vote" && response.output.cast_vote) {
    await upsertVote({
      simulationId: refreshed.id,
      agentId: activeAgent.id,
      option: response.output.cast_vote.option,
      rationale: response.output.cast_vote.rationale,
      turnIndex: refreshed.turnIndex,
    });

    await appendEvent({
      simulationId: refreshed.id,
      turnIndex: refreshed.turnIndex,
      type: "tool_cast_vote",
      agentId: activeAgent.id,
      payload: {
        option: response.output.cast_vote.option,
        rationale: response.output.cast_vote.rationale,
        isFinalVote: false,
        speakerName: activeAgent.displayName,
        speakerRole: activeAgent.role,
      },
    });
  }

  await incrementSimulationTurn(refreshed.id);

  // Run moderator check after the turn (structured mode only, at intervals)
  const afterIncrement = await getSimulation(refreshed.id);
  if (afterIncrement && afterIncrement.mode === "structured") {
    const scenario = getScenarioByKey(afterIncrement.scenarioKey);
    await maybeRunModerator(afterIncrement, scenario.decisionOptions);
  }

  // Check if we've hit max turns after incrementing
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

  return summarizeSimulation(refreshed.id);
}

export async function finalizeSimulationVote(simulationId: string) {
  const simulation = await getSimulation(simulationId);
  if (!simulation) throw new Error("Simulation not found.");

  if (simulation.state === "completed") {
    return summarizeSimulation(simulationId);
  }

  // Ensure we're in voting state first
  if (simulation.state !== "voting") {
    await setSimulationState(simulationId, "voting");
    await appendEvent({
      simulationId,
      turnIndex: simulation.turnIndex,
      type: "state_transition",
      payload: {
        from: simulation.state,
        to: "voting",
        reason: "manual_finalize",
      },
    });
  }

  await runVotingRound(simulationId);
  return summarizeSimulation(simulationId);
}

function extractKeywords(clue: string): string[] {
  // Pull distinctive content words from a private clue so we can detect
  // whether the clue's substance was surfaced in the transcript. We strip
  // stopwords and short tokens to reduce false positives from filler.
  const stopwords = new Set([
    "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "but",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "with", "by", "at", "from", "as", "that", "this",
    "these", "those", "it", "its", "their", "they", "them", "we", "our",
    "i", "you", "your", "he", "she", "his", "her", "not", "no", "if", "than",
    "then", "so", "such", "also", "more", "most", "some", "any", "all",
  ]);
  return Array.from(
    new Set(
      clue
        .toLowerCase()
        .replace(/[^a-z0-9%$.\s-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !stopwords.has(w)),
    ),
  );
}

function clueSurfaced(clue: string, transcript: string): boolean {
  const keywords = extractKeywords(clue);
  if (keywords.length === 0) return false;
  const lower = transcript.toLowerCase();
  // Require at least 40% of the clue's distinctive keywords to appear,
  // with a minimum of 2 hits. This is heuristic but tracks substantive
  // mentions, not single-word coincidences.
  const minHits = Math.max(2, Math.ceil(keywords.length * 0.4));
  let hits = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) {
      hits += 1;
      if (hits >= minHits) return true;
    }
  }
  return false;
}

export async function summarizeSimulation(simulationId: string) {
  const simulation = await getSimulation(simulationId);
  if (!simulation) throw new Error("Simulation not found.");

  const scenario = getScenarioByKey(simulation.scenarioKey);
  const events = await listEvents(simulation.id);
  const votes = await listVotes(simulation.id);
  const agents = await listSimulationAgents(simulation.id);

  const moderatorCount = events.filter(
    (e) => e.type === "moderator_intervention",
  ).length;

  const consensus = majorityVote(votes);
  const totalAgents = scenario.agents.length;

  const transcript = events
    .filter((e) => e.type === "message")
    .map((e) => String(e.payload.message ?? ""))
    .join("\n");

  const cluesSurfacedByAgent = agents.map((a) => ({
    agentId: a.id,
    displayName: a.displayName,
    privateClue: a.privateClue,
    surfaced: clueSurfaced(a.privateClue, transcript),
  }));
  const cluesSurfacedCount = cluesSurfacedByAgent.filter(
    (c) => c.surfaced,
  ).length;
  const totalClues = cluesSurfacedByAgent.length;

  return {
    simulation,
    metrics: {
      votesCount: votes.length,
      totalAgents,
      moderatorInterventions: moderatorCount,
      consensus,
      optimalDecision: scenario.optimalDecision,
      isConsensusOptimal: consensus
        ? consensus === scenario.optimalDecision
        : false,
      uniqueCluesSurfaced: cluesSurfacedCount,
      totalUniqueClues: totalClues,
      cluesSurfacedByAgent,
    },
  };
}

export const stepRequestSchema = z.object({
  runUntilVoting: z.boolean().optional(),
});
