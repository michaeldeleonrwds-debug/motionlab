---
name: voice-direction
description: Formulates professional voiceover pacing, tone, pronunciation, and emotion directives for commercial and documentary video production.
version: 1.0.0
category: audio
author: MotionLab AI Audio Systems
---

# Voice Direction Skill

The Voice Direction Skill translates creative briefs and narrative treatments into precisely calibrated speech directives, WPM pacing models, pause punctuation, and post-production audio DSP chains.

## 1. Principles of Commercial Voice Direction

1. **Cadence & Economy**: Commercial speech is measured in words-per-minute (WPM). Standard commercial pacing is 130–140 WPM. Exceeding 160 WPM degrades authority and listener retention unless specifically directed for high-energy social media hooks.
2. **Emphasis Over Volume**: True vocal authority comes from pitch inflection and deliberate micro-pauses before key brand keywords, not shouting or aggressive compression.
3. **Punctuation As Timing**: Periods (`.`) represent 300–400ms breath pauses. Commas (`,`) represent 150–200ms cadence inflections. Em dashes (`—`) represent dramatic narrative pivots.

## 2. Supported Voice Direction Presets

| Preset ID | Category | Target WPM | Recommended Tone | DSP Processing Chain |
|---|---|---|---|---|
| `premium-commercial` | B2B Commercial | 135 WPM | Authoritative baritone / alto, high clarity | 80Hz rumble cut, 3:1 compression, peak -1.0 dBFS |
| `cinematic-trailer` | Film & Showreel | 110 WPM | Deep resonant bass, dramatic pauses | Room reverb (15% wet), 4:1 compression, -22dB threshold |
| `technology-launch` | Tech Product | 140 WPM | Intelligent, modern, confident | Clean presence, 2.5:1 compression, peak -1.0 dBFS |
| `luxury-minimal` | Luxury Brand | 115 WPM | Velvety, intimate, breathy | Subtle room ambience, soft compression |
| `energetic-social` | Social Reels | 165 WPM | Rapid, punchy, high-inflection | Hard limiting, 4.5:1 compression, peak -0.5 dBFS |

## 3. Workflows

### Workflow: `plan_voiceover`
- Inputs: Raw script string, preset ID, scene target duration.
- Outputs: Word count, estimated speech duration, pacing advice, and directed script.

### Workflow: `sync_speech_to_motion`
- Inputs: Generated voice audio result.
- Outputs: Time-aligned sentence cues, motion beat markers, recommended scene cut timestamps, and kinetic caption clips.
