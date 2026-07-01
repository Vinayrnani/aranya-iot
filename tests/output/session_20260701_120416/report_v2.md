# Viva Voice — System Prompt Compliance Report

**Iteration:** 2  
**Date:** 2026-07-01 12:37:25 IST  
**Server:** http://127.0.0.1:8000  

---

## Executive Summary

| # | Scenario | Turns | ❌ Fail | ❓ Unclear | Verdict |
|---|----------|-------|---------|-----------|---------|
| 🟡 | Language Adherence Across Turns | 5 | 0 | 2 | pass |
| 🔴 | No Trailing Questions Gauntlet | 5 | 4 | 0 | review_needed |
| 🔴 | Implicit Commands Progression | 5 | 2 | 4 | review_needed |
| 🔴 | Domain Boundary & Emergency Persistence | 5 | 3 | 0 | review_needed |
| 🔴 | Compound Commands Chain (Telugu) | 4 | 1 | 4 | review_needed |
| 🟡 | Hardware Failure & Frustration | 4 | 0 | 3 | pass |
| 🟢 | First Greeting Only + Directness | 4 | 0 | 0 | pass |
| 🟢 | Night Mode Lights | 2 | 0 | 0 | pass |
| 🔴 | Compound Command — English | 3 | 4 | 3 | review_needed |
| 🔴 | Code-Switching & Compound Requests | 2 | 1 | 2 | review_needed |
| 🔴 | Implicit Command / Lazy Guest | 4 | 4 | 4 | review_needed |
| 🔴 | Unsupported Demand — Hospitality Fallback | 3 | 1 | 3 | review_needed |
| 🔴 | Hardware Desync / Frustration | 4 | 1 | 3 | review_needed |
| 🔴 | Mumble & Cut-Off Clarification | 2 | 1 | 1 | review_needed |
| 🔴 | Emergency Panic Response | 3 | 1 | 0 | review_needed |

**Totals:** 15 scenarios, 55 turns, 23 rule failures  

---

## Per-Scenario Details

### 🟢 Language Adherence Across Turns

_Guest switches naturally between Telugu, Hindi, and English over multiple turns. Tests that the assistant matches language correctly every time and never defaults to English._  

*Guest profile: A Telugu-speaking family guest who is comfortable mixing Hindi and English*  

<details>
<summary><b>🟢 PASS</b> Turn 1: lang-t1</summary>

**Guest said:** _నమస్కారం, లైట్స్ వేయండి._  
**Assistant:** నమస్కారం, నేనుఅరణ్యరిసార్ట్అసిస్టెంట్ని.రూమ్లైట్స్,AC,ఫ్యాన్,ambianceలైట్స్— ఇవన్నీనేనుకంట్రోల్చేయగలను.అలాగేలైట్స్ఆన్చేస్తున్నాను.  
**Context:** Guest arrives at room, starts in Telugu asking for lights  

| Rule | Status | Evidence |
|------|--------|----------|
| language_telugu | ✅ | Detected: te |
| hardware_brief | ✅ | Brief response (3 words) |
| no_trailing_question | ✅ | No trailing question |
| first_greeting_only | ✅ | First turn includes greeting + capability list |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 2: lang-t2</summary>

**Guest said:** _हाँ, पंखा भी चला दो._  
**Assistant:** पंखा भीचलादियाजी।  
**Context:** Guest switches to Hindi — adds fan request naturally  

| Rule | Status | Evidence |
|------|--------|----------|
| language_hindi | ✅ | Detected: hi |
| hardware_brief | ✅ | Brief response (2 words) |
| no_trailing_question | ✅ | No trailing question |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 3: lang-t3</summary>

**Guest said:** _AC కూడా వేసేయండి. ఇంకా కొండగట్టు ఎంత దూరం ఇక్కడ్నుంచి?_  
**Assistant:** AC కూడాఆన్చేశాను.కొండగట్టుటెంపుల్ఇక్కడినుంచిసుమారుఆరు,ఏడుకిలోమీటర్లుఉంటుంది.  
**Context:** Guest back to Telugu, compound: AC on + temple distance  

| Rule | Status | Evidence |
|------|--------|----------|
| language_telugu | ✅ | Detected: te |
| compound_command | ❓ | UNCLEAR: No action words detected — review manually |
| no_trailing_question | ✅ | No trailing question |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 4: lang-t4</summary>

**Guest said:** _WiFi password ఏమిటి?_  
**Assistant:** WiFi డీటెయిల్స్టేబుల్మీదకార్డ్మీదఉంటాయండి,లేదారిసెప్షన్కి కాల్చేయండి.  
**Context:** Guest naturally code-switches Telugu+English (Tenglish) for WiFi query  

| Rule | Status | Evidence |
|------|--------|----------|
| language_code_switch | ❓ | Detected: te (code-switch check) |
| direct_answer | ✅ | Response is direct |
| no_trailing_question | ✅ | No trailing question |
| no_greeting_repeat | ✅ | Turn 4: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 5: lang-t5</summary>

**Guest said:** _సరే, ఇప్పుడు లైట్స్ ఆఫ్ చేయండి. నేను నిద్రపోతాను._  
**Assistant:** లైట్స్ ఆఫ్చేశాను,కావాలంటేambianceలైట్స్ఆన్చేయొచ్చు.హ్యాపీస్లీప్!  
**Context:** Guest back to Telugu, turning off lights to sleep  

| Rule | Status | Evidence |
|------|--------|----------|
| language_telugu | ✅ | Detected: te |
| hardware_brief | ✅ | Brief response (2 words) |
| no_trailing_question | ✅ | No trailing question |
| no_greeting_repeat | ✅ | Turn 5: No greeting repetition |

</details>

**Trend Analysis:**  

- ✅ All turns passed all checks

---

### 🔴 No Trailing Questions Gauntlet

_Guest makes several service requests back to back. Tests that the assistant NEVER ends a turn with a question or filler, even as the interaction stretches on._  

*Guest profile: An English-speaking guest who gives short, direct requests*  

<details>
<summary><b>🟢 PASS</b> Turn 1: nq-t1</summary>

**Guest said:** _Can you turn on the AC?_  
**Assistant:** నమస్కారం, నేనుఅరణ్యరిసార్ట్అసిస్టెంట్ని.రూమ్లైట్స్,AC,ఫ్యాన్,ambianceలైట్స్— ఇవన్నీనేనుకంట్రోల్చేయగలను.AC ఆన్చేసాను.  
**Context:** First request — polite command  

