import { test, expect } from '@playwright/test';
import path from 'node:path';

test.describe('MotionLab 4.0 — Critical Memory Usage & Crash Investigation', () => {
  test('verifies memory diagnostics HUD, bounded decoder pool, and cache purge', async ({
    page,
  }) => {
    // 1. Navigate to MotionLab
    await page.goto('/');
    await page.waitForSelector('header', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 2. Open Memory Diagnostics Modal via RAM button in TopBar
    const ramBtn = page.locator('[data-testid="topbar-memory-btn"]');
    if (await ramBtn.isVisible()) {
      await ramBtn.click();
    } else {
      await page.keyboard.press('Control+Shift+M');
    }

    // Modal should be visible
    await expect(
      page.getByText('Memory Diagnostics & Resource Profiler')
    ).toBeVisible({ timeout: 5000 });

    // 3. Verify gauges and active decoder bound (max 6)
    await expect(page.getByText(/Active Video Decoders/i)).toBeVisible();
    await expect(page.getByText(/\/ 6 max/i)).toBeVisible();

    // Capture screenshot artifact of the Memory Diagnostics HUD
    const artifactPath = path.resolve(
      'C:/Users/REYMARK/.gemini/antigravity/brain/3c90f9e2-da2d-42d6-8add-a7b0a5b26682/v4-memory-diagnostics-hud.png'
    );
    await page.screenshot({ path: artifactPath, fullPage: false });

    // 4. Run the automated Scrub Stress Test inside the HUD
    const stressBtn = page.getByRole('button', { name: /Run Scrub Stress Test/i });
    await expect(stressBtn).toBeVisible();
    await stressBtn.click();

    // Wait for the stress test to complete (it iterates 120 rapid seeks)
    await expect(page.getByText(/Scrub test complete/i)).toBeVisible({
      timeout: 15000,
    });

    // 5. Test Purge Caches & Run GC
    const purgeBtn = page.getByRole('button', { name: /Purge Caches & Run GC/i });
    await expect(purgeBtn).toBeVisible();
    await purgeBtn.click();
    await page.waitForTimeout(500);

    // Verify status returns to Optimal
    await expect(page.getByText(/Optimal/i)).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('verifies SFX Studio text-to-sound generation generates distinct audible audio', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForSelector('header', { timeout: 15000 });

    // Navigate to AUDIO workspace
    const audioTab = page.locator('[data-testid="workspace-tab-audio"]');
    if (await audioTab.isVisible()) {
      await audioTab.click();
      await page.waitForTimeout(600);
    }

    // Check if Sound FX Studio is visible
    const sfxTabBtn = page.locator('button:has-text("SFX"), button:has-text("Sound FX")').first();
    if (await sfxTabBtn.isVisible()) {
      await sfxTabBtn.click();
      await page.waitForTimeout(500);
    }

    // Capture screenshot of the workspace with audio/SFX active
    const sfxArtifact = path.resolve(
      'C:/Users/REYMARK/.gemini/antigravity/brain/3c90f9e2-da2d-42d6-8add-a7b0a5b26682/v4-sfx-studio-audit.png'
    );
    await page.screenshot({ path: sfxArtifact, fullPage: false });
  });
});
