"""
Single-agent control. Can one agent pick the optimum from shared info alone?

If yes, the scenarios aren't real hidden profiles - the answer is derivable
without pooling private clues. If no, the group's success in exp1 really does
depend on getting the private facts on the table.

Two conditions per scenario:
    mixed   - original shared clues (control)
    decoy   - exp3's rewritten shared clues that argue for a suboptimal target

Run
    python exp6_single_agent.py --trials 5
"""

import argparse
import csv
import json
import re
import time

from core import DEFAULT_MODEL, RESULTS_DIR, SCENARIOS, chat
from exp3_adversarial_shared import DECOYS


PROMPT = """You are on a decision committee. Pick one option.

Task: {description}

Options: {options}

What you know:
{facts}

Reply with one JSON object on a single line:
{{"choice": "<option name, copied exactly>", "rationale": "<one sentence>"}}"""


def parse_choice(text, options):
    m = re.search(r"\{[^{}]*\"choice\"[^{}]*\}", text, re.DOTALL)
    if m:
        try:
            picked = str(json.loads(m.group(0)).get("choice", ""))
            for opt in options:
                if opt.lower() in picked.lower() or picked.lower() in opt.lower():
                    return opt
        except json.JSONDecodeError:
            pass
    for opt in options:
        if opt.lower() in text.lower():
            return opt
    return None


def ask(scenario, shared, model):
    facts = "\n".join(f"- {c}" for c in shared)
    prompt = PROMPT.format(
        description=scenario.description,
        options=", ".join(scenario.decision_options),
        facts=facts,
    )
    return chat(
        [{"role": "user", "content": prompt}],
        model=model,
        temperature=0.3,
        max_tokens=120,
    )


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--trials", type=int, default=5)
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--quiet", action="store_true")
    args = p.parse_args()

    csv_path = RESULTS_DIR / "exp6_single_agent.csv"
    txt_path = RESULTS_DIR / "exp6_single_agent_responses.txt"
    is_new = not csv_path.exists()

    totals = {"mixed": [0, 0], "decoy": [0, 0]}  # [optimal, total]
    decoy_picks = {"mixed": 0, "decoy": 0}
    t0 = time.time()

    f = csv_path.open("a", newline="")
    txt = txt_path.open("a")
    w = csv.DictWriter(f, fieldnames=[
        "scenario", "model", "condition", "trial_idx",
        "optimal_decision", "decoy_target", "chosen",
        "is_optimal", "is_decoy",
    ])
    if is_new:
        w.writeheader()

    for scn in SCENARIOS.values():
        target = DECOYS[scn.key]["target"]
        decoy_shared = DECOYS[scn.key]["shared"]
        print(f"\n=== {scn.title}  optimal={scn.optimal_decision}  decoy={target} ===")

        for cond, shared in [("mixed", scn.shared_clues), ("decoy", decoy_shared)]:
            for i in range(args.trials):
                raw = ask(scn, shared, args.model)
                chosen = parse_choice(raw, scn.decision_options)
                optimal = chosen == scn.optimal_decision
                is_decoy = chosen == target

                totals[cond][1] += 1
                if optimal:
                    totals[cond][0] += 1
                if is_decoy:
                    decoy_picks[cond] += 1

                if not args.quiet:
                    tag = " (optimal)" if optimal else (" (decoy)" if is_decoy else "")
                    print(f"  [{cond} {i+1}/{args.trials}] {chosen}{tag}")

                w.writerow({
                    "scenario": scn.key,
                    "model": args.model,
                    "condition": cond,
                    "trial_idx": i,
                    "optimal_decision": scn.optimal_decision,
                    "decoy_target": target,
                    "chosen": chosen or "UNPARSEABLE",
                    "is_optimal": int(optimal),
                    "is_decoy": int(is_decoy),
                })
                txt.write(f"\n--- {scn.key} / {cond} / trial {i} ---\n{raw}\n")

    f.close()
    txt.close()

    print(f"\nDone in {time.time() - t0:.0f}s")
    for cond, (k, n) in totals.items():
        d = decoy_picks[cond]
        pct = (k / n * 100) if n else 0
        print(f"  {cond:<6} optimal {k}/{n} ({pct:.0f}%)   decoy picks {d}/{n}")
    print(f"\nWrote: {csv_path}\nWrote: {txt_path}")


if __name__ == "__main__":
    main()