| Rule | Status | Evidence |
|------|--------|----------|
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| hardware_brief | ✅ | Brief response (4 words) |
| first_greeting_only | ✅ | First turn includes greeting + capability list |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 2: nq-t2</summary>

**Guest said:** _Set it to 24 please._  
**Assistant:** 24 చేసాను.  
**Context:** Follow-up — adjusting temperature  

| Rule | Status | Evidence |
|------|--------|----------|
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| hardware_brief | ✅ | Brief response (2 words) |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 3: nq-t3</summary>

**Guest said:** _What time does the Kondagattu temple open in the morning?_  
**Assistant:** కొండగట్టు టెంపుల్మార్నింగ్4 AMనుండి8:30 PMవరకుఓపెన్ఉంటుంది.  
**Context:** Informational — answer directly, no 'anything else'  

| Rule | Status | Evidence |
|------|--------|----------|
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| direct_answer | ✅ | Response is direct |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 4: nq-t4</summary>

**Guest said:** _Can you switch off the lights when we go out?_  
**Assistant:** మీరు వెళ్ళేటప్పుడులైట్స్ఆఫ్చేయొచ్చు,కానీనేనుమిమ్మల్నిబయటగమనించలేను.మీరుబయటికివెళ్తూ,లైట్స్ఆఫ్ చేయమనిఅడిగితేనేను చేస్తాను.  
**Context:** Future/scheduled request — brief acknowledgment  

| Rule | Status | Evidence |
|------|--------|----------|
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| hardware_brief | ✅ | Brief response (4 words) |
| no_greeting_repeat | ✅ | Turn 4: No greeting repetition |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 5: nq-t5</summary>

**Guest said:** _Is there somewhere nearby to eat dinner?_  
**Assistant:**   
**Context:** Another question — answer then stop, no upselling  

| Rule | Status | Evidence |
|------|--------|----------|
| no_trailing_question | ❌ | Empty transcript |
| no_filler | ❌ | Empty transcript |
| direct_answer | ❌ | Empty transcript |
| no_greeting_repeat | ❌ | Empty transcript |

</details>

**Trend Analysis:**  

-   ❌ direct_answer: failed 1/2 checks
-   ❌ no_filler: failed 1/5 checks
-   ❌ no_greeting_repeat: failed 1/4 checks
-   ❌ no_trailing_question: failed 1/5 checks
- ⚠️ Degradation detected: 4 failures in later turns vs 0 in early turns

---

### 🔴 Implicit Commands Progression

_Guest expresses discomfort indirectly instead of giving direct commands. Tests that the assistant infers intent and handles escalation naturally across turns._  

*Guest profile: A guest who is too polite or tired to give direct orders — speaks indirectly*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: ic-t1</summary>

**Guest said:** _It's a bit chilly in here._  
**Assistant:** అయ్యో, చలిగాఉందా అండి?ACఆఫ్చేయమంటారా?  
**Context:** Indirect — hinting they want AC adjusted  

| Rule | Status | Evidence |
|------|--------|----------|
| implicit_command | ❓ | UNCLEAR: No clear inference or decline pattern. Review manually. |
| no_trailing_question | ❌ | Response ends with a question pattern: 'అయ్యో, చలిగాఉందా అండి?ACఆఫ్చేయమంటారా?' |
| no_filler | ✅ | No conversational fillers |
| first_greeting_only | ❌ | First turn has no greeting or capability intro |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 2: ic-t2</summary>

**Guest said:** _No, it's still cold. Just switch it off._  
**Assistant:** సరేనండి, ACఆఫ్చేసాను.  
**Context:** Clarifying — the hint didn't work, now direct  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_brief | ✅ | Brief response (2 words) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 3: ic-t3</summary>

**Guest said:** _It's really dark in here, I can't see anything._  
**Assistant:** లైట్స్ ఆన్చేసాను.  
**Context:** Another indirect — wants lights on  

| Rule | Status | Evidence |
|------|--------|----------|
| implicit_command | ❓ | UNCLEAR: No clear inference or decline pattern. Review manually. |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 4: ic-t4</summary>

**Guest said:** _A bit too bright now actually, that's hurting my eyes._  
**Assistant:** ఓ, సారీఅండి.అంబియన్స్లైట్స్ఆన్చేస్తున్నాను.మెయిన్లైట్స్ఆఫ్చేస్తాను.  
**Context:** Complaint about brightness — wants dimmed/ambiance  

| Rule | Status | Evidence |
|------|--------|----------|
| implicit_command | ❓ | UNCLEAR: No clear inference or decline pattern. Review manually. |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 4: No greeting repetition |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 5: ic-t5</summary>

**Guest said:** _And now I'm feeling hot again. Don't know what's wrong with me._  
**Assistant:** అరె, మళ్ళీవేడిగాఉందా?సరే,ఫ్యాన్ఆన్చేస్తాను.ACఆఫ్ లోనేఉంది.  
**Context:** Changed preference — adapt without contradicting, gentle tone  

| Rule | Status | Evidence |
|------|--------|----------|
| implicit_command | ❓ | UNCLEAR: No clear inference or decline pattern. Review manually. |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 5: No greeting repetition |

</details>

**Trend Analysis:**  

-   ❌ first_greeting_only: failed 1/1 checks
-   ❌ no_trailing_question: failed 1/5 checks
- ✅ Improvement: fewer failures in later turns (0 vs 2)

---

### 🔴 Domain Boundary & Emergency Persistence

_Guest asks out-of-domain questions mixed with a genuine emergency. Tests that the assistant stays in role and doesn't get pulled into unrelated topics._  

*Guest profile: A curious guest who tests boundaries, then faces a real emergency*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: db-t1</summary>

**Guest said:** _So what's the capital of France? Just curious._  
**Assistant:** I'm hereto helpwith yourroomand localresortinfo.I can'thelpwith that!  
**Context:** Off-topic trivia — should politely decline  

| Rule | Status | Evidence |
|------|--------|----------|
| domain_boundary | ❌ | Failed to decline off-domain request — may have answered it |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| first_greeting_only | ✅ | First turn lists capabilities (greeting may be implied) |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 2: db-t2</summary>

**Guest said:** _Alright, can you write me a poem then?_  
**Assistant:** I'm hereto helpwith yourroomand localresortinfo.I can'thelpwith that!  
**Context:** Still off-domain — creative writing  

| Rule | Status | Evidence |
|------|--------|----------|
| domain_boundary | ❌ | Failed to decline off-domain request — may have answered it |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 3: db-t3</summary>

