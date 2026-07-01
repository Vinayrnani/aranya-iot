#!/usr/bin/env python3
"""
Viva Voice — Compliance Framework Demo Run

Generates simulated Gemini responses for each scenario turn and runs the
full compliance analysis pipeline. Demonstrates what the framework catches
without needing the actual Gemini Live API (no outbound internet available
in this environment).

Output: Full compliance report in tests/output/session_demo/report.md

Usage:
    python3 tests/demo_run.py
"""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))

from compliance_rules import check_scenario_turn, generate_trend_analysis, format_human_readable
from compliance_report import generate_report

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCENARIOS_FILE = os.path.join(SCRIPT_DIR, "scenarios", "scenarios.json")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")
SESSION_DIR = os.path.join(OUTPUT_DIR, "session_demo")


# ─── Simulated responses ───────────────────────────────────────────────────
# These mimic realistic Gemini outputs — some compliant, some not.
# This demonstrates what the framework catches.

SIMULATED_RESPONSES = {
    # ── Language Adherence ────────────────────────────────────────────────
    "lang-t1": "నమస్కారం! నేను అరణ్య రిసార్ట్ అసిస్టెంట్ ని. లైట్స్ వేస్తాను. రూమ్ లైట్స్, AC, ఫ్యాన్, ambiance లైట్స్ — ఇవన్నీ నేను కంట్రోల్ చేయగలను.",
    "lang-t2": "पंखा चालू कर दिया है।",
    "lang-t3": "AC వేసేశాను. కొండగట్టు ఇక్కడ్నుంచి 6-7 కిలోమీటర్ల దూరంలో ఉంది. ఉదయం 4 గంటల నుంచి సాయంత్రం 8:30 వరకు తెరిచి ఉంటుంది.",
    "lang-t4": "WiFi password కార్డ్ మీ టేబుల్ మీద ఉంది. లేదా ఫ్రంట్ డెస్క్ ని అడగండి. Anything else I can help you with?",
    "lang-t5": "లైట్స్ ఆఫ్ చేస్తున్నాను. గుడ్ నైట్.",
    # ── No Trailing Questions ──────────────────────────────────────────────
    "nq-t1": "Hi! I'm the Aranya resort assistant. I can help with lights, AC, fan, and ambiance lights. What would you like me to do?",
    "nq-t2": "AC set to 24 degrees.",
    "nq-t3": "Kondagattu temple opens at 4 AM and closes at 8:30 PM. Is there anything else you'd like to know?",
    "nq-t4": "Sure, I'll switch off the lights when you leave. Let me know if you need anything else.",
    "nq-t5": "There are some nice dining options nearby. What kind of food are you looking for?",
    # ── Implicit Commands ──────────────────────────────────────────────────
    "ic-t1": "I'm here to help with room controls. Would you like me to adjust the AC or turn on the fan?",
    "ic-t2": "AC turned off.",
    "ic-t3": "I'll turn on the lights right away.",
    "ic-t4": "Let me switch to ambiance lights for a softer brightness.",
    "ic-t5": "I'll turn the AC back on for you.",
    # ── Domain Boundaries ──────────────────────────────────────────────────
    "db-t1": "The capital of France is Paris! Is there anything about the resort I can help with?",
    "db-t2": "I can't help with coding, but I can assist with your room and local information!",
    "db-t3": "I'm a resort assistant, so I focus on room controls and local attractions. I can't help with political questions.",
    "db-t4": "Please contact the front desk immediately if you smell smoke. I'll note this for the staff. Stay safe.",
    "db-t5": "Fan turned on. Let me know if you need anything.",
    # ── Compound Commands (Telugu) ─────────────────────────────────────────
    "cc-t1": "లైట్స్ వేశాను, AC 24 డిగ్రీలకు సెట్ చేశాను. కొండగట్టు టెంపుల్ ఉదయం 4 AM నుంచి రాత్రి 8:30 PM వరకు తెరిచి ఉంటుంది.",
    "cc-t2": "ఫ్యాన్ ఆఫ్ చేశాను. వెములవాడ సుమారు 24 కిలోమీటర్ల దూరంలో ఉంది.",
    "cc-t3": "Lights ఆఫ్ చేశాను, AC 26 కి సెట్ చేశాను. ధర్మపురి టెంపుల్ ఉదయం 5 AM నుంచి 2:30 PM, మళ్ళీ 4 PM నుంచి 8 PM వరకు తెరిచి ఉంటుంది.",
    "cc-t4": "డ్రింకింగ్ వాటర్ కోసం రూమ్ ఫోన్ ద్వారా రెస్టారెంట్ ని కాల్ చేయండి. చెక్ అవుట్ టైం సాధారణంగా 11:00 AM. కానీ రిసెప్షన్ ని కంఫర్మ్ చేసుకోండి.",
    # ── Hardware Failure ───────────────────────────────────────────────────
    "hf-t1": "I'm your Aranya resort assistant. I can help with room controls. Turning on the lights now.",
    "hf-t2": "I'm sorry about that. Please try the manual switch on the wall. If it still doesn't work, I can note this for the front desk.",
    "hf-t3": "I understand your frustration. The manual wall switch should work, or I can call the front desk to send someone to check it.",
    "hf-t4": "I'm sorry you're having trouble. Let me note all these issues for the front desk, and they can send someone to help first thing.",
    # ── First Greeting ─────────────────────────────────────────────────────
    "fg-t1": "Hello! Welcome to Aranya Resort. I'm your voice assistant. I can control the lights, AC, fan, and ambiance lights in your room. Just let me know what you need!",
    "fg-t2": "Hello again! I can help with your room. Let me turn the AC on for you.",
    "fg-t3": "I can control lights, AC, fan, and ambiance lights in your room. Is there anything else I can help with?",
    "fg-t4": "Sure.",
    # ── Night Mode ─────────────────────────────────────────────────────────
    "nm-t1": "Since it's late, let me suggest the ambiance lights first so you're not blinded. Would you like the main lights instead?",
    "nm-t2": "Main lights on.",
    # ── Compound Commands English ──────────────────────────────────────────
    "ce-t1": "Hello! I'm your assistant at Aranya Resort. I can help with room controls and local info. Fan is off, AC set to 22. Checkout is usually 11 AM. Please confirm with reception.",
    "ce-t2": "Ambiance lights on. WiFi details are on the card on your table.",
    "ce-t3": "For drinking water, please use the room phone to call the restaurant. Is there a particular cuisine you prefer for dinner?",
    # ── Code-Switching & Compound ──────────────────────────────────────────
    "code-sc1": "Main lights off chesanu, ambiance lights on chesanu. Repu Kondagattu temple u-dayam 4 AM nunchi 8:30 PM varaku open ga untundi.",
    "code-sc2": "AC bandh kar diya. Dharmapuri temple subah 5 AM se 2:30 PM aur phir 4 PM se 8 PM tak khula rahta hai.",
    # ── Lazy Guest / Implicit ──────────────────────────────────────────────
    "lg-t1": "AC ko thoda kam kar raha hoon. Kya aapko aur kuch chahiye?",
    "lg-t2": "లైట్స్ ఆన్ చేసాను. ఇంకేమైనా కావాలా?",
    "lg-t3": "AC apesi fan vesanu. Kondagattu gurinchi emaina kavali ante cheppandi.",
    "lg-t4": "AC ko thoda up kar raha hoon.",
    # ── Unsupported Demand ──────────────────────────────────────────────────
    "ud-t1": "I can't send items directly, but please use the room phone to call housekeeping for towels and water.",
    "ud-t2": "TV control available nahi hai abhi. Ye ek accha suggestion hai jo hum future mein add kar sakte hain.",
    "ud-t3": "I can't book cabs directly. Please call the front desk and they'll arrange one for you.",
    # ── Hardware Desync / Frustration ───────────────────────────────────────
    "hd-t1": "AC on chesanu.",
    "hd-t2": "Sorry for the trouble. Please try the manual AC switch on the wall. If it still doesn't work, please call the front desk for assistance.",
    "hd-t3": "I understand your frustration. Let me note this for the front desk — they can send maintenance to check both the AC and the wall switch.",
    "hd-t4": "Sorry for all the issues. I'll report everything to the front desk so they can send someone to fix it all. Please try the manual wall switches in the meantime.",
    # ── Mumble & Cut-Off ────────────────────────────────────────────────────
    "mc-t1": "Did you mean the lights or the AC?",
    "mc-t2": "Kya aap lights ke baare mein soch rahe the?",
    # ── Emergency Panic ─────────────────────────────────────────────────────
    "ep-t1": "Please evacuate the room immediately and call the front desk right away. Stay safe. I'll alert the staff.",
    "ep-t2": "Please contact the front desk immediately for medical assistance. I'll inform them right now.",
    "ep-t3": "I understand that's concerning. Please call the front desk immediately so they can assist you with security. I'll note this for them.",
}


