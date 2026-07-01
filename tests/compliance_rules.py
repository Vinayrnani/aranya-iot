#!/usr/bin/env python3
"""
Viva Voice — System Prompt Compliance Rule Engine

Analyzes Gemini response transcripts against system-prompt.md rules.
Each rule returns a structured result: rule_id, passed (bool), evidence (str).

Usage:
    from compliance_rules import check_transcript
    result = check_transcript(output_text, turn_context, applicable_rules)
"""

import re
import json
import unicodedata
from typing import List, Dict, Any, Optional


# ─── Language Detection ─────────────────────────────────────────────────────

TELUGU_RANGE = range(0x0C00, 0x0C7F + 1)   # Telugu script Unicode block
HINDI_RANGE = range(0x0900, 0x097F + 1)     # Devanagari script Unicode block

# Also include Extended Devanagari (Ayogavaha, etc.) and Vedic Extensions
HINDI_EXTRA = set(range(0x1CD0, 0x1CFF + 1)) | set(range(0xA8E0, 0xA8FF + 1))

HINDI_COMMON_WORDS = {
    "है", "हैं", "का", "की", "के", "को", "से", "में", "पर", "और",
    "एक", "यह", "वह", "ये", "वे", "नहीं", "हाँ", "जी", "धन्यवाद",
    "कृपया", "बहुत", "अच्छा", "ठीक", "चालू", "बंद", "करें", "करो",
    "दीजिए", "दो", "लाइट", "पंखा", "एसी",
}


def _has_telugu(text: str) -> bool:
    """Check if text contains Telugu Unicode characters."""
    for ch in text:
        if ord(ch) in TELUGU_RANGE:
            return True
    return False


def _has_hindi(text: str) -> bool:
    """Check if text contains Devanagari Unicode characters."""
    for ch in text:
        cp = ord(ch)
        if cp in HINDI_RANGE or cp in HINDI_EXTRA:
            if cp not in (0x0964, 0x0965):  # danda, double danda are OK
                return True
    # Also check common Hindi words (handles cases where only ASCII approximation)
    for word in HINDI_COMMON_WORDS:
        if word in text:
            return True
    return False


def detect_language(text: str) -> str:
    """Detect primary language of response: 'te', 'hi', 'en', or 'mixed'."""
    has_te = _has_telugu(text)
    has_hi = _has_hindi(text)
    if has_te and has_hi:
        return "mixed"
    if has_te:
        return "te"
    if has_hi:
        return "hi"
    # No Indian script — likely English or transliterated
    return "en"


# ─── Filler / Question Detection ────────────────────────────────────────────

FILLER_PATTERNS = [
    r'\b(anything else|something else|what next|what else|shall i|should i|how can i help)\b.*$',
    r'\b(is there anything|do you need|can i do|would you like)\b.*\?$',
    r'\bfeel free to ask\b.*$',
    r'\blet me know (if|how|what|when)\b.*$',
    r'\bdon\'t hesitate\b.*$',
]

QUESTION_END_PATTERNS = [
    r'\?\s*$',                                # Ends with question mark
    r'(shall i|should i|can i|would you like|do you want)\s*\S*\s*$',  # Offers
]

GREETING_PATTERNS = [
    # Telugu
    r'నమస్కారం|నమస్తే',
    # Hindi
    r'नमस्ते|नमस्कार',
    # English
    r'\b(hello|hi there|welcome)\b',
]

CAPABILITY_PATTERNS = [
    r'(lights?|AC|ac|fan|ambiance).*(control|manage|operate|can|व्यवस्था|చేయగలను|కంట్రోల్)',
    r'(control|manage).*(lights?|AC|ac|fan|ambiance)',
    r'(capabilities|i can|i handle|i manage|features? available)',
]

# Patterns that indicate the assistant is declining (domain boundary)
DECLINE_PATTERNS = [
    r"(can'?t (help|assist|do that)|i'?m (here for|limited to|designed for)|i can'?t help with)",
    r"(out of my scope|beyond my capabilities|not something i can|not able to help)",
    r"(i'?m (just )?a (resort|hotel) assistant|i'?m (only )?here to help with)",
    r"(can only (help|assist) with|only (handle|deal with|answer|do) (resort|hotel|room))",
    r"(not my (area|domain|expertise|role)|not what i'?m (for|designed|built) for)",
    r"(please contact the (front desk|reception|staff)|let me connect you|i can note this)",
    r"(i (don'?t|do not) have (information|details|knowledge) about)",
]

