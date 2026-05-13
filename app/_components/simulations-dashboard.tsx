"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

function ClientTimestamp({ iso }: { iso: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    setText(new Date(iso).toLocaleString());
  }, [iso]);
  return <>{text ?? iso}</>;
}

type ModeratorPromptId =
  | "blind-process"
  | "devils-advocate"
  | "socratic-probe"
  | "hidden-profile-aware";

type SimulationSummary = {
  id: string;
  scenarioKey: string;
  mode: "unstructured" | "structured";
  moderatorPrompt: ModeratorPromptId | null;
  model: string;
  state: "created" | "running" | "voting" | "completed";
  turnIndex: number;
  maxTurns: number;
  createdAt: string;
  updatedAt: string;
};

const MODERATOR_PROMPT_OPTIONS: Array<{
  id: ModeratorPromptId;
  label: string;
  description: string;
}> = [
  {
    id: "blind-process",
    label: "Blind facilitator (process-only)",
    description:
      "Knows nothing about the scenario. Asks generic procedural questions about turn-taking, depth of reasoning, and engagement. Methodologically cleanest.",
  },
  {
    id: "devils-advocate",
    label: "Devil's advocate",
    description:
      "Surfaces the strongest case against the group's current direction. Tests whether stress-testing alone improves outcomes.",
  },
  {
    id: "socratic-probe",
    label: "Socratic probe",
    description:
      "Only asks justification questions about load-bearing claims. Tests whether forcing justification alone changes outcomes.",
  },
  {
    id: "hidden-profile-aware",
    label: "Hidden-profile-aware (leaky)",
    description:
      "Explicitly prompts agents to surface unique information. Mirrors Stasser-style structured information-sharing interventions; leaks the experimental construct.",
  },
];

type ScenarioAgent = {
  id: string;
  displayName: string;
  role: string;
  privateClue: string;
};

type ScenarioSummary = {
  key: string;
  title: string;
  description: string;
  decisionOptions: string[];
  sharedClues: string[];
  optimalDecision: string;
  agents: ScenarioAgent[];
};

type SimulationsResponse = {
  simulations: SimulationSummary[];
  scenarios: ScenarioSummary[];
};

type ModeratorPromptVariant = {
  id: ModeratorPromptId;
  label: string;
  description: string;
  template: string;
};

const DEFAULT_MODELS = [
  // "openai/gpt-4o-mini",
  // "anthropic/claude-sonnet-4-5",
  "google/gemini-3.1-flash-lite",
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

const MODE_LABEL: Record<string, string> = {
  unstructured: "Unmoderated",
  structured: "Moderated",
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
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${MODE_STYLES[mode] ?? MODE_STYLES.unstructured}`}
    >
      {MODE_LABEL[mode] ?? mode}
    </span>
  );
}

export function SimulationsDashboard() {
  const [data, setData] = useState<SimulationsResponse | null>(null);
  const [moderatorVariants, setModeratorVariants] = useState<
    ModeratorPromptVariant[] | null
  >(null);
  const [creating, setCreating] = useState(false);
  const [scenarioKey, setScenarioKey] = useState("");
  const [mode, setMode] = useState<"unstructured" | "structured">("unstructured");
  const [moderatorPrompt, setModeratorPrompt] =
    useState<ModeratorPromptId>("blind-process");
  const [model, setModel] = useState(DEFAULT_MODELS[0]);
  const [maxTurns, setMaxTurns] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const selectedPrompt = MODERATOR_PROMPT_OPTIONS.find(
    (o) => o.id === moderatorPrompt,
  );

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

  useEffect(() => {
    fetch("/api/moderator-prompts", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload: { variants: ModeratorPromptVariant[] }) => {
        setModeratorVariants(payload.variants);
      })
      .catch(() => {
        // Non-fatal: the templates panel just won't render.
      });
  }, []);

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
        body: JSON.stringify({
          scenarioKey,
          mode,
          moderatorPrompt: mode === "structured" ? moderatorPrompt : null,
          model,
          fallbackModels: [],
          maxTurns,
        }),
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
              <option value="unstructured">Unmoderated</option>
              <option value="structured">Moderated</option>
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

        {mode === "structured" && (
          <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900 dark:bg-indigo-950/20">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Moderator prompt</span>
              <select
                className="w-full rounded-lg border bg-white px-3 py-2 dark:bg-zinc-800"
                value={moderatorPrompt}
                onChange={(e) =>
                  setModeratorPrompt(e.target.value as ModeratorPromptId)
                }
              >
                {MODERATOR_PROMPT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {selectedPrompt && (
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {selectedPrompt.description}
              </p>
            )}
            {moderatorVariants && (
              <details className="rounded-md border border-indigo-200 bg-white p-2 text-xs dark:border-indigo-900 dark:bg-zinc-900">
                <summary className="cursor-pointer font-medium">
                  Show full prompt template sent to the moderator
                </summary>
                <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-zinc-50 p-2 font-mono text-[11px] leading-relaxed text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {moderatorVariants.find((v) => v.id === moderatorPrompt)
                    ?.template ?? "(template unavailable)"}
                </pre>
              </details>
            )}
          </div>
        )}

        {selectedScenario && (
          <div className="space-y-2">
            <p className="text-sm text-zinc-500">{selectedScenario.description}</p>
            <details className="rounded-lg border bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/50">
              <summary className="cursor-pointer font-medium">
                Scenario details (options, shared clues, agents & private clues)
              </summary>
              <div className="mt-3 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Decision options
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {selectedScenario.decisionOptions.map((opt) => (
                      <li key={opt}>
                        {opt}
                        {opt === selectedScenario.optimalDecision && (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            ground-truth optimal
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Shared clues (every agent sees these)
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-zinc-600 dark:text-zinc-400">
                    {selectedScenario.sharedClues.map((clue, i) => (
                      <li key={i}>{clue}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Agents & their private clues
                  </p>
                  <div className="mt-1 space-y-2">
                    {selectedScenario.agents.map((agent) => (
                      <div
                        key={agent.id}
                        className="rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <p className="font-medium">
                          {agent.displayName}{" "}
                          <span className="font-normal text-zinc-500">
                            — {agent.role}
                          </span>
                        </p>
                        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            Private clue:
                          </span>{" "}
                          {agent.privateClue}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          </div>
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
                      {sim.moderatorPrompt && (
                        <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400">
                          · moderator: {sim.moderatorPrompt}
                        </span>
                      )}
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
                  Created <ClientTimestamp iso={sim.createdAt} />
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