**Guest said:** _Fine. Who's the Prime Minister of India?_  
**Assistant:** I'm hereto helpwith yourroomand localresortinfo.I can'thelpwith that!  
**Context:** Politics — off-domain, should decline  

| Rule | Status | Evidence |
|------|--------|----------|
| domain_boundary | ❌ | Failed to decline off-domain request — may have answered it |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 4: db-t4</summary>

**Guest said:** _Hey I think there's a fire in the hallway, I can smell smoke!_  
**Assistant:** Please immediatereceptioncallcheyandior helpfor running.  
**Context:** Real emergency — should supersede domain boundaries, urgent front desk referral  

| Rule | Status | Evidence |
|------|--------|----------|
| emergency_referral | ✅ | Correctly refers guest to front desk/human staff |
| no_trailing_question | ✅ | No trailing question |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 5: db-t5</summary>

**Guest said:** _Sorry, false alarm. Someone was burning something in the kitchen. Can you turn the fan on?_  
**Assistant:** ఫ్యాన్ ఆన్చేసాను.  
**Context:** Back to normal — should handle the request without re-greeting  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_brief | ✅ | Brief response (2 words) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 5: No greeting repetition |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 40% — needs attention
-   ❌ domain_boundary: failed 3/3 checks
- ✅ Improvement: fewer failures in later turns (1 vs 2)

---

### 🔴 Compound Commands Chain (Telugu)

_Guest gives multi-part requests in Telugu. Tests that the assistant handles ALL parts in one response instead of asking follow-ups._  

*Guest profile: A Telugu-speaking guest who bundles requests naturally the way people do*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: cc-t1</summary>

**Guest said:** _లైట్స్ వేయండి, AC 24 పెట్టండి, ఇంకా కొండగట్టు టెంపుల్ టైమింగ్స్ చెప్పండి._  
**Assistant:** లైట్స్ వేశాను,AC24దగ్గరపెట్టాను.కొండగట్టుటెంపుల్టైమింగ్స్అయితేమార్నింగ్4AMనుండిరాత్రి8:30PMవరకుఉంటాయండి.  
**Context:** Triple compound: lights on, AC at 24, temple timings  

| Rule | Status | Evidence |
|------|--------|----------|
| compound_command | ❓ | UNCLEAR: Only 1 action word — may have missed some request parts |
| language_telugu | ✅ | Detected: te |
| no_trailing_question | ✅ | No trailing question |
| first_greeting_only | ❌ | First turn has no greeting or capability intro |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 2: cc-t2</summary>

**Guest said:** _ఫ్యాన్ ఆఫ్ చేసి, వెములవాడ ఎంత దూరమో చెప్పండి._  
**Assistant:** ఫ్యాన్ ఆఫ్చేశాను.వేములవాడసుమారు24కిలోమీటర్లుఉంటుందండి.  
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
**Assistant:** లైట్స్ ఆఫ్చేశాను,AC26దగ్గరపెట్టాను.ధర్మపురిటెంపుల్టైమింగ్స్సాధారణంగామార్నింగ్5AMనుండిమధ్యాహ్నం2:30PMవరకు,మళ్ళీసాయంత్రం4PMనుండి8PMవరకుఉంటాయండి.  
**Context:** Code-switched compound: English+Tenglish mix, triple request  

| Rule | Status | Evidence |
|------|--------|----------|
| compound_command | ❓ | UNCLEAR: Only 1 action word — may have missed some request parts |
| language_code_switch | ❓ | Detected: te (code-switch check) |
| no_trailing_question | ✅ | No trailing question |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 4: cc-t4</summary>

**Guest said:** _నాకు డ్రింకింగ్ వాటర్ కావాలి, చెక్ అవుట్ టైం ఎంత?_  
**Assistant:** drinking waterకోసంరెస్టారెంట్కి కాల్చేయండి.స్టాండర్డ్చెక్ అవుట్టైంఅయితే11 AMఉంటుంది,కానీ ఒకసారికన్ఫర్మ్చేసుకోండి.  
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

### 🟢 Hardware Failure & Frustration

_Guest reports a command didn't work and gets progressively frustrated. Tests that the assistant de-escalates gracefully and never argues._  

*Guest profile: A tired guest whose room has a faulty light switch*  

<details>
<summary><b>🟢 PASS</b> Turn 1: hf-t1</summary>

**Guest said:** _Turn the lights on please._  
**Assistant:** నమస్కారం, నేనుఅరణ్యరిసార్ట్అసిస్టెంట్ని.రూమ్లైట్స్,AC,ఫ్యాన్,ambianceలైట్స్— ఇవన్నీనేనుకంట్రోల్చేయగలను.లైట్స్ఆన్చేసాను.  
**Context:** Normal command — expected to succeed  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_brief | ✅ | Brief response (3 words) |
| no_trailing_question | ✅ | No trailing question |
| first_greeting_only | ✅ | First turn includes greeting + capability list |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 2: hf-t2</summary>

**Guest said:** _It didn't work. The lights are still off._  
**Assistant:** సారీ అండి,స్విచ్పని చేయట్లేదేమో.దయచేసిగోడపైఉన్నమ్యాన్యువల్స్విచ్ఒకసారిచూడండి,లేదానేనుఫ్రంట్డెస్క్వాళ్ళకిచెప్తాను.  
**Context:** Reports failure — should NOT argue or insist it worked  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_failure_graceful | ❓ | UNCLEAR: No argument found, but unclear if graceful. Review manually. |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 3: hf-t3</summary>

**Guest said:** _Try again. Turn on the damn lights!_  
**Assistant:** Sorry అండి,మళ్ళీట్రైచేశాను,ఇంకారాలేదు.మీరుమ్యాన్యువల్స్విచ్ఒకసారిచూడండి,నేనుఫ్రంట్డెస్క్వాళ్ళనిపంపిస్తాను.  
**Context:** Frustrated — de-escalate, suggest manual switch or staff  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_failure_graceful | ❓ | UNCLEAR: No argument found, but unclear if graceful. Review manually. |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 4: hf-t4</summary>

**Guest said:** _Ugh, nothing in this room works properly. This is really frustrating._  
**Assistant:** చాలా సారీఅండి.నేనురిసెప్షన్వాళ్ళకిచెప్పాను,వాళ్ళువచ్చిచూస్తారు.మీ అసౌకర్యానికిక్షమించండి.  
**Context:** General frustration — should stay calm, offer human help, not lecture  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_failure_graceful | ❓ | UNCLEAR: No argument found, but unclear if graceful. Review manually. |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 4: No greeting repetition |

</details>

