"""
Experiment 1 — Baseline replication with Qwen.

Question: Does Qwen reproduce the Sonnet-baseline null (no shared-information bias)?
If Qwen ALSO solves all 5 scenarios cleanly, the null is robust across model families.
If Qwen fails, that's evidence the null was a Sonnet-capability effect — and the
remaining experiments characterize the failure conditions.

Design
- 5 scenarios x N trials each, plain group discussion (no moderator, no manipulation).
- Records: optimal-decision rate, unique-clue surface rate, full transcripts.

Run
    python exp1_baseline.py --trials 5

Outputs
    results/exp1_baseline.csv
    results/exp1_baseline_transcripts.txt
    Terminal: per-scenario and overall summary table.
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

from core import (
    DEFAULT_MODEL, RESULTS_DIR, SCENARIOS,
    run_trial, summarize, write_trial_row, write_transcript,
)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--trials", type=int, default=5, help="trials per scenario")
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--rounds", type=int, default=2)
    p.add_argument("--quiet", action="store_true")
    p.add_argument("--scenario", default="restaurant-grants",
                   help="scenario key to run (default: restaurant-grants)")
    p.add_argument("--all-scenarios", action="store_true",
                   help="run all 5 scenarios instead of just one")
    args = p.parse_args()

    csv_path = RESULTS_DIR / "exp1_baseline.csv"
    txt_path = RESULTS_DIR / "exp1_baseline_transcripts.txt"

    scenarios_to_run = (
        list(SCENARIOS.values()) if args.all_scenarios else [SCENARIOS[args.scenario]]
    )

    all_results = []
    per_scenario_results: dict[str, list] = {}
    t0 = time.time()

    for scn in scenarios_to_run:
        print(f"\n{'#' * 78}\n# SCENARIO: {scn.title}  (optimal={scn.optimal_decision})\n{'#' * 78}")
        per_scenario_results[scn.key] = []
        for i in range(args.trials):
            print(f"\n--- trial {i + 1}/{args.trials} ---")
            res = run_trial(
                scn,
                model=args.model,
                condition="baseline",
                trial_idx=i,
                seed=1000 + i,
                rounds=args.rounds,
                verbose=not args.quiet,
            )
            write_trial_row(csv_path, res)
            write_transcript(txt_path, res)
            all_results.append(res)
            per_scenario_results[scn.key].append(res)

    elapsed = time.time() - t0
    print(f"\n\n{'=' * 78}\nSUMMARY (elapsed {elapsed:.0f}s)\n{'=' * 78}")
    print(f"{'scenario':<22}{'n':>4}{'optimal':>10}{'rate':>8}{'clues':>14}")
    for key, rs in per_scenario_results.items():
        s = summarize(rs)
        print(f"{key:<22}{s['n']:>4}{s['n_optimal']:>10}{s['optimal_rate']:>8.2f}"
              f"{s['avg_unique_clues_surfaced']:>7.1f}/{s['avg_total_unique_clues']:.0f}")
    overall = summarize(all_results)
    print(f"{'OVERALL':<22}{overall['n']:>4}{overall['n_optimal']:>10}"
          f"{overall['optimal_rate']:>8.2f}{overall['avg_unique_clues_surfaced']:>7.1f}/{overall['avg_total_unique_clues']:.0f}")
    print(f"\nWrote: {csv_path}\nWrote: {txt_path}")


if __name__ == "__main__":
    main()