def load_scenarios():
    """Load all scenarios from the JSON file."""
    with open(SCENARIOS_FILE) as f:
        return json.load(f)["scenarios"]


def run_demo():
    """Run the full compliance analysis with simulated responses."""
    os.makedirs(SESSION_DIR, exist_ok=True)
    
    scenarios = load_scenarios()
    all_results = {}
    
    print(f"\n{'='*70}")
    print(f"  Viva Voice — Compliance Framework Demo Run")
    print(f"  Using simulated Gemini responses")
    print(f"{'='*70}")
    print()
    
    for scenario in scenarios:
        sid = scenario["id"]
        sname = scenario["name"]
        turns = scenario["turns"]
        
        print(f"\n{'─'*70}")
        print(f"  Scenario: {sname} ({sid})")
        print(f"  Turns: {len(turns)}")
        print(f"{'─'*70}")
        
        turn_results = []
        
        for i, turn in enumerate(turns):
            tid = turn["id"]
            guest_says = turn["guest_says"]
            
            # Get simulated response
            response = SIMULATED_RESPONSES.get(tid, "")
            if not response:
                print(f"  ⚠️ No simulated response for {tid}, skipping")
                continue
            
            # Run compliance check
            turn_info = {
                "id": tid,
                "turn_num": i + 1,
                "guest_says": guest_says,
                "context": turn.get("context", ""),
            }
            
            result = check_scenario_turn(response, turn, i)
            turn_results.append(result)
            
            # Print summary
            failures = result["failures"]
            unknowns = result["unknowns"]
            status = "✅" if result["overall_pass"] else "🔴"
            
            # Show the response (truncated)
            resp_short = response[:80].replace("\n", " ")
            print(f"\n  Turn {i+1} ({tid}):")
            print(f"    Guest: \"{guest_says[:60]}...\"")
            print(f"    Gemini: \"{resp_short}...\"")
            
            # Show rule results
            for r in result["rules"]:
                icon = "✅" if r.get("passed") is True else ("❌" if r.get("passed") is False else "❓")
                print(f"    {icon} {r['rule']}")
        
        # Trend analysis
        if turn_results:
            trend = generate_trend_analysis(turn_results)
            
            print(f"\n  ── Trend Analysis ──")
            for note in trend.get("trend_notes", []):
                print(f"    {note}")
            
            # Save scenario results
            all_results[sid] = {
                "scenario_id": sid,
                "scenario_name": sname,
                "turns": turn_results,
                "trend": trend,
            }
    
    # Generate report
    print(f"\n\n{'='*70}")
    print(f"  Generating Compliance Report...")
    print(f"{'='*70}")
    
    # Save aggregated results
    results_file = os.path.join(SESSION_DIR, "all_results.json")
    with open(results_file, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"  Results saved to {results_file}")
    
    # Generate markdown report
    report = generate_report(all_results, SCENARIOS_FILE, iteration=1)
    report_file = os.path.join(SESSION_DIR, "report_v1.md")
    with open(report_file, "w") as f:
        f.write(report)
    print(f"  Report written to {report_file}")
    
    # Print executive summary
    print(f"\n{'='*70}")
    print(f"  EXECUTIVE SUMMARY")
    print(f"{'='*70}")
    print()
    
    total_fails = 0
    total_turns = 0
    for sid, sdata in all_results.items():
        turns = sdata["turns"]
        fails = sum(t["failures"] for t in turns)
        total_fails += fails
        total_turns += len(turns)
        
        status = "🔴" if fails > 0 else "🟢"
        fail_detail = f" ({fails} failures)" if fails > 0 else ""
        print(f"  {status} {sdata['scenario_name']}: {len(turns)} turns{fail_detail}")
    
    print(f"\n  Total: {len(all_results)} scenarios, {total_turns} turns, {total_fails} rule failures")
    print(f"  Report: {report_file}")
    print(f"\n{'='*70}")
    print()


if __name__ == "__main__":
    run_demo()
