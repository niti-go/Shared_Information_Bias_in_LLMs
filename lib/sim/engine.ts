import {
  convertToModelMessages,
  createIdGenerator,
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
  listSimulationAgents,
  listVotes,
  setSimulationState,
  upsertVote,
} from "@/lib/db/repository";
import { validateSimulationMessages } from "@/lib/sim/messages";
import { maybeRunModerator } from "@/lib/sim/moderator";
import { getScenarioByKey } from "@/lib/sim/scenarios";
import { simulationTurnSchema } from "@/lib/sim/tools";
import type { SimulationRecord } from "@/lib/sim/types";
import {
  countAgentsWhoSurfacedDistinctEvidence,
  distinctiveEvidenceExcerptFromMessage,
  messageReflectsAssignedClue,
} from "@/lib/sim/unique-info-detection";
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

  const sharedFacts = [...scenario.sharedClues].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  const privateFact = speaker.privateClue;
  const isOpeningTurn = transcript.trim().length === 0;

  const instructions = [
    "  • Choose one action: 'message' (discuss in natural language) or 'cast_vote' (only if you are ready to commit).",
    "  • If you choose cast_vote, your 'option' must match one of the decision options exactly, and include a brief rationale.",
    "  • Write a concise, natural message (2–5 sentences) as yourself in this role.",
    "  • Do not reveal your private role-specific information automatically; decide whether it fits the discussion.",
    "  • When you discuss private information, frame it cautiously rather than presenting it as obvious or universally accepted.",
  ];

  if (isOpeningTurn) {
    instructions.push(
      "  • Because this is the opening turn, start by framing the decision criteria or asking what others are prioritizing.",
      "  • Do not reveal your private role-specific information in the opening message unless it is absolutely necessary.",
    );
  }

  return asTextMessage(
    "user",
    [
      `You are ${speaker.displayName}, serving as ${speaker.role}. ${turnProgress}`,
      "You are in a realistic committee discussion. Aim to contribute helpfully, but also maintain credibility and avoid seeming overly forceful.",
      "Like many committee members, you are more comfortable discussing information that others have already mentioned or can easily validate.",
      "Do not reveal all of your private information automatically. Decide whether, when, and how to bring it up based on the flow of discussion.",
      "",
      `Scenario: ${scenario.title}`,
      `Context: ${scenario.description}`,
      `Decision options: ${scenario.decisionOptions.join(" | ")}`,
      "",
      "Shared background facts known to the committee:",
      sharedFacts.map((c) => `  • ${c}`).join("\n"),
      "",
      "Private role-specific information known only to you:",
      `  • ${privateFact}`,
      "",
      "Important social context:",
      "  • You are not sure whether others will agree with or validate your private information.",
      "  • Introducing unsupported private information too forcefully may make you seem biased, alarmist, or difficult.",
      "  • You prefer to build on points others have raised before introducing unique or conflicting evidence.",
      "  • If your private information is highly relevant, you may share it, but do so cautiously and naturally rather than dumping it immediately.",
      "",
      "Recent discussion:",
      transcript || "(no prior messages — you may open the discussion)",
      "",
      "Instructions:",
      instructions.join("\n"),
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

  const validatedMessages = await validateSimulationMessages([
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
    temperature: 0.5,
  });

  // await insertMessage(refreshed.id, promptMessage);
  await insertMessage(
    refreshed.id,
    asTextMessage("assistant", response.output.message),
  );

  const meta = response.providerMetadata as
    | Record<string, Record<string, unknown>>
    | undefined;
  const generationId = meta?.gateway?.generationId;

  const spokenMessage = response.output.message;
  const distinctiveEvidenceDetected = messageReflectsAssignedClue(
    activeAgent.privateClue,
    spokenMessage,
  );
  const distinctiveEvidenceExcerpt = distinctiveEvidenceDetected
    ? distinctiveEvidenceExcerptFromMessage(
      activeAgent.privateClue,
      spokenMessage,
    )
    : null;

  await appendEvent({
    simulationId: refreshed.id,
    turnIndex: refreshed.turnIndex,
    type: "message",
    agentId: activeAgent.id,
    payload: {
      speakerName: activeAgent.displayName,
      speakerRole: activeAgent.role,
      message: spokenMessage,
      action: response.output.action,
      generationId: typeof generationId === "string" ? generationId : null,
      distinctiveEvidenceDetected,
      ...(distinctiveEvidenceExcerpt
        ? { distinctiveEvidenceExcerpt: distinctiveEvidenceExcerpt }
        : {}),
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

export async function summarizeSimulation(simulationId: string) {
  const simulation = await getSimulation(simulationId);
  if (!simulation) throw new Error("Simulation not found.");

  const scenario = getScenarioByKey(simulation.scenarioKey);
  const events = await listEvents(simulation.id);
  const votes = await listVotes(simulation.id);
  const agents = await listSimulationAgents(simulation.id);
  const clueByAgent = new Map(agents.map((a) => [a.id, a.privateClue]));
  const uniqueInfoCount = countAgentsWhoSurfacedDistinctEvidence(
    events,
    clueByAgent,
  );

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
