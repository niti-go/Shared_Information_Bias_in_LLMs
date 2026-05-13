"""
Shared core for hidden-profile experiments with a local Qwen model via Ollama.

All experiments import from this module:
- chat(): single LLM call against Ollama's OpenAI-compatible endpoint
- SCENARIOS: the 5 hidden-profile scenarios (mirrored from lib/sim/scenarios.ts)
- run_trial(): runs one simulated group discussion + vote, returns a TrialResult
- write_csv(): append rows to a results CSV
"""

from __future__ import annotations

import csv
import json
import os
import random
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/v1/chat/completions")
DEFAULT_MODEL = os.environ.get("QWEN_MODEL", "qwen2.5:7b")
RESULTS_DIR = Path(__file__).parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)


# ── LLM client ──────────────────────────────────────────────────────────────

def chat(messages: list[dict], model: str = DEFAULT_MODEL, temperature: float = 0.7,
         max_tokens: int = 400, timeout: int = 120) -> str:
    """Call Ollama's OpenAI-compatible chat endpoint. Returns the assistant message."""
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        OLLAMA_URL, data=data, headers={"Content-Type": "application/json"}
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                body = json.loads(resp.read())
                return body["choices"][0]["message"]["content"].strip()
        except (urllib.error.URLError, TimeoutError, KeyError) as e:
            if attempt == 2:
                raise RuntimeError(f"Ollama call failed after 3 tries: {e}") from e
            time.sleep(2 ** attempt)
    raise RuntimeError("unreachable")


# ── Scenario data (mirrored from lib/sim/scenarios.ts) ──────────────────────

@dataclass
class AgentSpec:
    id: str
    display_name: str
    role: str
    private_clue: str
    distractor_clues: list[str] = field(default_factory=list)


@dataclass
class Scenario:
    key: str
    title: str
    description: str
    decision_options: list[str]
    shared_clues: list[str]
    optimal_decision: str
    agents: list[AgentSpec]