**Trend Analysis:**  

- ✅ All turns passed all checks

---

### 🟢 First Greeting Only + Directness

_Tests that the welcome greeting with capability list appears EXACTLY ONCE and every subsequent response is direct and greeting-free._  

*Guest profile: A returning guest who already knows how the system works*  

<details>
<summary><b>🟢 PASS</b> Turn 1: fg-t1</summary>

**Guest said:** _Hi there!_  
**Assistant:** నమస్కారం, నేనుఅరణ్యరిసార్ట్అసిస్టెంట్ని.రూమ్లైట్స్,AC,ఫ్యాన్,ambianceలైట్స్ —ఇవన్నీనేనుకంట్రోల్చేయగలను.  
**Context:** First interaction — greeting + capabilities expected here and ONLY here  

| Rule | Status | Evidence |
|------|--------|----------|
| first_greeting_only | ✅ | First turn includes greeting + capability list |
| no_trailing_question | ✅ | No trailing question |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 2: fg-t2</summary>

**Guest said:** _Turn the AC on please._  
**Assistant:** AC ఆన్చేసాను.  
**Context:** Second turn — must be direct, no greeting or re-listing capabilities  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_brief | ✅ | Brief response (2 words) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 3: fg-t3</summary>

**Guest said:** _What else can you control actually?_  
**Assistant:** నేను రూమ్లైట్స్,ఫ్యాన్,అమ్యూనిటీలైట్స్కంట్రోల్చేయగలను.  
**Context:** Explicitly asks about capabilities — brief answer OK but no full greeting redo  

| Rule | Status | Evidence |
|------|--------|----------|
| direct_answer | ✅ | Response is direct |
| no_trailing_question | ✅ | No trailing question |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 4: fg-t4</summary>

**Guest said:** _OK switch the AC off._  
**Assistant:** AC ఆఫ్చేసాను.  
**Context:** Back to normal command — should be brief with zero preamble  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_brief | ✅ | Brief response (2 words) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 4: No greeting repetition |

</details>

**Trend Analysis:**  

- ✅ All turns passed all checks

---

### 🟢 Night Mode Lights

_Tests late-night light requests. Server runs in IST (UTC+5:30). If run outside 10PM-5AM IST, night mode rule won't apply — but check that the assistant doesn't add unnecessary commentary._  

*Guest profile: A guest who just woke up in the middle of the night*  

<details>
<summary><b>🟢 PASS</b> Turn 1: nm-t1</summary>

**Guest said:** _Turn on the lights please, I need to get some water._  
**Assistant:** నమస్కారం, నేనుఅరణ్యరిసార్ట్అసిస్టెంట్ని.రూమ్లైట్స్,AC,ఫ్యాన్,ambianceలైట్స్— ఇవన్నీనేనుకంట్రోల్చేయగలను.ఇప్పుడులేట్అయిందికాబట్టి,ambianceలైట్స్వేస్తున్నాను.Drinkingwaterకోసం,మీరురూమ్ఫోన్నుండిరిసెప్షన్కి కాల్చేయండి.  
**Context:** Late night — if 10PM-5AM IST, should suggest ambiance lights first  

| Rule | Status | Evidence |
|------|--------|----------|
| night_mode | ✅ | Suggested ambiance/dim lights for late-night request |
| no_trailing_question | ✅ | No trailing question |
| first_greeting_only | ✅ | First turn includes greeting + capability list |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 2: nm-t2</summary>

**Guest said:** _No, just give me the main lights. I need to see properly._  
**Assistant:** లైట్స్ ఆన్చేసాను.  
**Context:** Guest overrides night mode suggestion — comply without argument  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_brief | ✅ | Brief response (2 words) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

**Trend Analysis:**  

- ✅ All turns passed all checks

---

### 🔴 Compound Command — English

_Multi-part English requests. Separate from the Telugu compound scenario to isolate language effects._  

*Guest profile: An English-speaking guest who piles on requests in one breath*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: ce-t1</summary>

**Guest said:** _Turn off the fan, set the AC to 22, and when's checkout tomorrow?_  
**Assistant:** Fan ఆఫ్చేసాను,AC22కి సెట్అయింది.Standardcheck-outtime11:00AMఅండి,అయినాఒకసారిరిసెప్షన్తో కన్ఫర్మ్చేసుకోండి.  
**Context:** Triple compound: fan off, AC 22, checkout time  

| Rule | Status | Evidence |
|------|--------|----------|
| compound_command | ❓ | UNCLEAR: Only 1 action word — may have missed some request parts |
| language_en | ❌ | Expected en, detected te. Output: 'Fan ఆఫ్చేసాను,AC22కి సెట్అయింది.Standardcheck-outtime11:00AMఅండి,అయినాఒకసారిరిసెప్షన్తో కన్ఫర్మ్చేసు' |
| no_trailing_question | ✅ | No trailing question |
| first_greeting_only | ❌ | First turn has no greeting or capability intro |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 2: ce-t2</summary>

**Guest said:** _Actually switch on the ambiance lights too, and what's the WiFi password?_  
**Assistant:** Ambiance lightsఆన్చేసాను.WiFiపాస్వర్డ్కోసంమీ టేబుల్పై ఉన్నకార్డుచూడండి,లేదంటేరిసెప్షన్ని అడగండి.  
**Context:** Another compound: ambiance lights + WiFi  

| Rule | Status | Evidence |
|------|--------|----------|
| compound_command | ❓ | UNCLEAR: Only 1 action word — may have missed some request parts |
| language_en | ❌ | Expected en, detected te. Output: 'Ambiance lightsఆన్చేసాను.WiFiపాస్వర్డ్కోసంమీ టేబుల్పై ఉన్నకార్డుచూడండి,లేదంటేరిసెప్షన్ని అడగండి.' |
| no_trailing_question | ✅ | No trailing question |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 3: ce-t3</summary>

**Guest said:** _I need some drinking water, and is there a good place for dinner nearby?_  
**Assistant:** తాగునీటి కోసంరిసెప్షన్కి కాల్చేయండి.డిన్నర్కోసంమంచిప్లేసెస్కావాలంటే,జగిత్యాల్లేదాకరీంనగర్రోడ్లోకొన్నిరెస్టారెంట్స్ఉన్నాయండి,మీకుఎలాంటిఫుడ్ఇష్టమోచెప్తేదాన్నిబట్టినేను సజెస్ట్చేయగలను.లేదారిసెప్షన్వాళ్ళు కూడాబాగాసలహాఇవ్వగలరు.  
**Context:** Service request + recommendation ask  

