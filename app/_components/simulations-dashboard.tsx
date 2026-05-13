"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type SimulationSummary = {
  id: string;
  scenarioKey: string;
  mode: "unstructured" | "structured";
  model: string;
  state: "created" | "running" | "voting" | "completed";
  turnIndex: number;
  maxTurns: number;
  createdAt: string;
  updatedAt: string;
};

type ScenarioSummary = {
  key: string;
  title: string;
  description: string;
};

type SimulationsResponse = {
  simulations: SimulationSummary[];
  scenarios: ScenarioSummary[];
};

const DEFAULT_MODELS = [
  // "openai/gpt-4o-mini",
  "anthropic/claude-sonnet-4-5",
  // "google/gemini-3.1-flash-lite",
];

const STATE_STYLES: Record<string, string> = {
  created: "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
  running: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  voting: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const MODE_STYLES: Record<string, string> = {
  unstructured: "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
  structured: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
};

function StatePill({ state }: { state: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${STATE_STYLES[state] ?? STATE_STYLES.created}`}
    >
      {state}
    </span>
  );
}

function ModePill({ mode }: { mode: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${MODE_STYLES[mode] ?? MODE_STYLES.unstructured}`}
    >
      {mode}
    </span>
  );
}

export function SimulationsDashboard() {
  const [data, setData] = useState<SimulationsResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [scenarioKey, setScenarioKey] = useState("");
  const [mode, setMode] = useState<"unstructured" | "structured">("unstructured");
  const [model, setModel] = useState(DEFAULT_MODELS[0]);
  const [maxTurns, setMaxTurns] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/simulations", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load simulations.");
    const payload = (await res.json()) as SimulationsResponse;
    setData(payload);
    if (!scenarioKey && payload.scenarios.length > 0) {
      setScenarioKey(payload.scenarios[0].key);
    }
  }, [scenarioKey]);

  useEffect(() => {
    load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Unknown error");
    });
  }, [load]);

  const sortedSimulations = useMemo(
    () =>
      [...(data?.simulations ?? [])].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    [data],
  );

  const scenarioMap = useMemo(() => {
    const m = new Map<string, ScenarioSummary>();
    for (const s of data?.scenarios ?? []) m.set(s.key, s);
    return m;
  }, [data]);

  const selectedScenario = scenarioMap.get(scenarioKey);

  async function createSimulation() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioKey, mode, model, fallbackModels: [], maxTurns }),
      });
      if (!res.ok) {
        const payload = await res.json() as Record<string, unknown>;
        throw new Error(String(payload.error ?? "Failed to create simulation."));
      }
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Create form ── */}
      <section className="space-y-4 rounded-xl border bg-white p-5 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Create simulation run</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Scenario</span>
            <select
              className="w-full rounded-lg border bg-white px-3 py-2 dark:bg-zinc-800"
              value={scenarioKey}
              onChange={(e) => setScenarioKey(e.target.value)}
            >
              {(data?.scenarios ?? []).map((scenario) => (
                <option key={scenario.key} value={scenario.key}>
                  {scenario.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Mode</span>
            <select
              className="w-full rounded-lg border bg-white px-3 py-2 dark:bg-zinc-800"
              value={mode}
              onChange={(e) =>
                setMode(e.target.value as "unstructured" | "structured")
              }
            >
              <option value="unstructured">Unstructured</option>
              <option value="structured">Structured (with moderator)</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Model</span>
            <input
              className="w-full rounded-lg border bg-white px-3 py-2 dark:bg-zinc-800"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              list="model-options"
              placeholder="provider/model-name"
            />
            <datalist id="model-options">
              {DEFAULT_MODELS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Discussion turns ({maxTurns})
            </span>
            <input
              type="range"
              min={5}
              max={20}
              step={1}
              value={maxTurns}
              onChange={(e) => setMaxTurns(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>
        </div>

        {selectedScenario && (
          <p className="text-sm text-zinc-500">{selectedScenario.description}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={createSimulation}
            disabled={creating || !scenarioKey}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {creating ? "Creating…" : "Create run"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </section>

      {/* ── Simulation list ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Simulation runs</h2>
        <div className="grid gap-3">
          {sortedSimulations.map((sim) => {
            const scenario = scenarioMap.get(sim.scenarioKey);
            const turnPct =
              sim.maxTurns === 0
                ? 0
                : Math.min(100, Math.round((sim.turnIndex / sim.maxTurns) * 100));

            return (
              <Link
                key={sim.id}
                href={`/simulations/${sim.id}`}
                className="block rounded-xl border bg-white p-4 transition hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {scenario?.title ?? sim.scenarioKey}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {sim.model}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ModePill mode={sim.mode} />
                    <StatePill state={sim.state} />
                  </div>
                </div>

                {/* Turn progress bar */}
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
                    <span>
                      Turn {sim.turnIndex}/{sim.maxTurns}
                    </span>
                    <span>{turnPct}%</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        sim.state === "completed"
                          ? "bg-emerald-500"
                          : sim.state === "voting"
                            ? "bg-amber-400"
                            : "bg-blue-500"
                      }`}
                      style={{ width: `${turnPct}%` }}
                    />
                  </div>
                </div>

                <p className="mt-2 text-xs text-zinc-400">
                  Created {new Date(sim.createdAt).toLocaleString()}
                </p>
              </Link>
            );
          })}

          {sortedSimulations.length === 0 && (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-zinc-500">
              No simulation runs yet. Create one above to get started.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
