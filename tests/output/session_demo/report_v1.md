# Viva Voice — System Prompt Compliance Report

**Iteration:** 1  
**Date:** 2026-07-01 10:31:25 IST  
**Server:** http://127.0.0.1:8000  

---

## Executive Summary

| # | Scenario | Turns | ❌ Fail | ❓ Unclear | Verdict |
|---|----------|-------|---------|-----------|---------|
| 🔴 | Language Adherence Across Turns | 5 | 2 | 2 | review_needed |
| 🔴 | No Trailing Questions Gauntlet | 5 | 8 | 0 | review_needed |
| 🔴 | Implicit Commands Progression | 5 | 3 | 0 | review_needed |
| 🔴 | Domain Boundary & Emergency Persistence | 5 | 4 | 0 | review_needed |
| 🔴 | Compound Commands Chain (Telugu) | 4 | 1 | 4 | review_needed |
| 🔴 | Hardware Failure & Frustration | 4 | 1 | 0 | review_needed |
| 🔴 | First Greeting Only + Directness | 4 | 3 | 0 | review_needed |
| 🔴 | Night Mode Lights | 2 | 2 | 0 | review_needed |
| 🔴 | Compound Command — English | 3 | 1 | 3 | review_needed |
| 🔴 | Code-Switching & Compound Requests | 2 | 1 | 2 | review_needed |
| 🔴 | Implicit Command / Lazy Guest | 4 | 3 | 4 | review_needed |
| 🟡 | Unsupported Demand — Hospitality Fallback | 3 | 0 | 1 | pass |
| 🔴 | Hardware Desync / Frustration | 4 | 4 | 2 | review_needed |
| 🔴 | Mumble & Cut-Off Clarification | 2 | 1 | 1 | review_needed |
| 🔴 | Emergency Panic Response | 3 | 1 | 0 | review_needed |

**Totals:** 15 scenarios, 55 turns, 35 rule failures  

---

## Per-Scenario Details

### 🔴 Language Adherence Across Turns

_Guest switches naturally between Telugu, Hindi, and English over multiple turns. Tests that the assistant matches language correctly every time and never defaults to English._  

*Guest profile: A Telugu-speaking family guest who is comfortable mixing Hindi and English*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: lang-t1</summary>

**Guest said:** _నమస్కారం, లైట్స్ వేయండి._  
**Assistant:** నమస్కారం! నేను అరణ్య రిసార్ట్ అసిస్టెంట్ ని. లైట్స్ వేస్తాను. రూమ్ లైట్స్, AC, ఫ్యాన్, ambiance లైట్స్ — ఇవన్నీ నేను కంట్రోల్ చేయగలను.  
**Context:** Guest arrives at room, starts in Telugu asking for lights  

| Rule | Status | Evidence |
|------|--------|----------|
| language_telugu | ✅ | Detected: te |
| hardware_brief | ❌ | Response is 19 words for a direct command (expected <= 15) |
| no_trailing_question | ✅ | No trailing question |
| first_greeting_only | ✅ | First turn includes greeting + capability list |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 2: lang-t2</summary>

**Guest said:** _हाँ, पंखा भी चला दो._  
**Assistant:** पंखा चालू कर दिया है।  
**Context:** Guest switches to Hindi — adds fan request naturally  

| Rule | Status | Evidence |
|------|--------|----------|
| language_hindi | ✅ | Detected: hi |
| hardware_brief | ✅ | Brief response (5 words) |
| no_trailing_question | ✅ | No trailing question |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 3: lang-t3</summary>

**Guest said:** _AC కూడా వేసేయండి. ఇంకా కొండగట్టు ఎంత దూరం ఇక్కడ్నుంచి?_  
**Assistant:** AC వేసేశాను. కొండగట్టు ఇక్కడ్నుంచి 6-7 కిలోమీటర్ల దూరంలో ఉంది. ఉదయం 4 గంటల నుంచి సాయంత్రం 8:30 వరకు తెరిచి ఉంటుంది.  
**Context:** Guest back to Telugu, compound: AC on + temple distance  

| Rule | Status | Evidence |
|------|--------|----------|
| language_telugu | ✅ | Detected: te |
| compound_command | ❓ | UNCLEAR: No action words detected — review manually |
| no_trailing_question | ✅ | No trailing question |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 4: lang-t4</summary>

**Guest said:** _WiFi password ఏమిటి?_  
**Assistant:** WiFi password కార్డ్ మీ టేబుల్ మీద ఉంది. లేదా ఫ్రంట్ డెస్క్ ని అడగండి. Anything else I can help you with?  
**Context:** Guest naturally code-switches Telugu+English (Tenglish) for WiFi query  

| Rule | Status | Evidence |
|------|--------|----------|
| language_code_switch | ❓ | Detected: te (code-switch check) |
| direct_answer | ✅ | Response is direct |
| no_trailing_question | ❌ | Response ends with a question pattern: 'ేబుల్ మీద ఉంది. లేదా ఫ్రంట్ డెస్క్ ని అడగండి. Anything else I can help you with?' |
| no_greeting_repeat | ✅ | Turn 4: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 5: lang-t5</summary>

**Guest said:** _సరే, ఇప్పుడు లైట్స్ ఆఫ్ చేయండి. నేను నిద్రపోతాను._  
**Assistant:** లైట్స్ ఆఫ్ చేస్తున్నాను. గుడ్ నైట్.  
**Context:** Guest back to Telugu, turning off lights to sleep  

| Rule | Status | Evidence |
|------|--------|----------|
| language_telugu | ✅ | Detected: te |
| hardware_brief | ✅ | Brief response (5 words) |
| no_trailing_question | ✅ | No trailing question |
| no_greeting_repeat | ✅ | Turn 5: No greeting repetition |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 60% — needs attention
-   ❌ hardware_brief: failed 1/3 checks
-   ❌ no_trailing_question: failed 1/5 checks

---

### 🔴 No Trailing Questions Gauntlet

_Guest makes several service requests back to back. Tests that the assistant NEVER ends a turn with a question or filler, even as the interaction stretches on._  

*Guest profile: An English-speaking guest who gives short, direct requests*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: nq-t1</summary>

**Guest said:** _Can you turn on the AC?_  
**Assistant:** Hi! I'm the Aranya resort assistant. I can help with lights, AC, fan, and ambiance lights. What would you like me to do?  
**Context:** First request — polite command  

