"use client";

import { useEffect, useMemo, useState } from "react";

type SimulationListItem = {
  id: string;
  scenarioKey: string;
  mode: string;
  model: string;
  state: string;
};

type SimulationEventsPayload = {
  simulation: SimulationListItem;
  metrics: {
    uniqueInfoMentions: number;
    votesCount: number;
    consensus: string | null;
    optimalDecision: string;
    isConsensusOptimal: boolean;
  };
  events: Array<{
    id: string;
    turnIndex: number;
    type: string;
    payload: Record<string, unknown>;
  }>;
  votes: Array<{
    agentId: string;
    option: string;
    rationale: string;
  }>;
};

type SimulationListResponse = {
  simulations: SimulationListItem[];
};

async function fetchRun(runId: string) {
  const response = await fetch(`/api/simulations/${runId}/events`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to load run details.");
  }
  return (await response.json()) as SimulationEventsPayload;
}

export function CompareView() {
  const [runs, setRuns] = useState<SimulationListItem[]>([]);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [left, setLeft] = useState<SimulationEventsPayload | null>(null);
  const [right, setRight] = useState<SimulationEventsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/simulations", { cache: "no-store" })
      .then((response) => response.json() as Promise<SimulationListResponse>)
      .then((payload) => {
        setRuns(payload.simulations);
        if (payload.simulations.length > 0) setLeftId(payload.simulations[0].id);
        if (payload.simulations.length > 1) setRightId(payload.simulations[1].id);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unknown error");
      });
  }, []);

  useEffect(() => {
    if (!leftId) return;
    fetchRun(leftId)
      .then(setLeft)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Unknown error"),
      );
  }, [leftId]);

  useEffect(() => {
    if (!rightId) return;
    fetchRun(rightId)
      .then(setRight)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Unknown error"),
      );
  }, [rightId]);

  const leftMessages = useMemo(
    () => left?.events.filter((event) => event.type === "message") ?? [],
    [left],
  );
  const rightMessages = useMemo(
    () => right?.events.filter((event) => event.type === "message") ?? [],
    [right],
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
        <label className="text-sm">
          Run A
          <select
            value={leftId}
            onChange={(event) => setLeftId(event.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          >
            <option value="">Select run</option>
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.id.slice(0, 8)} • {run.model} • {run.mode}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Run B
          <select
            value={rightId}
            onChange={(event) => setRightId(event.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          >
            <option value="">Select run</option>
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.id.slice(0, 8)} • {run.model} • {run.mode}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {[left, right].map((run, idx) => (
          <article key={idx} className="space-y-3 rounded-lg border p-4">
            <h2 className="font-semibold">Run {idx === 0 ? "A" : "B"}</h2>
            {run ? (
              <>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  {run.simulation.model} • {run.simulation.mode}
                </p>
                <ul className="space-y-1 text-sm">
                  <li>Unique clues: {run.metrics.uniqueInfoMentions}</li>
                  <li>Votes captured: {run.metrics.votesCount}</li>
                  <li>Consensus: {run.metrics.consensus ?? "pending"}</li>
                  <li>Optimal: {run.metrics.optimalDecision}</li>
                </ul>
              </>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Select a run to compare.
              </p>
            )}
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border p-4">
          <h3 className="mb-2 font-medium">Run A Messages</h3>
          <pre className="max-h-72 overflow-auto text-xs">
            {JSON.stringify(leftMessages.map((event) => event.payload), null, 2)}
          </pre>
        </article>
        <article className="rounded-lg border p-4">
          <h3 className="mb-2 font-medium">Run B Messages</h3>
          <pre className="max-h-72 overflow-auto text-xs">
            {JSON.stringify(rightMessages.map((event) => event.payload), null, 2)}
          </pre>
        </article>
      </section>
    </div>
  );
}