SCENARIOS: dict[str, Scenario] = {
    "restaurant-grants": Scenario(
        key="restaurant-grants",
        title="Restaurant Revitalization Grants",
        description="A city committee must select one neighborhood to receive immediate small-business restaurant revitalization funding.",
        decision_options=["North End", "East Harbor", "South Market"],
        shared_clues=[
            "North End has the highest current foot traffic of the three neighborhoods.",
            "East Harbor has the most pending restaurant permit applications.",
            "South Market recently gained improved public transit access.",
        ],
        optimal_decision="South Market",
        agents=[
            AgentSpec("a1", "Dr. Priya Nair", "Economic Development Analyst",
                "South Market has the highest projected five-year job multiplier of any neighborhood in the city."),
            AgentSpec("a2", "Marcus Webb", "Community Outcomes Specialist",
                "South Market has the largest concentration of small, owner-operated restaurants at immediate risk of permanent closure."),
            AgentSpec("a3", "Fatima Al-Rashid", "Infrastructure Planner",
                "East Harbor's municipal sewer upgrade is delayed by 18 months, which will restrict kitchen buildout permits during that period."),
            AgentSpec("a4", "Daniel Osei", "Public Finance Reviewer",
                "North End's top candidate projects have already secured private matching funds, substantially reducing the marginal impact of additional public grants."),
            AgentSpec("a5", "Chloe Kim", "Equity and Access Reviewer",
                "South Market has the highest proportion of low-income workers whose livelihoods depend on the neighborhood's restaurant sector."),
        ],
    ),
    "hiring-decision": Scenario(
        key="hiring-decision",
        title="Engineering Hire: Final Selection",
        description="A hiring committee must choose one finalist to fill a senior software engineering role on a collaborative product team.",
        decision_options=["Candidate A (Arjun)", "Candidate B (Beatriz)", "Candidate C (Chen)"],
        shared_clues=[
            "Candidate A scored highest on the live coding assessment.",
            "Candidate B received the strongest positive reactions during the panel interview.",
            "Candidate C has the most directly relevant industry experience in the domain.",
        ],
        optimal_decision="Candidate B (Beatriz)",
        agents=[
            AgentSpec("a1", "Sofia Reyes", "Engineering Manager",
                "Candidate A's references independently flagged a pattern of difficulty receiving critical code review feedback, which has caused friction on previous teams."),
            AgentSpec("a2", "James Okafor", "Senior Engineer",
                "Candidate B's take-home project showed an unusually thoughtful approach to system maintainability and documentation."),
            AgentSpec("a3", "Rachel Huang", "HR Director",
                "Candidate B has a competing offer that expires in four days, while Candidates A and C have indicated they can wait several weeks."),
            AgentSpec("a4", "Tom Elsworth", "Product Manager",
                "Candidate C's previous startup, listed prominently on their resume, failed in part due to critical architectural decisions they made."),
            AgentSpec("a5", "Aisha Diallo", "Team Lead",
                "Multiple references for Candidate B described them as the person who 'raised the bar' for cross-team communication and unblocked dependencies on past projects."),
        ],
    ),
    "medical-treatment": Scenario(
        key="medical-treatment",
        title="Medical Treatment Review",
        description="A multidisciplinary clinical team must select a treatment plan for a complex patient with overlapping conditions.",
        decision_options=["Treatment Plan A", "Treatment Plan B", "Treatment Plan C"],
        shared_clues=[
            "The patient has a confirmed diagnosis of Stage 2 hypertension and Type 2 diabetes.",
            "The patient experienced a mild ischemic stroke six weeks ago.",
            "All three treatment plans have shown efficacy in patients with this general profile in published trials.",
        ],
        optimal_decision="Treatment Plan C",
        agents=[
            AgentSpec("a1", "Dr. Elena Vasquez", "Cardiologist",
                "The patient's latest echocardiogram reveals left ventricular dysfunction that makes Treatment Plan A's primary agent contraindicated."),
            AgentSpec("a2", "Dr. Samuel Park", "Neurologist",
                "Advanced imaging shows a lesion pattern that responds measurably better to the neuroprotective component of Treatment Plan C compared to A or B."),
            AgentSpec("a3", "Dr. Ingrid Moller", "Internist",
                "Recent labs show the patient's creatinine levels are elevated, indicating kidney impairment that limits the maximum safe dose of Treatment Plan B below the therapeutic threshold."),
            AgentSpec("a4", "Kwame Asante", "Clinical Pharmacist",
                "Treatment Plan A contains an agent with a documented Class C interaction with one of the patient's current medications, creating a risk of serious adverse events."),
            AgentSpec("a5", "Nadia Petrov", "Patient Advocate",
                "After a detailed informed-consent conversation, the patient expressed a strong preference for Treatment Plan C based on its quality-of-life outcomes."),
        ],
    ),
    "research-grant": Scenario(
        key="research-grant",
        title="Research Grant Allocation",
        description="A university grant review panel must award a major multi-year research grant to one of three competing laboratory proposals.",
        decision_options=["Lab Alpha", "Lab Beta", "Lab Gamma"],
        shared_clues=[
            "Lab Alpha has the strongest recent publication record, including two Nature papers.",
            "Lab Beta has the most experienced and interdisciplinary team.",
            "Lab Gamma is proposing the most novel and exploratory research direction.",
        ],
        optimal_decision="Lab Beta",
        agents=[
            AgentSpec("a1", "Prof. Ruth Okonkwo", "Biostatistics Chair",
                "A methodological review of Lab Alpha's two Nature papers reveals a critical statistical error; a correction is expected to significantly downgrade the findings."),
            AgentSpec("a2", "Dr. Hiroshi Tanaka", "Domain Expert Reviewer",
                "Lab Gamma's lead PI signed a binding exclusive licensing agreement with a pharmaceutical company last month, which would legally prevent open publication of any grant-funded discoveries."),
            AgentSpec("a3", "Claire Fontaine", "Grants Administration Officer",
                "Lab Alpha's PI is currently under an active IRB investigation for a protocol deviation; funding rules prohibit awarding new grants to labs under active investigation."),
            AgentSpec("a4", "Marcus Lindqvist", "Industry Liaison",
                "Lab Beta recently declined a competing $2M industry grant to preserve academic independence and open publication rights."),
            AgentSpec("a5", "Dr. Yemi Adeyemi", "Ethics and Compliance Reviewer",
                "Lab Gamma's proposal includes a data collection protocol that conflicts with new EU AI Act regulations."),
        ],
    ),
    "city-development": Scenario(
        key="city-development",
        title="City Development Proposal",
        description="A city planning committee must approve one major development project to receive the next round of municipal capital funds.",
        decision_options=["Riverside Park Expansion", "Eastside Tech Hub", "Downtown Transit Center"],
        shared_clues=[
            "The Riverside Park Expansion would add 40 acres of green space in an underserved area.",
            "The Eastside Tech Hub is projected to create 2,000 jobs over five years.",
            "The Downtown Transit Center would reduce average commute times by an estimated 8 minutes.",
        ],
        optimal_decision="Riverside Park Expansion",
        agents=[
            AgentSpec("a1", "Alejandra Rivas", "Urban Planner",
                "A confidential geological survey shows the Downtown Transit Center's proposed site sits in a 100-year flood plain, requiring $22M in additional flood mitigation."),
            AgentSpec("a2", "Ben Osei", "Environmental Officer",
                "Phase I environmental testing confirmed significant industrial soil contamination at the Eastside Tech Hub site, with remediation costs of $15-18M and 2-3 year timeline additions."),
            AgentSpec("a3", "Dana Yip", "Budget Director",
                "The Riverside Park Expansion has a committed donor who will match city funds 2-to-1 up to $10M, effectively tripling the city's investment."),
            AgentSpec("a4", "Frank Mensah", "Community Liaison",
                "A recent independent survey found 74% of residents rank the Riverside Park Expansion as their first priority, and local health data shows elevated heat-stress incidents."),
            AgentSpec("a5", "Gracie Oduya", "Transportation Director",
                "Traffic modeling shows the Eastside Tech Hub would route 3,000 additional daily vehicle trips through the city's most-congested corridor, worsening commute times."),
        ],
    ),
}