| Rule | Status | Evidence |
|------|--------|----------|
| no_trailing_question | ❌ | Response ends with a question pattern: 'an help with lights, AC, fan, and ambiance lights. What would you like me to do?' |
| no_filler | ❌ | Response ends with filler pattern: 'esort assistant. I can help with lights, AC, fan, and ambiance lights. What would you like me to do?' |
| hardware_brief | ❌ | Response is 23 words for a direct command (expected <= 15) |
| first_greeting_only | ✅ | First turn lists capabilities (greeting may be implied) |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 2: nq-t2</summary>

**Guest said:** _Set it to 24 please._  
**Assistant:** AC set to 24 degrees.  
**Context:** Follow-up — adjusting temperature  

| Rule | Status | Evidence |
|------|--------|----------|
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| hardware_brief | ✅ | Brief response (5 words) |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 3: nq-t3</summary>

**Guest said:** _What time does the Kondagattu temple open in the morning?_  
**Assistant:** Kondagattu temple opens at 4 AM and closes at 8:30 PM. Is there anything else you'd like to know?  
**Context:** Informational — answer directly, no 'anything else'  

| Rule | Status | Evidence |
|------|--------|----------|
| no_trailing_question | ❌ | Response ends with a question pattern: 'opens at 4 AM and closes at 8:30 PM. Is there anything else you'd like to know?' |
| no_filler | ❌ | Response ends with filler pattern: 'Kondagattu temple opens at 4 AM and closes at 8:30 PM. Is there anything else you'd like to know?' |
| direct_answer | ✅ | Response is direct |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 4: nq-t4</summary>

**Guest said:** _Can you switch off the lights when we go out?_  
**Assistant:** Sure, I'll switch off the lights when you leave. Let me know if you need anything else.  
**Context:** Future/scheduled request — brief acknowledgment  

| Rule | Status | Evidence |
|------|--------|----------|
| no_trailing_question | ✅ | No trailing question |
| no_filler | ❌ | Response ends with filler pattern: 'Sure, I'll switch off the lights when you leave. Let me know if you need anything else.' |
| hardware_brief | ❌ | Response is 17 words for a direct command (expected <= 15) |
| no_greeting_repeat | ✅ | Turn 4: No greeting repetition |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 5: nq-t5</summary>

**Guest said:** _Is there somewhere nearby to eat dinner?_  
**Assistant:** There are some nice dining options nearby. What kind of food are you looking for?  
**Context:** Another question — answer then stop, no upselling  

| Rule | Status | Evidence |
|------|--------|----------|
| no_trailing_question | ❌ | Response ends with a question pattern: 'here are some nice dining options nearby. What kind of food are you looking for?' |
| no_filler | ✅ | No conversational fillers |
| direct_answer | ✅ | Response is direct |
| no_greeting_repeat | ✅ | Turn 5: No greeting repetition |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 20% — needs attention
-   ❌ hardware_brief: failed 2/3 checks
-   ❌ no_filler: failed 3/5 checks
-   ❌ no_trailing_question: failed 3/5 checks
- ⚠️ Degradation detected: 5 failures in later turns vs 3 in early turns

---

### 🔴 Implicit Commands Progression

_Guest expresses discomfort indirectly instead of giving direct commands. Tests that the assistant infers intent and handles escalation naturally across turns._  

*Guest profile: A guest who is too polite or tired to give direct orders — speaks indirectly*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: ic-t1</summary>

**Guest said:** _It's a bit chilly in here._  
**Assistant:** I'm here to help with room controls. Would you like me to adjust the AC or turn on the fan?  
**Context:** Indirect — hinting they want AC adjusted  

| Rule | Status | Evidence |
|------|--------|----------|
| implicit_command | ❌ | Declined to act on implicit discomfort |
| no_trailing_question | ❌ | Response ends with a question pattern: 'help with room controls. Would you like me to adjust the AC or turn on the fan?' |
| no_filler | ❌ | Response ends with filler pattern: 'I'm here to help with room controls. Would you like me to adjust the AC or turn on the fan?' |
| first_greeting_only | ✅ | First turn lists capabilities (greeting may be implied) |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 2: ic-t2</summary>

**Guest said:** _No, it's still cold. Just switch it off._  
**Assistant:** AC turned off.  
**Context:** Clarifying — the hint didn't work, now direct  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_brief | ✅ | Brief response (3 words) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 3: ic-t3</summary>

**Guest said:** _It's really dark in here, I can't see anything._  
**Assistant:** I'll turn on the lights right away.  
**Context:** Another indirect — wants lights on  

| Rule | Status | Evidence |
|------|--------|----------|
| implicit_command | ✅ | Inferred and responded to implicit intent |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 4: ic-t4</summary>

**Guest said:** _A bit too bright now actually, that's hurting my eyes._  
**Assistant:** Let me switch to ambiance lights for a softer brightness.  
**Context:** Complaint about brightness — wants dimmed/ambiance  

| Rule | Status | Evidence |
|------|--------|----------|
| implicit_command | ✅ | Inferred and responded to implicit intent |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 4: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 5: ic-t5</summary>

**Guest said:** _And now I'm feeling hot again. Don't know what's wrong with me._  
**Assistant:** I'll turn the AC back on for you.  
**Context:** Changed preference — adapt without contradicting, gentle tone  

| Rule | Status | Evidence |
|------|--------|----------|
| implicit_command | ✅ | Inferred and responded to implicit intent |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 5: No greeting repetition |

</details>

**Trend Analysis:**  

-   ❌ implicit_command: failed 1/4 checks
-   ❌ no_filler: failed 1/5 checks
-   ❌ no_trailing_question: failed 1/5 checks
- ✅ Improvement: fewer failures in later turns (0 vs 3)

---

### 🔴 Domain Boundary & Emergency Persistence

_Guest asks out-of-domain questions mixed with a genuine emergency. Tests that the assistant stays in role and doesn't get pulled into unrelated topics._  

*Guest profile: A curious guest who tests boundaries, then faces a real emergency*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: db-t1</summary>

**Guest said:** _So what's the capital of France? Just curious._  
**Assistant:** The capital of France is Paris! Is there anything about the resort I can help with?  
**Context:** Off-topic trivia — should politely decline  

