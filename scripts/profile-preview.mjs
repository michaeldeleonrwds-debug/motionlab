import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await context.route('**/api/mcp/bridge-stream', route => route.abort());
  await context.route('**/api/mcp/sync-state', route => route.fulfill({ json: { ok: true } }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:5170/');
  await page.waitForFunction(() => window.__MOTIONLAB_STORE__?.getState().projectList.length);
  await page.evaluate(async () => {
    const { buildAngoraWorldclass } = await import('/src/engine/angoraWorldclass.ts');
    const project = await buildAngoraWorldclass();
    window.__MOTIONLAB_STORE__.setState({ project, currentTime: 0, isPlaying: false, selectedClipId: null });
    await document.fonts.ready;
  });
  await page.waitForTimeout(1500);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const before = await cdp.send('Performance.getMetrics');
  await page.evaluate(() => {
    window.__profile = { frames: [], longTasks: [], last: 0 };
    const loop = now => {
      if (window.__profile.last) window.__profile.frames.push(now - window.__profile.last);
      window.__profile.last = now;
      window.__profile.raf = requestAnimationFrame(loop);
    };
    window.__profile.observer = new PerformanceObserver(list => {
      window.__profile.longTasks.push(...list.getEntries().map(e => e.duration));
    });
    window.__profile.observer.observe({ type: 'longtask', buffered: false });
    window.__profile.raf = requestAnimationFrame(loop);
    window.__MOTIONLAB_STORE__.getState().togglePlayPause();
  });
  const memorySamples = [];
  const rounds = Number(process.env.PROFILE_ROUNDS || 1);
  for (let round = 0; round < rounds; round++) {
    if (round > 0) await page.evaluate(() => window.__MOTIONLAB_STORE__.setState({ currentTime: 0, isPlaying: true }));
    await page.waitForTimeout(Number(process.env.PROFILE_MS || 12000));
    if (rounds > 1) {
      await cdp.send('HeapProfiler.collectGarbage');
      const snapshot = await cdp.send('Performance.getMetrics');
      memorySamples.push(Object.fromEntries(snapshot.metrics.filter(m => ['JSHeapUsedSize', 'Nodes'].includes(m.name)).map(m => [m.name, m.value])));
    }
  }
  const after = await cdp.send('Performance.getMetrics');
  const data = await page.evaluate(() => {
    window.__MOTIONLAB_STORE__.getState().setIsPlaying(false);
    cancelAnimationFrame(window.__profile.raf);
    window.__profile.observer.disconnect();
    const frames = window.__profile.frames.sort((a, b) => a - b);
    return {
      playhead: window.__MOTIONLAB_STORE__.getState().currentTime,
      clips: window.__MOTIONLAB_STORE__.getState().project.clips.length,
      frameCount: frames.length,
      p95FrameMs: frames[Math.floor(frames.length * .95)],
      longTasks: window.__profile.longTasks.length,
      longTaskMs: window.__profile.longTasks.reduce((a, b) => a + b, 0),
      images: document.images.length,
      nodes: document.querySelectorAll('*').length,
    };
  });
  const pick = result => Object.fromEntries(result.metrics.filter(m => ['JSHeapUsedSize','JSHeapTotalSize','TaskDuration','RecalcStyleDuration','LayoutDuration','Nodes'].includes(m.name)).map(m => [m.name, m.value]));
  const dimensions = await page.evaluate(async () => {
    const { renderCompositionAtTime } = await import('/src/engine/compositionRenderer.ts');
    const canvas = document.createElement('canvas');
    renderCompositionAtTime(canvas.getContext('2d'), window.__MOTIONLAB_STORE__.getState().project, 1, { videoElements: new Map(), imageElements: new Map() });
    const fullResolution = [canvas.width, canvas.height];
    const preview = document.querySelector('[data-testid="preview-canvas"]');
    return { fullResolution, preview: [preview.width, preview.height] };
  });
  if (dimensions.fullResolution.join('x') !== '1080x1920') throw new Error('Export resolution changed');
  console.log(JSON.stringify({ label: process.argv[2] || 'profile', ...data, dimensions, memorySamples, before: pick(before), after: pick(after), errors }));
} finally { await browser.close(); }