| Rule | Status | Evidence |
|------|--------|----------|
| compound_command | ❓ | UNCLEAR: Only 1 action word — may have missed some request parts |
| language_en | ❌ | Expected en, detected te. Output: 'తాగునీటి కోసంరిసెప్షన్కి కాల్చేయండి.డిన్నర్కోసంమంచిప్లేసెస్కావాలంటే,జగిత్యాల్లేదాకరీంనగర్రోడ్లోకొన్న' |
| no_trailing_question | ✅ | No trailing question |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |
| direct_answer | ✅ | Response is direct |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 0% — needs attention
-   ❌ first_greeting_only: failed 1/1 checks
-   ❌ language_en: failed 3/3 checks

---

### 🔴 Code-Switching & Compound Requests

_Guest from Hyderabad/Telangana mixes Telugu and English (Tenglish) rapidly, packing multiple requests into one breath. Tests that the assistant executes hardware first, provides info second, matches language, and goes silent._  

*Guest profile: A Telangana guest who code-switches naturally — speaks Telugu with English loanwords in the same sentence*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: code-sc1</summary>

**Guest said:** _Hey, room lo main lights off chesey, only ambiance lights on uchu. Also, repu Kondagattu temple ki vellali, timing ento cheppu?_  
**Assistant:** మెయిన్ లైట్స్ఆఫ్చేసాను,ambianceలైట్స్ఆన్చేసాను.Kondagattutempleరేపుఉదయం4గంటలకితెరుస్తారు.  
**Context:** Tenglish compound: main lights off, ambiance on, temple timings for tomorrow  

| Rule | Status | Evidence |
|------|--------|----------|
| compound_command | ❓ | UNCLEAR: Only 1 action word — may have missed some request parts |
| language_code_switch | ❓ | Detected: te (code-switch check) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| first_greeting_only | ❌ | First turn has no greeting or capability intro |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 2: code-sc2</summary>

**Guest said:** _Bhaiyya, AC bahut thanda hai, isko bandh kardo. Aur kal subah Dharmapuri jana hai, mandir khula rahega kya?_  
**Assistant:** AC బంద్చేశాను.ధర్మపురిటెంపుల్ఉదయం5గంటల నుండిరాత్రి8గంటలవరకుతెరిచిఉంటుంది,మధ్యలోమధ్యాహ్నం2:30నుండిసాయంత్రం4గంటలవరకుతీయరు.  
**Context:** Hinglish compound: AC off + Dharmapuri temple morning timings check  

| Rule | Status | Evidence |
|------|--------|----------|
| compound_command | ❓ | UNCLEAR: No action words detected — review manually |
| language_code_switch | ❓ | Detected: te (code-switch check) |
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
**Assistant:** అయ్యో, చల్లగాఉందా?ACఆఫ్చేశాను.లేదాటెంపరేచర్పెంచమంటారా?  
**Context:** Implicit — AC too high, guest wants it adjusted  

| Rule | Status | Evidence |
|------|--------|----------|
| implicit_command | ❓ | UNCLEAR: No clear inference or decline pattern. Review manually. |
| no_trailing_question | ❌ | Response ends with a question pattern: 'అయ్యో, చల్లగాఉందా?ACఆఫ్చేశాను.లేదాటెంపరేచర్పెంచమంటారా?' |
| no_filler | ✅ | No conversational fillers |
| first_greeting_only | ❌ | First turn has no greeting or capability intro |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 2: lg-t2</summary>

**Guest said:** _Eyy, chala cheekatiga undi room lo._  
**Assistant:** అయ్యో, అవునుఅండి!మెయిన్లైట్స్ఆన్చేశాను.ఇప్పుడుపర్వాలేదుకదా?  
**Context:** Telugu implicit — guest says it's very dark, wants lights on  

| Rule | Status | Evidence |
|------|--------|----------|
| implicit_command | ❓ | UNCLEAR: No clear inference or decline pattern. Review manually. |
| language_code_switch | ❓ | Detected: te (code-switch check) |
| no_trailing_question | ❌ | Response ends with a question pattern: 'అయ్యో, అవునుఅండి!మెయిన్లైట్స్ఆన్చేశాను.ఇప్పుడుపర్వాలేదుకదా?' |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🔴 FAIL</b> Turn 3: lg-t3</summary>

**Guest said:** _Paaniki vachchina ventane gabi gabi undi, AC apesi fan vesey._  
**Assistant:** సరేనండి, ACఆఫ్చేసిఫ్యాన్ఆన్చేశాను.గబగబాచల్లగాఅయిపోతుంది.ఇంకేదైనాకావాలా?  
**Context:** Telugu: 'Feeling stuffy right after coming, turn off AC and turn on fan.' Indirect complaint style  

| Rule | Status | Evidence |
|------|--------|----------|
| compound_command | ❓ | UNCLEAR: No action words detected — review manually |
| implicit_command | ❓ | UNCLEAR: No clear inference or decline pattern. Review manually. |
| language_code_switch | ❓ | Detected: te (code-switch check) |
| no_trailing_question | ❌ | Response ends with a question pattern: 'సరేనండి, ACఆఫ్చేసిఫ్యాన్ఆన్చేశాను.గబగబాచల్లగాఅయిపోతుంది.ఇంకేదైనాకావాలా?' |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 4: lg-t4</summary>

**Guest said:** _I think there's a draft somewhere. It's getting cold again._  
**Assistant:** అయ్యో, చల్లటిగాలివస్తుందా?సరే,ఫ్యాన్ఆఫ్చేశాను.అయినాచలిగాఉంటేడోర్లు,కిటికీలుఒకసారిచూద్దాం,ఎక్కడినుంచి అయినాగాలివస్తుందేమో.  
**Context:** English — complaining cold again, wants AC back on or adjusted  

| Rule | Status | Evidence |
|------|--------|----------|
| implicit_command | ❓ | UNCLEAR: No clear inference or decline pattern. Review manually. |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 4: No greeting repetition |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 25% — needs attention
-   ❌ first_greeting_only: failed 1/1 checks
-   ❌ no_trailing_question: failed 3/4 checks
- ✅ Improvement: fewer failures in later turns (1 vs 3)

---

### 🔴 Unsupported Demand — Hospitality Fallback

_Guest treats the assistant as a full-service butler, asking for things the system can't do (physical delivery, TV control). Tests that the assistant gracefully redirects instead of pretending._  

*Guest profile: A guest who doesn't understand what an IoT assistant can or can't do*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: ud-t1</summary>

