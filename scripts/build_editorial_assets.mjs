import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const outDir = path.resolve('public/angora-assets');
fs.mkdirSync(outDir, { recursive: true });

// 1. Copy generated human photo
const srcPhoto = 'C:/Users/REYMARK/.gemini/antigravity/brain/3c90f9e2-da2d-42d6-8add-a7b0a5b26682/angora_human_laptop_cutout_1793117397830.jpg';
const destPhoto = path.join(outDir, 'angora-human-laptop.jpg');
fs.copyFileSync(srcPhoto, destPhoto);
console.log('Copied human photo to', destPhoto);

// 2. Generate transparent cutout PNG using FFmpeg colorkey / threshold
// The background is pitch black (#000000 to #080808)
const cutoutPng = path.join(outDir, 'angora-human-laptop-cutout.png');
try {
  execFileSync('ffmpeg', [
    '-y',
    '-i', destPhoto,
    '-vf', "format=rgba,colorkey=0x040404:0.12:0.04",
    '-frames:v', '1',
    cutoutPng
  ]);
  console.log('Created transparent cutout:', cutoutPng);
} catch (err) {
  console.error('FFmpeg colorkey failed, copying photo as fallback:', err);
  fs.copyFileSync(destPhoto, cutoutPng);
}

// 3. Render bespoke Swiss Graphic Design poster collage (Scene 3)
async function renderCollageAssets() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  // Asset 1: Graphic Design Poster Collage (1080x1350)
  const graphicDesignHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      body { width: 1080px; height: 1350px; background: transparent; display: flex; align-items: center; justify-content: center; }
      .poster-card {
        width: 820px;
        height: 1100px;
        background: #172018;
        border: 2px solid #D7E83F;
        border-radius: 20px;
        padding: 48px;
        position: relative;
        overflow: hidden;
        box-shadow: 0 30px 80px rgba(0,0,0,0.8);
      }
      .grid-lines {
        position: absolute;
        inset: 0;
        background-image: linear-gradient(to right, rgba(215, 232, 63, 0.08) 1px, transparent 1px),
                          linear-gradient(to bottom, rgba(215, 232, 63, 0.08) 1px, transparent 1px);
        background-size: 60px 60px;
      }
      .crop-mark {
        position: absolute;
        width: 24px;
        height: 24px;
        border-color: #D7E83F;
      }
      .top-left { top: 20px; left: 20px; border-top: 2px solid #D7E83F; border-left: 2px solid #D7E83F; }
      .top-right { top: 20px; right: 20px; border-top: 2px solid #D7E83F; border-right: 2px solid #D7E83F; }
      .bottom-left { bottom: 20px; left: 20px; border-bottom: 2px solid #D7E83F; border-left: 2px solid #D7E83F; }
      .bottom-right { bottom: 20px; right: 20px; border-bottom: 2px solid #D7E83F; border-right: 2px solid #D7E83F; }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(215, 232, 63, 0.3);
        padding-bottom: 24px;
        position: relative;
        z-index: 2;
      }
      .tag {
        font-family: monospace;
        font-size: 16px;
        color: #D7E83F;
        letter-spacing: 2px;
        text-transform: uppercase;
      }
      .folio {
        font-family: monospace;
        font-size: 14px;
        color: #FFFFFF;
        opacity: 0.6;
      }
      .content {
        margin-top: 60px;
        position: relative;
        z-index: 2;
      }
      .huge-title {
        font-size: 88px;
        font-weight: 900;
        line-height: 0.95;
        color: #FFFFFF;
        letter-spacing: -2px;
        text-transform: uppercase;
      }
      .huge-title span {
        color: #D7E83F;
        display: block;
      }
      .spec-sheet {
        margin-top: 80px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 30px;
      }
      .spec-item {
        border-left: 3px solid #D7E83F;
        padding-left: 16px;
      }
      .spec-label {
        font-size: 12px;
        text-transform: uppercase;
        color: rgba(255,255,255,0.5);
        font-family: monospace;
      }
      .spec-val {
        font-size: 20px;
        font-weight: 700;
        color: #FFFFFF;
        margin-top: 4px;
      }
      .swatches {
        margin-top: 80px;
        display: flex;
        gap: 16px;
      }
      .swatch {
        width: 80px;
        height: 80px;
        border-radius: 8px;
        display: flex;
        align-items: flex-end;
        padding: 6px;
        font-family: monospace;
        font-size: 10px;
        font-weight: bold;
      }
      .s1 { background: #172018; border: 1px solid #D7E83F; color: #D7E83F; }
      .s2 { background: #D7E83F; color: #0B0F0B; }
      .s3 { background: #FFFFFF; color: #0B0F0B; }
      .s4 { background: #0B0F0B; border: 1px solid rgba(255,255,255,0.2); color: #FFFFFF; }
    </style>
  </head>
  <body>
    <div class="poster-card">
      <div class="grid-lines"></div>
      <div class="crop-mark top-left"></div>
      <div class="crop-mark top-right"></div>
      <div class="crop-mark bottom-left"></div>
      <div class="crop-mark bottom-right"></div>

      <div class="header">
        <span class="tag">ANGORA / SYSTEM 01</span>
        <span class="folio">SWISS EDITORIAL GRID • 2026</span>
      </div>

      <div class="content">
        <div class="huge-title">
          VISUAL
          <span>IDENTITY</span>
          POSTER
        </div>

        <div class="spec-sheet">
          <div class="spec-item">
            <div class="spec-label">TYPE SYSTEM</div>
            <div class="spec-val">HELVETICA NEUE BOLD</div>
          </div>
          <div class="spec-item">
            <div class="spec-label">GRID RATIO</div>
            <div class="spec-val">12-COLUMN DYNAMIC</div>
          </div>
          <div class="spec-item">
            <div class="spec-label">CONTRAST INDEX</div>
            <div class="spec-val">18.4 : 1 HIGH PASS</div>
          </div>
          <div class="spec-item">
            <div class="spec-label">OUTPUT STANDARD</div>
            <div class="spec-val">AGENCY MASTER 4K</div>
          </div>
        </div>

        <div class="swatches">
          <div class="swatch s1">#172018</div>
          <div class="swatch s2">#D7E83F</div>
          <div class="swatch s3">#FFFFFF</div>
          <div class="swatch s4">#0B0F0B</div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
  await page.setContent(graphicDesignHtml);
  const posterPath = path.join(outDir, 'angora-poster-graphic.png');
  await page.locator('.poster-card').screenshot({ path: posterPath, omitBackground: true });
  console.log('Rendered poster graphic:', posterPath);

  // Asset 2: Video Editing Filmstrip & UI (Scene 4)
  const videoEditingHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      body { width: 1080px; height: 1200px; background: transparent; display: flex; align-items: center; justify-content: center; }
      .filmstrip-card {
        width: 860px;
        background: #0B0F0B;
        border: 2px solid #28332a;
        border-radius: 20px;
        padding: 32px;
        box-shadow: 0 30px 80px rgba(0,0,0,0.9);
      }
      .timeline-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #28332a;
        padding-bottom: 16px;
        margin-bottom: 24px;
      }
      .timecode {
        font-family: monospace;
        font-size: 24px;
        font-weight: 700;
        color: #D7E83F;
      }
      .fps-badge {
        font-family: monospace;
        font-size: 14px;
        background: #172018;
        border: 1px solid #D7E83F;
        color: #D7E83F;
        padding: 4px 12px;
        border-radius: 6px;
      }
      .filmstrip-row {
        display: flex;
        gap: 16px;
        margin-bottom: 24px;
        position: relative;
      }
      .film-cell {
        flex: 1;
        height: 200px;
        background: #172018;
        border: 1px solid #3d4a3e;
        border-radius: 10px;
        overflow: hidden;
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 12px;
      }
      .sprocket {
        display: flex;
        justify-content: space-between;
      }
      .sprocket-hole {
        width: 14px;
        height: 8px;
        background: #0B0F0B;
        border-radius: 2px;
      }
      .cell-content {
        text-align: center;
        font-size: 14px;
        font-weight: 700;
        color: #FFFFFF;
        letter-spacing: 1px;
      }
      .cell-frame {
        font-family: monospace;
        font-size: 11px;
        color: #D7E83F;
        text-align: right;
      }
      .playhead-line {
        position: absolute;
        top: -10px;
        bottom: -10px;
        left: 48%;
        width: 3px;
        background: #D7E83F;
        box-shadow: 0 0 12px #D7E83F;
        z-index: 10;
      }
      .playhead-head {
        position: absolute;
        top: -14px;
        left: -6px;
        width: 15px;
        height: 14px;
        background: #D7E83F;
        clip-path: polygon(0 0, 100% 0, 50% 100%);
      }
      .track-stack {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .track-lane {
        height: 48px;
        background: #121713;
        border-radius: 8px;
        border: 1px solid #202b22;
        display: flex;
        align-items: center;
        padding: 0 16px;
        gap: 16px;
      }
      .track-tag {
        font-family: monospace;
        font-size: 12px;
        font-weight: bold;
        color: #D7E83F;
        width: 40px;
      }
      .track-block {
        flex: 1;
        height: 28px;
        background: #172018;
        border: 1px solid #D7E83F;
        border-radius: 4px;
        display: flex;
        align-items: center;
        padding: 0 12px;
        font-size: 12px;
        color: #FFFFFF;
        font-weight: 600;
      }
      .audio-block {
        background: rgba(215, 232, 63, 0.15);
        border: 1px solid #D7E83F;
        display: flex;
        align-items: center;
        gap: 3px;
        padding: 0 8px;
      }
      .wave-bar {
        width: 4px;
        background: #D7E83F;
        border-radius: 2px;
      }
    </style>
  </head>
  <body>
    <div class="filmstrip-card">
      <div class="timeline-header">
        <div class="timecode">00:06:18:24</div>
        <div class="fps-badge">KINETIC CUTS • 4K PRORES</div>
      </div>

      <div class="filmstrip-row">
        <div class="playhead-line"><div class="playhead-head"></div></div>

        <div class="film-cell">
          <div class="sprocket"><div class="sprocket-hole"></div><div class="sprocket-hole"></div></div>
          <div class="cell-content">SCENE 01<br><span style="font-size:10px; opacity:0.6;">HOOK</span></div>
          <div class="cell-frame">FR 045</div>
        </div>
        <div class="film-cell" style="border-color: #D7E83F;">
          <div class="sprocket"><div class="sprocket-hole"></div><div class="sprocket-hole"></div></div>
          <div class="cell-content" style="color: #D7E83F;">SCENE 02<br><span style="font-size:10px; color:#FFFFFF;">RHYTHM</span></div>
          <div class="cell-frame">FR 090</div>
        </div>
        <div class="film-cell">
          <div class="sprocket"><div class="sprocket-hole"></div><div class="sprocket-hole"></div></div>
          <div class="cell-content">SCENE 03<br><span style="font-size:10px; opacity:0.6;">CLIMAX</span></div>
          <div class="cell-frame">FR 135</div>
        </div>
      </div>

      <div class="track-stack">
        <div class="track-lane">
          <span class="track-tag">V1</span>
          <div class="track-block">CINEMATIC MONTAGE • 8K MASTER</div>
        </div>
        <div class="track-lane">
          <span class="track-tag">V2</span>
          <div class="track-block" style="border-color: #D7E83F; background: #1f2c21;">GRAPHIC OVERLAYS & MASKS</div>
        </div>
        <div class="track-lane">
          <span class="track-tag">A1</span>
          <div class="track-block audio-block">
            <span style="font-family: monospace; font-size: 11px; margin-right: 8px;">MASTER AUDIO</span>
            <div class="wave-bar" style="height: 12px;"></div>
            <div class="wave-bar" style="height: 20px;"></div>
            <div class="wave-bar" style="height: 8px;"></div>
            <div class="wave-bar" style="height: 24px;"></div>
            <div class="wave-bar" style="height: 16px;"></div>
            <div class="wave-bar" style="height: 22px;"></div>
            <div class="wave-bar" style="height: 14px;"></div>
            <div class="wave-bar" style="height: 18px;"></div>
          </div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
  await page.setContent(videoEditingHtml);
  const videoPath = path.join(outDir, 'angora-filmstrip-ui.png');
  await page.locator('.filmstrip-card').screenshot({ path: videoPath, omitBackground: true });
  console.log('Rendered filmstrip UI:', videoPath);

  // Asset 3A: Web Browser Window (860x520)
  const webBrowserHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      body { width: 1080px; height: 800px; background: transparent; display: flex; align-items: center; justify-content: center; }
      .browser-card {
        width: 860px;
        background: #0B0F0B;
        border: 2px solid #D7E83F;
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 40px 90px rgba(0,0,0,0.9);
      }
      .browser-bar {
        height: 52px;
        background: #172018;
        border-bottom: 1px solid rgba(215, 232, 63, 0.3);
        display: flex;
        align-items: center;
        padding: 0 20px;
        gap: 16px;
      }
      .dots { display: flex; gap: 8px; }
      .dot { width: 12px; height: 12px; border-radius: 50%; background: #2a382c; }
      .url-bar {
        flex: 1;
        height: 32px;
        background: #0B0F0B;
        border-radius: 8px;
        display: flex;
        align-items: center;
        padding: 0 14px;
        font-family: monospace;
        font-size: 13px;
        color: #D7E83F;
        border: 1px solid rgba(215, 232, 63, 0.2);
      }
      .browser-body {
        padding: 36px;
        background: #101611;
      }
      .nav-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
      }
      .brand-mark {
        font-weight: 900;
        font-size: 20px;
        color: #FFFFFF;
        letter-spacing: -0.5px;
      }
      .brand-mark span { color: #D7E83F; }
      .nav-links {
        display: flex;
        gap: 20px;
        font-size: 13px;
        color: rgba(255,255,255,0.7);
        font-family: monospace;
      }
      .hero-section {
        border-left: 4px solid #D7E83F;
        padding-left: 20px;
      }
      .hero-tag {
        font-family: monospace;
        font-size: 12px;
        color: #D7E83F;
        letter-spacing: 2px;
        text-transform: uppercase;
        margin-bottom: 10px;
      }
      .hero-heading {
        font-size: 42px;
        font-weight: 800;
        line-height: 1.1;
        color: #FFFFFF;
        letter-spacing: -1px;
        margin-bottom: 24px;
      }
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
      }
      .metric-box {
        background: #172018;
        border: 1px solid rgba(215, 232, 63, 0.3);
        border-radius: 10px;
        padding: 16px;
      }
      .metric-num {
        font-size: 32px;
        font-weight: 900;
        color: #D7E83F;
        font-family: monospace;
      }
      .metric-label {
        font-size: 11px;
        color: rgba(255,255,255,0.6);
        text-transform: uppercase;
        margin-top: 4px;
      }
    </style>
  </head>
  <body>
    <div class="browser-card">
      <div class="browser-bar">
        <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
        <div class="url-bar">https://angora.studio/web-systems</div>
      </div>
      <div class="browser-body">
        <div class="nav-row">
          <div class="brand-mark">ANGORA <span>/ WEB</span></div>
          <div class="nav-links">
            <span>PERFORMANCE</span>
            <span>JAMSTACK</span>
            <span>CLOUD</span>
          </div>
        </div>
        <div class="hero-section">
          <div class="hero-tag">NEXT-GEN WEB ARCHITECTURE</div>
          <div class="hero-heading">HIGH PERFORMANCE DIGITAL PLATFORMS</div>
        </div>
        <div class="metrics-grid">
          <div class="metric-box">
            <div class="metric-num">100</div>
            <div class="metric-label">PERF SCORE</div>
          </div>
          <div class="metric-box">
            <div class="metric-num">&lt;0.4s</div>
            <div class="metric-label">LCP SPEED</div>
          </div>
          <div class="metric-box">
            <div class="metric-num">99.9%</div>
            <div class="metric-label">UPTIME</div>
          </div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
  await page.setContent(webBrowserHtml);
  const webBrowserPath = path.join(outDir, 'angora-web-browser.png');
  await page.locator('.browser-card').screenshot({ path: webBrowserPath, omitBackground: true });
  console.log('Rendered web browser:', webBrowserPath);

  // Asset 3B: Mobile Device Mockup (340x640)
  const mobileMockupHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      body { width: 500px; height: 750px; background: transparent; display: flex; align-items: center; justify-content: center; }
      .phone-mockup {
        width: 340px;
        height: 640px;
        background: #0B0F0B;
        border: 4px solid #D7E83F;
        border-radius: 40px;
        box-shadow: 0 40px 100px rgba(0,0,0,0.95);
        padding: 24px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .phone-notch {
        width: 120px;
        height: 20px;
        background: #172018;
        border-radius: 10px;
        margin: 0 auto;
      }
      .phone-title {
        font-size: 30px;
        font-weight: 900;
        color: #FFFFFF;
        line-height: 1.1;
      }
      .phone-badge {
        font-family: monospace;
        font-size: 12px;
        background: #D7E83F;
        color: #0B0F0B;
        padding: 10px 16px;
        border-radius: 8px;
        font-weight: bold;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="phone-mockup">
      <div class="phone-notch"></div>
      <div>
        <div style="font-family: monospace; font-size: 11px; color: #D7E83F; margin-bottom: 10px; letter-spacing: 1px;">ANGORA MOBILE ENGINE</div>
        <div class="phone-title">PWA &amp; NATIVE FLUID EXPERIENCE</div>
      </div>
      <div class="phone-badge">DEPLOYED AT THE EDGE</div>
    </div>
  </body>
  </html>
  `;
  await page.setContent(mobileMockupHtml);
  const mobileMockupPath = path.join(outDir, 'angora-mobile-mockup.png');
  await page.locator('.phone-mockup').screenshot({ path: mobileMockupPath, omitBackground: true });
  console.log('Rendered mobile mockup:', mobileMockupPath);

  // Asset 4: Automation Nodes System (Scene 6)
  const automationHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      body { width: 1080px; height: 1200px; background: transparent; display: flex; align-items: center; justify-content: center; }
      .automation-card {
        width: 860px;
        background: #0B0F0B;
        border: 2px solid #28332a;
        border-radius: 20px;
        padding: 40px;
        box-shadow: 0 30px 80px rgba(0,0,0,0.9);
      }
      .auto-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #28332a;
        padding-bottom: 16px;
        margin-bottom: 40px;
      }
      .pipeline-name {
        font-family: monospace;
        font-size: 18px;
        font-weight: 700;
        color: #FFFFFF;
      }
      .pipeline-name span { color: #D7E83F; }
      .status-pill {
        font-family: monospace;
        font-size: 12px;
        background: rgba(215, 232, 63, 0.15);
        border: 1px solid #D7E83F;
        color: #D7E83F;
        padding: 6px 14px;
        border-radius: 20px;
        font-weight: bold;
      }
      .node-flow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .node-box {
        flex: 1;
        background: #172018;
        border: 2px solid #3d4a3e;
        border-radius: 14px;
        padding: 24px 20px;
        position: relative;
      }
      .node-box.active {
        border-color: #D7E83F;
        box-shadow: 0 0 25px rgba(215, 232, 63, 0.2);
      }
      .node-step {
        font-family: monospace;
        font-size: 11px;
        color: #D7E83F;
        margin-bottom: 8px;
        text-transform: uppercase;
      }
      .node-title {
        font-size: 20px;
        font-weight: 800;
        color: #FFFFFF;
        line-height: 1.1;
        margin-bottom: 12px;
      }
      .node-meta {
        font-family: monospace;
        font-size: 11px;
        color: rgba(255,255,255,0.6);
      }
      .connector-arrow {
        width: 40px;
        height: 2px;
        background: #D7E83F;
        position: relative;
        flex-shrink: 0;
      }
      .connector-arrow::after {
        content: '';
        position: absolute;
        right: 0;
        top: -4px;
        width: 10px;
        height: 10px;
        border-top: 2px solid #D7E83F;
        border-right: 2px solid #D7E83F;
        transform: rotate(45deg);
      }
      .metrics-strip {
        margin-top: 40px;
        padding: 20px;
        background: #121713;
        border-radius: 12px;
        border: 1px solid #202b22;
        display: flex;
        justify-content: space-around;
        text-align: center;
      }
      .metric-val {
        font-size: 26px;
        font-weight: 900;
        color: #D7E83F;
        font-family: monospace;
      }
      .metric-lbl {
        font-size: 11px;
        color: rgba(255,255,255,0.6);
        text-transform: uppercase;
        font-family: monospace;
        margin-top: 4px;
      }
    </style>
  </head>
  <body>
    <div class="automation-card">
      <div class="auto-header">
        <div class="pipeline-name">PIPELINE <span>// AUTONOMOUS CORE</span></div>
        <div class="status-pill">● EXECUTING AT SCALE</div>
      </div>

      <div class="node-flow">
        <div class="node-box">
          <div class="node-step">01. INGEST</div>
          <div class="node-title">RAW INPUT TRIGGER</div>
          <div class="node-meta">WEBHOOK / API STREAM</div>
        </div>

        <div class="connector-arrow"></div>

        <div class="node-box active">
          <div class="node-step">02. ENGINE</div>
          <div class="node-title">AI LOGIC &amp; ROUTING</div>
          <div class="node-meta" style="color: #D7E83F;">ANGORA ORCHESTRATION</div>
        </div>

        <div class="connector-arrow"></div>

        <div class="node-box">
          <div class="node-step">03. OUTPUT</div>
          <div class="node-title">MEASURABLE RESULT</div>
          <div class="node-meta">INSTANT DEPLOYMENT</div>
        </div>
      </div>

      <div class="metrics-strip">
        <div>
          <div class="metric-val">100x</div>
          <div class="metric-lbl">VELOCITY BOOST</div>
        </div>
        <div>
          <div class="metric-val">0.02s</div>
          <div class="metric-lbl">PIPELINE LATENCY</div>
        </div>
        <div>
          <div class="metric-val">ZERO</div>
          <div class="metric-lbl">MANUAL BOTTLENECK</div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
  await page.setContent(automationHtml);
  const autoPath = path.join(outDir, 'angora-automation-nodes.png');
  await page.locator('.automation-card').screenshot({ path: autoPath, omitBackground: true });
  console.log('Rendered automation nodes:', autoPath);

  await browser.close();
  console.log('All bespoke collage assets successfully generated!');
}

renderCollageAssets().catch(err => {
  console.error('Asset render error:', err);
  process.exit(1);
});
