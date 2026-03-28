import { finalizeSimulationVote } from "@/lib/sim/engine";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/simulations/[id]/vote">,
) {
  const { id } = await context.params;
  const summary = await finalizeSimulationVote(id);
  return Response.json(summary);
}
