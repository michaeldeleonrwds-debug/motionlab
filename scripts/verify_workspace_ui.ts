import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function captureWorkspaces() {
  const outDir = path.join(process.cwd(), 'public', 'exports');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  // 1. 1920x1080 Desktop Workstation
  console.log('--- Capturing 1920x1080 Workspaces ---');
  const page1080 = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });

  await page1080.goto('http://127.0.0.1:5170', { waitUntil: 'networkidle' });
  await page1080.waitForTimeout(1000);

  // EDIT workspace
  await page1080.screenshot({
    path: path.join(outDir, 'v4-workspace-edit-1920x1080.png'),
  });
  console.log('Captured: v4-workspace-edit-1920x1080.png');

  // Open Effects Browser in Edit Workspace
  const effectsTab = page1080.locator('[data-testid="left-tab-effects"]');
  if (await effectsTab.count() > 0) {
    await effectsTab.click();
    await page1080.waitForTimeout(400);
    await page1080.screenshot({
      path: path.join(outDir, 'v4-effects-browser-1920x1080.png'),
    });
    console.log('Captured: v4-effects-browser-1920x1080.png');
  }

  // Open Command Palette
  const cmdPaletteBtn = page1080.locator('[data-testid="command-palette-btn"]');
  if (await cmdPaletteBtn.count() > 0) {
    await cmdPaletteBtn.click();
    await page1080.waitForTimeout(400);
    await page1080.screenshot({
      path: path.join(outDir, 'v4-command-palette-1920x1080.png'),
    });
    console.log('Captured: v4-command-palette-1920x1080.png');
    await page1080.keyboard.press('Escape');
    await page1080.waitForTimeout(200);
  }

  // COLOR workspace
  const colorTab = page1080.locator('[data-testid="workspace-tab-color"]');
  if (await colorTab.count() > 0) {
    await colorTab.click();
    await page1080.waitForTimeout(600);
    await page1080.screenshot({
      path: path.join(outDir, 'v4-workspace-color-1920x1080.png'),
    });
    console.log('Captured: v4-workspace-color-1920x1080.png');
  }

  // AUDIO workspace
  const audioTab = page1080.locator('[data-testid="workspace-tab-audio"]');
  if (await audioTab.count() > 0) {
    await audioTab.click();
    await page1080.waitForTimeout(600);
    await page1080.screenshot({
      path: path.join(outDir, 'v4-workspace-audio-1920x1080.png'),
    });
    console.log('Captured: v4-workspace-audio-1920x1080.png');
  }

  // AI workspace
  const aiTab = page1080.locator('[data-testid="workspace-tab-ai"]');
  if (await aiTab.count() > 0) {
    await aiTab.click();
    await page1080.waitForTimeout(600);
    await page1080.screenshot({
      path: path.join(outDir, 'v4-workspace-ai-1920x1080.png'),
    });
    console.log('Captured: v4-workspace-ai-1920x1080.png');
  }

  await page1080.close();

  // 2. 1440x900 Laptop
  console.log('--- Capturing 1440x900 Laptop ---');
  const page900 = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await page900.goto('http://127.0.0.1:5170', { waitUntil: 'networkidle' });
  await page900.waitForTimeout(800);
  await page900.locator('[data-testid="workspace-tab-edit"]').click();
  await page900.waitForTimeout(300);
  await page900.screenshot({
    path: path.join(outDir, 'v4-workspace-edit-1440x900.png'),
  });
  console.log('Captured: v4-workspace-edit-1440x900.png');
  await page900.close();

  // 3. 1366x768 Standard Screen
  console.log('--- Capturing 1366x768 Standard Laptop ---');
  const page768 = await browser.newPage({
    viewport: { width: 1366, height: 768 },
  });
  await page768.goto('http://127.0.0.1:5170', { waitUntil: 'networkidle' });
  await page768.waitForTimeout(800);
  await page768.locator('[data-testid="workspace-tab-edit"]').click();
  await page768.waitForTimeout(300);
  await page768.screenshot({
    path: path.join(outDir, 'v4-workspace-edit-1366x768.png'),
  });
  console.log('Captured: v4-workspace-edit-1366x768.png');
  await page768.close();

  await browser.close();
  console.log('All visual verification captures completed successfully!');
}

captureWorkspaces().catch((err) => {
  console.error('Error in captureWorkspaces:', err);
  process.exit(1);
});
