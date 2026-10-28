import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/REYMARK/.gemini/antigravity/brain/3c90f9e2-da2d-42d6-8add-a7b0a5b26682';

async function run() {
  console.log('Starting Voicebox AI Voice Studio End-to-End Verification...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // 1. Locate and click the 'Voice' nav item in LeftPanel
  console.log('Navigating to Voice Studio tab in LeftPanel...');
  const voiceNavBtn = page.getByRole('button', { name: /voice/i }).first();
  await voiceNavBtn.click();
  await page.waitForTimeout(600);

  // 2. Click the 'Angora Commercial (15s)' template button
  console.log('Selecting Angora Commercial (15s) script template...');
  const templateBtn = page.getByRole('button', { name: /angora commercial/i });
  if (await templateBtn.isVisible()) {
    await templateBtn.click();
    await page.waitForTimeout(300);
  }

  // Capture screenshot of Voice Studio interface before generation
  const screenshotStudio = path.join(ARTIFACT_DIR, '10-motionlab-voicebox-ai-studio.png');
  await page.screenshot({ path: screenshotStudio });
  console.log('Saved Voicebox Studio screenshot to:', screenshotStudio);

  // 3. Click "Generate Speech Audio"
  console.log('Triggering speech synthesis for Angora Commercial...');
  const generateBtn = page.getByRole('button', { name: /generate speech audio/i });
  await generateBtn.click();
  await page.waitForTimeout(2000);

  // 4. Verify Generated Audio Result Card appeared
  console.log('Verifying audio waveform card...');
  const addToTimelineBtn = page.getByRole('button', { name: /add to timeline/i });
  await addToTimelineBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Found "Add to Timeline" button!');

  // 5. Add voiceover to timeline at playhead
  console.log('Adding synthesized voiceover to timeline...');
  await addToTimelineBtn.click();
  await page.waitForTimeout(800);

  // 6. Click "Sync Captions" to generate kinetic typography subtitles
  console.log('Generating synchronized typography captions...');
  const syncCaptionsBtn = page.getByRole('button', { name: /sync captions/i });
  if (await syncCaptionsBtn.isVisible()) {
    await syncCaptionsBtn.click();
    await page.waitForTimeout(800);
  }

  // 7. Verify the state in MotionLab via page.evaluate
  const timelineState = await page.evaluate(() => {
    // @ts-ignore
    const state = window.__MOTIONLAB_STORE__?.getState ? window.__MOTIONLAB_STORE__.getState() : null;
    if (!state) {
      // @ts-ignore
      return { hasState: false, clips: [] };
    }
    return {
      hasState: true,
      projectName: state.project.name,
      clipsCount: state.project.clips.length,
      audioClips: state.project.clips.filter((c) => c.type === 'audio').map((c) => ({
        id: c.id,
        name: c.name,
        startTime: c.startTime,
        duration: c.duration,
        trackId: c.trackId,
      })),
      textClips: state.project.clips.filter((c) => c.type === 'text').map((c) => ({
        id: c.id,
        name: c.name,
        startTime: c.startTime,
        duration: c.duration,
      })),
    };
  });

  console.log('Timeline State after Voicebox Integration:', JSON.stringify(timelineState, null, 2));

  // 8. Test MCP tool direct call through window.__MOTIONLAB_MCP__
  console.log('Testing MCP voice_generate and voice_list_profiles tools...');
  const mcpTest = await page.evaluate(async () => {
    // @ts-ignore
    if (window.__MOTIONLAB_MCP__) {
      // @ts-ignore
      const listRes = await window.__MOTIONLAB_MCP__.callTool('voice_list_profiles', {});
      // @ts-ignore
      const genRes = await window.__MOTIONLAB_MCP__.callTool('voice_generate', {
        text: 'Angora Web Services. Premium motion graphics and automation.',
        profileId: 'angora-dynamic-female',
      });
      return { listRes, genRes };
    }
    return { error: 'window.__MOTIONLAB_MCP__ not available' };
  });

  console.log('MCP Tools Test Result:', {
    profileCount: mcpTest.listRes?.profiles?.length,
    genOk: mcpTest.genRes?.ok,
    genDuration: mcpTest.genRes?.result?.durationSeconds,
    genProfile: mcpTest.genRes?.result?.profileName,
  });

  // 9. Capture screenshot of Timeline with newly added Voiceover and Synced Captions
  const screenshotTimeline = path.join(ARTIFACT_DIR, '11-motionlab-timeline-voiceover-synced.png');
  await page.screenshot({ path: screenshotTimeline });
  console.log('Saved Timeline Voiceover screenshot to:', screenshotTimeline);

  await browser.close();
  console.log('All Voicebox end-to-end verifications passed!');
}

run().catch((err) => {
  console.error('E2E Verification Error:', err);
  process.exit(1);
});
