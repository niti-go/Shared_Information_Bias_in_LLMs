"""
Experiment 2 — Information dilution.

Question: Does the bias appear when each agent's decisive private clue is buried
among plausible-but-irrelevant distractor clues?

Real-world tie-in: in actual decision settings (medical chart, hiring portfolio),
the decisive fact is never the only thing in an expert's head. We test whether
LLM agents can still surface the diagnostic piece when it's not their only fact.

Design
- 3 distractor levels: 0 (control), 2, 5 distractors per agent.
- Same 5 scenarios, N trials per (scenario x level).

Run
    python exp2_dilution.py --trials 4

Outputs
    results/exp2_dilution.csv
    results/exp2_dilution_transcripts.txt
"""

from __future__ import annotations

import argparse
import copy
import random
import time
from pathlib import Path

from core import (
    DEFAULT_MODEL, RESULTS_DIR, SCENARIOS,
    run_trial, summarize, write_trial_row, write_transcript,
)


DISTRACTORS: dict[str, dict[str, list[str]]] = {
    "restaurant-grants": {
        "a1": [
            "All three neighborhoods have submitted preliminary budget paperwork on time.",
            "The mayor publicly mentioned each neighborhood at least once in the last quarter.",
            "North End has the longest-running farmers market in the city.",
            "East Harbor's chamber of commerce held its annual gala last month.",
            "South Market's restaurant association recently elected a new chair.",
            "Average annual revenue per restaurant is broadly comparable across the three neighborhoods.",
            "All three areas have access to the city's small-business mentorship program.",
            "Tourism board materials feature each neighborhood at similar frequencies.",
            "North End's previous grant cycle was administered without significant compliance issues.",
            "Population growth over the last decade is within 2 percentage points across all three areas.",
        ],
        "a2": [
            "Each neighborhood has a designated city liaison who attends monthly community meetings.",
            "All three areas had press coverage in the local paper this month.",
            "Volunteer rates are roughly comparable across the three areas.",
            "North End hosts the annual neighborhood chili cook-off.",
            "East Harbor has a popular weekday ferry stop.",
            "Public Wi-Fi coverage is functionally similar across the three neighborhoods.",
            "Each area is served by at least one community development corporation.",
            "South Market's annual block party draws regional attendance.",
            "Residents in all three areas filed comparable numbers of 311 complaints last year.",
            "East Harbor's historical society has been active since the 1980s.",
        ],
        "a3": [
            "Standard permit processing times for non-kitchen renovations are similar across the three neighborhoods.",
            "All three areas have access to standard utility infrastructure.",
            "North End's main commercial street was repaved within the last three years.",
            "East Harbor's signage and wayfinding system was updated in 2023.",
            "South Market has an active community garden program.",
            "Sidewalk widths along restaurant rows are comparable in all three areas.",
            "Fire code inspection schedules are administered on the same citywide cadence.",
            "Each neighborhood has at least two ADA-compliant accessible corridors.",
            "Trash and recycling pickup services run on similar schedules across the three areas.",
            "Streetlight maintenance backlogs are roughly equal across the neighborhoods.",
        ],
        "a4": [
            "All three areas have submitted accurate financial disclosures.",
            "The committee has previously funded projects in two of the three areas without issue.",
            "North End's chamber of commerce membership has remained stable in recent years.",
            "East Harbor has applied for state matching funds in a separate program.",
            "South Market's last city audit closed with no findings.",
            "Each neighborhood has at least one community bank branch.",
            "Average property tax delinquency rates among the three areas are within 1.5 percentage points.",
            "All three areas qualify for the standard small-business interest rate program.",
            "Annual chamber dues are comparable in structure across the three neighborhoods.",
            "Each neighborhood has an established business improvement district with similar revenue.",
        ],
        "a5": [
            "Demographic census data is publicly available for all three areas.",
            "All three areas have local community boards that meet monthly.",
            "North End has a popular dog park used by the broader district.",
            "East Harbor recently celebrated its 100th anniversary as a designated district.",
            "South Market's library branch was renovated last year.",
            "School quality ratings are broadly similar across all three neighborhoods.",
            "Each area has at least one community health clinic within walking distance.",
            "Public transit ridership growth was positive in all three areas last year.",
            "Local language-access services exist in all three neighborhoods.",
            "Each neighborhood has an annual cultural festival drawing regional attendance.",
        ],
    },
    "hiring-decision": {
        "a1": [
            "All three candidates submitted complete application packets on time.",
            "Each candidate completed the same standard pre-screen.",
            "Candidate A mentioned distance running as a hobby in their cover letter.",
            "Candidate B mentioned that they enjoy cooking during the interview.",
            "Candidate C has lived in two countries earlier in their career.",
            "Each candidate has been responsive to recruiter communication.",
            "All three candidates met our minimum education requirement.",
            "Candidate A previously worked at a mid-sized company.",
            "Candidate B previously worked on a similar team size as ours.",
            "Candidate C previously worked at three different organizations.",
        ],
        "a2": [
            "All three take-home projects were submitted within the deadline.",
            "Each candidate met the minimum experience threshold for the role.",
            "Candidate A is open to remote work.",
            "Candidate B prefers hybrid arrangements.",
            "Candidate C requested a relocation conversation.",
            "All three candidates submitted code in the same programming language we use.",
            "Each candidate ran their take-home test suite before submitting.",
            "Candidate A used a popular IDE in their assessment.",
            "Candidate B included a brief README with their submission.",
            "Candidate C provided a short video walkthrough of their solution.",
        ],
        "a3": [
            "All three candidates passed standard reference checks for employment dates.",
            "Each candidate completed the diversity and inclusion intake questionnaire.",
            "Candidate A has a degree from a well-regarded university.",
            "Candidate B has volunteered as a mentor in coding bootcamps.",
            "Candidate C participated in a hackathon last year.",
            "All three candidates' availability windows overlap with our preferred start date.",
            "Each candidate completed the standard background check intake.",
            "Candidate A's references returned standard-form completions on time.",
            "Candidate B's recruiter intake was conducted by our standard vendor.",
            "Candidate C's employment authorization paperwork is in order.",
        ],
        "a4": [
            "All three resumes were reviewed by at least two product team members.",
            "Each candidate has at least 5 years of relevant professional experience.",
            "Candidate A presented well in the technical portion of the interview.",
            "Candidate B made eye contact and engaged warmly with the panel.",
            "Candidate C arrived early for their interview.",
            "All three candidates asked thoughtful questions about our roadmap.",
            "Each candidate followed up with a thank-you note within 24 hours.",
            "Candidate A's portfolio includes a public side project.",
            "Candidate B referenced our publicly posted product values during the interview.",
            "Candidate C has a portfolio site with case studies.",
        ],
        "a5": [
            "All three candidates expressed enthusiasm for our team's mission.",
            "Each candidate's salary expectations are within the approved range.",
            "Candidate A is active in open-source communities.",
            "Candidate B has spoken at industry conferences in the past two years.",
            "Candidate C maintains a technical blog with consistent posts.",
            "All three candidates have been clear about their preferred communication styles.",
            "Each candidate has worked in cross-functional roles before.",
            "Candidate A described a recent on-call rotation experience.",
            "Candidate B mentioned their preferred 1:1 cadence with managers.",
            "Candidate C noted prior experience with agile ceremonies.",
        ],
    },
    "medical-treatment": {
        "a1": [
            "The patient is 64 years old and has a supportive family member who attends visits.",
            "The patient has reliable transportation to the clinic.",
            "All three plans use generally well-tolerated medications in the broader population.",
            "Treatment Plan A has been on the institutional formulary for over a decade.",
            "Treatment Plan B was recently added to the hospital's approved list.",
            "Each plan has a standard FDA labeling for the patient's primary condition.",
            "The patient's last EKG was reviewed and signed off by cardiology.",
            "All three plans are stocked at the hospital pharmacy.",
            "The patient has no documented drug allergies in the chart.",
            "Each plan has a clinical pathway document available in the system.",
        ],
        "a2": [
            "The patient's blood pressure was well-controlled at the last three outpatient visits.",
            "Each plan has comparable monthly cost coverage under the patient's insurance.",
            "Treatment Plan A is administered orally.",
            "Treatment Plan B has a once-daily dosing schedule.",
            "Treatment Plan C requires monthly bloodwork for routine monitoring.",
            "Each plan has been reviewed in the most recent grand rounds session.",
            "All three plans have published patient-facing dosing guides.",
            "The patient has no language barriers to medication instructions.",
            "Each plan is compatible with the patient's reported sleep schedule.",
            "The patient confirmed they can store medications at room temperature.",
        ],
        "a3": [
            "The patient has been adherent to past prescription regimens.",
            "Lab work was drawn last week and reviewed by the team.",
            "Treatment Plan A's manufacturer offers a patient assistance program.",
            "Treatment Plan B has been the subject of two recent literature reviews.",
            "Treatment Plan C was discussed in a national society's recent guidelines.",
            "Each plan has known interactions documented in the standard drug reference.",
            "The patient's BMI is within the studied range for all three plans.",
            "All three plans permit standard exercise recommendations.",
            "The patient's hydration status was unremarkable at last visit.",
            "Each plan has a generic equivalent available within the hospital system.",
        ],
        "a4": [
            "The patient's primary pharmacy is within walking distance of their home.",
            "All three plans have available generic forms.",
            "Treatment Plan A is the most familiar to the floor nursing staff.",
            "Treatment Plan B comes in a convenient blister pack.",
            "Treatment Plan C has multiple administration options.",
            "Each plan's titration schedule fits within the patient's existing visit cadence.",
            "All three plans have similar refill workflows in our pharmacy system.",
            "The patient has a current OTC vitamin regimen reviewed for compatibility with all three.",
            "Each plan supports the patient's documented dietary preferences.",
            "All three plans have nursing handoff scripts already in the system.",
        ],
        "a5": [
            "The patient asked thoughtful questions during the most recent visit.",
            "Each plan has an associated patient education pamphlet in multiple languages.",
            "Treatment Plan A has been mentioned in the patient's local support group.",
            "Treatment Plan B was discussed on a recent health podcast.",
            "Treatment Plan C has a well-known patient advocacy organization.",
            "The patient prefers morning appointments and all three plans accommodate that.",
            "Each plan's first follow-up appointment can be scheduled within two weeks.",
            "The patient values clarity in written instructions for all care.",
            "All three plans have telehealth check-in options.",
            "The patient maintains a personal health journal independently.",
        ],
    },
    "research-grant": {
        "a1": [
            "All three labs submitted their proposals through the standard portal.",
            "Each PI completed the required ethics training in the last year.",
            "Lab Alpha has hosted two visiting scholars this year.",
            "Lab Beta held a well-attended open house last semester.",
            "Lab Gamma's website was recently redesigned.",
            "Each PI has an up-to-date ORCID profile.",
            "All three labs have submitted proposals through this office in previous cycles.",
            "Lab Alpha publishes monthly internal seminar notes.",
            "Lab Beta participates in the campus interdisciplinary cluster.",
            "Lab Gamma has an active LinkedIn presence.",
        ],
        "a2": [
            "All three proposals followed the required formatting guidelines.",
            "Each PI has at least three years remaining on their current appointment.",
            "Lab Alpha is located in the main science building.",
            "Lab Beta shares space with a teaching lab.",
            "Lab Gamma occupies a renovated wing.",
            "All three labs have completed their annual departmental progress reports.",
            "Each PI has presented at the campus research showcase in the past two years.",
            "Lab Alpha lists three external collaborators on the proposal cover sheet.",
            "Lab Beta lists four external collaborators.",
            "Lab Gamma lists two external collaborators and one consultant.",
        ],
        "a3": [
            "All three labs have current institutional support letters.",
            "Each PI is in good standing with the office of research.",
            "Lab Alpha has two postdocs listed on the personnel page.",
            "Lab Beta employs three graduate students on the proposal.",
            "Lab Gamma has a part-time research coordinator.",
            "All three proposals include a standard data management plan.",
            "Each PI has acknowledged the new indirect cost rate in their budget.",
            "Lab Alpha's effort allocations match the institutional cap.",
            "Lab Beta's budget justifications follow the standard template.",
            "Lab Gamma's facilities and administrative breakdown is properly documented.",
        ],
        "a4": [
            "All three proposals include reasonable equipment requests.",
            "Each lab has at least one collaboration with another university.",
            "Lab Alpha has presented at the last two annual symposia.",
            "Lab Beta runs a popular journal club.",
            "Lab Gamma sponsors an undergraduate research program.",
            "All three labs participate in campus tours during prospective student weekends.",
            "Each lab maintains a basic public-facing description on the department website.",
            "Lab Alpha has a Twitter account with regular updates.",
            "Lab Beta has a podcast that runs occasionally.",
            "Lab Gamma maintains an updated GitHub organization for code releases.",
        ],
        "a5": [
            "All three labs comply with general university data-handling policies.",
            "Each PI has served on at least one university committee in the last two years.",
            "Lab Alpha's safety review was completed in March.",
            "Lab Beta's last animal protocol was approved without revisions.",
            "Lab Gamma maintains an active outreach social media presence.",
            "All three labs have completed the standard responsible-conduct-of-research module.",
            "Each PI has signed the required intellectual property disclosure for this cycle.",
            "Lab Alpha contributes to the department's diversity outreach initiative.",
            "Lab Beta hosts a summer undergraduate workshop annually.",
            "Lab Gamma sponsors a regional high school science competition each spring.",
        ],
    },
    "city-development": {
        "a1": [
            "All three sites are zoned compatibly with their proposed uses.",
            "Each project has received preliminary architectural review.",
            "The Riverside site is near a popular weekend farmers market.",
            "The Eastside site is adjacent to a public school.",
            "The Downtown site is across from city hall.",
            "All three projects have draft renderings available in the planning portal.",
            "Each project has submitted preliminary site survey documentation.",
            "The Riverside site is served by an existing bus line.",
            "The Eastside site is within a quarter mile of an existing fire station.",
            "The Downtown site has historic plaque coverage on the adjacent block.",
        ],
        "a2": [
            "All three projects have submitted EIS drafts.",
            "Each project has received initial public comments.",
            "Riverside Park has been requested by neighborhood schools for field trips.",
            "The Eastside Tech Hub has hosted three planning charrettes.",
            "The Downtown Transit Center proposal includes covered bike parking.",
            "All three projects committed to LEED-equivalent sustainability targets.",
            "Each project's draft includes a tree preservation plan.",
            "Riverside Park's design includes stormwater retention features.",
            "The Eastside Tech Hub plans on-site EV charging.",
            "The Downtown Transit Center's design includes green-roof elements.",
        ],
        "a3": [
            "All three budget proposals are within the city's capital range.",
            "Each project has identified a project manager.",
            "Riverside Park is supported by the local youth sports league.",
            "The Eastside Tech Hub has expressed interest from a regional employer.",
            "The Downtown Transit Center would replace an aging structure.",
            "All three projects qualify for the city's standard capital improvement bond.",
            "Each project has identified at least one minority-owned subcontractor option.",
            "Riverside Park has a published 20-year operating cost projection.",
            "The Eastside Tech Hub has a draft tenant-improvement allowance budget.",
            "The Downtown Transit Center has cost estimates reviewed by an external firm.",
        ],
        "a4": [
            "All three projects have held at least two public meetings.",
            "Each project has a published timeline summary.",
            "Riverside Park signage would be available in three languages.",
            "The Eastside Tech Hub plans community-facing rooms.",
            "The Downtown Transit Center incorporates public art.",
            "All three projects have an active feedback channel on the city website.",
            "Each project committed to publishing quarterly construction updates.",
            "Riverside Park's design team includes a community liaison.",
            "The Eastside Tech Hub plans free wifi in adjacent public areas.",
            "The Downtown Transit Center will host construction-phase walking tours.",
        ],
        "a5": [
            "All three projects have engaged the city's transportation modeling team.",
            "Each project has draft accessibility plans.",
            "Riverside Park's pathways are designed to ADA standards.",
            "The Eastside Tech Hub's parking design follows current code.",
            "The Downtown Transit Center includes bus-bay updates.",
            "All three projects have draft bike-rack placement maps.",
            "Each project's draft considers connections to the existing pedestrian network.",
            "Riverside Park includes proposed pedestrian crosswalks at two entry points.",
            "The Eastside Tech Hub's frontage includes wider sidewalks than current code requires.",
            "The Downtown Transit Center will retain the current taxi loading zone.",
        ],
    },
}