# ── Trial runner ────────────────────────────────────────────────────────────

@dataclass
class TrialResult:
    scenario: str
    model: str
    condition: str
    trial_idx: int
    seed: int
    optimal_decision: str
    consensus: str | None
    is_optimal: bool
    votes: dict[str, str]  # agent_id -> option
    unique_clues_surfaced: int
    total_unique_clues: int
    clues_surfaced_flags: dict[str, bool]  # agent_id -> bool
    n_turns: int
    transcript: list[dict]  # [{turn, speaker, text}]


SYSTEM_TEMPLATE = """You are {name}, a {role} on a small committee.

Committee task: {description}

Decision options: {options}

Information you have access to (order is randomly shuffled — position does not indicate importance):
{facts}

You are in a group discussion. Other committee members may know different things than you do — you don't know in advance what they know or don't know. Speak in 1-3 sentences per turn. Refer to others by name. Be specific and contribute whatever facts you think are relevant. Stay in character."""


VOTE_TEMPLATE = """The discussion is over. As {name}, vote for ONE option from: {options}.

Reply with exactly one JSON object on a single line and nothing else:
{{"vote": "<option name, copied exactly from the list>", "rationale": "<one sentence>"}}"""


def _format_agent_system(agent: AgentSpec, scenario: Scenario, include_distractors: bool = False) -> str:
    facts = list(scenario.shared_clues) + [agent.private_clue]
    if include_distractors:
        facts.extend(agent.distractor_clues)
    random.shuffle(facts)
    return SYSTEM_TEMPLATE.format(
        name=agent.display_name,
        role=agent.role,
        description=scenario.description,
        options=", ".join(scenario.decision_options),
        facts="\n".join(f"{i + 1}. {c}" for i, c in enumerate(facts)),
    )


def _format_transcript(transcript: list[dict]) -> str:
    if not transcript:
        return "(no prior turns — you are speaking first)"
    return "\n".join(f"{t['speaker']}: {t['text']}" for t in transcript)