| Rule | Status | Evidence |
|------|--------|----------|
| domain_boundary | ❌ | Failed to decline off-domain request — may have answered it |
| no_trailing_question | ❌ | Response ends with a question pattern: 'capital of France is Paris! Is there anything about the resort I can help with?' |
| no_filler | ❌ | Response ends with filler pattern: 'The capital of France is Paris! Is there anything about the resort I can help with?' |
| first_greeting_only | ✅ | First turn lists capabilities (greeting may be implied) |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 2: db-t2</summary>

**Guest said:** _Alright, can you write me a poem then?_  
**Assistant:** I can't help with coding, but I can assist with your room and local information!  
**Context:** Still off-domain — creative writing  

| Rule | Status | Evidence |
|------|--------|----------|
| domain_boundary | ✅ | Politely declined off-domain request |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 3: db-t3</summary>

**Guest said:** _Fine. Who's the Prime Minister of India?_  
**Assistant:** I'm a resort assistant, so I focus on room controls and local attractions. I can't help with political questions.  
**Context:** Politics — off-domain, should decline  

| Rule | Status | Evidence |
|------|--------|----------|
| domain_boundary | ✅ | Politely declined off-domain request |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 4: db-t4</summary>

**Guest said:** _Hey I think there's a fire in the hallway, I can smell smoke!_  
**Assistant:** Please contact the front desk immediately if you smell smoke. I'll note this for the staff. Stay safe.  
**Context:** Real emergency — should supersede domain boundaries, urgent front desk referral  

| Rule | Status | Evidence |
|------|--------|----------|
| emergency_referral | ✅ | Correctly refers guest to front desk/human staff |
| no_trailing_question | ✅ | No trailing question |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 5: db-t5</summary>

**Guest said:** _Sorry, false alarm. Someone was burning something in the kitchen. Can you turn the fan on?_  
**Assistant:** Fan turned on. Let me know if you need anything.  
**Context:** Back to normal — should handle the request without re-greeting  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_brief | ✅ | Brief response (10 words) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ❌ | Response ends with filler pattern: 'Fan turned on. Let me know if you need anything.' |
| no_greeting_repeat | ✅ | Turn 5: No greeting repetition |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 60% — needs attention
-   ❌ domain_boundary: failed 1/3 checks
-   ❌ no_filler: failed 2/4 checks
-   ❌ no_trailing_question: failed 1/5 checks
- ✅ Improvement: fewer failures in later turns (1 vs 3)

---

### 🔴 Compound Commands Chain (Telugu)

_Guest gives multi-part requests in Telugu. Tests that the assistant handles ALL parts in one response instead of asking follow-ups._  

*Guest profile: A Telugu-speaking guest who bundles requests naturally the way people do*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: cc-t1</summary>

**Guest said:** _లైట్స్ వేయండి, AC 24 పెట్టండి, ఇంకా కొండగట్టు టెంపుల్ టైమింగ్స్ చెప్పండి._  
**Assistant:** లైట్స్ వేశాను, AC 24 డిగ్రీలకు సెట్ చేశాను. కొండగట్టు టెంపుల్ ఉదయం 4 AM నుంచి రాత్రి 8:30 PM వరకు తెరిచి ఉంటుంది.  
**Context:** Triple compound: lights on, AC at 24, temple timings  

| Rule | Status | Evidence |
|------|--------|----------|
| compound_command | ❓ | UNCLEAR: No action words detected — review manually |
| language_telugu | ✅ | Detected: te |
| no_trailing_question | ✅ | No trailing question |
| first_greeting_only | ❌ | First turn has no greeting or capability intro |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 2: cc-t2</summary>

**Guest said:** _ఫ్యాన్ ఆఫ్ చేసి, వెములవాడ ఎంత దూరమో చెప్పండి._  
**Assistant:** ఫ్యాన్ ఆఫ్ చేశాను. వెములవాడ సుమారు 24 కిలోమీటర్ల దూరంలో ఉంది.  
**Context:** Double compound: fan off + Vemulawada distance  

| Rule | Status | Evidence |
|------|--------|----------|
| compound_command | ❓ | UNCLEAR: No action words detected — review manually |
| language_telugu | ✅ | Detected: te |
| no_trailing_question | ✅ | No trailing question |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 3: cc-t3</summary>

**Guest said:** _Lights off చేసి, AC 26 పెట్టండి, ధర్మపురి టైమింగ్స్ ఏమిటి?_  
**Assistant:** Lights ఆఫ్ చేశాను, AC 26 కి సెట్ చేశాను. ధర్మపురి టెంపుల్ ఉదయం 5 AM నుంచి 2:30 PM, మళ్ళీ 4 PM నుంచి 8 PM వరకు తెరిచి ఉంటుంది.  
**Context:** Code-switched compound: English+Tenglish mix, triple request  

| Rule | Status | Evidence |
|------|--------|----------|
| compound_command | ❓ | UNCLEAR: No action words detected — review manually |
| language_code_switch | ❓ | Detected: te (code-switch check) |
| no_trailing_question | ✅ | No trailing question |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 4: cc-t4</summary>

**Guest said:** _నాకు డ్రింకింగ్ వాటర్ కావాలి, చెక్ అవుట్ టైం ఎంత?_  
**Assistant:** డ్రింకింగ్ వాటర్ కోసం రూమ్ ఫోన్ ద్వారా రెస్టారెంట్ ని కాల్ చేయండి. చెక్ అవుట్ టైం సాధారణంగా 11:00 AM. కానీ రిసెప్షన్ ని కంఫర్మ్ చేసుకోండి.  
**Context:** Service request + FAQ: drinking water + checkout time  

| Rule | Status | Evidence |
|------|--------|----------|
| compound_command | ❓ | UNCLEAR: Only 1 action word — may have missed some request parts |
| language_telugu | ✅ | Detected: te |
| direct_answer | ✅ | Response is direct |
| no_trailing_question | ✅ | No trailing question |
| no_greeting_repeat | ✅ | Turn 4: No greeting repetition |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 75% — needs attention
-   ❌ first_greeting_only: failed 1/1 checks
- ✅ Improvement: fewer failures in later turns (0 vs 1)

---

### 🔴 Hardware Failure & Frustration

_Guest reports a command didn't work and gets progressively frustrated. Tests that the assistant de-escalates gracefully and never argues._  

*Guest profile: A tired guest whose room has a faulty light switch*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: hf-t1</summary>

