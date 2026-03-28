import type { ScenarioDefinition } from "@/lib/sim/types";

const grantAllocationScenario: ScenarioDefinition = {
  key: "restaurant-grants-v1",
  title: "Restaurant Revitalization Grants",
  description:
    "A city committee must pick one neighborhood for immediate funding.",
  decisionOptions: ["North End", "East Harbor", "South Market"],
  sharedClues: [
    "North End has the highest current foot traffic.",
    "East Harbor has the most pending permit applications.",
    "South Market has recently improved public transit access.",
  ],
  optimalDecision: "South Market",
  agents: [
    {
      id: "agent-1",
      displayName: "Agent 1",
      role: "Economic Development Analyst",
      privateClue:
        "South Market has the highest projected five-year job multiplier.",
    },
    {
      id: "agent-2",
      displayName: "Agent 2",
      role: "Community Outcomes Specialist",
      privateClue:
        "South Market has the largest concentration of small, owner-operated restaurants at risk of closure.",
    },
    {
      id: "agent-3",
      displayName: "Agent 3",
      role: "Infrastructure Planner",
      privateClue:
        "East Harbor's sewer upgrade is delayed by 18 months, limiting near-term expansion.",
    },
    {
      id: "agent-4",
      displayName: "Agent 4",
      role: "Public Finance Reviewer",
      privateClue:
        "North End's candidate projects already secured private matching funds, reducing urgency for public grants.",
    },
    {
      id: "agent-5",
      displayName: "Agent 5",
      role: "Equity and Access Reviewer",
      privateClue:
        "South Market has the highest proportion of low-income workers dependent on local restaurant jobs.",
    },
  ],
};

export const scenarios: ScenarioDefinition[] = [grantAllocationScenario];

export function getScenarioByKey(key: string): ScenarioDefinition {
  const scenario = scenarios.find((candidate) => candidate.key === key);
  if (!scenario) {
    throw new Error(`Unknown scenario: ${key}`);
  }

  return scenario;
}
