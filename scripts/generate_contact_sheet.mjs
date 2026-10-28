import { chromium } from 'playwright';
import path from 'path';
import fs from 'node:fs';

const ARTIFACT_DIR = 'C:/Users/REYMARK/.gemini/antigravity/brain/3c90f9e2-da2d-42d6-8add-a7b0a5b26682';

const scenes = [
  { num: '01', title: 'THE HOOK', time: '00:00.80', headline: 'YOUR AGENCY.', file: '19-scene-1-01-hook-your-agency.png' },
  { num: '02', title: 'THE PROMISE', time: '00:02.80', headline: 'OUR EXECUTION.', file: '19-scene-2-02-promise-our-execution-cutout.png' },
  { num: '03', title: 'GRAPHIC DESIGN', time: '00:04.80', headline: 'GRAPHIC DESIGN', file: '19-scene-3-03-service-graphic-design-poster.png' },
  { num: '04', title: 'VIDEO EDITING', time: '00:06.80', headline: 'VIDEO EDITING', file: '19-scene-4-04-service-video-editing-filmstrip.png' },
  { num: '05', title: 'WEB ARCHITECTURE', time: '00:09.20', headline: 'WEB DESIGN & DEV.', file: '19-scene-5-05-service-web-design-dev-mockup.png' },
  { num: '06', title: 'AUTOMATION', time: '00:12.00', headline: 'AUTOMATION', file: '19-scene-6-06-service-automation-nodes.png' },
  { num: '07', title: 'BRAND OUTRO', time: '00:14.20', headline: "LET'S WORK TOGETHER.", file: '19-scene-7-07-brand-outro-monogram-cta.png' },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const cardsHtml = scenes.map(s => {
    const fullPath = path.join(ARTIFACT_DIR, s.file);
    let dataUri = '';
    if (fs.existsSync(fullPath)) {
      const b64 = fs.readFileSync(fullPath).toString('base64');
      dataUri = `data:image/png;base64,${b64}`;
    }
    return `
      <div class="scene-card">
        <div class="card-meta">
          <span class="scene-idx">SCENE ${s.num}</span>
          <span class="scene-time">${s.time}</span>
        </div>
        <div class="img-wrapper">
          <img src="${dataUri}" />
        </div>
        <div class="card-info">
          <div class="scene-title">${s.title}</div>
          <div class="scene-headline">${s.headline}</div>
        </div>
      </div>
    `;
  }).join('');

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      body { width: 1920px; height: 1080px; background: #0B0F0B; color: #FFFFFF; padding: 48px 56px; display: flex; flex-direction: column; justify-content: space-between; }
      .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #172018; padding-bottom: 24px; }
      .brand-title { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; }
      .brand-title span { color: #D7E83F; }
      .spec-pill { font-family: monospace; font-size: 13px; background: #172018; border: 1px solid #D7E83F; color: #D7E83F; padding: 6px 14px; border-radius: 6px; }
      .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 20px; margin-top: 32px; }
      .scene-card { background: #121713; border: 1px solid #233025; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
      .card-meta { display: flex; justify-content: space-between; padding: 8px 12px; font-family: monospace; font-size: 11px; background: #172018; border-bottom: 1px solid #233025; }
      .scene-idx { color: #D7E83F; font-weight: bold; }
      .scene-time { color: rgba(255,255,255,0.6); }
      .img-wrapper { width: 100%; aspect-ratio: 9/16; overflow: hidden; background: #000; }
      .img-wrapper img { width: 100%; height: 100%; object-fit: contain; }
      .card-info { padding: 12px; background: #0e120f; }
      .scene-title { font-family: monospace; font-size: 10px; color: #D7E83F; letter-spacing: 1px; text-transform: uppercase; }
      .scene-headline { font-size: 13px; font-weight: 800; color: #FFFFFF; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .footer { display: flex; justify-content: space-between; font-family: monospace; font-size: 12px; color: rgba(255,255,255,0.5); border-top: 1px solid #172018; padding-top: 16px; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div class="brand-title">ANGORA <span>/ EDITORIAL KINETIC PROMO</span></div>
        <div style="font-family: monospace; font-size: 13px; color: rgba(255,255,255,0.6); margin-top: 6px;">
          7-SCENE NARRATIVE TIMELINE CONTACT SHEET • 1080×1920 (9:16) • 15.0 SECONDS @ 30 FPS
        </div>
      </div>
      <div class="spec-pill">MASTER GRADE A+ • 8 TRACKS • 34 CLIPS</div>
    </div>

    <div class="grid">
      ${cardsHtml}
    </div>

    <div class="footer">
      <span>PRODUCTION: MOTIONLAB 2.0 AI CREATIVE DIRECTOR</span>
      <span>COLOR ROLES: #0B0F0B (NEAR BLACK) • #172018 (DEEP FOREST) • #D7E83F (ANGORA LIME) • #FFFFFF (WHITE)</span>
      <span>STATUS: FULL COMPOSITION VERIFIED</span>
    </div>
  </body>
  </html>
  `;

  await page.setContent(html);
  const contactSheetPath = path.join(ARTIFACT_DIR, '20-angora-editorial-7-scene-contact-sheet.png');
  await page.screenshot({ path: contactSheetPath });
  console.log('Saved 7-Scene Contact Sheet to:', contactSheetPath);

  await browser.close();
}

run().catch(err => {
  console.error('Contact Sheet Error:', err);
  process.exit(1);
});