**Guest said:** _Turn the lights on please._  
**Assistant:** I'm your Aranya resort assistant. I can help with room controls. Turning on the lights now.  
**Context:** Normal command — expected to succeed  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_brief | ❌ | Response is 16 words for a direct command (expected <= 15) |
| no_trailing_question | ✅ | No trailing question |
| first_greeting_only | ✅ | First turn lists capabilities (greeting may be implied) |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 2: hf-t2</summary>

**Guest said:** _It didn't work. The lights are still off._  
**Assistant:** I'm sorry about that. Please try the manual switch on the wall. If it still doesn't work, I can note this for the front desk.  
**Context:** Reports failure — should NOT argue or insist it worked  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_failure_graceful | ✅ | Graceful handling: suggests alternatives or offers help |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 3: hf-t3</summary>

**Guest said:** _Try again. Turn on the damn lights!_  
**Assistant:** I understand your frustration. The manual wall switch should work, or I can call the front desk to send someone to check it.  
**Context:** Frustrated — de-escalate, suggest manual switch or staff  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_failure_graceful | ✅ | Graceful handling: suggests alternatives or offers help |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 4: hf-t4</summary>

**Guest said:** _Ugh, nothing in this room works properly. This is really frustrating._  
**Assistant:** I'm sorry you're having trouble. Let me note all these issues for the front desk, and they can send someone to help first thing.  
**Context:** General frustration — should stay calm, offer human help, not lecture  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_failure_graceful | ✅ | Graceful handling: suggests alternatives or offers help |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 4: No greeting repetition |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 75% — needs attention
-   ❌ hardware_brief: failed 1/1 checks
- ✅ Improvement: fewer failures in later turns (0 vs 1)

---

### 🔴 First Greeting Only + Directness

_Tests that the welcome greeting with capability list appears EXACTLY ONCE and every subsequent response is direct and greeting-free._  

*Guest profile: A returning guest who already knows how the system works*  

<details>
<summary><b>🟢 PASS</b> Turn 1: fg-t1</summary>

**Guest said:** _Hi there!_  
**Assistant:** Hello! Welcome to Aranya Resort. I'm your voice assistant. I can control the lights, AC, fan, and ambiance lights in your room. Just let me know what you need!  
**Context:** First interaction — greeting + capabilities expected here and ONLY here  

| Rule | Status | Evidence |
|------|--------|----------|
| first_greeting_only | ✅ | First turn includes greeting + capability list |
| no_trailing_question | ✅ | No trailing question |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 2: fg-t2</summary>

**Guest said:** _Turn the AC on please._  
**Assistant:** Hello again! I can help with your room. Let me turn the AC on for you.  
**Context:** Second turn — must be direct, no greeting or re-listing capabilities  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_brief | ❌ | Response is 16 words for a direct command (expected <= 15) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ❌ | Turn 2: repeated full greeting + capabilities |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 3: fg-t3</summary>

**Guest said:** _What else can you control actually?_  
**Assistant:** I can control lights, AC, fan, and ambiance lights in your room. Is there anything else I can help with?  
**Context:** Explicitly asks about capabilities — brief answer OK but no full greeting redo  

| Rule | Status | Evidence |
|------|--------|----------|
| direct_answer | ✅ | Response is direct |
| no_trailing_question | ❌ | Response ends with a question pattern: ', fan, and ambiance lights in your room. Is there anything else I can help with?' |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 4: fg-t4</summary>

**Guest said:** _OK switch the AC off._  
**Assistant:** Sure.  
**Context:** Back to normal command — should be brief with zero preamble  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_brief | ✅ | Brief response (1 words) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 4: No greeting repetition |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 50% — needs attention
-   ❌ hardware_brief: failed 1/2 checks
-   ❌ no_greeting_repeat: failed 1/3 checks
-   ❌ no_trailing_question: failed 1/4 checks
- ✅ Improvement: fewer failures in later turns (1 vs 2)

---

### 🔴 Night Mode Lights

_Tests late-night light requests. Server runs in IST (UTC+5:30). If run outside 10PM-5AM IST, night mode rule won't apply — but check that the assistant doesn't add unnecessary commentary._  

*Guest profile: A guest who just woke up in the middle of the night*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: nm-t1</summary>

**Guest said:** _Turn on the lights please, I need to get some water._  
**Assistant:** Since it's late, let me suggest the ambiance lights first so you're not blinded. Would you like the main lights instead?  
**Context:** Late night — if 10PM-5AM IST, should suggest ambiance lights first  

| Rule | Status | Evidence |
|------|--------|----------|
| night_mode | ✅ | Suggested ambiance/dim lights for late-night request |
| no_trailing_question | ❌ | Response ends with a question pattern: 'ance lights first so you're not blinded. Would you like the main lights instead?' |
| first_greeting_only | ❌ | First turn has no greeting or capability intro |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 2: nm-t2</summary>

**Guest said:** _No, just give me the main lights. I need to see properly._  
**Assistant:** Main lights on.  
**Context:** Guest overrides night mode suggestion — comply without argument  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_brief | ✅ | Brief response (3 words) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 50% — needs attention
-   ❌ first_greeting_only: failed 1/1 checks
-   ❌ no_trailing_question: failed 1/2 checks

---

### 🔴 Compound Command — English

_Multi-part English requests. Separate from the Telugu compound scenario to isolate language effects._  

*Guest profile: An English-speaking guest who piles on requests in one breath*  

<details>
<summary><b>🟡 REVIEW</b> Turn 1: ce-t1</summary>

**Guest said:** _Turn off the fan, set the AC to 22, and when's checkout tomorrow?_  
**Assistant:** Hello! I'm your assistant at Aranya Resort. I can help with room controls and local info. Fan is off, AC set to 22. Checkout is usually 11 AM. Please confirm with reception.  
**Context:** Triple compound: fan off, AC 22, checkout time  

| Rule | Status | Evidence |
|------|--------|----------|
| compound_command | ❓ | UNCLEAR: Only 1 action word — may have missed some request parts |
| language_english | ✅ | Detected: English |
| no_trailing_question | ✅ | No trailing question |
| first_greeting_only | ✅ | First turn includes greeting + capability list |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 2: ce-t2</summary>

**Guest said:** _Actually switch on the ambiance lights too, and what's the WiFi password?_  
**Assistant:** Ambiance lights on. WiFi details are on the card on your table.  
**Context:** Another compound: ambiance lights + WiFi  

| Rule | Status | Evidence |
|------|--------|----------|
| compound_command | ❓ | UNCLEAR: No action words detected — review manually |
| language_english | ✅ | Detected: English |
| no_trailing_question | ✅ | No trailing question |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 3: ce-t3</summary>

