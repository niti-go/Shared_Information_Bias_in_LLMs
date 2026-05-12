import { convertToModelMessages, type UIMessage } from "ai";
import { generateObject } from "ai";

import {
  getDefaultModel,
  getGatewayProviderOptions,
  resolveGatewayModel,
} from "@/lib/ai/gateway";
import { appendEvent, listEvents, listVotes } from "@/lib/db/repository";
import { moderatorDecisionSchema } from "@/lib/sim/tools";
import type { SimulationRecord } from "@/lib/sim/types";

export const MODERATOR_AGENT_ID = "moderator";

// Only run the moderator at specific turn intervals, not every turn.
const MODERATOR_INTERVAL = 3;

function buildModeratorPrompt(
  simulation: SimulationRecord,
  transcript: string,
  votesRecorded: number,
  convergenceOption: string | null,
): UIMessage {
  const turnsLeft = simulation.maxTurns - simulation.turnIndex;

  return {
    id: "mod-check",
    role: "user",
    parts: [
      {
        type: "text",
        text: [
          "You are a neutral moderator facilitating a structured group decision-making discussion.",
          "Your role is NOT to advocate for any specific option.",
          "Your sole goal is to ensure the group has genuinely explored all perspectives before converging.",
          "",
          "Discussion transcript so far:",
          transcript || "(no messages yet)",
          "",
          "Current statistics:",
          `  - Turns elapsed: ${simulation.turnIndex} of ${simulation.maxTurns}`,
          `  - Turns remaining: ${turnsLeft}`,
          `  - Votes already recorded: ${votesRecorded}`,
          convergenceOption
            ? `  - The group appears to be converging toward: "${convergenceOption}"`
            : "  - No clear convergence detected yet",
          "",
          "Decide whether to intervene now.",
          "",
          "INTERVENE if any of the following are true:",
          "  1. The group is converging but few unique private insights have been shared",
          "  2. Agents are repeating shared information without adding new evidence",
          "  3. A particular option is gaining momentum without critical scrutiny",
          "  4. The discussion has stalled or agents are just agreeing with each other",
          "",
          "DO NOT intervene if:",
          "  - Agents are actively introducing new evidence and debating meaningfully",
          "  - The natural conclusion seems well-reasoned based on what has been shared",
          `  - Only 1 turn remains (let the group finish naturally)`,
          "",
          "If you intervene, write a brief, neutral message (1-3 sentences).",
          "Do NOT suggest which option is correct. Do NOT reveal private information.",
          "Good intervention examples:",
          '  - "Before we converge, has each member shared any unique analysis or data points that haven\'t yet come up?"',
          '  - "I notice we may be reaching consensus. Let\'s ensure we\'ve heard all perspectives — is there any evidence that might challenge the current direction?"',
          '  - "Could anyone elaborate on factors they considered but haven\'t mentioned yet?"',
        ].join("\n"),
      },
    ],
  };
}

function detectConvergence(
  events: Awaited<ReturnType<typeof listEvents>>,
  options: string[],
): string | null {
  const recentMessages = events
    .filter((e) => e.type === "message")
    .slice(-5)
    .map((e) => String(e.payload.message ?? "").toLowerCase());

  if (recentMessages.length < 3) return null;

  for (const option of options) {
    const lowerOption = option.toLowerCase();
    const mentionCount = recentMessages.filter((msg) =>
      msg.includes(lowerOption),
    ).length;
    if (mentionCount >= 3) return option;
  }

  return null;
}

export async function maybeRunModerator(
  simulation: SimulationRecord,
  decisionOptions: string[],
): Promise<void> {
  if (simulation.mode !== "structured") return;

  // Only fire at interval boundaries
  if ((simulation.turnIndex + 1) % MODERATOR_INTERVAL !== 0) return;

  // Don't run on the very last turn
  if (simulation.turnIndex >= simulation.maxTurns - 1) return;

  const events = await listEvents(simulation.id);
  const votes = await listVotes(simulation.id);

  const convergenceOption = detectConvergence(events, decisionOptions);

  const transcript = events
    .filter(
      (e) => e.type === "message" || e.type === "moderator_intervention",
    )
    .slice(-12)
    .map((e) => {
      if (e.type === "moderator_intervention") {
        return `[Moderator]: ${String(e.payload.message ?? "")}`;
      }
      const name = String(e.payload.speakerName ?? e.agentId ?? "Agent");
      return `${name}: ${String(e.payload.message ?? "")}`;
    })
    .join("\n");

  const promptMessage = buildModeratorPrompt(
    simulation,
    transcript,
    votes.length,
    convergenceOption,
  );

  const shouldUseMock = !process.env.AI_GATEWAY_API_KEY;

  if (shouldUseMock) {
    const shouldIntervene = convergenceOption !== null;
    if (!shouldIntervene) return;

    await appendEvent({
      simulationId: simulation.id,
      turnIndex: simulation.turnIndex,
      type: "moderator_intervention",
      agentId: MODERATOR_AGENT_ID,
      payload: {
        shouldIntervene: true,
        interventionType: convergenceOption
          ? "flag_premature_convergence"
          : "ask_for_unique_info",
        message:
          "Before we move forward, has each participant had a chance to share any data or analysis unique to their expertise that hasn't come up yet? I want to make sure we're considering the full picture.",
        reasoning:
          "Mock moderator: low unique-clue rate or convergence detected.",
      },
    });
    return;
  }

  const result = await generateObject({
    model: resolveGatewayModel(simulation.model || getDefaultModel()),
    providerOptions: getGatewayProviderOptions({
      simulationId: simulation.id,
      scenarioKey: simulation.scenarioKey,
      mode: simulation.mode,
    }),
    messages: await convertToModelMessages([promptMessage]),
    schema: moderatorDecisionSchema,
    temperature: 0.3,
  });

  if (!result.object.shouldIntervene || !result.object.message) {
    return;
  }

  await appendEvent({
    simulationId: simulation.id,
    turnIndex: simulation.turnIndex,
    type: "moderator_intervention",
    agentId: MODERATOR_AGENT_ID,
    payload: {
      shouldIntervene: true,
      interventionType: result.object.interventionType,
      message: result.object.message,
      reasoning: result.object.reasoning,
    },
  });
}
