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
      role: "Economic Development Analyst",
      privateClue:
        "South Market has the highest projected five-year job multiplier of any neighborhood in the city.",
    },
    {
      id: "agent-2",
      displayName: "Marcus Webb",
      role: "Community Outcomes Specialist",
      privateClue:
        "South Market has the largest concentration of small, owner-operated restaurants at immediate risk of permanent closure.",
    },
    {
      id: "agent-3",
      displayName: "Fatima Al-Rashid",
      role: "Infrastructure Planner",
      privateClue:
        "East Harbor's municipal sewer upgrade is delayed by 18 months, which will restrict kitchen buildout permits during that period.",
    },
    {
      id: "agent-4",
      displayName: "Daniel Osei",
      role: "Public Finance Reviewer",
      privateClue:
        "North End's top candidate projects have already secured private matching funds, substantially reducing the marginal impact of additional public grants.",
    },
    {
      id: "agent-5",
      displayName: "Chloe Kim",
      role: "Equity and Access Reviewer",
      privateClue:
        "South Market has the highest proportion of low-income workers whose livelihoods depend on the neighborhood's restaurant sector.",
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
      role: "Engineering Manager",
      privateClue:
        "Candidate A's references independently flagged a pattern of difficulty receiving critical code review feedback, which has caused friction on previous teams.",
    },
    {
      id: "agent-2",
      displayName: "James Okafor",
      role: "Senior Engineer (Technical Interviewer)",
      privateClue:
        "Candidate B's take-home project showed an unusually thoughtful approach to system maintainability and documentation — qualities the team currently lacks.",
    },
    {
      id: "agent-3",
      displayName: "Rachel Huang",
      role: "HR Director",
      privateClue:
        "Candidate B has a competing offer that expires in four days, while Candidates A and C have indicated they can wait several weeks.",
    },
    {
      id: "agent-4",
      displayName: "Tom Elsworth",
      role: "Product Manager",
      privateClue:
        "Candidate C's previous startup, listed prominently on their resume, failed in part due to critical architectural decisions they made — not widely known publicly.",
    },
    {
      id: "agent-5",
      displayName: "Aisha Diallo",
      role: "Team Lead (Cross-functional Liaison)",
      privateClue:
        "Multiple references for Candidate B described them as the person who 'raised the bar' for cross-team communication and unblocked dependencies on past projects.",
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
      role: "Cardiologist",
      privateClue:
        "The patient's latest echocardiogram reveals left ventricular dysfunction that makes Treatment Plan A's primary agent contraindicated — it would significantly worsen cardiac output.",
    },
    {
      id: "agent-2",
      displayName: "Dr. Samuel Park",
      role: "Neurologist",
      privateClue:
        "Advanced imaging shows a lesion pattern that, per recent literature, responds measurably better to the neuroprotective component of Treatment Plan C compared to A or B.",
    },
    {
      id: "agent-3",
      displayName: "Dr. Ingrid Möller",
      role: "Internist (Primary Physician)",
      privateClue:
        "Recent labs show the patient's creatinine levels are elevated, indicating kidney impairment that limits the maximum safe dose of Treatment Plan B below the therapeutic threshold.",
    },
    {
      id: "agent-4",
      displayName: "Kwame Asante",
      role: "Clinical Pharmacist",
      privateClue:
        "Treatment Plan A contains an agent with a documented Class C interaction with one of the patient's current medications, creating a risk of serious adverse events.",
    },
    {
      id: "agent-5",
      displayName: "Nadia Petrov",
      role: "Patient Advocate",
      privateClue:
        "After a detailed informed-consent conversation I facilitated, the patient expressed a strong preference for Treatment Plan C based on its quality-of-life outcomes, and is unlikely to adhere to a plan they didn't choose.",
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
      role: "Biostatistics Chair",
      privateClue:
        "A methodological review of Lab Alpha's two Nature papers reveals a critical statistical error that has not yet been publicly disclosed; a correction is expected to significantly downgrade the findings.",
    },
    {
      id: "agent-2",
      displayName: "Dr. Hiroshi Tanaka",
      role: "Domain Expert Reviewer",
      privateClue:
        "Lab Gamma's lead PI signed a binding exclusive licensing agreement with a pharmaceutical company last month — this would legally prevent open publication of any grant-funded discoveries.",
    },
    {
      id: "agent-3",
      displayName: "Claire Fontaine",
      role: "Grants Administration Officer",
      privateClue:
        "Lab Alpha's PI is currently under an active IRB investigation for a protocol deviation on a prior study; funding rules prohibit awarding new grants to labs under active investigation.",
    },
    {
      id: "agent-4",
      displayName: "Marcus Lindqvist",
      role: "Industry Liaison",
      privateClue:
        "Lab Beta recently declined a competing $2M industry grant specifically to preserve academic independence and open publication rights — a strong signal of alignment with university values.",
    },
    {
      id: "agent-5",
      displayName: "Dr. Yemi Adeyemi",
      role: "Ethics and Compliance Reviewer",
      privateClue:
        "Lab Gamma's proposal includes a data collection protocol that conflicts with the new EU AI Act regulations; the university's legal counsel has informally flagged this as a compliance blocker.",
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
      role: "Urban Planner",
      privateClue:
        "A confidential geological survey completed last month shows the Downtown Transit Center's proposed site sits in a 100-year flood plain, requiring $22M in additional flood mitigation before construction can begin.",
    },
    {
      id: "agent-2",
      displayName: "Ben Osei",
      role: "Environmental Officer",
      privateClue:
        "Phase I environmental testing confirmed significant industrial soil contamination at the Eastside Tech Hub site. Remediation costs are estimated at $15–18M and would add 2–3 years to the project timeline.",
    },
    {
      id: "agent-3",
      displayName: "Dana Yip",
      role: "Budget Director",
      privateClue:
        "The Riverside Park Expansion has a committed donor who will match city funds 2-to-1 up to $10M — effectively tripling the city's investment. No comparable leverage exists for the other two projects.",
    },
    {
      id: "agent-4",
      displayName: "Frank Mensah",
      role: "Community Liaison",
      privateClue:
        "A recent independent survey found 74% of residents in the affected neighborhoods rank the Riverside Park Expansion as their first priority, and local health data shows elevated heat-stress incidents due to lack of tree canopy.",
    },
    {
      id: "agent-5",
      displayName: "Gracie Oduya",
      role: "Transportation Director",
      privateClue:
        "Traffic modeling shows the Eastside Tech Hub, if built, would route 3,000 additional daily vehicle trips through the city's already most-congested corridor, worsening commute times rather than improving them.",
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