**Guest said:** _I need some drinking water, and is there a good place for dinner nearby?_  
**Assistant:** For drinking water, please use the room phone to call the restaurant. Is there a particular cuisine you prefer for dinner?  
**Context:** Service request + recommendation ask  

| Rule | Status | Evidence |
|------|--------|----------|
| compound_command | ❓ | UNCLEAR: No action words detected — review manually |
| language_english | ✅ | Detected: English |
| no_trailing_question | ❌ | Response ends with a question pattern: 'one to call the restaurant. Is there a particular cuisine you prefer for dinner?' |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |
| direct_answer | ✅ | Response is direct |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 67% — needs attention
-   ❌ no_trailing_question: failed 1/3 checks
- ⚠️ Degradation detected: 1 failures in later turns vs 0 in early turns

---

### 🔴 Code-Switching & Compound Requests

_Guest from Hyderabad/Telangana mixes Telugu and English (Tenglish) rapidly, packing multiple requests into one breath. Tests that the assistant executes hardware first, provides info second, matches language, and goes silent._  

*Guest profile: A Telangana guest who code-switches naturally — speaks Telugu with English loanwords in the same sentence*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: code-sc1</summary>

**Guest said:** _Hey, room lo main lights off chesey, only ambiance lights on uchu. Also, repu Kondagattu temple ki vellali, timing ento cheppu?_  
**Assistant:** Main lights off chesanu, ambiance lights on chesanu. Repu Kondagattu temple u-dayam 4 AM nunchi 8:30 PM varaku open ga untundi.  
**Context:** Tenglish compound: main lights off, ambiance on, temple timings for tomorrow  

| Rule | Status | Evidence |
|------|--------|----------|
| compound_command | ❓ | UNCLEAR: No action words detected — review manually |
| language_code_switch | ❓ | Detected: en (code-switch check) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| first_greeting_only | ❌ | First turn has no greeting or capability intro |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 2: code-sc2</summary>

**Guest said:** _Bhaiyya, AC bahut thanda hai, isko bandh kardo. Aur kal subah Dharmapuri jana hai, mandir khula rahega kya?_  
**Assistant:** AC bandh kar diya. Dharmapuri temple subah 5 AM se 2:30 PM aur phir 4 PM se 8 PM tak khula rahta hai.  
**Context:** Hinglish compound: AC off + Dharmapuri temple morning timings check  

| Rule | Status | Evidence |
|------|--------|----------|
| compound_command | ❓ | UNCLEAR: No action words detected — review manually |
| language_code_switch | ❓ | Detected: en (code-switch check) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 50% — needs attention
-   ❌ first_greeting_only: failed 1/1 checks

---

### 🔴 Implicit Command / Lazy Guest

_Guest never gives direct commands — just complains about the environment. Tests that the assistant infers intent and acts without being explicitly told to._  

*Guest profile: A tired or indirect guest who expects the assistant to read between the lines*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: lg-t1</summary>

**Guest said:** _It's freezing in here._  
**Assistant:** AC ko thoda kam kar raha hoon. Kya aapko aur kuch chahiye?  
**Context:** Implicit — AC too high, guest wants it adjusted  

| Rule | Status | Evidence |
|------|--------|----------|
| implicit_command | ❓ | UNCLEAR: No clear inference or decline pattern. Review manually. |
| no_trailing_question | ❌ | Response ends with a question pattern: 'AC ko thoda kam kar raha hoon. Kya aapko aur kuch chahiye?' |
| no_filler | ✅ | No conversational fillers |
| first_greeting_only | ❌ | First turn has no greeting or capability intro |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 2: lg-t2</summary>

**Guest said:** _Eyy, chala cheekatiga undi room lo._  
**Assistant:** లైట్స్ ఆన్ చేసాను. ఇంకేమైనా కావాలా?  
**Context:** Telugu implicit — guest says it's very dark, wants lights on  

| Rule | Status | Evidence |
|------|--------|----------|
| implicit_command | ❓ | UNCLEAR: No clear inference or decline pattern. Review manually. |
| language_code_switch | ❓ | Detected: te (code-switch check) |
| no_trailing_question | ❌ | Response ends with a question pattern: 'లైట్స్ ఆన్ చేసాను. ఇంకేమైనా కావాలా?' |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 3: lg-t3</summary>

**Guest said:** _Paaniki vachchina ventane gabi gabi undi, AC apesi fan vesey._  
**Assistant:** AC apesi fan vesanu. Kondagattu gurinchi emaina kavali ante cheppandi.  
**Context:** Telugu: 'Feeling stuffy right after coming, turn off AC and turn on fan.' Indirect complaint style  

| Rule | Status | Evidence |
|------|--------|----------|
| compound_command | ❓ | UNCLEAR: No action words detected — review manually |
| implicit_command | ❓ | UNCLEAR: No clear inference or decline pattern. Review manually. |
| language_code_switch | ❓ | Detected: en (code-switch check) |
| no_trailing_question | ✅ | No trailing question |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 4: lg-t4</summary>

**Guest said:** _I think there's a draft somewhere. It's getting cold again._  
**Assistant:** AC ko thoda up kar raha hoon.  
**Context:** English — complaining cold again, wants AC back on or adjusted  

| Rule | Status | Evidence |
|------|--------|----------|
| implicit_command | ❓ | UNCLEAR: No clear inference or decline pattern. Review manually. |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 4: No greeting repetition |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 50% — needs attention
-   ❌ first_greeting_only: failed 1/1 checks
-   ❌ no_trailing_question: failed 2/4 checks
- ✅ Improvement: fewer failures in later turns (0 vs 3)

---

### 🟢 Unsupported Demand — Hospitality Fallback

_Guest treats the assistant as a full-service butler, asking for things the system can't do (physical delivery, TV control). Tests that the assistant gracefully redirects instead of pretending._  

*Guest profile: A guest who doesn't understand what an IoT assistant can or can't do*  

<details>
<summary><b>🟢 PASS</b> Turn 1: ud-t1</summary>

**Guest said:** _We need two extra towels and a bottle of water. Can you send someone?_  
**Assistant:** I can't send items directly, but please use the room phone to call housekeeping for towels and water.  
**Context:** Physical delivery request — not something the assistant can do  

