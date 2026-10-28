import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACT_DIR = 'C:\\Users\\REYMARK\\.gemini\\antigravity\\brain\\3c90f9e2-da2d-42d6-8add-a7b0a5b26682';

const RESOLUTIONS = [
  { width: 1366, height: 768, name: '1366x768' },
  { width: 1440, height: 900, name: '1440x900' },
  { width: 1920, height: 1080, name: '1920x1080' },
  { width: 2560, height: 1440, name: '2560x1440' },
];

async function runVisualVerification() {
  console.log('=== STARTING PROGRAM MONITOR RESPONSIVE VISUAL VERIFICATION ===');
  const browser = await chromium.launch({ headless: true });

  for (const res of RESOLUTIONS) {
    console.log(`\nTesting Resolution: ${res.name} (${res.width}x${res.height})...`);
    const page = await browser.newPage({
      viewport: { width: res.width, height: res.height },
    });

    await page.goto('http://127.0.0.1:5170', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 1. Verify Program Monitor exists
    const monitorContainer = page.locator('[data-testid="center-preview-container"]');
    await monitorContainer.waitFor({ state: 'visible' });

    // 2. Read canvas element and bounding box
    const canvas = page.locator('[data-testid="preview-canvas"]');
    await canvas.waitFor({ state: 'visible' });
    const box = await canvas.boundingBox();
    console.log(`   [${res.name}] Canvas Box: width=${box?.width?.toFixed(1)}px, height=${box?.height?.toFixed(1)}px`);

    // 3. Capture normal workspace screenshot
    const normalPath = path.join(ARTIFACT_DIR, `v4-monitor-normal-${res.name}.png`);
    await page.screenshot({ path: normalPath });
    console.log(`   Captured: ${normalPath}`);

    // 4. Test 100% Zoom
    const zoomSelect = page.locator('[data-testid="canvas-zoom-select"]');
    await zoomSelect.selectOption('100');
    await page.waitForTimeout(500);
    const box100 = await canvas.boundingBox();
    console.log(`   [${res.name}] 100% Zoom Box: width=${box100?.width?.toFixed(1)}px, height=${box100?.height?.toFixed(1)}px`);

    // Reset back to Fit
    await zoomSelect.selectOption('fit');
    await page.waitForTimeout(500);

    // 5. Test Focus Mode (F key)
    console.log(`   Testing Focus Mode toggle...`);
    const focusBtn = page.locator('[data-testid="toggle-focus-mode-btn"]');
    await focusBtn.click();
    await page.waitForTimeout(800);

    const focusCanvasBox = await canvas.boundingBox();
    console.log(`   [${res.name}] Focus Mode Canvas Box: width=${focusCanvasBox?.width?.toFixed(1)}px, height=${focusCanvasBox?.height?.toFixed(1)}px`);
    
    // Capture focus mode screenshot
    const focusPath = path.join(ARTIFACT_DIR, `v4-monitor-focus-${res.name}.png`);
    await page.screenshot({ path: focusPath });
    console.log(`   Captured Focus Mode: ${focusPath}`);

    // Exit Focus Mode via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await page.close();
  }

  await browser.close();
  console.log('\n=== VISUAL VERIFICATION COMPLETE! ALL SCREENSHOTS SAVED ===');
}

runVisualVerification().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
