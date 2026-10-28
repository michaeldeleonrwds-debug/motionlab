# Preview performance verification

Measured locally on 2026-10-29 using isolated Chromium storage and the 133-clip Angora production builder. The user's current project was not rebuilt or modified. Browser tests block state sync and the MCP bridge to avoid affecting the live project.

## Changes

- Panels subscribe to their displayed editor fields instead of the entire store.
- The timeline playhead updates independently of clip cards and waveforms. Editing and snapping read the current transport position directly.
- Waveforms retain interval peaks with a pixel-based bar limit. Filmstrips are bounded, use their thumbnail sources, and do not try to decode audio/video files as images.
- The monitor renders at its displayed pixel density, capped at native sequence resolution. Zooming increases its render resolution. The shared renderer defaults to full sequence resolution for export.
- Media elements preload metadata rather than the entire source. Replaced and unmounted decoders release their sources and event handlers.
- Scopes reuse a readback canvas and sample at 10 Hz.
- SSE heartbeat comments keep the MCP proxy connection active and their timers are removed when clients disconnect.

## Playback comparison

Same 12-second interval and 1600×1000 browser viewport; figures vary with hardware and browser load.

| Measurement | Before | After |
| --- | ---: | ---: |
| 95th-percentile animation-frame interval | 100 ms | 16.7 ms |
| Main-thread task duration | 10.58 s | 3.14 s |
| Long tasks | 32 | 1 |
| Total long-task duration | 3658 ms | 140 ms |
| Image elements | 173 | 120 |

## Repeated playback

Three complete 30-second playbacks, sampled after garbage collection at each pass:

| Pass | JavaScript heap | DOM nodes reported by CDP |
| --- | ---: | ---: |
| 1 | 21,515,760 bytes | 3943 |
| 2 | 21,674,960 bytes | 3943 |
| 3 | 21,745,000 bytes | 3943 |

No page errors or crashes. The preview backing buffer was 282×501; a separate default renderer invocation confirmed 1080×1920 output. JavaScript heap does not include all browser process, media decoder, or GPU memory; this check does not establish that every possible source of memory growth has been eliminated.

## Checks

- `npm test`: 104 tests passed.
- `npm run build`: passed; existing bundle-size and mixed-import warnings remain.
- `node scripts/verify-playback.mjs`: button, Space, pause, replay, changing animation frames, and end stopping passed.
- `node scripts/verify-mcp-stream.mjs http://motionlab.test http://localhost:5170`: both remained connected for 75 seconds with four heartbeats. Before the fix, the proxy stream terminated at 60 seconds while the direct stream remained connected.
- `node scripts/profile-preview.mjs`: isolated production benchmark.
- Repeated-playback mode: set `PROFILE_ROUNDS=3` and `PROFILE_MS=31000` before running the profiler.
