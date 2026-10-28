import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/REYMARK/.gemini/antigravity/brain/3c90f9e2-da2d-42d6-8add-a7b0a5b26682';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Open Voice tab
  const voiceNavBtn = page.getByRole('button', { name: /voice/i }).first();
  await voiceNavBtn.click();
  await page.waitForTimeout(400);

  // 1. Voice Library Tab
  const libraryTab = page.getByRole('button', { name: /voice library/i });
  await libraryTab.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '12-motionlab-voice-library.png') });

  // 2. Clone Voice Tab
  const cloneTab = page.getByRole('button', { name: /clone voice/i });
  await cloneTab.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '13-motionlab-voice-cloning-consent.png') });

  // 3. DSP Effects Tab
  const effectsTab = page.getByRole('button', { name: /dsp effects/i });
  await effectsTab.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '14-motionlab-voice-dsp-effects.png') });

  await browser.close();
  console.log('Voicebox tabs captured successfully!');
}

run().catch(console.error);