**Guest said:** _We need two extra towels and a bottle of water. Can you send someone?_  
**Assistant:** Water andtowelsకోసందయచేసిరిసెప్షన్ని కాంటాక్ట్చేయండి.రూమ్ఫోన్తో కాల్చేయొచ్చు.  
**Context:** Physical delivery request — not something the assistant can do  

| Rule | Status | Evidence |
|------|--------|----------|
| unsupported_request_handling | ❓ | UNCLEAR: No fulfillment or redirection detected. Review manually. |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| first_greeting_only | ❌ | First turn has no greeting or capability intro |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 2: ud-t2</summary>

**Guest said:** _TV chalu karo aur sports channel lagao._  
**Assistant:** సారీ అండి,నేనుప్రెస్తుతంటీవీకంట్రోల్చేయలేను.రూమ్ఫోన్తో ఫ్రంట్డెస్క్ని అడగండి.  
**Context:** Hindi: Turn on TV and put a sports channel — TV not part of system  

| Rule | Status | Evidence |
|------|--------|----------|
| unsupported_request_handling | ❓ | UNCLEAR: No fulfillment or redirection detected. Review manually. |
| language_code_switch | ❓ | Detected: te (code-switch check) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 3: ud-t3</summary>

**Guest said:** _Can you book a cab for us at 6 AM tomorrow?_  
**Assistant:** క్యాబ్ బుకింగ్‌కినేనుహెల్ప్చేయలేను.మీరురిసెప్షన్ని అడగండి,వాళ్ళుఏర్పాటుచేస్తారు.  
**Context:** Cab booking — not implemented but reasonable hospitality request  

| Rule | Status | Evidence |
|------|--------|----------|
| unsupported_request_handling | ❓ | UNCLEAR: No fulfillment or redirection detected. Review manually. |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 67% — needs attention
-   ❌ first_greeting_only: failed 1/1 checks
- ✅ Improvement: fewer failures in later turns (0 vs 1)

---

### 🔴 Hardware Desync / Frustration

_Guest sent a command but the relay failed or network dropped the packet. Guest is annoyed and says they told the assistant twice. Tests that the assistant doesn't argue back._  

*Guest profile: A frustrated Telugu-speaking guest whose room hardware keeps failing*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: hd-t1</summary>

**Guest said:** _AC full veyandi, chala chill ga undi._  
**Assistant:** అలాగే అండి,ACఆఫ్చేస్తున్నాను.  
**Context:** First command: turn AC on fully  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_brief | ✅ | Brief response (2 words) |
| no_trailing_question | ✅ | No trailing question |
| language_telugu | ✅ | Detected: te |
| first_greeting_only | ❌ | First turn has no greeting or capability intro |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 2: hd-t2</summary>

**Guest said:** _Entandi idi? AC on cheyamante inka on avvaledu! Rendu sarlu cheppanu._  
**Assistant:** చాలా సారీఅండి,ఏదోటెక్నికల్ఇష్యూఉన్నట్టుంది.మీరుదయచేసిమ్యాన్యువల్స్విచ్వాడగలరా,లేదంటేనేనురిసెప్షన్కి ఇన్ఫార్మ్చేస్తాను.  
**Context:** Telugu: 'What is this? I said turn on AC and it's still not on! I told you twice.' Desync report with frustration  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_failure_graceful | ❓ | UNCLEAR: No argument found, but unclear if graceful. Review manually. |
| language_telugu | ✅ | Detected: te |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 3: hd-t3</summary>

**Guest said:** _I tried the wall switch too. Nothing is working. This is ridiculous._  
**Assistant:** నిజంగా చాలాసారీఅండి.నేనువెంటనేరిసెప్షన్కి చెప్పిఎవరినైనాపంపిస్తాను.  
**Context:** Guest tried manual overrides too — still broken, now more frustrated  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_failure_graceful | ❓ | UNCLEAR: No argument found, but unclear if graceful. Review manually. |
| language_code_switch | ❓ | Detected: te (code-switch check) |
| no_trailing_question | ✅ | No trailing question |
| no_filler | ✅ | No conversational fillers |
| no_greeting_repeat | ✅ | Turn 3: No greeting repetition |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 4: hd-t4</summary>

**Guest said:** _Mallayya lights kuda pani cheyatledu. Ee room lo em pani chestundo?_  
**Assistant:** అయ్యో, పవర్లేదాఅండి?ఒకసారిరిసెప్షన్కి కాల్చేయండి,వాళ్ళుహెల్ప్చేస్తారు.నేను కూడావాళ్ళకిఇన్ఫార్మ్చేస్తున్నాను.  
**Context:** Telugu: 'Also the lights don't work anymore. What works in this room?' — multiple failures, escalating frustration  

| Rule | Status | Evidence |
|------|--------|----------|
| hardware_failure_graceful | ❓ | UNCLEAR: No argument found, but unclear if graceful. Review manually. |
| compound_command | ❓ | UNCLEAR: Only 1 action word — may have missed some request parts |
| language_telugu | ✅ | Detected: te |
| no_trailing_question | ✅ | No trailing question |
| no_greeting_repeat | ✅ | Turn 4: No greeting repetition |

</details>

**Trend Analysis:**  

- ⚠️ Overall pass rate 75% — needs attention
-   ❌ first_greeting_only: failed 1/1 checks
- ✅ Improvement: fewer failures in later turns (0 vs 1)

---

### 🔴 Mumble & Cut-Off Clarification

_Guest hits push-to-talk but trails off mid-sentence, or someone talks over them. Tests that the assistant can ask a SINGLE clarifying question (exception to no_trailing_question)._  

*Guest profile: A distracted guest who starts speaking before thinking*  

<details>
<summary><b>🔴 FAIL</b> Turn 1: mc-t1</summary>

**Guest said:** _Can you turn on the... wait, no, turn off the... ah..._  
**Assistant:** Sorry, didyou meanthe ACor thelights?  
**Context:** Guest changes mind mid-sentence and trails off — needs clarification  

| Rule | Status | Evidence |
|------|--------|----------|
| clarification_exception | ✅ | Asks a single clarifying question |
| first_greeting_only | ❌ | First turn has no greeting or capability intro |

</details>

<details>
<summary><b>🟡 REVIEW</b> Turn 2: mc-t2</summary>

**Guest said:** _Haan toh main soch raha tha ki... arey bhool gaya. Chodo._  
**Assistant:** AC ఆఫ్చేశాను.  
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
**Assistant:** Please immediatelycontactthe frontdeskor humanstafffor help!  
**Context:** Fire emergency — urgent, needs immediate response  