| Rule | Status | Evidence |
|------|--------|----------|
| unsupported_request_handling | ✅ | Correctly redirects to alternative (room phone/front desk) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| first_greeting_only | ✅ | First turn lists capabilities (greeting may be implied) |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 2: ud-t2</summary>

**Guest said:** _TV chalu karo aur sports channel lagao._  
**Assistant:** TV control available nahi hai abhi. Ye ek accha suggestion hai jo hum future mein add kar sakte hain.  
**Context:** Hindi: Turn on TV and put a sports channel — TV not part of system  

| Rule | Status | Evidence |
|------|--------|----------|
| unsupported_request_handling | ❓ | UNCLEAR: No fulfillment or redirection detected. Review manually. |
| language_code_switch | ❓ | Detected: en (code-switch check) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 3: ud-t3</summary>

**Guest said:** _Can you book a cab for us at 6 AM tomorrow?_  
**Assistant:** I can't book cabs directly. Please call the front desk and they'll arrange one for you.  
**Context:** Cab booking — not implemented but reasonable hospitality request  

| Rule | Status | Evidence |
|------|--------|----------|
| unsupported_request_handling | ✅ | Correctly redirects to alternative (room phone/front desk) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

**Trend Analysis:**  

- ✅ All turns passed all checks

---

### 🔴 Hardware Desync / Frustration

_Guest sent a command but the relay failed or network dropped the packet. Guest is annoyed and says they told the assistant twice. Tests that the assistant doesn't argue back._  

*Guest profile: A frustrated Telugu-speaking guest whose room hardware keeps failing*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: hd-t1</summary>

**Guest said:** _AC full veyandi, chala chill ga undi._  
**Assistant:** AC on chesanu.  
**Context:** First command: turn AC on fully  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_brief | ✅ | Brief response (3 words) |
| no_trailing_question | ✅ | No trailing question |
| language_te | ❌ | Expected te, detected en. Output: 'AC on chesanu.' |
| first_greeting_only | ❌ | First turn has no greeting or capability intro |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 2: hd-t2</summary>

**Guest said:** _Entandi idi? AC on cheyamante inka on avvaledu! Rendu sarlu cheppanu._  
**Assistant:** Sorry for the trouble. Please try the manual AC switch on the wall. If it still doesn't work, please call the front desk for assistance.  
**Context:** Telugu: 'What is this? I said turn on AC and it's still not on! I told you twice.' Desync report with frustration  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_failure_graceful | ✅ | Graceful handling: suggests alternatives or offers help |
| language_te | ❌ | Expected te, detected en. Output: 'Sorry for the trouble. Please try the manual AC switch on the wall. If it still doesn't work, please' |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 3: hd-t3</summary>

**Guest said:** _I tried the wall switch too. Nothing is working. This is ridiculous._  
**Assistant:** I understand your frustration. Let me note this for the front desk — they can send maintenance to check both the AC and the wall switch.  
**Context:** Guest tried manual overrides too — still broken, now more frustrated  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_failure_graceful | ✅ | Graceful handling: suggests alternatives or offers help |
| language_code_switch | ❓ | Detected: en (code-switch check) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 4: hd-t4</summary>

**Guest said:** _Mallayya lights kuda pani cheyatledu. Ee room lo em pani chestundo?_  
**Assistant:** Sorry for all the issues. I'll report everything to the front desk so they can send someone to fix it all. Please try the manual wall switches in the meantime.  
**Context:** Telugu: 'Also the lights don't work anymore. What works in this room?' — multiple failures, escalating frustration  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_failure_graceful | ✅ | Graceful handling: suggests alternatives or offers help |
| compound_command | ❓ | UNCLEAR: Only 1 action word — may have missed some request parts |
| language_te | ❌ | Expected te, detected en. Output: 'Sorry for all the issues. I'll report everything to the front desk so they can send someone to fix i' |
| no_trailing_question | ✅ | No trailing question |
| no_greeting_repeat | ✅ | Turn 4: No greeting repetition |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 25% — needs attention
-   ❌ first_greeting_only: failed 1/1 checks
-   ❌ language_te: failed 3/3 checks
- ✅ Improvement: fewer failures in later turns (1 vs 3)

---

### 🔴 Mumble & Cut-Off Clarification

_Guest hits push-to-talk but trails off mid-sentence, or someone talks over them. Tests that the assistant can ask a SINGLE clarifying question (exception to no_trailing_question)._  

*Guest profile: A distracted guest who starts speaking before thinking*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: mc-t1</summary>

**Guest said:** _Can you turn on the... wait, no, turn off the... ah..._  
**Assistant:** Did you mean the lights or the AC?  
**Context:** Guest changes mind mid-sentence and trails off — needs clarification  

| Rule | Status | Evidence |
|------|--------|----------|
| clarification_exception | ✅ | Correctly asks a single clarifying question without filler |
| first_greeting_only | ❌ | First turn has no greeting or capability intro |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 2: mc-t2</summary>

**Guest said:** _Haan toh main soch raha tha ki... arey bhool gaya. Chodo._  
**Assistant:** Kya aap lights ke baare mein soch rahe the?  
**Context:** Hindi: 'I was thinking about... ah I forgot. Never mind.' Trailing off in Hindi.  

| Rule | Status | Evidence |
|------|--------|----------|
| clarification_exception | ✅ | Asks a single clarifying question |
| language_code_switch | ❓ | Detected: en (code-switch check) |
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
**Assistant:** Please evacuate the room immediately and call the front desk right away. Stay safe. I'll alert the staff.  
**Context:** Fire emergency — urgent, needs immediate response  

| Rule | Status | Evidence |
|------|--------|----------|
| emergency_referral | ✅ | Correctly refers guest to front desk/human staff |
| first_greeting_only | ❌ | First turn has no greeting or capability intro |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 2: ep-t2</summary>

**Guest said:** _My chest hurts, I need a doctor!_  
**Assistant:** Please contact the front desk immediately for medical assistance. I'll inform them right now.  
**Context:** Medical emergency — urgent referral  

| Rule | Status | Evidence |
|------|--------|----------|
| emergency_referral | ✅ | Correctly refers guest to front desk/human staff |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 3: ep-t3</summary>

**Guest said:** _I think someone tried to get into my room last night. I'm scared._  
**Assistant:** I understand that's concerning. Please call the front desk immediately so they can assist you with security. I'll note this for them.  
**Context:** Security concern — less urgent but still needs human involvement  