def _clue_was_surfaced(clue: str, transcript_text: str, model: str) -> bool:
    """Use the LLM as a semantic judge for whether a clue was meaningfully revealed."""
    judge_prompt = f"""You are evaluating whether a specific piece of information was meaningfully shared in a group discussion.

INFORMATION: "{clue}"

DISCUSSION TRANSCRIPT:
{transcript_text}

Was the key substance of the information revealed in the discussion (even if paraphrased)? Reply with exactly one word: YES or NO."""
    resp = chat(
        [{"role": "user", "content": judge_prompt}],
        model=model,
        temperature=0.0,
        max_tokens=10,
    )
    return resp.strip().upper().startswith("YES")


def _parse_vote(text: str, options: list[str]) -> str | None:
    """Find which option the agent voted for. Prefers JSON, falls back to substring."""
    json_match = re.search(r"\{[^{}]*\"vote\"[^{}]*\}", text, re.DOTALL)
    if json_match:
        try:
            parsed = json.loads(json_match.group(0))
            vote_text = str(parsed.get("vote", "")).strip()
            for opt in options:
                if opt.lower() in vote_text.lower() or vote_text.lower() in opt.lower():
                    return opt
        except json.JSONDecodeError:
            pass
    for opt in options:
        if opt.lower() in text.lower():
            return opt
    return None


def run_trial(
    scenario: Scenario,
    *,
    model: str = DEFAULT_MODEL,
    condition: str = "baseline",
    trial_idx: int = 0,
    seed: int = 0,
    n_agents: int | None = None,
    rounds: int = 2,
    include_distractors: bool = False,
    confident_wrong_seed: bool = False,
    suboptimal_target: str | None = None,
    use_shared_override: list[str] | None = None,
    verbose: bool = True,
) -> TrialResult:
    """Run one full discussion + vote and return metrics.

    rounds: each round = each agent speaks once
    confident_wrong_seed: agent 1 starts with a strongly-worded argument for suboptimal_target
    use_shared_override: replace scenario.shared_clues for this trial only
    """
    random.seed(seed)
    agents = scenario.agents if n_agents is None else scenario.agents[:n_agents]
    scenario_for_trial = scenario
    if use_shared_override is not None:
        scenario_for_trial = Scenario(
            key=scenario.key, title=scenario.title, description=scenario.description,
            decision_options=scenario.decision_options, shared_clues=use_shared_override,
            optimal_decision=scenario.optimal_decision, agents=agents,
        )

    transcript: list[dict] = []
    turn = 0

    if confident_wrong_seed and suboptimal_target:
        seed_text = (
            f"I want to be direct: I think we should go with {suboptimal_target}. "
            f"Looking at what we all know, the case for it is clear and I don't see a strong reason to look elsewhere."
        )
        transcript.append({"turn": turn, "speaker": agents[0].display_name, "text": seed_text})
        turn += 1
        if verbose:
            print(f"  [seed] {agents[0].display_name}: {seed_text}")

    for round_idx in range(rounds):
        for agent in agents:
            if round_idx == 0 and confident_wrong_seed and agent.id == agents[0].id:
                continue
            sys_msg = _format_agent_system(agent, scenario_for_trial, include_distractors=include_distractors)
            user_msg = (
                f"DISCUSSION SO FAR:\n{_format_transcript(transcript)}\n\n"
                f"It is now your turn to speak ({agent.display_name}). "
                f"Contribute to the discussion in 1-3 sentences."
            )
            reply = chat(
                [{"role": "system", "content": sys_msg}, {"role": "user", "content": user_msg}],
                model=model,
                temperature=0.7,
            )
            transcript.append({"turn": turn, "speaker": agent.display_name, "text": reply})
            turn += 1
            if verbose:
                print(f"  [t{turn}] {agent.display_name}: {reply[:140]}{'...' if len(reply) > 140 else ''}")

    votes: dict[str, str] = {}
    for agent in agents:
        sys_msg = _format_agent_system(agent, scenario_for_trial, include_distractors=include_distractors)
        user_msg = (
            f"DISCUSSION TRANSCRIPT:\n{_format_transcript(transcript)}\n\n"
            + VOTE_TEMPLATE.format(name=agent.display_name, options=", ".join(scenario.decision_options))
        )
        vote_text = chat(
            [{"role": "system", "content": sys_msg}, {"role": "user", "content": user_msg}],
            model=model,
            temperature=0.3,
            max_tokens=120,
        )
        chosen = _parse_vote(vote_text, scenario.decision_options)
        votes[agent.id] = chosen or "UNPARSEABLE"
        if verbose:
            print(f"  [vote] {agent.display_name} -> {votes[agent.id]}")

    tallies: dict[str, int] = {}
    for v in votes.values():
        tallies[v] = tallies.get(v, 0) + 1
    consensus = None
    if tallies:
        top_opt, top_count = max(tallies.items(), key=lambda kv: kv[1])
        if top_count > len(agents) / 2:
            consensus = top_opt
    is_optimal = consensus == scenario.optimal_decision

    transcript_text = "\n".join(f"{t['speaker']}: {t['text']}" for t in transcript)
    clues_surfaced_flags: dict[str, bool] = {}
    for agent in agents:
        clues_surfaced_flags[agent.id] = _clue_was_surfaced(agent.private_clue, transcript_text, model)
    unique_surfaced = sum(1 for v in clues_surfaced_flags.values() if v)

    if verbose:
        print(f"  [result] consensus={consensus} optimal={scenario.optimal_decision} unique_surfaced={unique_surfaced}/{len(agents)}")

    return TrialResult(
        scenario=scenario.key,
        model=model,
        condition=condition,
        trial_idx=trial_idx,
        seed=seed,
        optimal_decision=scenario.optimal_decision,
        consensus=consensus,
        is_optimal=is_optimal,
        votes=votes,
        unique_clues_surfaced=unique_surfaced,
        total_unique_clues=len(agents),
        clues_surfaced_flags=clues_surfaced_flags,
        n_turns=turn,
        transcript=transcript,
    )


