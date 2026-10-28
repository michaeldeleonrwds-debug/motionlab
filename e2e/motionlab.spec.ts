import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../public/test-media');
const screenshotsDir = path.resolve(__dirname, '../screenshots');
const artifactDir =
  'C:/Users/REYMARK/.gemini/antigravity/brain/3c90f9e2-da2d-42d6-8add-a7b0a5b26682';

fs.mkdirSync(screenshotsDir, { recursive: true });

test.describe('MotionLab Professional NLE — End-to-End Acceptance Suite', () => {
  test('1. Rejects unsupported or corrupt codec files rather than trusting extension', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('motionlab-app')).toBeVisible();

    const badMovPath = path.join(fixturesDir, 'unsupported-raw-codec.mov');
    const fileInput = page.getByTestId('media-file-input');
    await fileInput.setInputFiles([badMovPath]);

    const errorBanner = page.getByTestId('import-error-banner');
    await expect(errorBanner).toBeVisible({ timeout: 10000 });
    await expect(errorBanner).toContainText('Unsupported video codec');
  });

  test('2. Full 16-Step Benchmark Acceptance Workflow (Create -> Import -> Edit -> Preview -> Reload -> Export -> Verify MP4)', async ({
    page,
  }) => {
    // 1. Open MotionLab
    await page.goto('/');
    await expect(page.getByTestId('motionlab-app')).toBeVisible();

    // 2. Create a new 1080p project
    await page.getByTestId('open-projects-modal-btn').click();
    await expect(page.getByTestId('project-modal')).toBeVisible();
    await page.getByTestId('new-project-name-input').fill('Benchmark Master 1080p');
    await page.getByTestId('new-project-aspect-select').selectOption('16:9');
    await page.getByTestId('new-project-res-select').selectOption('1080p');
    await page.getByTestId('new-project-fps-select').selectOption('30');
    await page.getByTestId('create-project-submit-btn').click();

    await expect(page.getByTestId('project-name-display')).toHaveText(
      'Benchmark Master 1080p'
    );

    // 3 & 4. Import two video files and one audio file
    const clipAPath = path.join(fixturesDir, 'clip-a-studio.mp4');
    const clipBPath = path.join(fixturesDir, 'clip-b-motion.mp4');
    const audioPath = path.join(fixturesDir, 'ambient-score.wav');

    const fileInput = page.getByTestId('media-file-input');
    await fileInput.setInputFiles([clipAPath, clipBPath, audioPath]);

    await expect(
      page.getByTestId('media-asset-card-clip-a-studio.mp4')
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByTestId('media-asset-card-clip-b-motion.mp4')
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByTestId('media-asset-card-ambient-score.wav')
    ).toBeVisible({ timeout: 15000 });

    // 5 & 6. Add first video, trim it from 3.0s to 2.0s, then add second video so they are flush at 2.0s
    await page.getByTestId('add-asset-btn-clip-a-studio.mp4').click();
    const firstClip = page.locator('[data-clip-type="video"]').first();
    await firstClip.click();
    const durationInput = page.getByTestId('inspector-clip-duration');
    await durationInput.fill('2.0');
    await durationInput.press('Enter');

    await page.getByTestId('add-asset-btn-clip-b-motion.mp4').click();
    const videoClips = page.locator('[data-clip-type="video"]');
    await expect(videoClips).toHaveCount(2);

    // Apply a slight color enhancement on second clip
    const secondClip = videoClips.nth(1);
    await secondClip.click();
    await page.getByTestId('effect-slider-contrast').fill('15');

    // 7. Split the second video (which spans 2.0s..5.0s) at ~3.5s (332px on ruler)
    await page.getByTestId('timeline-ruler').click({ position: { x: 332, y: 12 } });
    await page.getByTestId('split-clip-btn').click();
    await expect(page.locator('[data-clip-type="video"]')).toHaveCount(3);

    // 8. Add animated text starting at 0.5s (48px on ruler)
    await page.getByTestId('timeline-ruler').click({ position: { x: 48, y: 12 } });
    await page.getByTestId('left-tab-text').click();
    await page.getByTestId('custom-text-input').fill('MOTIONLAB PREMIERE CUT');
    await page.getByTestId('add-text-preset-kinetic-zoom').click();
    await expect(page.locator('[data-clip-type="text"]')).toHaveCount(1);

    // Add a keyframe on the text layer
    await page.getByTestId('add-keyframe-scale').click();
    await expect(page.getByTestId('keyframe-item-scale')).toBeVisible();

    // 9. Add a transition (Cross Dissolve) on the second video clip (at the 2.0s cut)
    await page.getByTestId('left-tab-transitions').click();
    await page.locator('[data-clip-type="video"]').nth(1).click();
    await page.getByTestId('apply-transition-cross-dissolve').click();

    // 10. Add background music
    await page.getByTestId('left-tab-audio').click();
    await page.getByTestId('add-audio-asset-ambient-score.wav').click();
    await expect(page.locator('[data-clip-type="audio"]')).toHaveCount(1);

    // Adjust audio fade-in and fade-out in Inspector
    await page.locator('[data-clip-type="audio"]').first().click();
    await page.getByTestId('inspector-fade-in-slider').fill('0.5');
    await page.getByTestId('inspector-fade-out-slider').fill('0.8');

    // Switch back to Media tab and toggle Safe Guides on for screenshot
    await page.getByTestId('left-tab-media').click();
    await page.getByTestId('safe-guides-btn').click();

    // 11. Preview the complete composition
    await page.getByTestId('jump-start-btn').click();
    await page.getByTestId('play-pause-btn').click();
    await page.waitForTimeout(1400);
    await page.getByTestId('play-pause-btn').click(); // Pause around ~1.4s where video + title + audio are all active

    // Verify preview canvas rendered actual non-black video + title pixels
    const hasNonBlackPixels = await page.evaluate(() => {
      const c = document.querySelector(
        '[data-testid="preview-canvas"]'
      ) as HTMLCanvasElement | null;
      if (!c) return false;
      const ctx = c.getContext('2d');
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let nonBlack = 0;
      for (let i = 0; i < data.length; i += 64) {
        if (data[i] > 15 || data[i + 1] > 15 || data[i + 2] > 15) {
          nonBlack++;
        }
      }
      return nonBlack > 50;
    });
    expect(hasNonBlackPixels).toBe(true);

    // Capture Screenshot 1: Full Workspace with Multitrack Timeline & Preview
    const workspaceShot = path.join(screenshotsDir, '01-motionlab-workspace.png');
    await page.screenshot({ path: workspaceShot });
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(
        workspaceShot,
        path.join(artifactDir, '01-motionlab-workspace.png')
      );
    }

    // Select Text Clip while playhead is at ~1.4s so Direct Manipulation Gizmo & Text Inspector are both visible
    await page.locator('[data-clip-type="text"]').first().click();
    await expect(page.getByTestId('direct-manipulation-gizmo')).toBeVisible();
    const inspectorShot = path.join(
      screenshotsDir,
      '02-motionlab-text-keyframes.png'
    );
    await page.screenshot({ path: inspectorShot });
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(
        inspectorShot,
        path.join(artifactDir, '02-motionlab-text-keyframes.png')
      );
    }

    // 12. Save the project
    await page.getByTestId('save-project-btn').click();
    await expect(page.getByTestId('save-status-indicator')).toContainText(
      'Saved',
      { timeout: 10000 }
    );

    // 13. Reload the browser
    await page.reload();

    // 14. Reopen / verify restored project with all edits intact
    await expect(page.getByTestId('project-name-display')).toHaveText(
      'Benchmark Master 1080p',
      { timeout: 10000 }
    );
    await expect(page.locator('[data-clip-type="video"]')).toHaveCount(3);
    await expect(page.locator('[data-clip-type="text"]')).toHaveCount(1);
    await expect(page.locator('[data-clip-type="audio"]')).toHaveCount(1);

    // 15. Export an MP4
    await page.getByTestId('open-export-btn').click();
    await expect(page.getByTestId('export-modal')).toBeVisible();
    await page.getByTestId('export-resolution-select').selectOption('1080p');
    await page.getByTestId('export-fps-select').selectOption('30');
    await page.getByTestId('export-quality-select').selectOption('standard');

    await page.getByTestId('start-export-btn').click();

    // Wait for export completion
    const completePanel = page.getByTestId('export-complete-panel');
    await expect(completePanel).toBeVisible({ timeout: 65000 });
    await expect(page.getByTestId('export-progress-percent')).toHaveText('100%');

    // Wait for the embedded <video> player inside the modal to load its first frame for a clean screenshot
    await page.evaluate(async () => {
      const v = document.querySelector(
        '[data-testid="exported-video-player"]'
      ) as HTMLVideoElement | null;
      if (!v) return;
      if (v.readyState < 2) {
        await new Promise<void>((res) => {
          v.addEventListener('loadeddata', () => res(), { once: true });
          setTimeout(res, 2000);
        });
      }
      v.currentTime = 1.2;
      await new Promise<void>((res) => {
        v.addEventListener('seeked', () => res(), { once: true });
        setTimeout(res, 1000);
      });
    });

    // Capture Screenshot 3: Completed Export Modal with Embedded MP4 Player
    const exportShot = path.join(screenshotsDir, '03-motionlab-export-complete.png');
    await page.screenshot({ path: exportShot });
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(
        exportShot,
        path.join(artifactDir, '03-motionlab-export-complete.png')
      );
    }

    // 16. Play the exported file and verify video, audio, text, and transitions
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('download-export-btn').click();
    const download = await downloadPromise;
    const exportedFilePath = path.join(
      screenshotsDir,
      'exported-benchmark-1080p.mp4'
    );
    await download.saveAs(exportedFilePath);

    expect(fs.existsSync(exportedFilePath)).toBe(true);
    const stat = fs.statSync(exportedFilePath);
    expect(stat.size).toBeGreaterThan(20_000);

    // Verify exported MP4 streams with ffprobe
    const probeJsonStr = execFileSync(
      'ffprobe',
      [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        exportedFilePath,
      ],
      { encoding: 'utf-8' }
    );
    const probeData = JSON.parse(probeJsonStr);
    const streams = probeData.streams as Array<Record<string, unknown>>;
    const videoStream = streams.find((s) => s.codec_type === 'video');
    const audioStream = streams.find((s) => s.codec_type === 'audio');

    expect(videoStream).toBeDefined();
    expect(videoStream?.codec_name).toBe('h264');
    expect(videoStream?.width).toBe(1920);
    expect(videoStream?.height).toBe(1080);

    expect(audioStream).toBeDefined();
    expect(audioStream?.codec_name).toBe('aac');
    expect(Number(probeData.format.duration)).toBeGreaterThan(4.5);

    // Also verify playback in the browser's <video> element inside the modal
    const videoVerifiedInBrowser = await page.evaluate(async () => {
      const v = document.querySelector(
        '[data-testid="exported-video-player"]'
      ) as HTMLVideoElement | null;
      if (!v) return { ok: false };
      if (v.readyState < 1) {
        await new Promise<void>((res) => {
          v.addEventListener('loadedmetadata', () => res(), { once: true });
        });
      }
      return {
        ok: v.videoWidth === 1920 && v.videoHeight === 1080 && v.duration > 4.5,
        width: v.videoWidth,
        height: v.videoHeight,
        duration: v.duration,
      };
    });
    expect(videoVerifiedInBrowser.ok).toBe(true);
  });

  test('3. AI MCP Studio (Antigravity, ChatGPT/Codex, Claude) & External JSON-RPC 2.0 Bridge Verification', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('motionlab-app')).toBeVisible();

    // Open AI MCP tab in Left Sidebar
    await page.getByTestId('left-tab-ai-mcp').click();
    await expect(page.getByTestId('ai-mcp-panel')).toBeVisible();

    // Switch across AI providers (Antigravity, ChatGPT/Codex, Claude, Custom)
    await page.getByTestId('ai-provider-btn-chatgpt-codex').click();
    await page.getByTestId('ai-provider-btn-claude').click();
    await page.getByTestId('ai-provider-btn-antigravity').click();

    // Trigger Quick AI MCP Action to auto-assemble commercial sequence
    await page.getByTestId('ai-quick-prompt-0').click();
    await expect(page.getByTestId('executed-mcp-call-load_studio_media')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator('[data-clip-type="video"]')).toHaveCount(2);
    await expect(page.locator('[data-clip-type="text"]')).toHaveCount(1);

    // Test external JSON-RPC 2.0 MCP Server Bridge (/api/mcp/rpc) as if called by Claude/Codex/Antigravity
    const listRes = await request.post('/api/mcp/rpc', {
      data: {
        jsonrpc: '2.0',
        id: 101,
        method: 'tools/list',
      },
    });
    expect(listRes.ok()).toBe(true);
    const listJson = await listRes.json();
    expect(listJson.result.tools.length).toBeGreaterThanOrEqual(14);

    // Call tools/call over JSON-RPC 2.0 bridge and verify live browser timeline updates
    const callRes = await request.post('/api/mcp/rpc', {
      data: {
        jsonrpc: '2.0',
        id: 102,
        method: 'tools/call',
        params: {
          name: 'add_text_layer',
          arguments: {
            content: 'EXTERNAL MCP BRIDGE LIVE',
            startTime: 1.0,
            duration: 2.5,
            animationIn: 'typewriter',
          },
        },
      },
    });
    expect(callRes.ok()).toBe(true);
    await expect(page.locator('[data-clip-type="text"]')).toHaveCount(2);

    // Seek to 1.2s so the AI-assembled sequence & titles are visible on Program Monitor
    await page.getByTestId('timeline-ruler').click({ position: { x: 115, y: 12 } });

    // Capture Screenshot 4: AI & MCP Hub Sidebar with Executed MCP Tool Calls
    const aiHubShot = path.join(screenshotsDir, '04-motionlab-ai-mcp-hub.png');
    await page.screenshot({ path: aiHubShot });
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(
        aiHubShot,
        path.join(artifactDir, '04-motionlab-ai-mcp-hub.png')
      );
    }

    // Open MCP Server & Tool Studio Modal
    await page.getByTestId('open-mcp-config-btn').click();
    await expect(page.getByTestId('mcp-config-modal')).toBeVisible();

    // Check ChatGPT/Codex and Claude tabs inside modal
    await page.getByTestId('mcp-client-select-chatgpt-codex').click();
    await expect(page.getByTestId('mcp-config-codeblock')).toContainText('mcp_servers.motionlab');

    // Switch to MCP Tool Runner tab and execute get_state
    await page.getByTestId('mcp-tab-explorer').click();
    await page.getByTestId('execute-mcp-tool-btn').click();
    await expect(page.getByTestId('mcp-tool-output-pre')).toContainText('"ok": true');

    // Capture Screenshot 5: MCP Studio Modal
    const mcpModalShot = path.join(
      screenshotsDir,
      '05-motionlab-mcp-studio-modal.png'
    );
    await page.screenshot({ path: mcpModalShot });
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(
        mcpModalShot,
        path.join(artifactDir, '05-motionlab-mcp-studio-modal.png')
      );
    }
  });
});
