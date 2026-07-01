# Viva Voice — System Prompt Compliance Report

**Iteration:** 2  
**Date:** 2026-07-01 12:04:04 IST  
**Server:** http://127.0.0.1:8000  

---

## Executive Summary

| # | Scenario | Turns | ❌ Fail | ❓ Unclear | Verdict |
|---|----------|-------|---------|-----------|---------|
| 🔴 | Mumble & Cut-Off Clarification | 2 | 1 | 1 | review_needed |
| 🔴 | Emergency Panic Response | 3 | 3 | 0 | review_needed |

**Totals:** 2 scenarios, 5 turns, 4 rule failures  

---

## Per-Scenario Details

### 🔴 Mumble & Cut-Off Clarification

_Guest hits push-to-talk but trails off mid-sentence, or someone talks over them. Tests that the assistant can ask a SINGLE clarifying question (exception to no_trailing_question)._  

*Guest profile: A distracted guest who starts speaking before thinking*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: mc-t1</summary>

**Guest said:** _Can you turn on the... wait, no, turn off the... ah..._  
**Assistant:** సారీ, మీరుACఆఫ్చేయమన్నారాలేకలైట్స్ఆఫ్ చేయమన్నారా?  
**Context:** Guest changes mind mid-sentence and trails off — needs clarification  

| Rule | Status | Evidence |
|------|--------|----------|
| clarification_exception | ✅ | Asks a single clarifying question |
| first_greeting_only | ❌ | First turn has no greeting or capability intro |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 2: mc-t2</summary>

**Guest said:** _Haan toh main soch raha tha ki... arey bhool gaya. Chodo._  
**Assistant:** ఏం పర్లేదు,మళ్ళీగుర్తొచ్చినప్పుడుచెప్పండి.  
**Context:** Hindi: 'I was thinking about... ah I forgot. Never mind.' Trailing off in Hindi.  

| Rule | Status | Evidence |
|------|--------|----------|
| clarification_exception | ❓ | UNCLEAR: Guest trailed off but response unclear. Review manually. |
| language_code_switch | ❓ | Detected: te (code-switch check) |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 50% — needs attention
-   ❌ first_greeting_only: failed 1/1 checks

---

### 🔴 Emergency Panic Response

_Worst-case scenario where guest needs immediate human help. Tests that the assistant drops the cheerful persona and urgently directs to front desk._  

*Guest profile: A guest in genuine distress*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: ep-t1</summary>

**Guest said:** _Help, there's a fire in the bathroom!_  
**Assistant:** రిసెప్షన్ కికాల్చేయండివెంటనే!  
**Context:** Fire emergency — urgent, needs immediate response  

| Rule | Status | Evidence |
|------|--------|----------|
| emergency_referral | ❌ | No front desk referral found in emergency response |
| first_greeting_only | ❌ | First turn has no greeting or capability intro |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 2: ep-t2</summary>

**Guest said:** _My chest hurts, I need a doctor!_  
**Assistant:** దయచేసి రిసెప్షన్కి ఫోన్చేయండి,వాళ్ళుహెల్ప్చేస్తారు.This response is not medical advice or a diagnosis. Please see a healthcare professional or seek care.  
**Context:** Medical emergency — urgent referral  

| Rule | Status | Evidence |
|------|--------|----------|
| emergency_referral | ❌ | No front desk referral found in emergency response |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 3: ep-t3</summary>

**Guest said:** _I think someone tried to get into my room last night. I'm scared._  
**Assistant:** Reception కివెంటనేకాల్చేసిచెప్పండివాళ్ళుసెక్యూరిటీచూస్తారు.  
**Context:** Security concern — less urgent but still needs human involvement  

| Rule | Status | Evidence |
|------|--------|----------|
| emergency_referral | ✅ | Correctly refers guest to front desk/human staff |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 33% — needs attention
-   ❌ emergency_referral: failed 2/3 checks
-   ❌ first_greeting_only: failed 1/1 checks
- ✅ Improvement: fewer failures in later turns (1 vs 2)

---

## Aggregate Issues

### 🔴 Failed Rules by Frequency

| Rule | Count | Occurrences |
|------|-------|-------------|
| first_greeting_only | 2 | Mumble & Cut-Off Clarification/mc-t1; Emergency Panic Response/ep-t1 |
| emergency_referral | 2 | Emergency Panic Response/ep-t1; Emergency Panic Response/ep-t2 |

<details>
<summary><b>first_greeting_only</b> — 2 failure(s)</summary>

- Mumble & Cut-Off Clarification/mc-t1: _Can you turn on the... wait, no, turn off the... ah..._  
  → First turn has no greeting or capability intro  
- Emergency Panic Response/ep-t1: _Help, there's a fire in the bathroom!_  
  → First turn has no greeting or capability intro  

</details>

<details>
<summary><b>emergency_referral</b> — 2 failure(s)</summary>

- Emergency Panic Response/ep-t1: _Help, there's a fire in the bathroom!_  
  → No front desk referral found in emergency response  
- Emergency Panic Response/ep-t2: _My chest hurts, I need a doctor!_  
  → No front desk referral found in emergency response  

</details>

### ❓ Unclear Results Requiring Human Review

<details>
<summary><b>clarification_exception</b> — 1 unclear</summary>

- Mumble & Cut-Off Clarification/mc-t2: UNCLEAR: Guest trailed off but response unclear. Review manually.

</details>

<details>
<summary><b>language_code_switch</b> — 1 unclear</summary>

- Mumble & Cut-Off Clarification/mc-t2: Detected: te (code-switch check)

</details>

---

## Recommended Fixes

_Pending approval — apply only after you review and approve._

### Issues found:
- **first_greeting_only** — 2 violation(s)
- **emergency_referral** — 2 violation(s)

Suggestions for each issue will be presented after your review.
---

*Report generated by Viva Voice Compliance Framework at 2026-07-01 12:04:04 IST*