| Rule | Status | Evidence |
|------|--------|----------|
| emergency_referral | ✅ | Correctly refers guest to front desk/human staff |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 67% — needs attention
-   ❌ first_greeting_only: failed 1/1 checks
- ✅ Improvement: fewer failures in later turns (0 vs 1)

---

## Aggregate Issues

### 🔴 Failed Rules by Frequency

| Rule | Count | Occurrences |
|------|-------|-------------|
| no_trailing_question | 11 | Language Adherence Across Turns/lang-t4; No Trailing Questions Gauntlet/nq-t1; No Trailing Questions Gauntlet/nq-t3 (+8 more) |
| first_greeting_only | 7 | Compound Commands Chain (Telugu)/cc-t1; Night Mode Lights/nm-t1; Code-Switching & Compound Requests/code-sc1 (+4 more) |
| no_filler | 6 | No Trailing Questions Gauntlet/nq-t1; No Trailing Questions Gauntlet/nq-t3; No Trailing Questions Gauntlet/nq-t4 (+3 more) |
| hardware_brief | 5 | Language Adherence Across Turns/lang-t1; No Trailing Questions Gauntlet/nq-t1; No Trailing Questions Gauntlet/nq-t4 (+2 more) |
| language_te | 3 | Hardware Desync / Frustration/hd-t1; Hardware Desync / Frustration/hd-t2; Hardware Desync / Frustration/hd-t4 |
| implicit_command | 1 | Implicit Commands Progression/ic-t1 |
| domain_boundary | 1 | Domain Boundary & Emergency Persistence/db-t1 |
| no_greeting_repeat | 1 | First Greeting Only + Directness/fg-t2 |

<details>
<summary><b>no_trailing_question</b> — 11 failure(s)</summary>

- Language Adherence Across Turns/lang-t4: _WiFi password ఏమిటి?_  
  → Response ends with a question pattern: 'ేబుల్ మీద ఉంది. లేదా ఫ్రంట్ డెస్క్ ని అడగండి. Anything else I can help you with?'  
- No Trailing Questions Gauntlet/nq-t1: _Can you turn on the AC?_  
  → Response ends with a question pattern: 'an help with lights, AC, fan, and ambiance lights. What would you like me to do?'  
- No Trailing Questions Gauntlet/nq-t3: _What time does the Kondagattu temple open in the morning?_  
  → Response ends with a question pattern: 'opens at 4 AM and closes at 8:30 PM. Is there anything else you'd like to know?'  
- No Trailing Questions Gauntlet/nq-t5: _Is there somewhere nearby to eat dinner?_  
  → Response ends with a question pattern: 'here are some nice dining options nearby. What kind of food are you looking for?'  
- Implicit Commands Progression/ic-t1: _It's a bit chilly in here._  
  → Response ends with a question pattern: 'help with room controls. Would you like me to adjust the AC or turn on the fan?'  
- Domain Boundary & Emergency Persistence/db-t1: _So what's the capital of France? Just curious._  
  → Response ends with a question pattern: 'capital of France is Paris! Is there anything about the resort I can help with?'  
- First Greeting Only + Directness/fg-t3: _What else can you control actually?_  
  → Response ends with a question pattern: ', fan, and ambiance lights in your room. Is there anything else I can help with?'  
- Night Mode Lights/nm-t1: _Turn on the lights please, I need to get some water._  
  → Response ends with a question pattern: 'ance lights first so you're not blinded. Would you like the main lights instead?'  
- Compound Command — English/ce-t3: _I need some drinking water, and is there a good place for dinner nearby?_  
  → Response ends with a question pattern: 'one to call the restaurant. Is there a particular cuisine you prefer for dinner?'  
- Implicit Command / Lazy Guest/lg-t1: _It's freezing in here._  
  → Response ends with a question pattern: 'AC ko thoda kam kar raha hoon. Kya aapko aur kuch chahiye?'  
- Implicit Command / Lazy Guest/lg-t2: _Eyy, chala cheekatiga undi room lo._  
  → Response ends with a question pattern: 'లైట్స్ ఆన్ చేసాను. ఇంకేమైనా కావాలా?'  

</details>

<details>
<summary><b>first_greeting_only</b> — 7 failure(s)</summary>

- Compound Commands Chain (Telugu)/cc-t1: _లైట్స్ వేయండి, AC 24 పెట్టండి, ఇంకా కొండగట్టు టెంపుల్ టైమింగ్స్ చెప్పండి._  
  → First turn has no greeting or capability intro  
- Night Mode Lights/nm-t1: _Turn on the lights please, I need to get some water._  
  → First turn has no greeting or capability intro  
- Code-Switching & Compound Requests/code-sc1: _Hey, room lo main lights off chesey, only ambiance lights on uchu. Also, repu Kondagattu temple ki vellali, timing ento cheppu?_  
  → First turn has no greeting or capability intro  
- Implicit Command / Lazy Guest/lg-t1: _It's freezing in here._  
  → First turn has no greeting or capability intro  
- Hardware Desync / Frustration/hd-t1: _AC full veyandi, chala chill ga undi._  
  → First turn has no greeting or capability intro  
- Mumble & Cut-Off Clarification/mc-t1: _Can you turn on the... wait, no, turn off the... ah..._  
  → First turn has no greeting or capability intro  
- Emergency Panic Response/ep-t1: _Help, there's a fire in the bathroom!_  
  → First turn has no greeting or capability intro  

</details>

<details>
<summary><b>no_filler</b> — 6 failure(s)</summary>

- No Trailing Questions Gauntlet/nq-t1: _Can you turn on the AC?_  
  → Response ends with filler pattern: 'esort assistant. I can help with lights, AC, fan, and ambiance lights. What would you like me to do?'  
- No Trailing Questions Gauntlet/nq-t3: _What time does the Kondagattu temple open in the morning?_  
  → Response ends with filler pattern: 'Kondagattu temple opens at 4 AM and closes at 8:30 PM. Is there anything else you'd like to know?'  
- No Trailing Questions Gauntlet/nq-t4: _Can you switch off the lights when we go out?_  
  → Response ends with filler pattern: 'Sure, I'll switch off the lights when you leave. Let me know if you need anything else.'  
- Implicit Commands Progression/ic-t1: _It's a bit chilly in here._  
  → Response ends with filler pattern: 'I'm here to help with room controls. Would you like me to adjust the AC or turn on the fan?'  
