import Link from "next/link";

import { SimulationDetail } from "@/app/_components/simulation-detail";
import { getSimulation } from "@/lib/db/repository";
import { getScenarioByKey } from "@/lib/sim/scenarios";

export default async function SimulationDetailPage(
  props: PageProps<"/simulations/[id]">,
) {
  const { id } = await props.params;

  const simulation = await getSimulation(id).catch(() => null);
  let scenarioTitle = "Simulation Run";
  if (simulation) {
    try {
      scenarioTitle = getScenarioByKey(simulation.scenarioKey).title;
    } catch {
      scenarioTitle = simulation.scenarioKey;
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="space-y-1">
        <Link
          href="/simulations"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← Back to simulations
        </Link>
        <h1 className="text-2xl font-semibold">{scenarioTitle}</h1>
        <p className="font-mono text-xs text-zinc-400">{id}</p>
      </header>
      <SimulationDetail simulationId={id} />
    </div>
  );
}
