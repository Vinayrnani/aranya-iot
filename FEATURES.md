# Feature Ideas — Viva Voice

> Ideas to refine and revisit later. Not yet implemented.

## WhatsApp Link + Booking-Based Sessions

### Concept
Send each guest a unique link via WhatsApp before check-in:
```
https://viva-voice.app/?booking=RES-ABC123
```
The `bookingId` becomes the key for all state persistence — identity, preferences, conversation history, greeting status.

### What it enables

**1. Guest-aware greeting**
- Booking data ties to guest name, language, room number
- System prompt knows who's talking before they speak
- Preferred language from booking form — no voice detection needed on first use

**2. No repeated greetings (core ask)**
- Server tracks `greeted: true` per bookingId
- Every subsequent visit skips the intro
- Guest opens the link 10 times across their stay — hears "I'm Aranya assistant" exactly once

**3. Persistent conversation**
- Every turn saved server-side with bookingId
- On reconnect, last N exchanges injected into system prompt
- "You asked about pool timings yesterday — they're 6AM-10PM as usual"
- Conversation spans days, survives page reloads and device switches

**4. Guest preferences**
- "Set AC to 24°C" → saved to server
- Next session: system prompt includes `Guest prefers AC at 24°C`
- Preference carries across all sessions and devices

**5. Room-aware controls**
- Controls (lights, AC, fan, ambiance) mapped to the room
- "Your room is currently at 22°C with lights at 40% — same as you left it"
- State restoration across disconnects

**6. Pre-arrival Q&A**
- Link shared 2 days before check-in
- Guest asks about early check-in, breakfast, pool timings
- On arrival: "Before you arrived, you asked about breakfast — buffet runs 7-10AM at The Terrace"

**7. Cross-device continuity**
- Same bookingId on phone (WhatsApp link), room tablet, in-room smart speaker
- Conversation history follows them regardless of device

**8. Post-stay re-engagement**
- Returning guest with new booking but same phone number
- Server maps phone → aggregated history across stays
- "Welcome back! Last time you loved the ocean-view room. Restoring your preferences."

### Architecture sketch

```
Guest taps WhatsApp link
       │
       ▼
Browser ──GET /?booking=RES-ABC123──▶ Server
        ◀── HTML ─────────────────────
               │
Browser ──POST /api/token ──────────▶ Server (reads bookingId from session)
        ◀── token + guest context ────
               │
App injects into system prompt:
  "Guest: Rajesh Sharma, prefers Hindi.
   Already greeted — do not repeat intro.
   Previous conversation: ...
   Preferences: AC at 24°C, warm lighting."
```

### Database model (server-side)

```
bookings:
  id: RES-ABC123
  guest_name: Rajesh Sharma
  language: hi
  room: 204
  greeted: true/false
  preferences: {ac_temp: 24, lights: "warm"}
  created_at, updated_at

conversations:
  id: conv_...
  booking_id: RES-ABC123
  turns: [{input, output, timestamp}, ...]
  saved_at
```

### Open questions
- How to handle link sharing (guest forwards it to family — same bookingId, different person)?
  → Option: PIN or "who is this?" voice detection on first use
- Token expiry vs. long-term context — system prompt length limits
- Data retention: delete after check-out?
- Offline resilience: what if server is unreachable during a turn?

---

## Misc Ideas

- Wake word ("Hey Aranya") for hands-free use in room
- Voice-based room service ordering integrated with PMS
- Multi-room support: guest in Room 204 asks "switch off Room 205 AC"
- IoT device discovery: scan room QR to pair with specific devices
- Push notifications via WhatsApp: "Your cab to the airport departs in 30 mins"
- Emergency: "Help" triggers alert to front desk with room number