def with_distractors(scenario, n_distractors: int, seed: int = 0):
    """Return a deep copy of scenario with n distractors added to each agent.
    Distractors are sampled from each agent's pool using the given seed, so
    different trials see different subsets of distractors."""
    rng = random.Random(seed)
    new_scn = copy.deepcopy(scenario)
    distractor_pool = DISTRACTORS.get(scenario.key, {})
    for agent in new_scn.agents:
        pool = list(distractor_pool.get(agent.id, []))
        rng.shuffle(pool)
        agent.distractor_clues = pool[:n_distractors]
    return new_scn


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--trials", type=int, default=4)
    p.add_argument("--levels", type=int, nargs="+", default=[0, 3, 6, 10])
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--rounds", type=int, default=2)
    p.add_argument("--quiet", action="store_true")
    p.add_argument("--scenario", default="restaurant-grants",
                   help="scenario key to run (default: restaurant-grants)")
    p.add_argument("--all-scenarios", action="store_true",
                   help="run all 5 scenarios instead of just one")
    args = p.parse_args()

    csv_path = RESULTS_DIR / "exp2_dilution.csv"
    txt_path = RESULTS_DIR / "exp2_dilution_transcripts.txt"
    scenarios_to_run = (
        list(SCENARIOS.values()) if args.all_scenarios else [SCENARIOS[args.scenario]]
    )

    per_cond_results: dict[str, list] = {}
    t0 = time.time()

    for n_dist in args.levels:
        cond_name = f"distractors={n_dist}"
        per_cond_results[cond_name] = []
        print(f"\n{'#' * 78}\n# CONDITION: {cond_name}\n{'#' * 78}")
        for scn in scenarios_to_run:
            print(f"\n--- scenario: {scn.title} ---")
            for i in range(args.trials):
                trial_seed = 2000 + n_dist * 100 + i
                scn_with = with_distractors(scn, n_dist, seed=trial_seed)
                print(f"\n[trial {i + 1}/{args.trials}]")
                res = run_trial(
                    scn_with,
                    model=args.model,
                    condition=cond_name,
                    trial_idx=i,
                    seed=trial_seed,
                    rounds=args.rounds,
                    include_distractors=True,
                    verbose=not args.quiet,
                )
                write_trial_row(csv_path, res)
                write_transcript(txt_path, res)
                per_cond_results[cond_name].append(res)

    elapsed = time.time() - t0
    print(f"\n\n{'=' * 78}\nSUMMARY (elapsed {elapsed:.0f}s)\n{'=' * 78}")
    print(f"{'condition':<22}{'n':>4}{'optimal':>10}{'rate':>8}{'avg_clues':>14}")
    for cond, rs in per_cond_results.items():
        s = summarize(rs)
        print(f"{cond:<22}{s['n']:>4}{s['n_optimal']:>10}{s['optimal_rate']:>8.2f}"
              f"{s['avg_unique_clues_surfaced']:>7.1f}/{s['avg_total_unique_clues']:.0f}")
    print(f"\nWrote: {csv_path}\nWrote: {txt_path}")


if __name__ == "__main__":
    main()