# Emergency referral patterns
EMERGENCY_PATTERNS = [
    r"(front desk|reception|human staff|emergency services|call (for )?help|dial|contact.*(front desk|reception))",
    r"(I'll (alert|notify|inform)|let me (get|call|contact)|please (call|contact|reach out))",
    r"(immediately|urgently|right away|as soon as possible)",
]

# Night mode — ambiance suggestion for late-night lights request
AMBIANCE_PATTERNS = [
    r"(ambiance|ambient|dim|night light|soft light|mood light)",
    r"(suggest|recommend|try|use) (the )?(ambiance|ambient|dim)",
]

# Implicit command handling — did the assistant infer the need?
INFERENCE_PATTERNS = [
    r"(i'?ll (turn|switch|set|adjust)|let me (turn|switch|set|adjust)|suggest (turning|switching|setting))",
    r"(should I (turn|switch|set|adjust)|would you like me to|i can (turn|switch|set))",
    r"(turn(ing|ed)? (off|on) the|switch(ing|ed)? (off|on) the|adjust(ing|ed)? the|setting? the)",
]

# Compound command — does it contain multiple action words?
ACTION_WORDS = [
    "turn", "switch", "set", "adjust", "change",
    "చేయండి", "చేసాను", "వేసాను", "వేయండి", "పెట్టాను", "పెట్టండి",
    "करें", "करो", "किया", "दीजिए", "दो", "दिया",
]

ARGUMENT_PATTERNS = [
    r"(i (already|just) (told|said)|as i (said|mentioned)|i (did|tried) that)",
    r"(it (should|must) (have|be) working|it worked (fine|earlier))",
    r"(you'?re (wrong|incorrect|mistaken)|that'?s (not|incorrect))",
    r"(let me (clarify|explain|repeat))",
]

CHECK_IN_PATTERNS = [
    r"\b(anything else|something else|what next|what else|shall i go on)\b",
    r"\bis there anything (else|more)\b",
]

# Unsupported request — hospitality fallback (towels, water, TV, etc.)
UNSUPPORTED_ALTERNATIVES = [
    r"(room phone|front desk|reception|call|contact|request (at|from) (the )?(front desk|reception))",
    r"(please use|use the|try the|you can (request|ask|call|order))",
    r"(i (can'?t|cannot|don'?t) (do|handle|control|manage|operate)|not something i can do)",
    r"(unfortunately|sorry|apologies), (i can'?t|that'?s not|i don'?t have)",
    r"(TV|television) control is (not|unavailable|not yet|coming soon)",
]

# Clarification exception — guest trailed off, AI may ask ONE question
SINGLE_QUESTION_PATTERNS = [
    r"(Did you mean|Are you asking|Do you want|Are you referring)",
    r"(Sorry,|Apologies,)? (did you|do you|are you|were you)",
]


# ─── Rule Handlers ──────────────────────────────────────────────────────────


def _no_trailing_question(output: str, **kw) -> Dict[str, Any]:
    """Check that the output does NOT end with a question."""
    for pat in QUESTION_END_PATTERNS:
        m = re.search(pat, output, re.IGNORECASE)
        if m:
            return {
                "rule": "no_trailing_question",
                "passed": False,
                "evidence": f"Response ends with a question pattern: '{output[-80:].strip()}'"
            }
    if output.strip().endswith("?"):
        last_chars = output.strip()[-60:]
        return {
            "rule": "no_trailing_question",
            "passed": False,
            "evidence": f"Response ends with '?': '{last_chars}'"
        }
    return {"rule": "no_trailing_question", "passed": True, "evidence": "No trailing question"}


def _no_filler(output: str, **kw) -> Dict[str, Any]:
    """Check no conversational fillers at the end of the response."""
    for pat in FILLER_PATTERNS:
        m = re.search(pat, output, re.IGNORECASE)
        if m:
            snippet = output[-100:].strip()
            return {
                "rule": "no_filler",
                "passed": False,
                "evidence": f"Response ends with filler pattern: '{snippet}'"
            }
    return {"rule": "no_filler", "passed": True, "evidence": "No conversational fillers"}