# ── CSV writer ──────────────────────────────────────────────────────────────

def write_trial_row(csv_path: Path, result: TrialResult) -> None:
    row = {
        "scenario": result.scenario,
        "model": result.model,
        "condition": result.condition,
        "trial_idx": result.trial_idx,
        "seed": result.seed,
        "optimal_decision": result.optimal_decision,
        "consensus": result.consensus or "",
        "is_optimal": int(result.is_optimal),
        "unique_clues_surfaced": result.unique_clues_surfaced,
        "total_unique_clues": result.total_unique_clues,
        "n_turns": result.n_turns,
        "votes_json": json.dumps(result.votes),
        "clues_surfaced_json": json.dumps(result.clues_surfaced_flags),
    }
    is_new = not csv_path.exists()
    with csv_path.open("a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(row.keys()))
        if is_new:
            w.writeheader()
        w.writerow(row)


def write_transcript(txt_path: Path, result: TrialResult) -> None:
    with txt_path.open("a") as f:
        f.write(f"\n{'=' * 78}\n")
        f.write(f"scenario={result.scenario}  condition={result.condition}  trial={result.trial_idx}  seed={result.seed}\n")
        f.write(f"consensus={result.consensus}  optimal={result.optimal_decision}  is_optimal={result.is_optimal}\n")
        f.write(f"unique_clues_surfaced={result.unique_clues_surfaced}/{result.total_unique_clues}\n")
        f.write(f"{'=' * 78}\n")
        for t in result.transcript:
            f.write(f"[t{t['turn']}] {t['speaker']}: {t['text']}\n")
        f.write("\nVOTES:\n")
        for aid, v in result.votes.items():
            f.write(f"  {aid}: {v}\n")


def summarize(results: list[TrialResult]) -> dict[str, Any]:
    if not results:
        return {"n": 0}
    n = len(results)
    n_optimal = sum(1 for r in results if r.is_optimal)
    avg_clues = sum(r.unique_clues_surfaced for r in results) / n
    avg_total = sum(r.total_unique_clues for r in results) / n
    return {
        "n": n,
        "optimal_rate": n_optimal / n,
        "n_optimal": n_optimal,
        "avg_unique_clues_surfaced": avg_clues,
        "avg_total_unique_clues": avg_total,
        "avg_clue_surface_rate": avg_clues / avg_total if avg_total else 0,
    }
