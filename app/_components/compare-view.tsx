"use client";

import { useEffect, useMemo, useState } from "react";

type SimEvent = {
  id: string;
  turnIndex: number;
  type: string;
  agentId: string | null;
  payload: Record<string, unknown>;
};

type VoteRecord = {
  agentId: string;
  option: string;
  rationale: string;
};

type Metrics = {
  uniqueInfoMentions: number;
  totalPrivateClues: number;
  votesCount: number;
  totalAgents: number;
  moderatorInterventions: number;
  consensus: string | null;
  optimalDecision: string;
  isConsensusOptimal: boolean;
};

type RunData = {
  simulation: {
    id: string;
    scenarioKey: string;
    mode: string;
    model: string;
    state: string;
    turnIndex: number;
    maxTurns: number;
  };
  events: SimEvent[];
  votes: VoteRecord[];
  metrics: Metrics;
};

type SimListItem = {
  id: string;
  scenarioKey: string;
  mode: string;
  model: string;
  state: string;
};

async function fetchRun(runId: string): Promise<RunData> {
  const res = await fetch(`/api/simulations/${runId}/events`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load run.");
  return (await res.json()) as RunData;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

function OutcomeBadge({ isOptimal }: { isOptimal: boolean }) {
  return isOptimal ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
      ✓ Optimal
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-300">
      ✗ Suboptimal
    </span>
  );
}

function VoteBar({
  option,
  count,
  total,
  isOptimal,
}: {
  option: string;
  count: number;
  total: number;
  isOptimal: boolean;
}) {
  const width = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div className="text-xs">
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <span className={`truncate font-medium ${isOptimal ? "text-emerald-700 dark:text-emerald-400" : ""}`}>
          {option}
        </span>
        <span className="shrink-0 tabular-nums text-zinc-500">
          {count}/{total}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all ${isOptimal ? "bg-emerald-500" : "bg-zinc-400"}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function RunMetrics({
  run,
  label,
}: {
  run: RunData | null;
  label: string;
}) {
  if (!run) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-zinc-400">
        Select a run to compare
      </div>
    );
  }

  const { simulation: sim, metrics, votes } = run;

  const voteCounts = new Map<string, number>();
  for (const v of votes) {
    voteCounts.set(v.option, (voteCounts.get(v.option) ?? 0) + 1);
  }
  const sortedVotes = [...voteCounts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-zinc-500">Model</p>
        <p className="font-medium">{sim.model}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border px-2 py-0.5 text-xs capitalize">
          {sim.mode}
        </span>
        <span className="rounded-full border px-2 py-0.5 text-xs capitalize">
          {sim.state}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-zinc-500">Turns</p>
          <p className="font-medium">
            {sim.turnIndex}/{sim.maxTurns}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Unique clues surfaced</p>
          <p className="font-medium">
            {metrics.uniqueInfoMentions}/{metrics.totalPrivateClues}
            <span className="ml-1 text-zinc-400">
              ({pct(metrics.uniqueInfoMentions, metrics.totalPrivateClues)})
            </span>
          </p>
        </div>
        {sim.mode === "structured" && (
          <div>
            <p className="text-xs text-zinc-500">Moderator interventions</p>
            <p className="font-medium">{metrics.moderatorInterventions}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-zinc-500">Final consensus</p>
          <p className="font-medium">{metrics.consensus ?? "—"}</p>
        </div>
      </div>

      {metrics.consensus && (
        <div className="flex items-center gap-2">
          <OutcomeBadge isOptimal={metrics.isConsensusOptimal} />
          <span className="text-xs text-zinc-500">
            Optimal: {metrics.optimalDecision}
          </span>
        </div>
      )}

      {sortedVotes.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Vote distribution
          </p>
          <div className="space-y-2">
            {sortedVotes.map(([option, count]) => (
              <VoteBar
                key={option}
                option={option}
                count={count}
                total={votes.length}
                isOptimal={option === metrics.optimalDecision}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TranscriptExcerpt({ events }: { events: SimEvent[] }) {
  const messages = events
    .filter((e) => e.type === "message" || e.type === "moderator_intervention")
    .slice(-15);

  if (messages.length === 0) {
    return (
      <p className="text-xs text-zinc-400 italic">No messages recorded.</p>
    );
  }

  return (
    <div className="max-h-72 space-y-2 overflow-y-auto text-xs">
      {messages.map((e) => {
        const isMod = e.type === "moderator_intervention";
        const name = isMod
          ? "Moderator"
          : String(e.payload.speakerName ?? e.agentId ?? "Agent");
        const text = String(
          isMod ? e.payload.message : e.payload.message ?? "",
        );
        return (
          <div
            key={e.id}
            className={`rounded p-2 ${
              isMod
                ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200"
                : "bg-zinc-50 dark:bg-zinc-800/50"
            }`}
          >
            <span className="font-semibold">{name}: </span>
            {text}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function CompareView() {
  const [runs, setRuns] = useState<SimListItem[]>([]);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [left, setLeft] = useState<RunData | null>(null);
  const [right, setRight] = useState<RunData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/simulations", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ simulations: SimListItem[] }>)
      .then((data) => {
        setRuns(data.simulations);
        const completed = data.simulations.filter((s) => s.state === "completed");
        if (completed.length > 0) setLeftId(completed[0].id);
        if (completed.length > 1) setRightId(completed[1].id);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Unknown error"),
      );
  }, []);

  useEffect(() => {
    if (!leftId) { setLeft(null); return; }
    fetchRun(leftId)
      .then(setLeft)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Unknown error"),
      );
  }, [leftId]);

  useEffect(() => {
    if (!rightId) { setRight(null); return; }
    fetchRun(rightId)
      .then(setRight)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Unknown error"),
      );
  }, [rightId]);

  const leftEvents = useMemo(() => left?.events ?? [], [left]);
  const rightEvents = useMemo(() => right?.events ?? [], [right]);

  function runLabel(run: SimListItem) {
    return `${run.id.slice(0, 8)} · ${run.scenarioKey} · ${run.mode} · ${run.model}`;
  }

  return (
    <div className="space-y-8">
      {/* ── Selectors ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {(["A", "B"] as const).map((label, idx) => {
          const currentId = idx === 0 ? leftId : rightId;
          const setId = idx === 0 ? setLeftId : setRightId;
          return (
            <label key={label} className="block text-sm">
              <span className="mb-1 block font-medium">Run {label}</span>
              <select
                value={currentId}
                onChange={(e) => setId(e.target.value)}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm dark:bg-zinc-900"
              >
                <option value="">— select a run —</option>
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {runLabel(run)}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* ── Side-by-side metrics ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(["A", "B"] as const).map((label, idx) => {
          const run = idx === 0 ? left : right;
          return (
            <div key={label} className="rounded-xl border p-5">
              <h2 className="mb-4 text-base font-semibold">Run {label}</h2>
              <RunMetrics run={run} label={label} />
            </div>
          );
        })}
      </div>

      {/* ── Comparison table ── */}
      {left && right && (
        <div className="rounded-xl border">
          <div className="border-b px-5 py-3">
            <h2 className="font-semibold">Head-to-head comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-zinc-50 dark:bg-zinc-800/50">
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">
                    Metric
                  </th>
                  <th className="px-4 py-2 text-left font-medium">Run A</th>
                  <th className="px-4 py-2 text-left font-medium">Run B</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ["Scenario", left.simulation.scenarioKey, right.simulation.scenarioKey],
                  ["Mode", left.simulation.mode, right.simulation.mode],
                  ["Model", left.simulation.model, right.simulation.model],
                  [
                    "Turns elapsed",
                    `${left.simulation.turnIndex}/${left.simulation.maxTurns}`,
                    `${right.simulation.turnIndex}/${right.simulation.maxTurns}`,
                  ],
                  [
                    "Unique clues surfaced",
                    `${left.metrics.uniqueInfoMentions}/${left.metrics.totalPrivateClues} (${pct(left.metrics.uniqueInfoMentions, left.metrics.totalPrivateClues)})`,
                    `${right.metrics.uniqueInfoMentions}/${right.metrics.totalPrivateClues} (${pct(right.metrics.uniqueInfoMentions, right.metrics.totalPrivateClues)})`,
                  ],
                  [
                    "Moderator interventions",
                    String(left.metrics.moderatorInterventions),
                    String(right.metrics.moderatorInterventions),
                  ],
                  ["Final consensus", left.metrics.consensus ?? "—", right.metrics.consensus ?? "—"],
                  ["Optimal decision", left.metrics.optimalDecision, right.metrics.optimalDecision],
                  [
                    "Outcome",
                    left.metrics.consensus
                      ? left.metrics.isConsensusOptimal
                        ? "✓ Optimal"
                        : "✗ Suboptimal"
                      : "—",
                    right.metrics.consensus
                      ? right.metrics.isConsensusOptimal
                        ? "✓ Optimal"
                        : "✗ Suboptimal"
                      : "—",
                  ],
                ].map(([metric, a, b]) => (
                  <tr key={metric}>
                    <td className="px-4 py-2 font-medium text-zinc-500">
                      {metric}
                    </td>
                    <td
                      className={`px-4 py-2 ${a === "✓ Optimal" ? "text-emerald-600 font-semibold" : a === "✗ Suboptimal" ? "text-red-600 font-semibold" : ""}`}
                    >
                      {a}
                    </td>
                    <td
                      className={`px-4 py-2 ${b === "✓ Optimal" ? "text-emerald-600 font-semibold" : b === "✗ Suboptimal" ? "text-red-600 font-semibold" : ""}`}
                    >
                      {b}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Discussion transcripts ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(["A", "B"] as const).map((label, idx) => {
          const events = idx === 0 ? leftEvents : rightEvents;
          return (
            <div key={label} className="rounded-xl border p-4">
              <h3 className="mb-3 font-medium">
                Run {label} — Recent discussion
              </h3>
              <TranscriptExcerpt events={events} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
