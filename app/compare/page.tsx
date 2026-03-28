import { CompareView } from "@/app/_components/compare-view";

export default function ComparePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Compare Runs</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Side-by-side comparison of key metrics and rationale traces.
        </p>
      </header>
      <CompareView />
    </div>
  );
}
