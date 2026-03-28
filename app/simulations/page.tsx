import { SimulationsDashboard } from "@/app/_components/simulations-dashboard";

export default function SimulationsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Simulations</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Create and manage unstructured/structured simulation runs.
        </p>
      </header>
      <SimulationsDashboard />
    </div>
  );
}
