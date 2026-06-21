# Test Audio Fixtures

Generated TTS audio clips for testing the STT language detection pipeline.

| File | Language | Expected Code | Generated With | Status |
|------|----------|---------------|----------------|--------|
| test_en.wav | English | `en` | Piper en_US-amy-medium | ✅ Passes |
| test_hi.wav | Hindi | `hi` | Piper hi_IN-priyamvada-medium | ✅ Passes |
| test_te.wav | Telugu | `te` | Piper te_IN-maya-medium | ⚠️ Piper's synthetic Telugu output is not recognized as Telugu by Whisper (detected as Gujarati/Tamil/Russian/Japanese depending on phrase). Real human Telugu speech works correctly. |

**Regenerate**: Run `voice-server/scripts/generate_test_fixtures.sh`
