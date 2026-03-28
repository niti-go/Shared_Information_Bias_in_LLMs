import { SimulationDetail } from "@/app/_components/simulation-detail";

export default async function SimulationDetailPage(
  props: PageProps<"/simulations/[id]">,
) {
  const { id } = await props.params;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Simulation Run</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Run id: <span className="font-mono">{id}</span>
        </p>
      </header>
      <SimulationDetail simulationId={id} />
    </div>
  );
}