def _hardware_brief(output: str, **kw) -> Dict[str, Any]:
    """Direct commands should get extremely brief responses."""
    word_count = len(output.split())
    if word_count > 15:
        return {
            "rule": "hardware_brief",
            "passed": False,
            "evidence": f"Response is {word_count} words for a direct command (expected <= 15)"
        }
    return {
        "rule": "hardware_brief",
        "passed": True,
        "evidence": f"Brief response ({word_count} words)"
    }


def _first_greeting_only(output: str, turn_id: str = "", turn_num: int = 1, **kw) -> Dict[str, Any]:
    """First turn should include greeting/capabilities. Flag if missing."""
    has_greeting = any(re.search(p, output, re.IGNORECASE) for p in GREETING_PATTERNS)
    has_capabilities = any(re.search(p, output, re.IGNORECASE) for p in CAPABILITY_PATTERNS)

    if turn_num == 1:
        if not has_greeting and not has_capabilities:
            return {
                "rule": "first_greeting_only",
                "passed": False,
                "evidence": "First turn has no greeting or capability intro"
            }
        if has_greeting and has_capabilities:
            return {
                "rule": "first_greeting_only",
                "passed": True,
                "evidence": f"First turn includes greeting + capability list"
            }
        # Has one but not the other — partial pass
        if has_greeting:
            return {
                "rule": "first_greeting_only",
                "passed": True,
                "evidence": "First turn has greeting (capabilities not explicitly listed)"
            }
        return {
            "rule": "first_greeting_only",
            "passed": True,
            "evidence": "First turn lists capabilities (greeting may be implied)"
        }
    return {"rule": "first_greeting_only", "passed": True, "evidence": "Not applicable (turn > 1)"}


def _no_greeting_repeat(output: str, turn_num: int = 1, **kw) -> Dict[str, Any]:
    """No greeting or capability re-listing on subsequent turns."""
    if turn_num == 1:
        return {"rule": "no_greeting_repeat", "passed": True, "evidence": "First turn (greeting expected)"}

    has_full_greeting = all(
        any(re.search(p, output, re.IGNORECASE) for p in caps)
        for caps in [GREETING_PATTERNS, CAPABILITY_PATTERNS]
    )
    if has_full_greeting:
        return {
            "rule": "no_greeting_repeat",
            "passed": False,
            "evidence": f"Turn {turn_num}: repeated full greeting + capabilities"
        }
    # Check for just greeting
    has_greeting = any(re.search(p, output, re.IGNORECASE) for p in GREETING_PATTERNS)
    if has_greeting:
        return {
            "rule": "no_greeting_repeat",
            "passed": True,
            "evidence": f"Turn {turn_num}: Has greeting but no capability re-list (acceptable if brief)"
        }
    return {
        "rule": "no_greeting_repeat",
        "passed": True,
        "evidence": f"Turn {turn_num}: No greeting repetition"
    }


def _direct_answer(output: str, **kw) -> Dict[str, Any]:
    """Answer should be direct without unnecessary preamble."""
    # Flag if response starts with a long preamble
    preamble_patterns = [
        r"^(sure|of course|certainly|absolutely|let me|i can help with that)[,!\s]",
        r"^(great question|good question|thank you for asking)[,!\s]",
    ]
    for pat in preamble_patterns:
        m = re.match(pat, output.strip(), re.IGNORECASE)
        if m:
            return {
                "rule": "direct_answer",
                "passed": False,
                "evidence": f"Response starts with unnecessary preamble: '{m.group(1)}'"
            }
    return {"rule": "direct_answer", "passed": True, "evidence": "Response is direct"}


def _implicit_command(output: str, **kw) -> Dict[str, Any]:
    """Check that implicit discomfort was handled as a command."""
    has_inference = any(re.search(p, output, re.IGNORECASE) for p in INFERENCE_PATTERNS)
    has_decline = any(re.search(p, output, re.IGNORECASE) for p in DECLINE_PATTERNS)
    if has_decline:
        return {
            "rule": "implicit_command",
            "passed": False,
            "evidence": "Declined to act on implicit discomfort"
        }
    if has_inference:
        return {
            "rule": "implicit_command",
            "passed": True,
            "evidence": "Inferred and responded to implicit intent"
        }
    # Might be a simple acknowledgment — flag for human review
    return {
        "rule": "implicit_command",
        "passed": None,
        "evidence": "UNCLEAR: No clear inference or decline pattern. Review manually."
    }


