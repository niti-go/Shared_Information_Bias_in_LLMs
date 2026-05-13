"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Agent = {
  id: string;
  displayName: string;
  role: string;
  privateClue: string;
};

type SimEvent = {
  id: string;
  turnIndex: number;
  type: string;
  agentId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

type VoteRecord = {
  id: string;
  agentId: string;
  option: string;
  rationale: string;
  turnIndex: number;
};

type Metrics = {
  votesCount: number;
  totalAgents: number;
  moderatorInterventions: number;
  consensus: string | null;
  optimalDecision: string;
  isConsensusOptimal: boolean;
  uniqueCluesSurfaced: number;
  totalUniqueClues: number;
  cluesSurfacedByAgent: Array<{
    agentId: string;
    displayName: string;
    privateClue: string;
    surfaced: boolean;
  }>;
};

type SimulationData = {
  simulation: {
    id: string;
    scenarioKey: string;
    mode: string;
    moderatorPrompt: string | null;
    model: string;
    state: "created" | "running" | "voting" | "completed";
    turnIndex: number;
    maxTurns: number;
  };
  agents: Agent[];
  events: SimEvent[];
  votes: VoteRecord[];
  metrics: Metrics;
};

// ── Avatar ──────────────────────────────────────────────────────────────────

const AGENT_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-teal-500",
];

function agentColor(agentId: string | null, agents: Agent[]): string {
  if (!agentId) return "bg-zinc-400";
  const idx = agents.findIndex((a) => a.id === agentId);
  return AGENT_COLORS[Math.max(0, idx) % AGENT_COLORS.length];
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Avatar({
  name,
  colorClass,
  size = "md",
}: {
  name: string;
  colorClass: string;
  size?: "sm" | "md";
}) {
  const sz = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  return (
    <div
      className={`${sz} ${colorClass} flex shrink-0 items-center justify-center rounded-full font-semibold text-white`}
    >
      {initials(name)}
    </div>
  );
}

// ── Event cards ──────────────────────────────────────────────────────────────

function StateTransitionCard({ event }: { event: SimEvent }) {
  const { from, to, reason, consensus } = event.payload as Record<
    string,
    string | null | undefined
  >;
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 border-t border-dashed border-zinc-300 dark:border-zinc-700" />
      <span className="rounded-full border border-zinc-300 px-3 py-0.5 text-xs text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
        {from} → {to}
        {reason ? ` (${reason})` : ""}
        {consensus ? ` · consensus: ${consensus}` : ""}
      </span>
      <div className="h-px flex-1 border-t border-dashed border-zinc-300 dark:border-zinc-700" />
    </div>
  );
}

function MessageCard({
  event,
  agents,
}: {
  event: SimEvent;
  agents: Agent[];
}) {
  const speakerName = String(event.payload.speakerName ?? event.agentId ?? "Agent");
  const speakerRole = String(event.payload.speakerRole ?? "");
  const message = String(event.payload.message ?? "");
  const action = String(event.payload.action ?? "message");
  const color = agentColor(event.agentId, agents);

  const actionPill =
    action === "cast_vote" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
        ✓ Voted mid-discussion
      </span>
    ) : null;

  return (
    <div className="flex gap-3">
      <Avatar name={speakerName} colorClass={color} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{speakerName}</span>
          {speakerRole && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {speakerRole}
            </span>
          )}
          {actionPill}
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-zinc-100 px-4 py-2.5 text-sm dark:bg-zinc-800">
          {message}
        </div>
      </div>
    </div>
  );
}


