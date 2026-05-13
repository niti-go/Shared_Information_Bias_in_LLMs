import { convertToModelMessages, type UIMessage } from "ai";
import { generateObject } from "ai";

import {
  getDefaultModel,
  getGatewayProviderOptions,
  resolveGatewayModel,
} from "@/lib/ai/gateway";
import { appendEvent, listEvents, listVotes } from "@/lib/db/repository";
import { moderatorDecisionSchema } from "@/lib/sim/tools";
import type { ModeratorPrompt, SimulationRecord } from "@/lib/sim/types";

export const MODERATOR_AGENT_ID = "moderator";

const MODERATOR_INTERVAL = 3;

export const MODERATOR_PROMPT_VARIANTS: ReadonlyArray<{
  id: ModeratorPrompt;
  label: string;
  description: string;
}> = [
  {
    id: "blind-process",
    label: "Blind facilitator (process-only)",
    description:
      "Knows nothing about the scenario. Intervenes only on generic discussion process: turn-taking, depth of reasoning, engagement. No hidden-profile vocabulary.",
  },
  {
    id: "devils-advocate",
    label: "Devil's advocate",
    description:
      "Surfaces the strongest case against the direction the group is heading. Borrowed from Schwenk's devil's-advocacy literature.",
  },
  {
    id: "socratic-probe",
    label: "Socratic probe",
    description:
      "Asks clarifying / justification questions on whichever claim seems load-bearing. Tests whether forcing justification alone changes outcomes.",
  },
  {
    id: "hidden-profile-aware",
    label: "Hidden-profile-aware (leaky)",
    description:
      "Explicitly knows the task may hide unique information and prompts agents to share what hasn't come up. Matches Stasser-style structured information-sharing interventions; methodologically leaky but kept for comparison.",
  },
];

const DEFAULT_MODERATOR_PROMPT: ModeratorPrompt = "blind-process";

function commonHeader(
  simulation: SimulationRecord,
  transcript: string,
  votesRecorded: number,
  convergenceHint: string | null,
): string[] {
  const turnsLeft = simulation.maxTurns - simulation.turnIndex;
  return [
    "Discussion transcript so far:",
    transcript || "(no messages yet)",
    "",
    "Current statistics:",
    `  - Turns elapsed: ${simulation.turnIndex} of ${simulation.maxTurns}`,
    `  - Turns remaining: ${turnsLeft}`,
    `  - Votes already recorded: ${votesRecorded}`,
    convergenceHint
      ? `  - The conversation appears to be settling on one direction.`
      : "  - No clear convergence detected yet.",
    "",
  ];
}

function buildBlindProcessPrompt(
  simulation: SimulationRecord,
  transcript: string,
  votesRecorded: number,
  convergenceHint: string | null,
): string {
  return [
    "You are a neutral discussion facilitator. You have NO information about the scenario, the options being debated, or what evidence anyone holds.",
    "Your only job is to monitor discussion process and, when useful, ask a procedural question that helps the group deliberate well.",
    "",
    ...commonHeader(simulation, transcript, votesRecorded, convergenceHint),
    "Process signals you may consider:",
    "  - Has each participant spoken substantively, or is one voice dominating?",
    "  - Are participants engaging with each other's points, or talking past them?",
    "  - Have reasons and evidence been offered, or mostly conclusions?",
    "  - Has the group considered the strongest case for and against the direction it seems to be heading?",
    "",
    "Decide whether to intervene now. DO NOT intervene on the final turn.",
    "If you intervene, write 1–2 sentences as a question about discussion PROCESS — not content, evidence, or which option is right.",
    "Forbidden words: 'unique', 'private', 'shared', 'hidden', 'unshared'. Do not suggest anyone is withholding information. Do not name any option.",
    "",
    "Acceptable examples:",
    '  - "Before moving on, has each participant had a chance to weigh in on this?"',
    '  - "What\'s the strongest objection to where the conversation is heading right now?"',
    '  - "Can someone restate the reasoning behind the current direction in their own words?"',
  ].join("\n");
}

function buildDevilsAdvocatePrompt(
  simulation: SimulationRecord,
  transcript: string,
  votesRecorded: number,
  convergenceHint: string | null,
): string {
  return [
    "You are a devil's advocate facilitator. Your role is to surface the strongest case AGAINST whichever direction the group is heading, regardless of what that direction is.",
    "You are not advocating any particular outcome — you are stress-testing the group's reasoning.",
    "",
    ...commonHeader(simulation, transcript, votesRecorded, convergenceHint),
    "Decide whether to intervene now. DO NOT intervene on the final turn.",
    "Intervene if the group is moving toward a decision without seriously stress-testing it.",
    "If you intervene, write 1–2 sentences that articulate or invite the strongest counter-argument to the current direction.",
    "Do not reveal information not already in the transcript. Do not assert facts. You may name the option being challenged.",
    "",
    "Acceptable examples:",
    '  - "Suppose this decision turned out badly a year from now — what would the most likely reason be?"',
    '  - "What evidence, if it existed, would change your minds about the current direction?"',
    '  - "Let me push back: the case for this option rests on a few specific claims — which is the weakest?"',
  ].join("\n");
}