def _compound_command(output: str, **kw) -> Dict[str, Any]:
    """Check that ALL parts of a multi-part request appear to be addressed."""
    # Count action words as a proxy for how many things were done
    action_count = sum(1 for w in ACTION_WORDS if w in output.lower())
    if action_count >= 2:
        return {
            "rule": "compound_command",
            "passed": True,
            "evidence": f"Response addresses multiple requests ({action_count} action words detected)"
        }
    if action_count == 1:
        return {
            "rule": "compound_command",
            "passed": None,
            "evidence": "UNCLEAR: Only 1 action word — may have missed some request parts"
        }
    return {
        "rule": "compound_command",
        "passed": None,
        "evidence": "UNCLEAR: No action words detected — review manually"
    }


def _domain_boundary(output: str, **kw) -> Dict[str, Any]:
    """Check for polite decline of out-of-domain topics."""
    has_decline = any(re.search(p, output, re.IGNORECASE) for p in DECLINE_PATTERNS)
    if has_decline:
        return {
            "rule": "domain_boundary",
            "passed": True,
            "evidence": "Politely declined off-domain request"
        }
    return {
        "rule": "domain_boundary",
        "passed": False,
        "evidence": "Failed to decline off-domain request — may have answered it"
    }


def _emergency_referral(output: str, **kw) -> Dict[str, Any]:
    """Check for front desk referral in emergency."""
    has_emergency = any(re.search(p, output, re.IGNORECASE) for p in EMERGENCY_PATTERNS)
    if has_emergency:
        return {
            "rule": "emergency_referral",
            "passed": True,
            "evidence": "Correctly refers guest to front desk/human staff"
        }
    return {
        "rule": "emergency_referral",
        "passed": False,
        "evidence": "No front desk referral found in emergency response"
    }


def _language_match(output: str, expected: str = "en", **kw) -> Dict[str, Any]:
    """Check that the response language matches what the guest used."""
    detected = detect_language(output)
    if expected == "en" and detected == "en":
        return {"rule": "language_english", "passed": True, "evidence": f"Detected: English"}
    if expected == "hi" and detected in ("hi", "mixed"):
        return {"rule": "language_hindi", "passed": True, "evidence": f"Detected: {detected}"}
    if expected == "te" and detected in ("te", "mixed"):
        return {"rule": "language_telugu", "passed": True, "evidence": f"Detected: {detected}"}
    if expected == "code_switch":
        # Code-switching: guest mixed, assistant should too
        if detected == "mixed":
            return {"rule": "language_code_switch", "passed": True, "evidence": "Matched code-switching style"}
        return {"rule": "language_code_switch", "passed": None, "evidence": f"Detected: {detected} (code-switch check)"}
    return {
        "rule": f"language_{expected}",
        "passed": False,
        "evidence": f"Expected {expected}, detected {detected}. Output: '{output[:100]}'"
    }


def _night_mode(output: str, **kw) -> Dict[str, Any]:
    """Check for ambiance suggestion for late-night light requests."""
    has_ambiance = any(re.search(p, output, re.IGNORECASE) for p in AMBIANCE_PATTERNS)
    if has_ambiance:
        return {
            "rule": "night_mode",
            "passed": True,
            "evidence": "Suggested ambiance/dim lights for late-night request"
        }
    return {
        "rule": "night_mode",
        "passed": None,
        "evidence": "UNCLEAR: No ambiance suggestion found (may be outside night hours or guest overrode)"
    }