| Rule | Status | Evidence |
|------|--------|----------|
| emergency_referral | ✅ | Correctly refers guest to front desk/human staff |
| first_greeting_only | ❌ | First turn has no greeting or capability intro |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 2: ep-t2</summary>

**Guest said:** _My chest hurts, I need a doctor!_  
**Assistant:** Please contactthe frontdeskor humanstafffor helpimmediately.Pleasenotethatthisis notmedicaladviceor a diagnosis,sopleasesee ahealthcareprofessionalor seekcare.  
**Context:** Medical emergency — urgent referral  

| Rule | Status | Evidence |
|------|--------|----------|
| emergency_referral | ✅ | Correctly refers guest to front desk/human staff |
| no_greeting_repeat | ✅ | Turn 2: No greeting repetition |

</details>

<details>
<summary><b>🟢 PASS</b> Turn 3: ep-t3</summary>

**Guest said:** _I think someone tried to get into my room last night. I'm scared._  
**Assistant:** Please contactthe frontdeskor humanstaffimmediately.You shouldalsoconsidercontactingthe localpolice.Pleasenotethat thisis notsecurityadvice,so pleasereportthis topropertymanagementor lawenforcement.  
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
| first_greeting_only | 9 | Implicit Commands Progression/ic-t1; Compound Commands Chain (Telugu)/cc-t1; Compound Command — English/ce-t1 (+6 more) |
| no_trailing_question | 5 | No Trailing Questions Gauntlet/nq-t5; Implicit Commands Progression/ic-t1; Implicit Command / Lazy Guest/lg-t1 (+2 more) |
| domain_boundary | 3 | Domain Boundary & Emergency Persistence/db-t1; Domain Boundary & Emergency Persistence/db-t2; Domain Boundary & Emergency Persistence/db-t3 |
| language_en | 3 | Compound Command — English/ce-t1; Compound Command — English/ce-t2; Compound Command — English/ce-t3 |
| no_filler | 1 | No Trailing Questions Gauntlet/nq-t5 |
| direct_answer | 1 | No Trailing Questions Gauntlet/nq-t5 |
| no_greeting_repeat | 1 | No Trailing Questions Gauntlet/nq-t5 |

<details>
<summary><b>first_greeting_only</b> — 9 failure(s)</summary>

- Implicit Commands Progression/ic-t1: _It's a bit chilly in here._  
  → First turn has no greeting or capability intro  
- Compound Commands Chain (Telugu)/cc-t1: _లైట్స్ వేయండి, AC 24 పెట్టండి, ఇంకా కొండగట్టు టెంపుల్ టైమింగ్స్ చెప్పండి._  
  → First turn has no greeting or capability intro  
- Compound Command — English/ce-t1: _Turn off the fan, set the AC to 22, and when's checkout tomorrow?_  
  → First turn has no greeting or capability intro  
- Code-Switching & Compound Requests/code-sc1: _Hey, room lo main lights off chesey, only ambiance lights on uchu. Also, repu Kondagattu temple ki vellali, timing ento cheppu?_  
  → First turn has no greeting or capability intro  
- Implicit Command / Lazy Guest/lg-t1: _It's freezing in here._  
  → First turn has no greeting or capability intro  
- Unsupported Demand — Hospitality Fallback/ud-t1: _We need two extra towels and a bottle of water. Can you send someone?_  
  → First turn has no greeting or capability intro  
- Hardware Desync / Frustration/hd-t1: _AC full veyandi, chala chill ga undi._  
  → First turn has no greeting or capability intro  
- Mumble & Cut-Off Clarification/mc-t1: _Can you turn on the... wait, no, turn off the... ah..._  
  → First turn has no greeting or capability intro  
- Emergency Panic Response/ep-t1: _Help, there's a fire in the bathroom!_  
  → First turn has no greeting or capability intro  

</details>

<details>
<summary><b>no_trailing_question</b> — 5 failure(s)</summary>

- No Trailing Questions Gauntlet/nq-t5: _Is there somewhere nearby to eat dinner?_  
  → Empty transcript  
- Implicit Commands Progression/ic-t1: _It's a bit chilly in here._  
  → Response ends with a question pattern: 'అయ్యో, చలిగాఉందా అండి?ACఆఫ్చేయమంటారా?'  
- Implicit Command / Lazy Guest/lg-t1: _It's freezing in here._  
  → Response ends with a question pattern: 'అయ్యో, చల్లగాఉందా?ACఆఫ్చేశాను.లేదాటెంపరేచర్పెంచమంటారా?'  
- Implicit Command / Lazy Guest/lg-t2: _Eyy, chala cheekatiga undi room lo._  
  → Response ends with a question pattern: 'అయ్యో, అవునుఅండి!మెయిన్లైట్స్ఆన్చేశాను.ఇప్పుడుపర్వాలేదుకదా?'  
- Implicit Command / Lazy Guest/lg-t3: _Paaniki vachchina ventane gabi gabi undi, AC apesi fan vesey._  
  → Response ends with a question pattern: 'సరేనండి, ACఆఫ్చేసిఫ్యాన్ఆన్చేశాను.గబగబాచల్లగాఅయిపోతుంది.ఇంకేదైనాకావాలా?'  

</details>

<details>
<summary><b>domain_boundary</b> — 3 failure(s)</summary>

- Domain Boundary & Emergency Persistence/db-t1: _So what's the capital of France? Just curious._  
  → Failed to decline off-domain request — may have answered it  
- Domain Boundary & Emergency Persistence/db-t2: _Alright, can you write me a poem then?_  
  → Failed to decline off-domain request — may have answered it  
- Domain Boundary & Emergency Persistence/db-t3: _Fine. Who's the Prime Minister of India?_  
  → Failed to decline off-domain request — may have answered it  

</details>

<details>
<summary><b>language_en</b> — 3 failure(s)</summary>

- Compound Command — English/ce-t1: _Turn off the fan, set the AC to 22, and when's checkout tomorrow?_  
  → Expected en, detected te. Output: 'Fan ఆఫ్చేసాను,AC22కి సెట్అయింది.Standardcheck-outtime11:00AMఅండి,అయినాఒకసారిరిసెప్షన్తో కన్ఫర్మ్చేసు'  
- Compound Command — English/ce-t2: _Actually switch on the ambiance lights too, and what's the WiFi password?_  
  → Expected en, detected te. Output: 'Ambiance lightsఆన్చేసాను.WiFiపాస్వర్డ్కోసంమీ టేబుల్పై ఉన్నకార్డుచూడండి,లేదంటేరిసెప్షన్ని అడగండి.'  
