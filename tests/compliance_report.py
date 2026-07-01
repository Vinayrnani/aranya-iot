#!/usr/bin/env python3
"""
Viva Voice — Compliance Report Generator

Generates structured markdown reports from compliance analysis results.
Tracks issues across iterations for trend comparison.

Usage:
    python3 compliance_report.py --results results.json --output report.md
    python3 compliance_report.py --session results/ --scenarios scenarios.json --report report.md
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional


def load_results(results_path: str) -> Dict[str, Any]:
    """Load analysis results from JSON."""
    with open(results_path) as f:
        return json.load(f)


def load_scenario(scenario_id: str, scenarios_path: str) -> Optional[Dict[str, Any]]:
    """Load a specific scenario definition."""
    with open(scenarios_path) as f:
        scenarios_data = json.load(f)
    for s in scenarios_data.get("scenarios", []):
        if s["id"] == scenario_id:
            return s
    return None


def format_turn_severity(turn: Dict[str, Any]) -> str:
    """Return emoji/severity for a turn result."""
    if turn["failures"] > 0:
        return "🔴 FAIL"
    if turn["has_unknowns"]:
        return "🟡 REVIEW"
    return "🟢 PASS"


def generate_report(
    all_results: Dict[str, Any],  # {scenario_id: {turns: [...], trend: {...}}}
    scenarios_path: str = "scenarios/scenarios.json",
    iteration: int = 1,
) -> str:
    """Generate full markdown compliance report."""
    lines = []
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S IST")

    # ── Header ──────────────────────────────────────────────────────────────
    lines.append(f"# Viva Voice — System Prompt Compliance Report")
    lines.append(f"")
    lines.append(f"**Iteration:** {iteration}  ")
    lines.append(f"**Date:** {timestamp}  ")
    lines.append(f"**Server:** http://127.0.0.1:8000  ")
    lines.append(f"")
    lines.append(f"---")
    lines.append(f"")

    # ── Summary Table ───────────────────────────────────────────────────────
    total_turns = 0
    total_failures = 0
    total_pass = 0
    total_scenarios = len(all_results)
    scenario_rows = []

    for scenario_id, sdata in all_results.items():
        scenario = load_scenario(scenario_id, scenarios_path)
        sname = scenario["name"] if scenario else scenario_id
        turns = sdata.get("turns", [])
        trend = sdata.get("trend", {})

        st_failures = sum(t["failures"] for t in turns)
        st_unknowns = sum(t["has_unknowns"] for t in turns)
        st_turns = len(turns)
        st_pass = sum(1 for t in turns if t["overall_pass"])

        total_turns += st_turns
        total_failures += st_failures
        total_pass += st_pass

        trend_notes = trend.get("trend_notes", [])
        status_icon = "🔴" if st_failures > 0 else ("🟡" if st_unknowns > 0 else "🟢")
        scenario_rows.append((scenario_id, sname, st_turns, st_failures, st_unknowns, status_icon, trend.get("overall_verdict", "?")))

    lines.append(f"## Executive Summary")
    lines.append(f"")
    lines.append(f"| # | Scenario | Turns | ❌ Fail | ❓ Unclear | Verdict |")
    lines.append(f"|---|----------|-------|---------|-----------|---------|")
    for sid, sname, turns, fails, unknowns, icon, verdict in scenario_rows:
        lines.append(f"| {icon} | {sname} | {turns} | {fails} | {unknowns} | {verdict} |")
    lines.append(f"")
    lines.append(f"**Totals:** {total_scenarios} scenarios, {total_turns} turns, {total_failures} rule failures  ")
    lines.append(f"")
    lines.append(f"---")
    lines.append(f"")

    # ── Per-Scenario Details ────────────────────────────────────────────────
    lines.append(f"## Per-Scenario Details")
    lines.append(f"")

    for scenario_id, sdata in all_results.items():
        scenario = load_scenario(scenario_id, scenarios_path)
        sname = scenario["name"] if scenario else scenario_id
        sdesc = scenario["description"] if scenario else ""
        sguest = scenario.get("guest_profile", "") if scenario else ""
        turns = sdata.get("turns", [])
        trend = sdata.get("trend", {})

        status_icon = "🔴" if any(t["failures"] > 0 for t in turns) else "🟢"
        lines.append(f"### {status_icon} {sname}")
        lines.append(f"")
        if sdesc:
            lines.append(f"_{sdesc}_  ")
            lines.append(f"")
        if sguest:
            lines.append(f"*Guest profile: {sguest}*  ")
            lines.append(f"")

        # Per-turn results
        for t in turns:
            severity = format_turn_severity(t)
            lines.append(f"<details>")
            lines.append(f"<summary><b>{severity}</b> Turn {t['turn_num']}: {t['turn_id']}</summary>")
            lines.append(f"")
            lines.append(f"**Guest said:** _{t['guest_says']}_  ")
            lines.append(f"**Assistant:** {t.get('assistant_response', '*(not captured)*')}  ")
            lines.append(f"**Context:** {t['context']}  ")
            lines.append(f"")
            lines.append(f"| Rule | Status | Evidence |")
            lines.append(f"|------|--------|----------|")
            for r in t["rules"]:
                status_emoji = "✅" if r.get("passed") is True else ("❌" if r.get("passed") is False else "❓")
                lines.append(f"| {r['rule']} | {status_emoji} | {r['evidence']} |")
            lines.append(f"")
            lines.append(f"</details>")
            lines.append(f"")

        # Trend analysis
        trend_notes = trend.get("trend_notes", [])
        if trend_notes:
            lines.append(f"**Trend Analysis:**  ")
            lines.append(f"")
            for note in trend_notes:
                lines.append(f"- {note}")
            lines.append(f"")

        lines.append(f"---")
        lines.append(f"")

    # ── Aggregate Issues ────────────────────────────────────────────────────
    lines.append(f"## Aggregate Issues")
    lines.append(f"")

    # Collect all failures across scenarios
    all_failures = {}  # rule -> [(scenario, turn, evidence)]
    all_unknowns = {}
    for scenario_id, sdata in all_results.items():
        scenario = load_scenario(scenario_id, scenarios_path)
        sname = scenario["name"] if scenario else scenario_id
        for t in sdata.get("turns", []):
            for r in t["rules"]:
                if r.get("passed") is False:
                    all_failures.setdefault(r["rule"], []).append({
                        "scenario": sname,
                        "turn": t["turn_id"],
                        "evidence": r["evidence"],
                        "guest_says": t["guest_says"],
                    })
                elif r.get("passed") is None:
                    all_unknowns.setdefault(r["rule"], []).append({
                        "scenario": sname,
                        "turn": t["turn_id"],
                        "evidence": r["evidence"],
                    })

    if all_failures:
        lines.append(f"### 🔴 Failed Rules by Frequency")
        lines.append(f"")
        lines.append(f"| Rule | Count | Occurrences |")
        lines.append(f"|------|-------|-------------|")
        for rule, occurrences in sorted(all_failures.items(), key=lambda x: -len(x[1])):
            short_list = "; ".join(f"{o['scenario']}/{o['turn']}" for o in occurrences[:3])
            if len(occurrences) > 3:
                short_list += f" (+{len(occurrences) - 3} more)"
            lines.append(f"| {rule} | {len(occurrences)} | {short_list} |")
        lines.append(f"")

        # Show failure detail
        for rule, occurrences in sorted(all_failures.items(), key=lambda x: -len(x[1])):
            lines.append(f"<details>")
            lines.append(f"<summary><b>{rule}</b> — {len(occurrences)} failure(s)</summary>")
            lines.append(f"")
            for o in occurrences:
                lines.append(f"- {o['scenario']}/{o['turn']}: _{o['guest_says']}_  ")
                lines.append(f"  → {o['evidence']}  ")
            lines.append(f"")
            lines.append(f"</details>")
            lines.append(f"")
    else:
        lines.append(f"No rule failures found. ✅")
        lines.append(f"")

    if all_unknowns:
        lines.append(f"### ❓ Unclear Results Requiring Human Review")
        lines.append(f"")
        for rule, occurrences in sorted(all_unknowns.items(), key=lambda x: -len(x[1])):
            lines.append(f"<details>")
            lines.append(f"<summary><b>{rule}</b> — {len(occurrences)} unclear</summary>")
            lines.append(f"")
            for o in occurrences:
                lines.append(f"- {o['scenario']}/{o['turn']}: {o['evidence']}")
            lines.append(f"")
            lines.append(f"</details>")
            lines.append(f"")

    lines.append(f"---")
    lines.append(f"")

    # ── Recommendations ────────────────────────────────────────────────────
    lines.append(f"## Recommended Fixes")
    lines.append(f"")
    lines.append(f"_Pending approval — apply only after you review and approve._")
    lines.append(f"")
    if all_failures:
        lines.append(f"### Issues found:")
        for rule, occurrences in sorted(all_failures.items(), key=lambda x: -len(x[1])):
            lines.append(f"- **{rule}** — {len(occurrences)} violation(s)")
        lines.append(f"")
        lines.append(f"Suggestions for each issue will be presented after your review.")
    else:
        lines.append(f"All rules passed. No fixes needed. ✅")
        lines.append(f"")

    lines.append(f"---")
    lines.append(f"")
    lines.append(f"*Report generated by Viva Voice Compliance Framework at {timestamp}*")

    return "\n".join(lines)


def save_report(report: str, output_path: str):
    """Write report to file."""
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w") as f:
        f.write(report)
    print(f"  Report written to {output_path}")


# ─── CLI ────────────────────────────────────────────────────────────────────


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Generate compliance report")
    parser.add_argument("--results", "-r", required=True, help="Results JSON file or directory")
    parser.add_argument("--scenarios", "-s", default="scenarios/scenarios.json", help="Scenarios definition file")
    parser.add_argument("--output", "-o", default="compliance_report.md", help="Output report path")
    parser.add_argument("--iteration", "-i", type=int, default=1, help="Iteration number")
    args = parser.parse_args()

    # Load results
    if os.path.isdir(args.results):
        all_results = {}
        for f in sorted(os.listdir(args.results)):
            if f.endswith(".json"):
                sid = f.replace(".json", "")
                all_results[sid] = load_results(os.path.join(args.results, f))
    else:
        all_results = load_results(args.results)

    report = generate_report(all_results, args.scenarios, iteration=args.iteration)
    save_report(report, args.output)

    # Print summary
    total_fails = sum(
        sum(t["failures"] for t in sdata.get("turns", []))
        for sdata in all_results.values()
    )
    total_turns = sum(
        len(sdata.get("turns", []))
        for sdata in all_results.values()
    )
    print(f"\n{'='*60}")
    print(f"  Report Summary: {len(all_results)} scenarios, {total_turns} turns")
    print(f"  Failures: {total_fails}")
    print(f"  Report: {args.output}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
