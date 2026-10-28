import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotsDir = path.resolve(__dirname, '../screenshots');
const publicExportDir = path.resolve(__dirname, '../public/angora-assets');
const artifactDir =
  'C:/Users/REYMARK/.gemini/antigravity/brain/3c90f9e2-da2d-42d6-8add-a7b0a5b26682';

fs.mkdirSync(screenshotsDir, { recursive: true });
fs.mkdirSync(publicExportDir, { recursive: true });

test.describe('ANGORA — Agency Promo V2 (15s 9:16 1080x1920 30fps Cinematic Enhancement)', () => {
  test.setTimeout(180000);

  test('Preserves V1, builds V2 with masking & selectable keyframes, scrubs all 4 scenes + 5 service demos, and exports 1080x1920 30fps 15s MP4', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1520, height: 920 });
    await page.goto('/');
    await expect(page.getByTestId('motionlab-app')).toBeVisible();

    // 1. Load ANGORA Promo (saves preserved V1 + activates enhanced V2)
    await page.getByTestId('load-angora-promo-btn').click();

    await expect(page.getByTestId('project-name-display')).toHaveText(
      'ANGORA — Agency Promo V2',
      { timeout: 25000 }
    );
    await expect(page.getByTestId('save-status-indicator')).toContainText('Saved', {
      timeout: 15000,
    });

    // Verify original ANGORA — Agency Promo 2026 is preserved in IndexedDB project list
    await page.getByTestId('open-projects-modal-btn').click();
    await expect(page.getByTestId('project-modal')).toBeVisible();
    await expect(page.getByTestId('project-modal')).toContainText(
      'ANGORA — Agency Promo 2026'
    );
    await expect(page.getByTestId('project-modal')).toContainText(
      'ANGORA — Agency Promo V2'
    );
    await page.getByTestId('close-project-modal-btn').click();

    // 2. Verify Project Configuration: 1080x1920 • 9:16 • 30fps • 00:00:15:00 (450 frames)
    await expect(page.getByTestId('aspect-ratio-select')).toHaveValue('9:16');
    await expect(page.getByTestId('resolution-select')).toHaveValue('1080p');
    await expect(page.getByTestId('fps-select')).toHaveValue('30');
    await expect(page.getByTestId('duration-display')).toHaveText('00:00:15:00');

    const canvasDims = await page.evaluate(() => {
      const c = document.querySelector(
        '[data-testid="preview-canvas"]'
      ) as HTMLCanvasElement | null;
      return c ? { width: c.width, height: c.height } : null;
    });
    expect(canvasDims).toEqual({ width: 1080, height: 1920 });

    // 3. Verify all 8 required timeline tracks exist in exact structure
    const expectedTrackIds = [
      { id: 'track-v3-brand', name: 'V3 — Brand Assets' },
      { id: 'track-v2-graphics', name: 'V2 — Graphic Elements' },
      { id: 'track-v1-bg', name: 'V1 — Backgrounds' },
      { id: 'track-t3-cta', name: 'T3 — Call to Action' },
      { id: 'track-t2-support', name: 'T2 — Supporting Text' },
      { id: 'track-t1-headlines', name: 'T1 — Main Headlines' },
      { id: 'track-a1-music', name: 'A1 — Music' },
      { id: 'track-a2-sfx', name: 'A2 — Sound Effects' },
    ];
    for (const trk of expectedTrackIds) {
      const header = page.getByTestId(`track-header-${trk.id}`);
      await expect(header).toBeVisible();
      await expect(header).toContainText(trk.name);
    }

    // 4. Test Clip Masking & Selectable Keyframe Manual Editing on Scene 01 Symbol
    await page.getByTestId('timeline-clip-clip-s1-symbol').click();
    await expect(page.getByTestId('clip-mask-badge-clip-s1-symbol')).toBeVisible();
    await expect(page.getByTestId('inspector-mask-section')).toBeVisible();
    await expect(page.getByTestId('inspector-mask-shape')).toHaveValue('rectangle');
    await expect(page.getByTestId('keyframe-item-maskWidth').first()).toBeVisible();

    // Click a keyframe item in the Inspector and verify the Selected Keyframe Manual Editor opens
    await page.getByTestId('keyframe-item-scale').first().click();
    await expect(page.getByTestId('selected-keyframe-editor')).toBeVisible();
    await expect(page.getByTestId('keyframe-easing-select')).toHaveValue('cubic-bezier');

    // Verify zero horizontal overflow in RightInspector (Parent Layer select & Keyframe rows stay inside bounds)
    const inspectorBox = await page.getByTestId('right-inspector').boundingBox();
    const parentSelectBox = await page
      .getByTestId('inspector-parent-select')
      .boundingBox();
    expect(inspectorBox).not.toBeNull();
    expect(parentSelectBox).not.toBeNull();
    expect(parentSelectBox!.x + parentSelectBox!.width).toBeLessThanOrEqual(
      inspectorBox!.x + inspectorBox!.width
    );

    // Verify Space key toggles Play and Pause cleanly (even when an Inspector control is focused)
    await page.getByTestId('inspector-parent-select').focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(120);
    await expect(page.getByTestId('play-pause-btn')).toHaveAttribute(
      'title',
      /Pause/i
    );
    await page.keyboard.press('Space');
    await page.waitForTimeout(80);
    await expect(page.getByTestId('play-pause-btn')).toHaveAttribute(
      'title',
      /Play/i
    );

    // Helper to seek deterministically and verify non-black canvas rendering
    const seekAndVerifyScene = async (timeSec: number, screenshotName?: string) => {
      await page.evaluate((t) => {
        const mcp = window.__MOTIONLAB_MCP__;
        if (mcp) {
          void mcp.callTool('command_run', {
            id: 'time.set',
            params: { time: t },
          });
        }
      }, timeSec);
      await page.waitForTimeout(180);

      const pixelStats = await page.evaluate(() => {
        const c = document.querySelector(
          '[data-testid="preview-canvas"]'
        ) as HTMLCanvasElement | null;
        if (!c) return { nonBlackRatio: 0, limePixels: 0 };
        const ctx = c.getContext('2d');
        if (!ctx) return { nonBlackRatio: 0, limePixels: 0 };
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        let nonBlack = 0;
        let lime = 0;
        const step = 16;
        let totalSampled = 0;
        for (let i = 0; i < data.length; i += 4 * step) {
          totalSampled++;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r > 8 || g > 8 || b > 8) nonBlack++;
          if (g > 160 && r > 130 && b < 110) lime++;
        }
        return {
          nonBlackRatio: nonBlack / Math.max(1, totalSampled),
          limePixels: lime,
        };
      });

      expect(pixelStats.nonBlackRatio).toBeGreaterThan(0.5);
      expect(pixelStats.limePixels).toBeGreaterThan(20);

      if (screenshotName) {
        const shotPath = path.join(screenshotsDir, screenshotName);
        await page.screenshot({ path: shotPath });
        if (fs.existsSync(artifactDir)) {
          fs.copyFileSync(shotPath, path.join(artifactDir, screenshotName));
        }
      }
    };

    // 5. Scrub & Verify All 4 Enhanced Scenes + 5 Service Demonstrations
    // SCENE 01 — CINEMATIC BRAND INTRO (0:00–0:03): Check at 1.85s
    await seekAndVerifyScene(1.85, 'angora-scene-01-brand-intro.png');

    // Verify Parent-Child Transform Link on WEB SERVICES (clip-s1-sub -> clip-s1-wordmark)
    await page.getByTestId('timeline-clip-clip-s1-sub').click();
    await expect(page.getByTestId('inspector-parent-select')).toHaveValue(
      'clip-s1-wordmark'
    );

    // SCENE 02 — KINETIC BRAND STATEMENT (0:03–0:06): Check at 4.4s
    await page.getByTestId('timeline-clip-clip-s2-our-execution').click();
    await expect(page.getByTestId('inspector-motion-blur-toggle')).toContainText('M-Blur');
    await seekAndVerifyScene(4.4, 'angora-scene-02-kinetic-typography.png');

    // SCENE 03 — ADVANCED SERVICES SHOWCASE (0:06–0:11): Check all 5 visual demonstrations
    await seekAndVerifyScene(6.5, 'angora-v2-service-01-webdesign.png'); // 01 Web Design UI
    await seekAndVerifyScene(7.5, 'angora-v2-service-02-webdev.png'); // 02 Web Dev Code + Live Preview
    await page.getByTestId('timeline-clip-clip-s3-title-03').click();
    await seekAndVerifyScene(8.5, 'angora-scene-03-services-showcase.png'); // 03 Graphic Design Swiss Grid
    await seekAndVerifyScene(9.5, 'angora-v2-service-04-video.png'); // 04 Video Editing Timeline + Playhead
    await seekAndVerifyScene(10.5, 'angora-v2-service-05-automation.png'); // 05 Automation Node Pipeline

    // SCENE 04 — PREMIUM FINAL CTA (0:11–0:15): Check at 13.8s and final frame 15.0s
    await page.getByTestId('timeline-clip-clip-s4-cta-button').click();
    await expect(page.getByTestId('inspector-mask-shape')).toHaveValue('linear-wipe');
    await seekAndVerifyScene(13.8, 'angora-scene-04-final-cta.png');
    await seekAndVerifyScene(15.0);

    // 6. Verify Reload Persistence from IndexedDB
    await page.getByTestId('save-project-btn').click();
    await expect(page.getByTestId('save-status-indicator')).toContainText('Saved');
    await page.reload();
    await expect(page.getByTestId('motionlab-app')).toBeVisible();
    await expect(page.getByTestId('project-name-display')).toHaveText(
      'ANGORA — Agency Promo V2',
      { timeout: 15000 }
    );
    await expect(page.getByTestId('duration-display')).toHaveText('00:00:15:00');

    // 7. Export Final 1080x1920 30fps 15s MP4 Video
    await page.getByTestId('open-export-btn').click();
    await expect(page.getByTestId('export-modal')).toBeVisible();
    await page.getByTestId('start-export-btn').click();

    await expect(page.getByTestId('export-complete-panel')).toBeVisible({
      timeout: 120000,
    });

    const exportShot = path.join(screenshotsDir, 'angora-promo-export-complete.png');
    await page.screenshot({ path: exportShot });
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(
        exportShot,
        path.join(artifactDir, 'angora-promo-export-complete.png')
      );
    }

    // Download and save final MP4 file via Playwright download event
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('download-export-btn').click();
    const download = await downloadPromise;

    const savedPublicV2Mp4 = path.join(publicExportDir, 'ANGORA-Agency-Promo-V2.mp4');
    const savedPublicV1Mp4 = path.join(publicExportDir, 'ANGORA-Agency-Promo-2026.mp4');
    await download.saveAs(savedPublicV2Mp4);
    fs.copyFileSync(savedPublicV2Mp4, savedPublicV1Mp4);

    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(
        savedPublicV2Mp4,
        path.join(artifactDir, 'ANGORA-Agency-Promo-V2.mp4')
      );
    }

    const stat = fs.statSync(savedPublicV2Mp4);
    expect(stat.size).toBeGreaterThan(50_000);

    // 8. Verify exported MP4 via ffprobe
    const probeJsonStr = execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration,size:stream=index,codec_name,codec_type,width,height,r_frame_rate,nb_frames',
        '-of',
        'json',
        savedPublicV2Mp4,
      ],
      { encoding: 'utf8' }
    );
    const probeData = JSON.parse(probeJsonStr);
    const streams = probeData.streams as Array<Record<string, unknown>>;
    const videoStream = streams.find((s) => s.codec_type === 'video');
    const audioStream = streams.find((s) => s.codec_type === 'audio');

    expect(videoStream).toBeDefined();
    expect(videoStream?.codec_name).toBe('h264');
    expect(videoStream?.width).toBe(1080);
    expect(videoStream?.height).toBe(1920);
    expect(videoStream?.r_frame_rate).toBe('30/1');
    expect(Number(videoStream?.nb_frames)).toBe(450);

    expect(audioStream).toBeDefined();
    expect(audioStream?.codec_name).toBe('aac');
    expect(Number(probeData.format.duration)).toBeGreaterThanOrEqual(14.95);
    expect(Number(probeData.format.duration)).toBeLessThanOrEqual(15.15);
  });
});
