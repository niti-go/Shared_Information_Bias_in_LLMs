import Link from "next/link";

import { getGatewayRuntimeSummary } from "@/lib/ai/gateway";
import { scenarios } from "@/lib/sim/scenarios";

export default function Home() {
  const gateway = getGatewayRuntimeSummary();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">
          Shared Information Bias
          <span className="block text-2xl font-normal text-zinc-500 dark:text-zinc-400">
            in Large Language Models
          </span>
        </h1>
        <p className="max-w-2xl text-zinc-600 dark:text-zinc-300">
          A simulation environment for studying how LLM agents share — or withhold
          — private information during group decision-making. Runs{" "}
          <strong>hidden-profile scenarios</strong> where optimal outcomes require
          surfacing information distributed across agents, then measures whether
          models find the correct answer alone or with a structured moderator.
        </p>
      </header>

      {/* ── Feature cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/simulations"
          className="group rounded-xl border bg-white p-5 transition hover:border-zinc-400 hover:shadow-sm dark:bg-zinc-900 dark:hover:border-zinc-500"
        >
          <div className="mb-2 text-2xl">🧪</div>
          <h2 className="font-semibold">Run Simulations</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Create multi-agent discussion sessions, step through turns, and observe
            when agents surface their unique private clues.
          </p>
        </Link>

        <Link
          href="/compare"
          className="group rounded-xl border bg-white p-5 transition hover:border-zinc-400 hover:shadow-sm dark:bg-zinc-900 dark:hover:border-zinc-500"
        >
          <div className="mb-2 text-2xl">📊</div>
          <h2 className="font-semibold">Compare Runs</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Compare outcomes across models and modes: see how unique-clue surfacing
            rates, vote distributions, and consensus accuracy differ.
          </p>
        </Link>

        <div className="rounded-xl border bg-white p-5 dark:bg-zinc-900">
          <div className="mb-2 text-2xl">⚙️</div>
          <h2 className="font-semibold">AI Gateway</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {gateway.usingApiKey
              ? "API key detected — using Vercel AI Gateway for live LLM calls."
              : "No API key set — running in deterministic mock mode for UI testing."}
          </p>
        </div>
      </div>

      {/* ── How it works ── */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">How it works</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              title: "Hidden-profile setup",
              body: "Each scenario has shared clues (visible to all agents) and private clues (each agent holds one unique piece of critical information). The optimal decision can only be reached when private clues are surfaced.",
            },
            {
              title: "Agent discussion",
              body: "5 LLM agents take turns in a discussion. They can share a message, explicitly reveal their private clue, or cast an early vote. All messages are stored as events.",
            },
            {
              title: "Moderator (structured mode)",
              body: "In structured mode, a neutral moderator LLM watches the transcript and intervenes when it detects premature convergence or stalled discussion — never revealing private info, only prompting reflection.",
            },
            {
              title: "Voting round & outcome",
              body: "After discussion, every agent casts a final vote. The majority consensus is checked against the scenario's known optimal decision to produce an accuracy metric.",
            },
          ].map(({ title, body }) => (
            <div key={title} className="rounded-xl border bg-white p-4 dark:bg-zinc-900">
              <h3 className="mb-1 font-medium">{title}</h3>
              <p className="text-sm text-zinc-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Scenario index ── */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Available scenarios</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scenarios.map((scenario) => (
            <div
              key={scenario.key}
              className="rounded-xl border bg-white p-4 dark:bg-zinc-900"
            >
              <h3 className="mb-1 font-medium">{scenario.title}</h3>
              <p className="text-xs text-zinc-500">{scenario.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {scenario.decisionOptions.map((opt) => (
                  <span
                    key={opt}
                    className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
                  >
                    {opt}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