function VoteCard({ event, agents }: { event: SimEvent; agents: Agent[] }) {
  const option = String(event.payload.option ?? "");
  const rationale = String(event.payload.rationale ?? "");
  const speakerName = String(
    event.payload.speakerName ?? event.agentId ?? "Agent",
  );
  const speakerRole = String(event.payload.speakerRole ?? "");
  const isFinal = Boolean(event.payload.isFinalVote);
  const color = agentColor(event.agentId, agents);

  return (
    <div className="flex gap-3">
      <Avatar name={speakerName} colorClass={color} size="sm" />
      <div className="flex-1 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-700 dark:bg-emerald-950/30">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            ✓ {isFinal ? "Final vote" : "Mid-discussion vote"} — {speakerName}
          </p>
          {speakerRole && (
            <span className="text-xs text-emerald-600 dark:text-emerald-500">
              {speakerRole}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
          {option}
        </p>
        {rationale && (
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
            {rationale}
          </p>
        )}
      </div>
    </div>
  );
}

function ModeratorCard({ event }: { event: SimEvent }) {
  const message = String(event.payload.message ?? "");
  const interventionType = String(event.payload.interventionType ?? "");
  const typeLabel: Record<string, string> = {
    ask_for_unique_info: "Asking for unique info",
    flag_premature_convergence: "Flagging premature convergence",
    probe_discussion: "Probing the discussion",
  };

  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
        M
      </div>
      <div className="flex-1 rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-3 dark:border-indigo-700 dark:bg-indigo-950/30">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-400">
          Moderator
          {interventionType && interventionType !== "none"
            ? ` · ${typeLabel[interventionType] ?? interventionType}`
            : ""}
        </p>
        <p className="text-sm text-indigo-900 dark:text-indigo-200">{message}</p>
      </div>
    </div>
  );
}

function EventCard({
  event,
  agents,
}: {
  event: SimEvent;
  agents: Agent[];
}) {
  switch (event.type) {
    case "state_transition":
      return <StateTransitionCard event={event} />;
    case "message":
      return <MessageCard event={event} agents={agents} />;
    case "tool_cast_vote":
      return <VoteCard event={event} agents={agents} />;
    case "moderator_intervention":
      return <ModeratorCard event={event} />;
    default:
      return null;
  }
}

// ── Metrics bar ──────────────────────────────────────────────────────────────

function StatePill({ state }: { state: string }) {
  const styles: Record<string, string> = {
    created: "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
    running: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    voting: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${styles[state] ?? styles.created}`}
    >
      {state}
    </span>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className="h-full rounded-full bg-zinc-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-zinc-500">
        {value}/{max}
      </span>
    </div>
  );
}

// ── Vote tally ───────────────────────────────────────────────────────────────

function VoteTally({
  votes,
  optimalDecision,
}: {
  votes: VoteRecord[];
  optimalDecision: string;
}) {
  if (votes.length === 0) return null;

  const counts = new Map<string, number>();
  for (const v of votes) {
    counts.set(v.option, (counts.get(v.option) ?? 0) + 1);
  }
  const total = votes.length;
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-2">
      {sorted.map(([option, count]) => {
        const pct = Math.round((count / total) * 100);
        const isOptimal = option === optimalDecision;
        return (
          <div key={option}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">
                {option}{" "}
                {isOptimal && (
                  <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                    (optimal)
                  </span>
                )}
              </span>
              <span className="tabular-nums text-zinc-500">
                {count}/{total} ({pct}%)
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all ${isOptimal ? "bg-emerald-500" : "bg-zinc-400"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function SimulationDetail({ simulationId }: { simulationId: string }) {
  const [data, setData] = useState<SimulationData | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timelineEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/simulations/${simulationId}/events`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to load simulation.");
    setData((await res.json()) as SimulationData);
  }, [simulationId]);

  useEffect(() => {
    load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Unknown error");
    });
  }, [load]);

  // Auto-poll every 4 seconds while running (in case of external updates)
  useEffect(() => {
    if (!data) return;
    if (data.simulation.state !== "running" || busyAction !== null) return;
    const interval = setInterval(() => {
      load().catch(() => null);
    }, 4000);
    return () => clearInterval(interval);
  }, [data, busyAction, load]);

  // Scroll timeline to bottom when events update
  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.events.length]);

  async function callAction(
    path: string,
    actionKey: string,
    body?: Record<string, unknown>,
  ) {
    setBusyAction(actionKey);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(String(payload.error ?? "Action failed."));
      }
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusyAction(null);
    }
  }

  const agents = useMemo(() => data?.agents ?? [], [data]);
  const events = useMemo(() => data?.events ?? [], [data]);
  const metrics = data?.metrics;
  const sim = data?.simulation;
  const isActive = sim && sim.state !== "completed";
  const isBusy = busyAction !== null;

  return (
    <div className="space-y-6">
      {/* ── Metrics bar ── */}
      {sim && metrics && (
        <div className="rounded-xl border bg-white p-4 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">State</span>
              <StatePill state={sim.state} />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Turns</p>
              <ProgressBar value={sim.turnIndex} max={sim.maxTurns} />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Votes cast</p>
              <ProgressBar value={metrics.votesCount} max={metrics.totalAgents} />
            </div>
            {sim.mode === "structured" && (
              <>
                <div>
                  <p className="text-xs text-zinc-500">Moderator interventions</p>
                  <p className="text-sm font-medium">{metrics.moderatorInterventions}</p>
                </div>
                {sim.moderatorPrompt && (
                  <div>
                    <p className="text-xs text-zinc-500">Moderator prompt</p>
                    <p className="text-sm font-medium text-indigo-700 dark:text-indigo-400">
                      {sim.moderatorPrompt}
                    </p>
                  </div>
                )}
              </>
            )}
            {metrics.consensus && (
              <div>
                <p className="text-xs text-zinc-500">Consensus</p>
                <p className="text-sm font-medium">{metrics.consensus}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-zinc-500">Unique clues surfaced</p>
              <p className="text-sm font-medium">
                {metrics.uniqueCluesSurfaced}/{metrics.totalUniqueClues}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            callAction(`/api/simulations/${simulationId}/step`, "step", {
              runUntilVoting: false,
            })
          }
          disabled={!isActive || isBusy}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {busyAction === "step" ? "Running…" : "Run 1 step"}
        </button>
        <button
          type="button"
          onClick={() =>
            callAction(`/api/simulations/${simulationId}/step`, "run-all", {
              runUntilVoting: true,
            })
          }
          disabled={!isActive || isBusy}
          className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800"
        >
          {busyAction === "run-all" ? "Running…" : "Run to completion"}
        </button>
        <button
          type="button"
          onClick={() =>
            callAction(`/api/simulations/${simulationId}/vote`, "finalize")
          }
          disabled={!isActive || isBusy}
          className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800"
        >
          {busyAction === "finalize" ? "Finalizing…" : "Finalize votes now"}
        </button>
        {isBusy && (
          <span className="text-sm text-zinc-500 animate-pulse">
            Calling AI Gateway…
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}

      {/* ── Outcome banner ── */}
      {sim?.state === "completed" && metrics && (
        <div
          className={`rounded-xl border px-5 py-4 ${
            metrics.isConsensusOptimal
              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
              : "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30"
          }`}
        >
          <p className="font-semibold">
            {metrics.isConsensusOptimal
              ? "✓ Optimal decision reached"
              : "✗ Suboptimal decision"}
          </p>
          <p className="mt-1 text-sm">
            Consensus: <strong>{metrics.consensus ?? "none"}</strong> ·
            Optimal was: <strong>{metrics.optimalDecision}</strong>
          </p>
        </div>
      )}

      {/* ── Timeline ── */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Discussion Timeline</h2>
        <div className="space-y-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} agents={agents} />
          ))}
          {events.length === 0 && (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-zinc-500">
              No events yet. Use the controls above to start the simulation.
            </p>
          )}
          <div ref={timelineEndRef} />
        </div>
      </div>

      {/* ── Vote tally ── */}
      {data && data.votes.length > 0 && (
        <div className="rounded-xl border p-4">
          <h2 className="mb-3 text-lg font-semibold">Vote Distribution</h2>
          <VoteTally
            votes={data.votes}
            optimalDecision={data.metrics.optimalDecision}
          />
        </div>
      )}

      {/* ── Agent roster ── */}
      {agents.length > 0 && (
        <details className="rounded-xl border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            Agent roster ({agents.length})
          </summary>
          <div className="divide-y px-4 pb-4">
            {agents.map((agent, i) => (
              <div key={agent.id} className="py-3">
                <div className="flex items-center gap-2">
                  <Avatar
                    name={agent.displayName}
                    colorClass={AGENT_COLORS[i % AGENT_COLORS.length]}
                    size="sm"
                  />
                  <div>
                    <p className="text-sm font-medium">{agent.displayName}</p>
                    <p className="text-xs text-zinc-500">{agent.role}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    Private clue:
                  </span>{" "}
                  {agent.privateClue}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
