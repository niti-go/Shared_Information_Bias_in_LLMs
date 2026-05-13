"""
Experiment 3 — Adversarial shared information.

Question: Stasser & Titus (1985) arranged shared facts to ADVOCATE for the wrong
candidate. Our default scenarios have neutral/mixed shared facts. Does aiming the
shared information at a coherent decoy reproduce the human bias?

Real-world tie-in: in real hiring/medical/grant settings, the publicly-known facts
about a candidate are often the *positives* that got them shortlisted — a coherent
positive narrative for what may not be the best option. We test whether LLMs can
override a coherent decoy story when only private facts contradict it.

Design
- Two conditions per scenario:
    "shared=mixed"         (original — control)
    "shared=decoy"         (3 shared clues all point at a specific suboptimal option)
- For each scenario, suboptimal_target is the option the decoy shared facts argue for.

Run
    python exp3_adversarial_shared.py --trials 5
"""

from __future__ import annotations

import argparse
import time

from core import (
    DEFAULT_MODEL, RESULTS_DIR, SCENARIOS,
    run_trial, summarize, write_trial_row, write_transcript,
)


DECOYS: dict[str, dict[str, list[str] | str]] = {
    "restaurant-grants": {
        "target": "North End",
        "shared": [
            "North End has the highest current foot traffic of any neighborhood, making short-term revenue impact most measurable there.",
            "North End has the most established restaurant scene, with the deepest pool of experienced operators ready to deploy grants immediately.",
            "North End's chamber of commerce has the strongest organizational capacity to administer and report on grant outcomes.",
        ],
    },
    "hiring-decision": {
        "target": "Candidate A (Arjun)",
        "shared": [
            "Candidate A scored highest on the live coding assessment, by a substantial margin.",
            "Candidate A's resume is the strongest of the three on paper, with the most prestigious prior employers.",
            "Candidate A interviewed last and made the most confident, decisive impression on the panel.",
        ],
    },
    "medical-treatment": {
        "target": "Treatment Plan A",
        "shared": [
            "Treatment Plan A has the longest established track record and the most published efficacy data of the three plans.",
            "Treatment Plan A has the lowest baseline cost and is on the formulary at every nearby pharmacy, making access reliable.",
            "Treatment Plan A is the most familiar to the rest of the clinical team, reducing handoff risk.",
        ],
    },
    "research-grant": {
        "target": "Lab Alpha",
        "shared": [
            "Lab Alpha has the strongest recent publication record, including two Nature papers in the last 18 months.",
            "Lab Alpha has the highest citation impact factor among the three labs by a clear margin.",
            "Lab Alpha's senior PI is a long-serving member of the university and has trained more current faculty than any other lab leader on campus.",
        ],
    },
    "city-development": {
        "target": "Eastside Tech Hub",
        "shared": [
            "The Eastside Tech Hub is projected to create 2,000 jobs over five years — by far the largest direct employment impact of any project under consideration.",
            "The Eastside Tech Hub has explicit commitments from two anchor tenants who have signed letters of intent.",
            "The Eastside Tech Hub aligns with the city's published economic development plan and has the most measurable tax-revenue projections.",
        ],
    },
}


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--trials", type=int, default=5)
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--rounds", type=int, default=2)
    p.add_argument("--quiet", action="store_true")
    p.add_argument("--scenario", default="restaurant-grants",
                   help="scenario key to run (default: restaurant-grants)")
    p.add_argument("--all-scenarios", action="store_true",
                   help="run all 5 scenarios instead of just one")
    args = p.parse_args()

    csv_path = RESULTS_DIR / "exp3_adversarial_shared.csv"
    txt_path = RESULTS_DIR / "exp3_adversarial_shared_transcripts.txt"
    scenarios_to_run = (
        list(SCENARIOS.values()) if args.all_scenarios else [SCENARIOS[args.scenario]]
    )

    per_cond_results: dict[str, list] = {"mixed": [], "decoy": []}
    t0 = time.time()

    for scn in scenarios_to_run:
        target = DECOYS[scn.key]["target"]
        decoy_shared = DECOYS[scn.key]["shared"]
        print(f"\n{'#' * 78}\n# SCENARIO: {scn.title}\n#   optimal={scn.optimal_decision}  decoy_target={target}\n{'#' * 78}")
        for cond_name, override in [("mixed", None), ("decoy", decoy_shared)]:
            print(f"\n--- condition: shared={cond_name} ---")
            for i in range(args.trials):
                print(f"\n[trial {i + 1}/{args.trials}]")
                res = run_trial(
                    scn,
                    model=args.model,
                    condition=f"shared={cond_name}",
                    trial_idx=i,
                    seed=3000 + (1 if cond_name == "decoy" else 0) * 100 + i,
                    rounds=args.rounds,
                    use_shared_override=override,
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
        print(f"shared={cond:<15}{s['n']:>4}{s['n_optimal']:>10}{s['optimal_rate']:>8.2f}"
              f"{s['avg_unique_clues_surfaced']:>7.1f}/{s['avg_total_unique_clues']:.0f}")
    print(f"\nWrote: {csv_path}\nWrote: {txt_path}")


if __name__ == "__main__":
    main()
