import Link from "next/link";

import { getGatewayRuntimeSummary } from "@/lib/ai/gateway";

export default function Home() {
  const gateway = getGatewayRuntimeSummary();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Shared Information Bias Simulation Lab
        </h1>
        <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-300">
          First progress milestone scaffold: simulation runs, AI Gateway-backed
          stepping APIs, persisted event logs, and side-by-side model
          comparison.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/simulations"
          className="rounded-lg border p-4 hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          <h2 className="font-medium">Simulations</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Create runs and execute turn-by-turn.
          </p>
        </Link>
        <Link
          href="/compare"
          className="rounded-lg border p-4 hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          <h2 className="font-medium">Compare Models</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Compare outcomes across completed runs.
          </p>
        </Link>
        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Gateway Runtime</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            API key present: {gateway.usingApiKey ? "yes" : "no (OIDC/runtime placeholder)"}
          </p>
        </div>
      </div>
    </div>
  );
}
