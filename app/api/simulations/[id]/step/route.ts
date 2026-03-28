import { runSimulationStep, stepRequestSchema } from "@/lib/sim/engine";

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
    let summary = await runSimulationStep(id);
    while (summary.simulation.state === "running") {
      summary = await runSimulationStep(id);
    }
    return Response.json(summary);
  }

  const summary = await runSimulationStep(id);
  return Response.json(summary);
}