function buildSocraticProbePrompt(
  simulation: SimulationRecord,
  transcript: string,
  votesRecorded: number,
  convergenceHint: string | null,
): string {
  return [
    "You are a Socratic facilitator. Your role is to ask one clarifying or justification-seeking question about whichever claim in the transcript seems most load-bearing.",
    "You do not advocate, summarize, or introduce new information. You only probe.",
    "",
    ...commonHeader(simulation, transcript, votesRecorded, convergenceHint),
    "Decide whether to intervene now. DO NOT intervene on the final turn.",
    "Intervene if any claim is being treated as settled without being examined.",
    "If you intervene, write a single concise question (max 2 sentences) that asks WHY a participant believes a specific claim, or HOW they would justify it.",
    "Do not reveal information not already in the transcript. Do not name any option as correct or incorrect.",
    "",
    "Acceptable examples:",
    '  - "You mentioned [claim X] as a key factor — what specifically makes you confident in that?"',
    '  - "How would you justify giving weight to [claim X] over [claim Y]?"',
    '  - "If you had to defend that reasoning to someone skeptical, what would you say?"',
  ].join("\n");
}

function buildHiddenProfileAwarePrompt(
  simulation: SimulationRecord,
  transcript: string,
  votesRecorded: number,
  convergenceHint: string | null,
): string {
  return [
    "You are a neutral moderator facilitating a structured group decision-making discussion.",
    "Your role is NOT to advocate for any specific option.",
    "Your sole goal is to ensure the group has genuinely explored all perspectives before converging.",
    "",
    ...commonHeader(simulation, transcript, votesRecorded, convergenceHint),
    "INTERVENE if any of the following are true:",
    "  1. The group is converging but few unique private insights have been shared",
    "  2. Agents are repeating shared information without adding new evidence",
    "  3. A particular option is gaining momentum without critical scrutiny",
    "  4. The discussion has stalled or agents are just agreeing with each other",
    "",
    "DO NOT intervene if:",
    "  - Agents are actively introducing new evidence and debating meaningfully",
    "  - The natural conclusion seems well-reasoned based on what has been shared",
    "  - Only 1 turn remains (let the group finish naturally)",
    "",
    "If you intervene, write a brief, neutral message (1–3 sentences).",
    "Do NOT suggest which option is correct. Do NOT reveal private information.",
    "Good intervention examples:",
    '  - "Before we converge, has each member shared any unique analysis or data points that haven\'t yet come up?"',
    '  - "I notice we may be reaching consensus. Let\'s ensure we\'ve heard all perspectives — is there any evidence that might challenge the current direction?"',
    '  - "Could anyone elaborate on factors they considered but haven\'t mentioned yet?"',
  ].join("\n");
}

function getMockMessage(variant: ModeratorPrompt): string {
  switch (variant) {
    case "blind-process":
      return "Before moving on, has each participant had a chance to weigh in on this?";
    case "devils-advocate":
      return "Suppose this decision turned out badly a year from now — what would the most likely reason be?";
    case "socratic-probe":
      return "What specifically makes you confident in the reasoning the group has converged on?";
    case "hidden-profile-aware":
      return "Before we move forward, has each participant had a chance to share any data or analysis unique to their expertise that hasn't come up yet?";
  }
}

function renderPromptText(
  variant: ModeratorPrompt,
  simulation: SimulationRecord,
  transcript: string,
  votesRecorded: number,
  convergenceHint: string | null,
): string {
  switch (variant) {
    case "blind-process":
      return buildBlindProcessPrompt(
        simulation,
        transcript,
        votesRecorded,
        convergenceHint,
      );
    case "devils-advocate":
      return buildDevilsAdvocatePrompt(
        simulation,
        transcript,
        votesRecorded,
        convergenceHint,
      );
    case "socratic-probe":
      return buildSocraticProbePrompt(
        simulation,
        transcript,
        votesRecorded,
        convergenceHint,
      );
    case "hidden-profile-aware":
      return buildHiddenProfileAwarePrompt(
        simulation,
        transcript,
        votesRecorded,
        convergenceHint,
      );
  }
}

export function getModeratorPromptTemplate(variant: ModeratorPrompt): string {
  const placeholderSimulation = {
    maxTurns: 10,
    turnIndex: 6,
  } as SimulationRecord;
  const placeholderTranscript = "{{ recent transcript injected here at runtime }}";
  return renderPromptText(
    variant,
    placeholderSimulation,
    placeholderTranscript,
    0,
    null,
  );
}

function buildModeratorPrompt(
  simulation: SimulationRecord,
  transcript: string,
  votesRecorded: number,
  convergenceHint: string | null,
): UIMessage {
  const variant = simulation.moderatorPrompt ?? DEFAULT_MODERATOR_PROMPT;
  const text = renderPromptText(
    variant,
    simulation,
    transcript,
    votesRecorded,
    convergenceHint,
  );

  return {
    id: "mod-check",
    role: "user",
    parts: [{ type: "text", text }],
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

  if ((simulation.turnIndex + 1) % MODERATOR_INTERVAL !== 0) return;

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

  const variant = simulation.moderatorPrompt ?? DEFAULT_MODERATOR_PROMPT;
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
        interventionType: "probe_discussion",
        message: getMockMessage(variant),
        reasoning: `Mock moderator (${variant}): convergence detected.`,
        promptVariant: variant,
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
      promptVariant: variant,
    },
  });
}
