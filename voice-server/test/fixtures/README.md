# Test Audio Fixtures

Generated TTS audio clips for testing the Gemini voice pipeline language detection.

| File | Language | Expected Code | Generated With | Status |
|------|----------|---------------|----------------|--------|
| test_en.wav | English | `en` | Piper en_US-amy-medium | ✅ Passes |
| test_hi.wav | Hindi | `hi` | Piper hi_IN-priyamvada-medium | ✅ Passes |
| test_te.wav | Telugu | `te` | Piper te_IN-maya-medium | ✅ Passes with Gemini (handles code-switching natively) |

These fixtures are used by `test/language-detection.test.js` (E2E, requires GEMINI_API_KEY + running server) and `test/replay.test.js`.
