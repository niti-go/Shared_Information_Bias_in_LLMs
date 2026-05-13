import type { SimulationEventRecord } from "@/lib/sim/types";

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** True if this single message reuses substantial wording from the assigned clue. */
export function messageReflectsAssignedClue(
  clue: string,
  message: string,
): boolean {
  return agentMessagesReflectClue(clue, [message]);
}

/**
 * Short excerpt from the message around the first detected overlap with the clue
 * (for UI). Returns null if no overlap.
 */
export function distinctiveEvidenceExcerptFromMessage(
  clue: string,
  message: string,
): string | null {
  if (!messageReflectsAssignedClue(clue, message)) return null;
  const lower = message.toLowerCase();
  const normClue = normalizeForMatch(clue);
  const win = 28;
  for (let i = 0; i + win <= normClue.length; i += 6) {
    const frag = normClue.slice(i, i + win);
    if (frag.length < 22) continue;
    const idx = lower.indexOf(frag);
    if (idx !== -1) {
      const pad = 48;
      const start = Math.max(0, idx - pad);
      const end = Math.min(message.length, idx + frag.length + pad);
      return message.slice(start, end).replace(/\s+/g, " ").trim();
    }
  }
  const clauses = normClue
    .split(/[.;!?]+|;+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 22);
  for (const c of clauses) {
    const idx = lower.indexOf(c);
    if (idx !== -1) {
      const pad = 48;
      const start = Math.max(0, idx - pad);
      const end = Math.min(message.length, idx + c.length + pad);
      return message.slice(start, end).replace(/\s+/g, " ").trim();
    }
  }
  return message.slice(0, Math.min(220, message.length)).trim();
}

export function countAgentsWhoSurfacedDistinctEvidence(
  events: SimulationEventRecord[],
  privateClueByAgentId: Map<string, string>,
): number {
  const surfaced = new Set<string>();

  for (const e of events) {
    if (e.type === "tool_reveal_unique_clue" && e.agentId) {
      surfaced.add(e.agentId);
    }
  }

  const messagesByAgent = new Map<string, string[]>();
  for (const e of events) {
    if (e.type !== "message" || !e.agentId) continue;
    const text = String(e.payload.message ?? "");
    const list = messagesByAgent.get(e.agentId) ?? [];
    list.push(text);
    messagesByAgent.set(e.agentId, list);
  }

  for (const [agentId, clue] of privateClueByAgentId) {
    if (surfaced.has(agentId)) continue;
    const messages = messagesByAgent.get(agentId);
    if (messages?.length && agentMessagesReflectClue(clue, messages)) {
      surfaced.add(agentId);
    }
  }

  return surfaced.size;
}

/**
 * Detects whether an agent's messages reuse substantial wording from their
 * assigned clue. Models usually paraphrase; exact sentence matches are rare,
 * so we also scan sliding substrings of the clue against the transcript.
 */
function agentMessagesReflectClue(clue: string, messages: string[]): boolean {
  const combined = normalizeForMatch(messages.join("\n"));
  const normalizedClue = normalizeForMatch(clue);

  if (normalizedClue.length < 12) {
    return combined.includes(normalizedClue);
  }

  const clauses = normalizedClue
    .split(/[.;!?]+|;+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 22);

  for (const c of clauses) {
    if (combined.includes(c)) return true;
  }

  if (normalizedClue.length >= 18 && normalizedClue.length <= 45) {
    if (combined.includes(normalizedClue)) return true;
  }

  const windowLen = 28;
  const step = 6;
  if (normalizedClue.length >= windowLen) {
    for (let i = 0; i + windowLen <= normalizedClue.length; i += step) {
      const frag = normalizedClue.slice(i, i + windowLen);
      if (frag.length >= 22 && combined.includes(frag)) return true;
    }
  }

  const mid = Math.floor(normalizedClue.length / 2) - 14;
  const start = Math.max(0, mid);
  const slice = normalizedClue.slice(start, start + 44);
  if (slice.length >= 24 && combined.includes(slice)) return true;

  return false;
}
