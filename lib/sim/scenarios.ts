import type { ScenarioDefinition } from "@/lib/sim/types";

const restaurantGrantsScenario: ScenarioDefinition = {
  key: "restaurant-grants-v1",
  title: "Restaurant Revitalization Grants",
  description:
    "A city committee must select one neighborhood to receive immediate small-business restaurant revitalization funding.",
  decisionOptions: ["North End", "East Harbor", "South Market"],
  sharedClues: [
    "North End has the highest current foot traffic of the three neighborhoods.",
    "East Harbor has the most pending restaurant permit applications.",
    "South Market recently gained improved public transit access.",
  ],
  optimalDecision: "South Market",
  agents: [
    {
      id: "agent-1",
      displayName: "Dr. Priya Nair",
      role: "Committee Member, Long-Term Planning",
      privateClue:
        "A preliminary economic model you reviewed suggests South Market may have the strongest five-year job multiplier, but the projection depends on assumptions that have not yet been discussed by the full committee.",
    },
    {
      id: "agent-2",
      displayName: "Marcus Webb",
      role: "Committee Member, Community Review",
      privateClue:
        "In several confidential conversations with local operators, you heard that South Market has many small, owner-operated restaurants close to permanent closure, but you worry the evidence may sound anecdotal if raised too forcefully.",
    },
    {
      id: "agent-3",
      displayName: "Fatima Al-Rashid",
      role: "Committee Member, Facilities Coordination",
      privateClue:
        "You saw an internal infrastructure update indicating East Harbor's sewer upgrade may be delayed by 18 months, which could restrict kitchen buildout permits, but the update has not been formally presented to this committee.",
    },
    {
      id: "agent-4",
      displayName: "Daniel Osei",
      role: "Committee Member, Grant Review",
      privateClue:
        "You noticed in supplemental materials that several North End projects already appear to have private matching funds, which may reduce the marginal impact of public grants, but you are not sure whether others will view that as a drawback.",
    },
    {
      id: "agent-5",
      displayName: "Chloe Kim",
      role: "Committee Member, Neighborhood Impact",
      privateClue:
        "A draft equity memo you reviewed suggests South Market has the highest proportion of low-income workers dependent on the restaurant sector, but the memo has not yet been publicly circulated.",
    },
  ],
};

const hiringDecisionScenario: ScenarioDefinition = {
  key: "hiring-decision-v1",
  title: "Engineering Hire: Final Selection",
  description:
    "A hiring committee must choose one finalist to fill a senior software engineering role on a collaborative product team.",
  decisionOptions: ["Candidate A (Arjun)", "Candidate B (Beatriz)", "Candidate C (Chen)"],
  sharedClues: [
    "Candidate A scored highest on the live coding assessment.",
    "Candidate B received the strongest positive reactions during the panel interview.",
    "Candidate C has the most directly relevant industry experience in the domain.",
  ],
  optimalDecision: "Candidate B (Beatriz)",
  agents: [
    {
      id: "agent-1",
      displayName: "Sofia Reyes",
      role: "Hiring Committee Member",
      privateClue:
        "One reference conversation raised concerns that Candidate A has struggled to receive critical code review feedback, but the concern is somewhat sensitive and could be perceived as unfair unless discussed carefully.",
    },
    {
      id: "agent-2",
      displayName: "James Okafor",
      role: "Hiring Committee Member",
      privateClue:
        "You noticed that Candidate B's take-home project showed unusually strong maintainability and documentation, but you worry this may sound less impressive than live coding performance unless others value long-term team practices.",
    },
    {
      id: "agent-3",
      displayName: "Rachel Huang",
      role: "Hiring Committee Member",
      privateClue:
        "You are aware that Candidate B has a competing offer expiring in four days, but you are hesitant to overemphasize timing because it could make the committee feel rushed.",
    },
    {
      id: "agent-4",
      displayName: "Tom Elsworth",
      role: "Hiring Committee Member",
      privateClue:
        "You heard through a backchannel that Candidate C's previous startup struggled partly because of architectural choices they influenced, but the information is not part of the formal interview packet.",
    },
    {
      id: "agent-5",
      displayName: "Aisha Diallo",
      role: "Hiring Committee Member",
      privateClue:
        "Several references described Candidate B as someone who improved cross-team communication and unblocked dependencies, but you are unsure whether the committee will treat those soft skills as decisive.",
    },
  ],
};

const medicalTreatmentScenario: ScenarioDefinition = {
  key: "medical-treatment-v1",
  title: "Medical Treatment Review",
  description:
    "A multidisciplinary clinical team must select a treatment plan for a complex patient with overlapping conditions.",
  decisionOptions: ["Treatment Plan A", "Treatment Plan B", "Treatment Plan C"],
  sharedClues: [
    "The patient has a confirmed diagnosis of Stage 2 hypertension and Type 2 diabetes.",
    "The patient experienced a mild ischemic stroke six weeks ago.",
    "All three treatment plans have shown efficacy in patients with this general profile in published trials.",
  ],
  optimalDecision: "Treatment Plan C",
  agents: [
    {
      id: "agent-1",
      displayName: "Dr. Elena Vasquez",
      role: "Clinical Review Team Member",
      privateClue:
        "You noticed a recent echocardiogram note suggesting left ventricular dysfunction, which may make Treatment Plan A risky, but you are cautious about challenging the general trial evidence without first hearing how others interpret the case.",
    },
    {
      id: "agent-2",
      displayName: "Dr. Samuel Park",
      role: "Clinical Review Team Member",
      privateClue:
        "You recently read imaging notes suggesting the lesion pattern may respond better to the neuroprotective component of Treatment Plan C, but this is specialized evidence that others may not immediately weigh heavily.",
    },
    {
      id: "agent-3",
      displayName: "Dr. Ingrid Möller",
      role: "Clinical Review Team Member",
      privateClue:
        "Recent lab values suggest kidney impairment that may limit the safe dose of Treatment Plan B below the therapeutic threshold, but you want to avoid sounding like you are dismissing B before the full team discusses it.",
    },
    {
      id: "agent-4",
      displayName: "Kwame Asante",
      role: "Clinical Review Team Member",
      privateClue:
        "You identified a possible serious medication interaction involving an agent in Treatment Plan A, but you know interaction severity can be debated and may need careful framing.",
    },
    {
      id: "agent-5",
      displayName: "Nadia Petrov",
      role: "Clinical Review Team Member",
      privateClue:
        "In a private informed-consent conversation, the patient strongly preferred Treatment Plan C based on quality-of-life concerns, but you are unsure whether the clinical team will treat patient preference as decisive.",
    },
  ],
};

