import { runSimulationStep, stepRequestSchema, summarizeSimulation } from "@/lib/sim/engine";
import { runVotingRound } from "@/lib/sim/voting";

export async function POST(
  request: Request,
  context: RouteContext<"/api/simulations/[id]/step">,
) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = stepRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.runUntilVoting) {
    // Run all remaining discussion turns
    let summary = await runSimulationStep(id);
    while (summary.simulation.state === "running") {
      summary = await runSimulationStep(id);
    }

    // If we just entered voting state, auto-run the voting round to completion
    if (summary.simulation.state === "voting") {
      await runVotingRound(id);
    }

    return Response.json(await summarizeSimulation(id));
  }

  const summary = await runSimulationStep(id);
  return Response.json(summary);
}