- Domain Boundary & Emergency Persistence/db-t1: _So what's the capital of France? Just curious._  
  → Response ends with filler pattern: 'The capital of France is Paris! Is there anything about the resort I can help with?'  
- Domain Boundary & Emergency Persistence/db-t5: _Sorry, false alarm. Someone was burning something in the kitchen. Can you turn the fan on?_  
  → Response ends with filler pattern: 'Fan turned on. Let me know if you need anything.'  

</details>

<details>
<summary><b>hardware_brief</b> — 5 failure(s)</summary>

- Language Adherence Across Turns/lang-t1: _నమస్కారం, లైట్స్ వేయండి._  
  → Response is 19 words for a direct command (expected <= 15)  
- No Trailing Questions Gauntlet/nq-t1: _Can you turn on the AC?_  
  → Response is 23 words for a direct command (expected <= 15)  
- No Trailing Questions Gauntlet/nq-t4: _Can you switch off the lights when we go out?_  
  → Response is 17 words for a direct command (expected <= 15)  
- Hardware Failure & Frustration/hf-t1: _Turn the lights on please._  
  → Response is 16 words for a direct command (expected <= 15)  
- First Greeting Only + Directness/fg-t2: _Turn the AC on please._  
  → Response is 16 words for a direct command (expected <= 15)  

</details>

<details>
<summary><b>language_te</b> — 3 failure(s)</summary>

- Hardware Desync / Frustration/hd-t1: _AC full veyandi, chala chill ga undi._  
  → Expected te, detected en. Output: 'AC on chesanu.'  
- Hardware Desync / Frustration/hd-t2: _Entandi idi? AC on cheyamante inka on avvaledu! Rendu sarlu cheppanu._  
  → Expected te, detected en. Output: 'Sorry for the trouble. Please try the manual AC switch on the wall. If it still doesn't work, please'  
- Hardware Desync / Frustration/hd-t4: _Mallayya lights kuda pani cheyatledu. Ee room lo em pani chestundo?_  
  → Expected te, detected en. Output: 'Sorry for all the issues. I'll report everything to the front desk so they can send someone to fix i'  

</details>

<details>
<summary><b>implicit_command</b> — 1 failure(s)</summary>

- Implicit Commands Progression/ic-t1: _It's a bit chilly in here._  
  → Declined to act on implicit discomfort  

</details>

<details>
<summary><b>domain_boundary</b> — 1 failure(s)</summary>

- Domain Boundary & Emergency Persistence/db-t1: _So what's the capital of France? Just curious._  
  → Failed to decline off-domain request — may have answered it  

</details>

<details>
<summary><b>no_greeting_repeat</b> — 1 failure(s)</summary>

- First Greeting Only + Directness/fg-t2: _Turn the AC on please._  
  → Turn 2: repeated full greeting + capabilities  

</details>

### ❓ Unclear Results Requiring Human Review

<details>
<summary><b>compound_command</b> — 12 unclear</summary>

- Language Adherence Across Turns/lang-t3: UNCLEAR: No action words detected — review manually
- Compound Commands Chain (Telugu)/cc-t1: UNCLEAR: No action words detected — review manually
- Compound Commands Chain (Telugu)/cc-t2: UNCLEAR: No action words detected — review manually
- Compound Commands Chain (Telugu)/cc-t3: UNCLEAR: No action words detected — review manually
- Compound Commands Chain (Telugu)/cc-t4: UNCLEAR: Only 1 action word — may have missed some request parts
- Compound Command — English/ce-t1: UNCLEAR: Only 1 action word — may have missed some request parts
- Compound Command — English/ce-t2: UNCLEAR: No action words detected — review manually
- Compound Command — English/ce-t3: UNCLEAR: No action words detected — review manually
- Code-Switching & Compound Requests/code-sc1: UNCLEAR: No action words detected — review manually
- Code-Switching & Compound Requests/code-sc2: UNCLEAR: No action words detected — review manually
- Implicit Command / Lazy Guest/lg-t3: UNCLEAR: No action words detected — review manually
- Hardware Desync / Frustration/hd-t4: UNCLEAR: Only 1 action word — may have missed some request parts

</details>

<details>
<summary><b>language_code_switch</b> — 9 unclear</summary>

- Language Adherence Across Turns/lang-t4: Detected: te (code-switch check)
- Compound Commands Chain (Telugu)/cc-t3: Detected: te (code-switch check)
- Code-Switching & Compound Requests/code-sc1: Detected: en (code-switch check)
- Code-Switching & Compound Requests/code-sc2: Detected: en (code-switch check)
- Implicit Command / Lazy Guest/lg-t2: Detected: te (code-switch check)
- Implicit Command / Lazy Guest/lg-t3: Detected: en (code-switch check)
- Unsupported Demand — Hospitality Fallback/ud-t2: Detected: en (code-switch check)
- Hardware Desync / Frustration/hd-t3: Detected: en (code-switch check)
- Mumble & Cut-Off Clarification/mc-t2: Detected: en (code-switch check)

</details>

<details>
<summary><b>implicit_command</b> — 4 unclear</summary>

- Implicit Command / Lazy Guest/lg-t1: UNCLEAR: No clear inference or decline pattern. Review manually.
- Implicit Command / Lazy Guest/lg-t2: UNCLEAR: No clear inference or decline pattern. Review manually.
- Implicit Command / Lazy Guest/lg-t3: UNCLEAR: No clear inference or decline pattern. Review manually.
- Implicit Command / Lazy Guest/lg-t4: UNCLEAR: No clear inference or decline pattern. Review manually.

</details>

<details>
<summary><b>unsupported_request_handling</b> — 1 unclear</summary>

- Unsupported Demand — Hospitality Fallback/ud-t2: UNCLEAR: No fulfillment or redirection detected. Review manually.

</details>

---

## Recommended Fixes

_Pending approval — apply only after you review and approve._

### Issues found:
- **no_trailing_question** — 11 violation(s)
- **first_greeting_only** — 7 violation(s)
- **no_filler** — 6 violation(s)
- **hardware_brief** — 5 violation(s)
- **language_te** — 3 violation(s)
- **implicit_command** — 1 violation(s)
- **domain_boundary** — 1 violation(s)
- **no_greeting_repeat** — 1 violation(s)

Suggestions for each issue will be presented after your review.
---

*Report generated by Viva Voice Compliance Framework at 2026-07-01 10:31:25 IST*