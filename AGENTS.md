# MotionLab 2.0 & HyperFrames — Agent Guidelines

## Architecture Overview
MotionLab is an AI-native browser video editor and motion design studio powered by:
- **Timeline Engine**: Multi-track non-linear editor (video, text, audio, overlay).
- **Compositor**: Frame-accurate HTML5 Canvas2D renderer with cubic-bezier keyframes.
- **Voice Studio**: Voicebox integration for neural TTS and licensed voice profiles.
- **Creative Director (MCIE)**: AI Creative Intelligence Engine with 12 modular skills.
- **HyperFrames Engine**: Deterministic HTML-to-video rendering framework.

---

## Active HyperFrames Skills (`.agents/skills/`)

The following 7 HyperFrames skills are installed and active in this workspace:

1. **`hyperframes`** ([.agents/skills/hyperframes/SKILL.md](file:///c:/Users/REYMARK/Documents/Sites/MotionLab/.agents/skills/hyperframes/SKILL.md)):
   The core render contract: deterministic animation, paused timelines registered in `window.__timelines`, `.clip` elements with `data-start` and `data-duration`.

2. **`hyperframes-cli`** ([.agents/skills/hyperframes-cli/SKILL.md](file:///c:/Users/REYMARK/Documents/Sites/MotionLab/.agents/skills/hyperframes-cli/SKILL.md)):
   CLI commands:
   - `npx hyperframes init <dir>` — Scaffold a new HTML video project
   - `npx hyperframes check --json` — Audit layout, contrast, and reading speed
   - `npx hyperframes snapshot` — Capture inspection frames into `.hyperframes/artifacts/`
   - `npx hyperframes preview --background` — Launch live studio preview
   - `npx hyperframes render --quality looks --output out.mp4` — Render MP4 master

3. **`hyperframes-registry`** ([.agents/skills/hyperframes-registry/SKILL.md](file:///c:/Users/REYMARK/Documents/Sites/MotionLab/.agents/skills/hyperframes-registry/SKILL.md)):
   Curated motion components: kinetic typography, split wipes, filmstrip interfaces, and stat counters.

4. **`media-use`** ([.agents/skills/media-use/SKILL.md](file:///c:/Users/REYMARK/Documents/Sites/MotionLab/.agents/skills/media-use/SKILL.md)):
   Media treatments, film grain, audio ducking (-14dB for voiceover stems), and HeyGen digital avatars.

5. **`figma`** ([.agents/skills/figma/SKILL.md](file:///c:/Users/REYMARK/Documents/Sites/MotionLab/.agents/skills/figma/SKILL.md)):
   Figma design system import, vector styling, and auto-layout animation mapping.

6. **`remotion-to-hyperframes`** ([.agents/skills/remotion-to-hyperframes/SKILL.md](file:///c:/Users/REYMARK/Documents/Sites/MotionLab/.agents/skills/remotion-to-hyperframes/SKILL.md)):
   Translating React/Remotion springs and timelines into deterministic cubic-bezier keyframes.

7. **`slideshow`** ([.agents/skills/slideshow/SKILL.md](file:///c:/Users/REYMARK/Documents/Sites/MotionLab/.agents/skills/slideshow/SKILL.md)):
   Cinematic Ken Burns photo/video pan-zoom generation.