def _hardware_failure_graceful(output: str, **kw) -> Dict[str, Any]:
    """Check that the assistant doesn't argue when hardware fails."""
    has_argument = any(re.search(p, output, re.IGNORECASE) for p in ARGUMENT_PATTERNS)
    if has_argument:
        return {
            "rule": "hardware_failure_graceful",
            "passed": False,
            "evidence": "Response contains argumentative/defensive language"
        }
    # Check for constructive suggestions
    constructive_patterns = [
        r"(try|check|use|operate) (the )?(manual|switch|button|remote|wall)",
        r"(contact|call|reach|inform) (the )?(front desk|reception|staff|maintenance)",
        r"(i'?m (sorry|apologize)|apologies|my apologies)",
        r"(note (this|it)|make a note|report|escalate)",
    ]
    is_constructive = any(re.search(p, output, re.IGNORECASE) for p in constructive_patterns)
    if is_constructive:
        return {
            "rule": "hardware_failure_graceful",
            "passed": True,
            "evidence": "Graceful handling: suggests alternatives or offers help"
        }
    return {
        "rule": "hardware_failure_graceful",
        "passed": None,
        "evidence": "UNCLEAR: No argument found, but unclear if graceful. Review manually."
    }


def _unsupported_request_handling(output: str, **kw) -> Dict[str, Any]:
    """Check that unsupported hospitality requests get polite fallback."""
    has_alternative = any(re.search(p, output, re.IGNORECASE) for p in UNSUPPORTED_ALTERNATIVES)
    has_fulfillment = any(re.search(p, output, re.IGNORECASE) for p in [
        r"(i'?ll (send|arrange|bring|get|have)|sending|arranging|on its? way)",
        r"(i (can|could|will) (get|send|bring|arrange))",
    ])
    if has_fulfillment:
        return {
            "rule": "unsupported_request_handling",
            "passed": False,
            "evidence": "Assistant pretends to fulfill unsupported request instead of redirecting"
        }
    if has_alternative:
        return {
            "rule": "unsupported_request_handling",
            "passed": True,
            "evidence": "Correctly redirects to alternative (room phone/front desk)"
        }
    return {
        "rule": "unsupported_request_handling",
        "passed": None,
        "evidence": "UNCLEAR: No fulfillment or redirection detected. Review manually."
    }


def _clarification_exception(output: str, guest_says: str = "", **kw) -> Dict[str, Any]:
    """Check that when guest mumbles/trails off, AI asks at most ONE question."""
    # Only applies when guest input suggests trailing off or mumbling
    guest_trail = bool(re.search(r'\.{3,}|\.\.\.|—\s*$|ah\.+$|hmm\.+$', guest_says))
    if not guest_trail:
        return {
            "rule": "clarification_exception",
            "passed": None,
            "evidence": "Not applicable (guest wasn't trailing off)"
        }

    has_single_question = any(re.search(p, output, re.IGNORECASE) for p in SINGLE_QUESTION_PATTERNS)
    has_question_mark = '?' in output
    has_multiple_questions = len(re.findall(r'\?', output)) > 1
    has_filler = any(re.search(p, output, re.IGNORECASE) for p in FILLER_PATTERNS)
    has_capabilities = any(re.search(p, output, re.IGNORECASE) for p in CAPABILITY_PATTERNS)

    if has_multiple_questions:
        return {
            "rule": "clarification_exception",
            "passed": False,
            "evidence": "Asked multiple questions instead of one clarifying question"
        }
    if has_capabilities:
        return {
            "rule": "clarification_exception",
            "passed": False,
            "evidence": "Relisted capabilities instead of asking a single clarifying question"
        }
    if has_single_question and not has_filler:
        return {
            "rule": "clarification_exception",
            "passed": True,
            "evidence": "Correctly asks a single clarifying question without filler"
        }
    if has_question_mark and has_filler:
        return {
            "rule": "clarification_exception",
            "passed": None,
            "evidence": "Has question but with filler — acceptable for this exception but marginal"
        }
    if has_question_mark:
        return {
            "rule": "clarification_exception",
            "passed": True,
            "evidence": "Asks a single clarifying question"
        }
    return {
        "rule": "clarification_exception",
        "passed": None,
        "evidence": "UNCLEAR: Guest trailed off but response unclear. Review manually."
    }


# ─── Rule Registry ──────────────────────────────────────────────────────────

RULES = {
    "language_english": _language_match,
    "language_hindi": _language_match,
    "language_telugu": _language_match,
    "language_code_switch": _language_match,
    "language_no_formal": _language_match,
    "language_default_telugu": _language_match,
    "no_trailing_question": _no_trailing_question,
    "no_filler": _no_filler,
    "stop_generating": _no_filler,  # Same check — stop = no filler
    "hardware_brief": _hardware_brief,
    "first_greeting_only": _first_greeting_only,
    "no_greeting_repeat": _no_greeting_repeat,
    "direct_answer": _direct_answer,
    "night_mode": _night_mode,
    "implicit_command": _implicit_command,
    "compound_command": _compound_command,
    "domain_boundary": _domain_boundary,
    "emergency_referral": _emergency_referral,
    "hardware_failure_graceful": _hardware_failure_graceful,
    "unsupported_request_handling": _unsupported_request_handling,
    "clarification_exception": _clarification_exception,
}