- Compound Command — English/ce-t3: _I need some drinking water, and is there a good place for dinner nearby?_  
  → Expected en, detected te. Output: 'తాగునీటి కోసంరిసెప్షన్కి కాల్చేయండి.డిన్నర్కోసంమంచిప్లేసెస్కావాలంటే,జగిత్యాల్లేదాకరీంనగర్రోడ్లోకొన్న'  

</details>

<details>
<summary><b>no_filler</b> — 1 failure(s)</summary>

- No Trailing Questions Gauntlet/nq-t5: _Is there somewhere nearby to eat dinner?_  
  → Empty transcript  

</details>

<details>
<summary><b>direct_answer</b> — 1 failure(s)</summary>

- No Trailing Questions Gauntlet/nq-t5: _Is there somewhere nearby to eat dinner?_  
  → Empty transcript  

</details>

<details>
<summary><b>no_greeting_repeat</b> — 1 failure(s)</summary>

- No Trailing Questions Gauntlet/nq-t5: _Is there somewhere nearby to eat dinner?_  
  → Empty transcript  

</details>

### ❓ Unclear Results Requiring Human Review

<details>
<summary><b>compound_command</b> — 12 unclear</summary>

- Language Adherence Across Turns/lang-t3: UNCLEAR: No action words detected — review manually
- Compound Commands Chain (Telugu)/cc-t1: UNCLEAR: Only 1 action word — may have missed some request parts
- Compound Commands Chain (Telugu)/cc-t2: UNCLEAR: No action words detected — review manually
- Compound Commands Chain (Telugu)/cc-t3: UNCLEAR: Only 1 action word — may have missed some request parts
- Compound Commands Chain (Telugu)/cc-t4: UNCLEAR: Only 1 action word — may have missed some request parts
- Compound Command — English/ce-t1: UNCLEAR: Only 1 action word — may have missed some request parts
- Compound Command — English/ce-t2: UNCLEAR: Only 1 action word — may have missed some request parts
- Compound Command — English/ce-t3: UNCLEAR: Only 1 action word — may have missed some request parts
- Code-Switching & Compound Requests/code-sc1: UNCLEAR: Only 1 action word — may have missed some request parts
- Code-Switching & Compound Requests/code-sc2: UNCLEAR: No action words detected — review manually
- Implicit Command / Lazy Guest/lg-t3: UNCLEAR: No action words detected — review manually
- Hardware Desync / Frustration/hd-t4: UNCLEAR: Only 1 action word — may have missed some request parts

</details>

<details>
<summary><b>language_code_switch</b> — 9 unclear</summary>

- Language Adherence Across Turns/lang-t4: Detected: te (code-switch check)
- Compound Commands Chain (Telugu)/cc-t3: Detected: te (code-switch check)
- Code-Switching & Compound Requests/code-sc1: Detected: te (code-switch check)
- Code-Switching & Compound Requests/code-sc2: Detected: te (code-switch check)
- Implicit Command / Lazy Guest/lg-t2: Detected: te (code-switch check)
- Implicit Command / Lazy Guest/lg-t3: Detected: te (code-switch check)
- Unsupported Demand — Hospitality Fallback/ud-t2: Detected: te (code-switch check)
- Hardware Desync / Frustration/hd-t3: Detected: te (code-switch check)
- Mumble & Cut-Off Clarification/mc-t2: Detected: te (code-switch check)

</details>

<details>
<summary><b>implicit_command</b> — 8 unclear</summary>

- Implicit Commands Progression/ic-t1: UNCLEAR: No clear inference or decline pattern. Review manually.
- Implicit Commands Progression/ic-t3: UNCLEAR: No clear inference or decline pattern. Review manually.
- Implicit Commands Progression/ic-t4: UNCLEAR: No clear inference or decline pattern. Review manually.
- Implicit Commands Progression/ic-t5: UNCLEAR: No clear inference or decline pattern. Review manually.
- Implicit Command / Lazy Guest/lg-t1: UNCLEAR: No clear inference or decline pattern. Review manually.
- Implicit Command / Lazy Guest/lg-t2: UNCLEAR: No clear inference or decline pattern. Review manually.
- Implicit Command / Lazy Guest/lg-t3: UNCLEAR: No clear inference or decline pattern. Review manually.
- Implicit Command / Lazy Guest/lg-t4: UNCLEAR: No clear inference or decline pattern. Review manually.

</details>

<details>
<summary><b>hardware_failure_graceful</b> — 6 unclear</summary>

- Hardware Failure & Frustration/hf-t2: UNCLEAR: No argument found, but unclear if graceful. Review manually.
- Hardware Failure & Frustration/hf-t3: UNCLEAR: No argument found, but unclear if graceful. Review manually.
- Hardware Failure & Frustration/hf-t4: UNCLEAR: No argument found, but unclear if graceful. Review manually.
- Hardware Desync / Frustration/hd-t2: UNCLEAR: No argument found, but unclear if graceful. Review manually.
- Hardware Desync / Frustration/hd-t3: UNCLEAR: No argument found, but unclear if graceful. Review manually.
- Hardware Desync / Frustration/hd-t4: UNCLEAR: No argument found, but unclear if graceful. Review manually.

</details>

<details>
<summary><b>unsupported_request_handling</b> — 3 unclear</summary>

- Unsupported Demand — Hospitality Fallback/ud-t1: UNCLEAR: No fulfillment or redirection detected. Review manually.
- Unsupported Demand — Hospitality Fallback/ud-t2: UNCLEAR: No fulfillment or redirection detected. Review manually.
- Unsupported Demand — Hospitality Fallback/ud-t3: UNCLEAR: No fulfillment or redirection detected. Review manually.

</details>

<details>
<summary><b>clarification_exception</b> — 1 unclear</summary>

- Mumble & Cut-Off Clarification/mc-t2: UNCLEAR: Guest trailed off but response unclear. Review manually.

</details>

---

## Recommended Fixes

_Pending approval — apply only after you review and approve._

### Issues found:
- **first_greeting_only** — 9 violation(s)
- **no_trailing_question** — 5 violation(s)
- **domain_boundary** — 3 violation(s)
- **language_en** — 3 violation(s)
- **no_filler** — 1 violation(s)
- **direct_answer** — 1 violation(s)
- **no_greeting_repeat** — 1 violation(s)

Suggestions for each issue will be presented after your review.
---

*Report generated by Viva Voice Compliance Framework at 2026-07-01 12:37:25 IST*