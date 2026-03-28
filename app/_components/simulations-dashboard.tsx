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
  "openai/gpt-5-mini",
  "anthropic/claude-sonnet-4.6",
  "google/gemini-2.5-pro",
];

export function SimulationsDashboard() {
  const [data, setData] = useState<SimulationsResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [scenarioKey, setScenarioKey] = useState("");
  const [mode, setMode] = useState<"unstructured" | "structured">("unstructured");
  const [model, setModel] = useState(DEFAULT_MODELS[0]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/simulations", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load simulations.");
    }
    const payload = (await response.json()) as SimulationsResponse;
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

  async function createSimulation() {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioKey,
          mode,
          model,
          fallbackModels: [],
          maxTurns: 8,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Failed to create simulation.");
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
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-xl font-semibold">Create Simulation Run</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Scenario
            <select
              className="mt-1 w-full rounded border px-2 py-1"
              value={scenarioKey}
              onChange={(event) => setScenarioKey(event.target.value)}
            >
              {(data?.scenarios ?? []).map((scenario) => (
                <option key={scenario.key} value={scenario.key}>
                  {scenario.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Mode
            <select
              className="mt-1 w-full rounded border px-2 py-1"
              value={mode}
              onChange={(event) =>
                setMode(event.target.value as "unstructured" | "structured")
              }
            >
              <option value="unstructured">Unstructured</option>
              <option value="structured">Structured</option>
            </select>
          </label>
          <label className="text-sm">
            Model
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              list="model-options"
            />
            <datalist id="model-options">
              {DEFAULT_MODELS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>
        </div>
        <button
          type="button"
          onClick={createSimulation}
          disabled={creating || !scenarioKey}
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {creating ? "Creating..." : "Create run"}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Simulation Runs</h2>
        <div className="grid gap-3">
          {sortedSimulations.map((simulation) => (
            <Link
              href={`/simulations/${simulation.id}`}
              key={simulation.id}
              className="rounded-lg border p-4 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{simulation.scenarioKey}</p>
                <span className="rounded border px-2 py-0.5 text-xs uppercase">
                  {simulation.state}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {simulation.mode} • {simulation.model}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Turn {simulation.turnIndex}/{simulation.maxTurns}
              </p>
            </Link>
          ))}
          {sortedSimulations.length === 0 ? (
            <p className="rounded border p-4 text-sm text-zinc-600 dark:text-zinc-300">
              No runs yet. Create one above to begin.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