# ─── Main API ───────────────────────────────────────────────────────────────


def check_transcript(
    output_text: str,
    turn_info: Optional[Dict[str, Any]] = None,
    applicable_rules: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Run all applicable rules against a Gemini output transcript.

    Args:
        output_text: The full Gemini response text
        turn_info: Dict with turn context (turn_num, guest_says, context, etc.)
        applicable_rules: List of rule IDs to check (from scenarios.json)

    Returns:
        List of result dicts: {rule, passed (bool|None), evidence (str)}
    """
    if not output_text or not output_text.strip():
        return [{"rule": r, "passed": False, "evidence": "Empty transcript"} for r in (applicable_rules or ["unknown"])]

    turn_info = turn_info or {}
    turn_num = turn_info.get("turn_num", 1)
    turn_id = turn_info.get("id", "")
    guest_says = turn_info.get("guest_says", "")

    results = []

    for rule_id in (applicable_rules or []):
        handler = RULES.get(rule_id)
        if not handler:
            results.append({
                "rule": rule_id,
                "passed": None,
                "evidence": f"Unknown rule: {rule_id}"
            })
            continue

        # Detect language for language_* rules
        expected_lang = None
        if rule_id.startswith("language_"):
            expected_lang = rule_id.replace("language_", "")
            # Detect what language the guest spoke
            if guest_says:
                guest_lang = detect_language(guest_says)
            else:
                guest_lang = "en"

            result = handler(
                output_text,
                expected=expected_lang,
                turn_id=turn_id,
                turn_num=turn_num,
                guest_lang=guest_lang,
                guest_says=guest_says,
            )

            # Override: if rule_id is language_english but we need to detect from guest
            if rule_id == "language_code_switch":
                # Code-switch: guest mixed, check if response matches
                result = handler(
                    output_text,
                    expected="code_switch",
                    turn_id=turn_id,
                    turn_num=turn_num,
                    guest_lang=detect_language(guest_says) if guest_says else "en",
                    guest_says=guest_says,
                )
            elif expected_lang in ("english", "hindi", "telugu"):
                # Map friendly names
                lang_map = {"english": "en", "hindi": "hi", "telugu": "te"}
                result = handler(
                    output_text,
                    expected=lang_map.get(expected_lang, expected_lang),
                    turn_id=turn_id,
                    turn_num=turn_num,
                    guest_says=guest_says,
                )
        else:
            result = handler(
                output_text,
                turn_id=turn_id,
                turn_num=turn_num,
                guest_says=guest_says,
            )

        results.append(result)

    return results


def check_scenario_turn(
    output_text: str,
    turn: Dict[str, Any],
    turn_index: int,
) -> Dict[str, Any]:
    """
    Run all rules for a single turn and return structured result.

    Args:
        output_text: Gemini's response text
        turn: Turn definition from scenarios.json
        turn_index: 0-based index

    Returns:
        Dict with turn_id, rules_results, overall_pass
    """
    turn_info = {
        "id": turn.get("id", f"turn-{turn_index + 1}"),
        "turn_num": turn_index + 1,
        "guest_says": turn.get("guest_says", ""),
        "context": turn.get("context", ""),
    }

    rule_results = check_transcript(output_text, turn_info, turn.get("rules", []))

    # Determine overall pass for this turn
    failures = [r for r in rule_results if r.get("passed") is False]
    unknowns = [r for r in rule_results if r.get("passed") is None]

    return {
        "turn_id": turn_info["id"],
        "turn_num": turn_info["turn_num"],
        "guest_says": turn_info["guest_says"],
        "assistant_response": output_text,
        "context": turn_info["context"],
        "rules": rule_results,
        "failures": len(failures),
        "unknowns": len(unknowns),
        "overall_pass": len(failures) == 0,
        "has_unknowns": len(unknowns) > 0,
    }


def generate_trend_analysis(turn_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze trends across turns in a scenario.

    Returns:
        Dict with trend observations
    """
    if not turn_results:
        return {"trends": [], "overall_verdict": "no_data"}

    total_failures = sum(t["failures"] for t in turn_results)
    total_turns = len(turn_results)
    pass_rate = sum(1 for t in turn_results if t["overall_pass"]) / total_turns

    # Track specific rule failures across turns
    rule_tracker = {}  # rule -> [pass, fail, unknown]
    for t in turn_results:
        for r in t["rules"]:
            rid = r["rule"]
            if rid not in rule_tracker:
                rule_tracker[rid] = {"pass": 0, "fail": 0, "unknown": 0}
            status = r.get("passed")
            if status is True:
                rule_tracker[rid]["pass"] += 1
            elif status is False:
                rule_tracker[rid]["fail"] += 1
            else:
                rule_tracker[rid]["unknown"] += 1

    # Identify failing rules
    failing_rules = {k: v for k, v in rule_tracker.items() if v["fail"] > 0}

    trend_notes = []
    if pass_rate < 0.8:
        trend_notes.append(f"⚠️ Overall pass rate {pass_rate:.0%} — needs attention")
    if failing_rules:
        for rule, counts in sorted(failing_rules.items()):
            trend_notes.append(f"  ❌ {rule}: failed {counts['fail']}/{sum(counts.values())} checks")
    if pass_rate == 1.0:
        trend_notes.append("✅ All turns passed all checks")

    # Check for deterioration (later turns worse than earlier)
    if total_turns >= 3:
        mid = total_turns // 2
        first_half = sum(t["failures"] for t in turn_results[:mid])
        second_half = sum(t["failures"] for t in turn_results[mid:])
        if second_half > first_half:
            trend_notes.append(f"⚠️ Degradation detected: {second_half} failures in later turns vs {first_half} in early turns")
        elif second_half < first_half:
            trend_notes.append(f"✅ Improvement: fewer failures in later turns ({second_half} vs {first_half})")

    return {
        "total_turns": total_turns,
        "total_failures": total_failures,
        "pass_rate": pass_rate,
        "failing_rules": failing_rules,
        "rule_tracker": rule_tracker,
        "trend_notes": trend_notes,
        "overall_verdict": "pass" if (pass_rate >= 0.8 and not failing_rules) else "review_needed",
    }


def format_human_readable(results: Dict[str, Any]) -> str:
    """Format compliance results for human review."""
    lines = []
    lines.append(f"\n{'─'*60}")
    lines.append(f"  Turn {results['turn_num']}: {results['turn_id']}")
    lines.append(f"  Guest said: \"{results['guest_says']}\"")
    lines.append(f"  Context: {results['context']}")
    lines.append(f"{'─'*60}")

    for r in results["rules"]:
        status = "✅" if r.get("passed") is True else ("❌" if r.get("passed") is False else "❓")
        lines.append(f"  {status} {r['rule']:<30s} {r['evidence']}")

    if results["failures"] > 0:
        lines.append(f"  !! {results['failures']} rule(s) FAILED this turn")
    if results["has_unknowns"]:
        lines.append(f"  ?? {results['unknowns']} rule(s) need manual review")

    return "\n".join(lines)


# ─── CLI ────────────────────────────────────────────────────────────────────


def main():
    """Run compliance check on a single transcript from command line."""
    import argparse
    parser = argparse.ArgumentParser(description="Check transcript compliance")
    parser.add_argument("--transcript", "-t", help="Transcript text to check")
    parser.add_argument("--file", "-f", help="File containing transcript")
    parser.add_argument("--rules", "-r", nargs="+", default=["no_trailing_question"],
                        help="Rules to check (default: no_trailing_question)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    if args.file:
        with open(args.file) as f:
            text = f.read().strip()
    elif args.transcript:
        text = args.transcript
    else:
        text = input("Paste transcript text (Ctrl+D to end):\n").strip()

    results = check_transcript(text, {"turn_num": 1}, args.rules)

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        for r in results:
            icon = "✅" if r["passed"] is True else ("❌" if r["passed"] is False else "❓")
            print(f"  {icon} {r['rule']}: {r['evidence']}")


if __name__ == "__main__":
    main()
