import {
  getSimulation,
  listEvents,
  listVotes,
  listSimulationAgents,
} from "@/lib/db/repository";
import { summarizeSimulation } from "@/lib/sim/engine";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/simulations/[id]/events">,
) {
  const { id } = await context.params;
  const simulation = await getSimulation(id);

  if (!simulation) {
    return Response.json({ error: "Simulation not found" }, { status: 404 });
  }

  const [events, votes, agents, summary] = await Promise.all([
    listEvents(id),
    listVotes(id),
    listSimulationAgents(id),
    summarizeSimulation(id),
  ]);

  return Response.json({
    simulation,
    agents,
    events,
    votes,
    metrics: summary.metrics,
  });
}
