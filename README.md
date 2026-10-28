# MotionLab — Professional Browser-Based Nonlinear Video Editor

MotionLab is a desktop-class nonlinear video editing (NLE) application running in the browser, inspired by the editing workflows of CapCut Desktop, Adobe Premiere Pro, and DaVinci Resolve.

## Architecture Overview

1. **Deterministic Nonlinear Timeline Engine (`src/engine/timelineEngine.ts`)**
   - Distinguishes source media time (`inPoint`, `outPoint`, `sourceDuration`) from timeline position (`startTime`, `duration`), playback speed (`0.25x`–`4.0x`), track order, and bottom-to-top painter's algorithm layer compositing order (`getCompositedVisualClipsAtTime`).
   - Supports frame-accurate SMPTE timecode (`HH:MM:SS:FF`), left/right clip trimming with source boundary clamping and keyframe shifting, splitting at playhead, clip duplication, magnetic snapping to playhead and clip boundaries, and adjacent clip transition detection.

2. **Keyframe Interpolation & Motion Graphics Engine (`src/engine/keyframeEngine.ts`)**
   - Time-based keyframe interpolation for `x`, `y`, `scale`, `rotation`, and `opacity` with `linear`, `ease-in`, `ease-out`, and `ease-in-out` curves.
   - Deterministic text motion graphics evaluator supporting `fade-in`, `fade-out`, `slide-in`, `slide-out`, `zoom-in`, and `typewriter`.

3. **Unified Canvas 2D Composition Renderer (`src/engine/compositionRenderer.ts`)**
   - Shared rendering pipeline used by **both** the live interactive Program Monitor and the frame-by-frame MP4 Export Engine so preview and exported video match pixel-for-pixel.
   - Supports multi-track visual compositing, non-destructive cropping, horizontal/vertical flips, color grading & optical effects (`brightness`, `contrast`, `saturation`, `exposure`, `blur`, `grayscale`, `sepia`), multi-line styled titles (stroke, drop shadow, background plate, alignment), transitions (`cross-dissolve`, `fade-from-black`, `fade-to-black`, `slide-left`, `wipe-right`), and broadcast safe-area guides (90% Action Safe & 80% Title Safe).

4. **Audio Engine & Offline WAV Mixer (`src/engine/audioEngine.ts` & `src/workers/waveformWorker.ts`)**
   - Real-time audio/video synchronization with per-clip volume (`0%`–`200%`), clip mute, track mute, and linear fade-in/fade-out envelopes.
   - Web Worker (`waveformWorker.ts`) computes normalized RMS/peak waveform arrays on import.
   - `OfflineAudioContext` mixes all active audio tracks and video audio streams into a sample-accurate 44.1 kHz 16-bit stereo PCM WAV stream during export.

5. **Real MP4 Export Pipeline (`src/engine/exportEngine.ts` & `server/ffmpegPlugin.ts`)**
   - Renders each composition frame deterministically at target resolution (`1080p` or `720p`) and frame rate (`24`, `30`, or `60` FPS), mixes multitrack audio via `OfflineAudioContext`, and pipes frames + audio into a local FFmpeg child process (`libx264` + `aac` + `+faststart`) integrated directly into the Vite server (`/api/export/*`).
   - Supports real-time frame progress reporting, mid-render cancellation (`SIGKILL`), in-modal `<video>` playback verification, and `ffprobe` stream inspection.

6. **Local-First IndexedDB Persistence (`src/storage/projectStorage.ts`)**
   - Persists project metadata, tracks, clips, keyframes, transitions, effects, and imported media `Blob` binaries in IndexedDB (`motionlab-nle-db`) with automatic hydration on page reload.

## Local Setup & Commands

```bash
# Install dependencies
npm install

# Generate local test media fixtures (MP4s, WAV, PNG, invalid codec test file)
npm run generate:fixtures

# Start development server (includes built-in FFmpeg export API middleware)
npm run dev

# Run unit tests (Vitest)
npm test

# Run end-to-end browser acceptance tests (Playwright)
npm run test:e2e

# Build for production
npm run build
```

## Supported Formats & Documented Limitations

- **Supported Import Containers/Codecs**:
  - Video: `.mp4` (H.264/AVC, VP9, AV1 where browser-supported), `.webm` (VP8/VP9), `.mov` (H.264/AAC where supported by browser media decoder).
  - Audio: `.mp3`, `.wav` (PCM).
  - Image: `.png`, `.jpg`/`.jpeg`, `.webp`.
- **Codec Verification**: MotionLab never claims a file is supported merely because its file extension is recognized. Every imported file undergoes actual media stream decoding and frame/audio verification before admission to the Media Library. Unsupported bitstreams (e.g., Apple ProRes `.mov` on browsers without ProRes decoders, or corrupted containers) are rejected with an explicit diagnostic error banner.
- **Browser & Rendering Limitations**:
  - Canvas 2D `ctx.filter` is supported in modern Chromium, Firefox, and Safari 18+; on older WebKit versions without `ctx.filter`, transform, opacity, crop, transitions, and text rendering remain identical while CSS filter adjustments gracefully fall back.
  - Full H.264 + AAC `.mp4` export uses the integrated Vite/Node FFmpeg render middleware (`server/ffmpegPlugin.ts`), requiring `ffmpeg` and `ffprobe` on the host `PATH`.