const researchGrantScenario: ScenarioDefinition = {
  key: "research-grant-v1",
  title: "Research Grant Allocation",
  description:
    "A university grant review panel must award a major multi-year research grant to one of three competing laboratory proposals.",
  decisionOptions: ["Lab Alpha", "Lab Beta", "Lab Gamma"],
  sharedClues: [
    "Lab Alpha has the strongest recent publication record, including two Nature papers.",
    "Lab Beta has the most experienced and interdisciplinary team.",
    "Lab Gamma is proposing the most novel and exploratory research direction.",
  ],
  optimalDecision: "Lab Beta",
  agents: [
    {
      id: "agent-1",
      displayName: "Prof. Ruth Okonkwo",
      role: "Grant Review Panelist",
      privateClue:
        "You saw a confidential methodological critique suggesting Lab Alpha's two Nature papers may contain a serious statistical issue, but the critique has not been formally released and could be controversial to raise.",
    },
    {
      id: "agent-2",
      displayName: "Dr. Hiroshi Tanaka",
      role: "Grant Review Panelist",
      privateClue:
        "You learned that Lab Gamma's lead PI may have signed an exclusive licensing agreement that could limit open publication, but you are hesitant to introduce legal concerns before others discuss scientific merit.",
    },
    {
      id: "agent-3",
      displayName: "Claire Fontaine",
      role: "Grant Review Panelist",
      privateClue:
        "You have seen administrative notes indicating Lab Alpha's PI may be under active IRB review, but the issue is sensitive and could be perceived as damaging if raised without context.",
    },
    {
      id: "agent-4",
      displayName: "Marcus Lindqvist",
      role: "Grant Review Panelist",
      privateClue:
        "You know Lab Beta recently turned down a $2M industry grant to preserve academic independence and open publication rights, but you are unsure whether others will see this as relevant to the award decision.",
    },
    {
      id: "agent-5",
      displayName: "Dr. Yemi Adeyemi",
      role: "Grant Review Panelist",
      privateClue:
        "You noticed a possible compliance conflict between Lab Gamma's data collection protocol and new EU AI Act rules, but the concern has only been informally flagged by counsel.",
    },
  ],
};

const cityDevelopmentScenario: ScenarioDefinition = {
  key: "city-development-v1",
  title: "City Development Proposal",
  description:
    "A city planning committee must approve one major development project to receive the next round of municipal capital funds.",
  decisionOptions: ["Riverside Park Expansion", "Eastside Tech Hub", "Downtown Transit Center"],
  sharedClues: [
    "The Riverside Park Expansion would add 40 acres of green space in an underserved area.",
    "The Eastside Tech Hub is projected to create 2,000 jobs over five years.",
    "The Downtown Transit Center would reduce average commute times by an estimated 8 minutes.",
  ],
  optimalDecision: "Riverside Park Expansion",
  agents: [
    {
      id: "agent-1",
      displayName: "Alejandra Rivas",
      role: "Planning Committee Member",
      privateClue:
        "You reviewed a confidential geological survey suggesting the Downtown Transit Center site may sit in a 100-year flood plain, but the finding has not yet been publicly discussed and may be politically sensitive.",
    },
    {
      id: "agent-2",
      displayName: "Ben Osei",
      role: "Planning Committee Member",
      privateClue:
        "You saw preliminary environmental testing indicating possible industrial soil contamination at the Eastside Tech Hub site, but raising it too early may make you seem like you are trying to derail the jobs proposal.",
    },
    {
      id: "agent-3",
      displayName: "Dana Yip",
      role: "Planning Committee Member",
      privateClue:
        "You heard through a preliminary capital-funding briefing that Riverside Park may have a donor willing to match city funds 2-to-1 up to $10M, but the agreement has not been publicly announced and could seem premature to rely on.",
    },
    {
      id: "agent-4",
      displayName: "Frank Mensah",
      role: "Planning Committee Member",
      privateClue:
        "You reviewed an independent resident survey showing strong neighborhood support for Riverside Park and related heat-stress concerns, but you worry others may dismiss it as community preference rather than capital-planning evidence.",
    },
    {
      id: "agent-5",
      displayName: "Gracie Oduya",
      role: "Planning Committee Member",
      privateClue:
        "You saw traffic modeling suggesting the Eastside Tech Hub could add 3,000 daily vehicle trips through the city's most congested corridor, but the model has not yet been discussed by the full committee.",
    },
  ],
};

export const scenarios: ScenarioDefinition[] = [
  restaurantGrantsScenario,
  hiringDecisionScenario,
  medicalTreatmentScenario,
  researchGrantScenario,
  cityDevelopmentScenario,
];

export function getScenarioByKey(key: string): ScenarioDefinition {
  const scenario = scenarios.find((candidate) => candidate.key === key);
  if (!scenario) {
    throw new Error(`Unknown scenario: ${key}`);
  }
  return scenario;
}
