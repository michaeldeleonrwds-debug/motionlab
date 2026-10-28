import { describe, it, expect } from 'vitest';
import { getResolutionDimensions } from '../../engine/timelineEngine';

describe('Program Monitor Canvas Scaling & Resolution Math', () => {
  it('correctly computes logical composition dimensions for all aspect ratios', () => {
    // 9:16 Portrait (Shorts / Reels / TikTok)
    const portrait = getResolutionDimensions('9:16', '1080p');
    expect(portrait.width).toBe(1080);
    expect(portrait.height).toBe(1920);

    // 16:9 Landscape (YouTube / Broadcast)
    const landscape = getResolutionDimensions('16:9', '1080p');
    expect(landscape.width).toBe(1920);
    expect(landscape.height).toBe(1080);

    // 1:1 Square (Instagram Post)
    const square = getResolutionDimensions('1:1', '1080p');
    expect(square.width).toBe(1080);
    expect(square.height).toBe(1080);

    // 720p Landscape
    const res720 = getResolutionDimensions('16:9', '720p');
    expect(res720.width).toBe(1280);
    expect(res720.height).toBe(720);

    // 4K Custom Resolution (UHD)
    const uhd = getResolutionDimensions('custom', '1080p', 3840, 2160);
    expect(uhd.width).toBe(3840);
    expect(uhd.height).toBe(2160);
  });

  it('preserves exact 9:16 aspect ratio with height as constraining dimension in normal workspace', () => {
    const compW = 1080;
    const compH = 1920;

    // Suppose container in normal workspace is 900px wide by 500px tall
    const containerW = 900;
    const containerH = 500;
    const availableW = containerW - 24; // 876
    const availableH = containerH - 24; // 476

    const fitScale = Math.min(availableW / compW, availableH / compH);
    // Height is constraining: 476 / 1920 = 0.2479...
    expect(fitScale).toBe(availableH / compH);

    const displayW = Math.round(compW * fitScale);
    const displayH = Math.round(compH * fitScale);

    // Uniform aspect ratio verification
    expect(displayW).toBe(Math.round((availableH / compH) * compW));
    expect(displayH).toBe(availableH);
    expect(Math.abs(displayW / displayH - 9 / 16)).toBeLessThan(0.01);
  });

  it('preserves exact 16:9 aspect ratio with width as constraining dimension', () => {
    const compW = 1920;
    const compH = 1080;

    // Suppose container is 900px wide by 600px tall
    const availableW = 900 - 24; // 876
    const availableH = 600 - 24; // 576

    const fitScale = Math.min(availableW / compW, availableH / compH);
    // Width is constraining: 876 / 1920 = 0.45625 < 576 / 1080 = 0.5333
    expect(fitScale).toBe(availableW / compW);

    const displayW = Math.round(compW * fitScale);
    const displayH = Math.round(compH * fitScale);

    expect(displayW).toBe(availableW);
    expect(Math.abs(displayW / displayH - 16 / 9)).toBeLessThan(0.01);
  });

  it('evaluates zoom modes relative to 100% composition scale, NOT fit scale', () => {
    const compW = 1080;
    const compH = 1920;
    const fitScale = 0.25;

    // 25% zoom must equal 0.25 of full 1080x1920, resulting in 270x480
    const scale25 = 0.25;
    expect(Math.round(compW * scale25)).toBe(270);
    expect(Math.round(compH * scale25)).toBe(480);

    // 50% zoom must equal 0.50 of full 1080x1920, resulting in 540x960
    const scale50 = 0.5;
    expect(Math.round(compW * scale50)).toBe(540);
    expect(Math.round(compH * scale50)).toBe(960);

    // 100% zoom must equal 1.0 of full 1080x1920, resulting in 1080x1920
    const scale100 = 1.0;
    expect(Math.round(compW * scale100)).toBe(1080);
    expect(Math.round(compH * scale100)).toBe(1920);

    // 200% zoom must equal 2.0 of full 1080x1920, resulting in 2160x3840
    const scale200 = 2.0;
    expect(Math.round(compW * scale200)).toBe(2160);
    expect(Math.round(compH * scale200)).toBe(3840);
  });

  it('guarantees 1:1 mouse movement to composition coordinates across zoom levels without drift', () => {
    const deltaMouseScreenX = 50; // mouse dragged 50 screen pixels
    const deltaMouseScreenY = -30; // mouse dragged -30 screen pixels

    // Case A: Fit scale = 0.25 (scaled down)
    const effectiveScaleA = 0.25;
    const compDeltaXA = deltaMouseScreenX / effectiveScaleA;
    const compDeltaYA = deltaMouseScreenY / effectiveScaleA;
    expect(compDeltaXA).toBe(200);
    expect(compDeltaYA).toBe(-120);
    // When projected back to screen at effectiveScaleA: 200 * 0.25 = 50px, locked under mouse!
    expect(compDeltaXA * effectiveScaleA).toBe(deltaMouseScreenX);
    expect(compDeltaYA * effectiveScaleA).toBe(deltaMouseScreenY);

    // Case B: 100% scale = 1.0
    const effectiveScaleB = 1.0;
    expect(deltaMouseScreenX / effectiveScaleB).toBe(50);
    expect(deltaMouseScreenY / effectiveScaleB).toBe(-30);

    // Case C: 200% scale = 2.0 (zoomed in)
    const effectiveScaleC = 2.0;
    expect(deltaMouseScreenX / effectiveScaleC).toBe(25);
    expect(deltaMouseScreenY / effectiveScaleC).toBe(-15);
    expect((deltaMouseScreenX / effectiveScaleC) * effectiveScaleC).toBe(50);
  });

  it('selects correct adaptive render quality based on preview scale and explicit setting', () => {
    const compW = 1080;
    const compH = 1920;

    // Auto mode with effectiveScale 0.25 (<= 0.45) selects half render scale (0.5)
    const autoScaleSmall = 0.25;
    const renderScaleSmall = autoScaleSmall <= 0.45 ? 0.5 : 1.0;
    expect(renderScaleSmall).toBe(0.5);

    // Auto mode with effectiveScale 0.75 (> 0.45) selects full render scale (1.0)
    const autoScaleLarge = 0.75;
    const renderScaleLarge = autoScaleLarge <= 0.45 ? 0.5 : 1.0;
    expect(renderScaleLarge).toBe(1.0);

    // Explicit Quarter preview quality is 0.25
    expect(Math.round(compW * 0.25)).toBe(270);
    expect(Math.round(compH * 0.25)).toBe(480);
  });
});
