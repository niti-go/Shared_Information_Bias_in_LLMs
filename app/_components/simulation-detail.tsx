"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type SimulationResponse = {
  simulation: {
    id: string;
    scenarioKey: string;
    mode: string;
    model: string;
    state: "created" | "running" | "voting" | "completed";
    turnIndex: number;
    maxTurns: number;
  };
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
    agentId: string | null;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
  votes: Array<{
    agentId: string;
    option: string;
    rationale: string;
  }>;
};

export function SimulationDetail({ simulationId }: { simulationId: string }) {
  const [data, setData] = useState<SimulationResponse | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/simulations/${simulationId}/events`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Failed to load simulation details.");
    }
    setData((await response.json()) as SimulationResponse);
  }, [simulationId]);

  useEffect(() => {
    load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Unknown error");
    });
  }, [load]);

  const canStep = data && data.simulation.state !== "completed";
  const canFinalize = data && data.simulation.state !== "completed";

  async function callAction(path: string, actionKey: string, body?: Record<string, unknown>) {
    setBusyAction(actionKey);
    setError(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Action failed.");
      }
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusyAction(null);
    }
  }

  const timeline = useMemo(() => data?.events ?? [], [data]);

  return (
    <div className="space-y-6">
      {data ? (
        <section className="grid gap-3 rounded-lg border p-4 sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-zinc-500">State</p>
            <p className="font-medium">{data.simulation.state}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-zinc-500">Turns</p>
            <p className="font-medium">
              {data.simulation.turnIndex}/{data.simulation.maxTurns}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-zinc-500">Unique Clues</p>
            <p className="font-medium">{data.metrics.uniqueInfoMentions}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-zinc-500">Consensus</p>
            <p className="font-medium">{data.metrics.consensus ?? "pending"}</p>
          </div>
        </section>
      ) : null}

      <section className="flex flex-wrap gap-2">
        <button
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
          onClick={() =>
            callAction(`/api/simulations/${simulationId}/step`, "step", {
              runUntilVoting: false,
            })
          }
          disabled={!canStep || busyAction !== null}
          type="button"
        >
          {busyAction === "step" ? "Running..." : "Run next step"}
        </button>
        <button
          className="rounded border px-3 py-2 text-sm disabled:opacity-50"
          onClick={() =>
            callAction(`/api/simulations/${simulationId}/step`, "to-voting", {
              runUntilVoting: true,
            })
          }
          disabled={!canStep || busyAction !== null}
          type="button"
        >
          {busyAction === "to-voting" ? "Running..." : "Run to voting"}
        </button>
        <button
          className="rounded border px-3 py-2 text-sm disabled:opacity-50"
          onClick={() => callAction(`/api/simulations/${simulationId}/vote`, "finalize")}
          disabled={!canFinalize || busyAction !== null}
          type="button"
        >
          {busyAction === "finalize" ? "Finalizing..." : "Finalize"}
        </button>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Event Timeline</h2>
        <div className="space-y-2">
          {timeline.map((event) => (
            <article key={event.id} className="rounded border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <span>
                  Turn {event.turnIndex} • {event.type}
                </span>
                <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
              </div>
              <pre className="mt-2 overflow-x-auto text-xs">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </article>
          ))}
          {timeline.length === 0 ? (
            <p className="rounded border p-3 text-sm text-zinc-600 dark:text-zinc-300">
              No events yet.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
