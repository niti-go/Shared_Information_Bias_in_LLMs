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

function modeInstruction(mode: SimulationMode): string {
  if (mode === "structured") {
    return [
      "You are in a STRUCTURED discussion with a neutral moderator.",
      "When the moderator speaks, take their prompt seriously and prioritize surfacing any information you haven't yet shared.",
      "Do not rush to consensus — ensure your unique perspective has been heard.",
    ].join(" ");
  }
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
          "The combined evidence from the discussion and my private analysis points clearly to this option.",
      },
    };
  }

  if (turnIndex % 3 === 1) {
    return {
      message: `I'd like to share a specific piece of analysis from my area of expertise that I think is critical here.`,
      action: "reveal_unique_clue" as const,
      reveal_unique_clue: { clue: activeAgent.privateClue },
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
      "Information shared with ALL participants:",
      scenario.sharedClues.map((c) => `  • ${c}`).join("\n"),
      "",
      "Your PRIVATE information (only you know this):",
      `  • ${speaker.privateClue}`,
      "",
      "Recent discussion:",
      transcript || "(no prior messages — you may open the discussion)",
      "",
      "Instructions:",
      "  • Choose one action: 'message' (discuss), 'reveal_unique_clue' (explicitly surface your private info), or 'cast_vote' (if you are ready to commit).",
      "  • If you choose reveal_unique_clue, your 'clue' field should faithfully convey your private information in your own words.",
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

  if (
    response.output.action === "reveal_unique_clue" &&
    response.output.reveal_unique_clue
  ) {
    await appendEvent({
      simulationId: refreshed.id,
      turnIndex: refreshed.turnIndex,
      type: "tool_reveal_unique_clue",
      agentId: activeAgent.id,
      payload: {
        clue: response.output.reveal_unique_clue.clue,
        speakerName: activeAgent.displayName,
        speakerRole: activeAgent.role,
      },
    });
  }

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

export async function summarizeSimulation(simulationId: string) {
  const simulation = await getSimulation(simulationId);
  if (!simulation) throw new Error("Simulation not found.");

  const scenario = getScenarioByKey(simulation.scenarioKey);
  const events = await listEvents(simulation.id);
  const votes = await listVotes(simulation.id);

  const uniqueInfoCount = events.filter(
    (e) => e.type === "tool_reveal_unique_clue",
  ).length;

  const moderatorCount = events.filter(
    (e) => e.type === "moderator_intervention",
  ).length;

  const consensus = majorityVote(votes);
  const totalAgents = scenario.agents.length;

  return {
    simulation,
    metrics: {
      uniqueInfoMentions: uniqueInfoCount,
      totalPrivateClues: totalAgents,
      votesCount: votes.length,
      totalAgents,
      moderatorInterventions: moderatorCount,
      consensus,
      optimalDecision: scenario.optimalDecision,
      isConsensusOptimal: consensus
        ? consensus === scenario.optimalDecision
        : false,
    },
  };
}

export const stepRequestSchema = z.object({
  runUntilVoting: z.boolean().optional(),
});
