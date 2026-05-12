import { convertToModelMessages, type UIMessage } from "ai";
import { generateObject } from "ai";

import {
  getDefaultModel,
  getGatewayProviderOptions,
  resolveGatewayModel,
} from "@/lib/ai/gateway";
import {
  appendEvent,
  getSimulation,
  listEvents,
  listSimulationAgents,
  listVotes,
  setSimulationState,
  upsertVote,
} from "@/lib/db/repository";
import { getScenarioByKey } from "@/lib/sim/scenarios";
import { castVoteSchema } from "@/lib/sim/tools";
import type { SimulationRecord, VoteRecord } from "@/lib/sim/types";

function majorityVote(votes: VoteRecord[]): string | null {
  if (votes.length === 0) return null;
  const counts = new Map<string, number>();
  for (const v of votes) {
    counts.set(v.option, (counts.get(v.option) ?? 0) + 1);
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

function buildVotePrompt(
  simulation: SimulationRecord,
  agent: { id: string; displayName: string; role: string; privateClue: string },
  decisionOptions: string[],
  transcript: string,
): UIMessage {
  return {
    id: `vote-prompt-${agent.id}`,
    role: "user",
    parts: [
      {
        type: "text",
        text: [
          `You are ${agent.displayName} (${agent.role}).`,
          "The discussion phase has ended. It is now time to cast your FINAL VOTE.",
          "",
          "Information available to you:",
          `  • ${agent.privateClue}`,
          "",
          "Full discussion transcript:",
          transcript || "(no prior discussion)",
          "",
          `Decision options: ${decisionOptions.join(", ")}`,
          "",
          "Review all the information — both what was shared in the discussion and what you know.",
          "Choose the option you believe is most strongly supported by the combined evidence.",
          "Provide a concise rationale (2-4 sentences) explaining your reasoning.",
          "Your vote must be one of the listed options exactly as written.",
        ].join("\n"),
      },
    ],
  };
}

export async function runVotingRound(simulationId: string): Promise<{
  votes: VoteRecord[];
  consensus: string | null;
  isConsensusOptimal: boolean;
  optimalDecision: string;
}> {
  const simulation = await getSimulation(simulationId);
  if (!simulation) throw new Error("Simulation not found.");

  const scenario = getScenarioByKey(simulation.scenarioKey);
  const agents = await listSimulationAgents(simulationId);
  const existingVotes = await listVotes(simulationId);
  const votedIds = new Set(existingVotes.map((v) => v.agentId));

  const events = await listEvents(simulationId);
  const transcript = events
    .filter(
      (e) => e.type === "message" || e.type === "moderator_intervention",
    )
    .map((e) => {
      if (e.type === "moderator_intervention") {
        return `[Moderator]: ${String(e.payload.message ?? "")}`;
      }
      const name = String(e.payload.speakerName ?? e.agentId ?? "Agent");
      return `${name}: ${String(e.payload.message ?? "")}`;
    })
    .join("\n");

  const shouldUseMock = !process.env.AI_GATEWAY_API_KEY;

  for (const agent of agents) {
    if (votedIds.has(agent.id)) continue;

    const promptMessage = buildVotePrompt(
      simulation,
      agent,
      scenario.decisionOptions,
      transcript,
    );

    let option: string;
    let rationale: string;

    if (shouldUseMock) {
      option = scenario.optimalDecision;
      rationale = `After reviewing the full discussion and applying my private expertise, ${scenario.optimalDecision} is the strongest choice given the combined body of evidence presented.`;
    } else {
      const result = await generateObject({
        model: resolveGatewayModel(simulation.model || getDefaultModel()),
        providerOptions: getGatewayProviderOptions({
          simulationId: simulation.id,
          scenarioKey: simulation.scenarioKey,
          mode: simulation.mode,
        }),
        messages: await convertToModelMessages([promptMessage]),
        schema: castVoteSchema,
        temperature: 0.3,
      });
      option = result.object.option;
      rationale = result.object.rationale;
    }

    await upsertVote({
      simulationId,
      agentId: agent.id,
      option,
      rationale,
      turnIndex: simulation.turnIndex,
    });

    await appendEvent({
      simulationId,
      turnIndex: simulation.turnIndex,
      type: "tool_cast_vote",
      agentId: agent.id,
      payload: {
        option,
        rationale,
        isFinalVote: true,
        speakerName: agent.displayName,
        speakerRole: agent.role,
      },
    });
  }

  const allVotes = await listVotes(simulationId);
  const consensus = majorityVote(allVotes);

  await setSimulationState(simulationId, "completed");
  await appendEvent({
    simulationId,
    turnIndex: simulation.turnIndex,
    type: "state_transition",
    payload: { from: "voting", to: "completed", consensus },
  });

  return {
    votes: allVotes,
    consensus,
    isConsensusOptimal: consensus === scenario.optimalDecision,
    optimalDecision: scenario.optimalDecision,
  };
}
