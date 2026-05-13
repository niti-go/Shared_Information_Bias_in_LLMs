"""
Experiment 5 — Group size scaling.

Question: Does adding more agents help (more clue-holders, more error-correction)
or hurt (more pressure to converge, more turns of shared-info repetition)?

In the human literature, Stasser found a non-monotonic effect: more group members
mean more decisive clues are held by *someone*, but conversation airtime is
finite, so unique clues are surfaced at lower rates and small groups sometimes
outperform large ones.

Real-world tie-in: when teams design "AI committees," there's a tendency to add
agents to cover more perspectives. We test whether that helps or backfires.

Design
- Group sizes: 3, 4, 5 agents (we have 5 unique clue-holders per scenario).
- For n_agents < 5, we use the first n agents of the scenario.
- N trials per (scenario x size).

Run
    python exp5_group_size.py --trials 4
"""

from __future__ import annotations

import argparse
import time

from core import (
    DEFAULT_MODEL, RESULTS_DIR, SCENARIOS,
    run_trial, summarize, write_trial_row, write_transcript,
)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--trials", type=int, default=4)
    p.add_argument("--sizes", type=int, nargs="+", default=[3, 4, 5])
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--rounds", type=int, default=2)
    p.add_argument("--quiet", action="store_true")
    p.add_argument("--scenario", default="restaurant-grants",
                   help="scenario key to run (default: restaurant-grants)")
    p.add_argument("--all-scenarios", action="store_true",
                   help="run all 5 scenarios instead of just one")
    args = p.parse_args()

    csv_path = RESULTS_DIR / "exp5_group_size.csv"
    txt_path = RESULTS_DIR / "exp5_group_size_transcripts.txt"
    scenarios_to_run = (
        list(SCENARIOS.values()) if args.all_scenarios else [SCENARIOS[args.scenario]]
    )

    per_size_results: dict[int, list] = {n: [] for n in args.sizes}
    t0 = time.time()

    for n in args.sizes:
        print(f"\n{'#' * 78}\n# GROUP SIZE: {n} agents\n{'#' * 78}")
        for scn in scenarios_to_run:
            print(f"\n--- scenario: {scn.title} ---")
            for i in range(args.trials):
                print(f"\n[trial {i + 1}/{args.trials}]")
                res = run_trial(
                    scn,
                    model=args.model,
                    condition=f"n_agents={n}",
                    trial_idx=i,
                    seed=5000 + n * 100 + i,
                    rounds=args.rounds,
                    n_agents=n,
                    verbose=not args.quiet,
                )
                write_trial_row(csv_path, res)
                write_transcript(txt_path, res)
                per_size_results[n].append(res)

    elapsed = time.time() - t0
    print(f"\n\n{'=' * 78}\nSUMMARY (elapsed {elapsed:.0f}s)\n{'=' * 78}")
    print(f"{'condition':<22}{'n':>4}{'optimal':>10}{'rate':>8}{'avg_clues':>14}")
    for n, rs in per_size_results.items():
        s = summarize(rs)
        print(f"n_agents={n:<14}{s['n']:>4}{s['n_optimal']:>10}{s['optimal_rate']:>8.2f}"
              f"{s['avg_unique_clues_surfaced']:>7.1f}/{s['avg_total_unique_clues']:.0f}")
    print(f"\nWrote: {csv_path}\nWrote: {txt_path}")


if __name__ == "__main__":
    main()
