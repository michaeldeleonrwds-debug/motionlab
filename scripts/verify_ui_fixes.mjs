import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/REYMARK/.gemini/antigravity/brain/3c90f9e2-da2d-42d6-8add-a7b0a5b26682';

async function run() {
  console.log('Capturing screenshots of verified UI fixes...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // 1. Open Voice Studio
  const voiceNavBtn = page.getByRole('button', { name: /voice/i }).first();
  await voiceNavBtn.click();
  await page.waitForTimeout(600);

  // Select Angora script template and generate audio
  const templateBtn = page.getByRole('button', { name: /angora commercial/i });
  if (await templateBtn.isVisible()) {
    await templateBtn.click();
    await page.waitForTimeout(300);
  }

  const generateBtn = page.getByRole('button', { name: /generate speech audio/i });
  await generateBtn.click();
  await page.waitForTimeout(2000);

  // Capture Voice Studio Script Tab (with unclipped Add to Timeline / Sync Captions buttons & Studio Synth (Offline) status)
  const screenshotStudio = path.join(ARTIFACT_DIR, '15-ui-fix-voice-studio-result.png');
  await page.screenshot({ path: screenshotStudio });
  console.log('Saved 15-ui-fix-voice-studio-result.png');

  // 2. Click Voice Library Tab
  const libraryTabBtn = page.getByRole('button', { name: /library/i }).first();
  await libraryTabBtn.click();
  await page.waitForTimeout(500);

  // Capture Voice Library Tab (with single column clean full-width cards)
  const screenshotLibrary = path.join(ARTIFACT_DIR, '16-ui-fix-voice-library-cards.png');
  await page.screenshot({ path: screenshotLibrary });
  console.log('Saved 16-ui-fix-voice-library-cards.png');

  // 3. Add to timeline and inspect a clip to check timeline and inspector
  const scriptTabBtn = page.getByRole('button', { name: /script/i }).first();
  await scriptTabBtn.click();
  await page.waitForTimeout(300);

  const addToTimelineBtn = page.getByRole('button', { name: /add to timeline/i });
  if (await addToTimelineBtn.isVisible()) {
    await addToTimelineBtn.click();
    await page.waitForTimeout(500);
  }

  // Select a clip in timeline to view its inspector with keyframe easing select
  await page.evaluate(() => {
    // @ts-ignore
    const store = window.__MOTIONLAB_STORE__;
    if (store && store.getState) {
      const state = store.getState();
      const clipWithKf = state.project.clips.find((c) => c.keyframes && c.keyframes.length > 0);
      if (clipWithKf) {
        state.selectClip(clipWithKf.id);
      }
    }
  });
  await page.waitForTimeout(600);

  // Scroll timeline down slightly to show synchronized scrolling and header width
  await page.evaluate(() => {
    const lanes = document.querySelector('[data-testid="timeline-lanes"]');
    if (lanes) {
      lanes.scrollTop = 40;
    }
  });
  await page.waitForTimeout(400);

  // Capture full view showing timeline and inspector
  const screenshotTimelineInspector = path.join(ARTIFACT_DIR, '17-ui-fix-timeline-inspector.png');
  await page.screenshot({ path: screenshotTimelineInspector });
  console.log('Saved 17-ui-fix-timeline-inspector.png');

  await browser.close();
  console.log('UI Fixes screenshots successfully captured!');
}

run().catch((err) => {
  console.error('Screenshot Capture Error:', err);
  process.exit(1);
});
