import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../public/angora-assets');
fs.mkdirSync(outDir, { recursive: true });

const uploadedDir =
  'C:/Users/REYMARK/.gemini/antigravity/brain/3c90f9e2-da2d-42d6-8add-a7b0a5b26682/.user_uploaded';

const srcRibbonJpg = path.join(uploadedDir, 'media_1793101903530_190b48d0.jpg');
const srcWatermarkJpg = path.join(uploadedDir, 'media_1793101913452_9f596c3f.jpg');
const srcBannerPng = path.join(uploadedDir, 'media_1793101938244_bd077ffa.png');

// 1. Copy original brand references into public/angora-assets
const ribbonCopy = path.join(outDir, 'angora-ribbon-a-source.jpg');
const watermarkCopy = path.join(outDir, 'angora-watermark-source.jpg');
const bannerCopy = path.join(outDir, 'angora-banner-reference.png');

fs.copyFileSync(srcRibbonJpg, ribbonCopy);
fs.copyFileSync(srcWatermarkJpg, watermarkCopy);
fs.copyFileSync(srcBannerPng, bannerCopy);
console.log('Copied original Angora brand assets to', outDir);

// 2. Extract razor-sharp transparent PNG of the Angora Ribbon-A symbol (1080x1080 RGBA)
// The Ribbon-A has high green/lime dominance (G - B > 38) whereas the dark background/glow has G - B < 25.
const symbolTransparentPath = path.join(outDir, 'angora-symbol-transparent.png');
execFileSync('ffmpeg', [
  '-y',
  '-i',
  ribbonCopy,
  '-vf',
  "scale=1080:1080:flags=lanczos,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='clip((g(X,Y)-92)*14,0,255)'",
  '-frames:v',
  '1',
  symbolTransparentPath,
]);
console.log('Generated transparent symbol:', symbolTransparentPath);

// 3. Generate Primary Background Plate (1080x1920 #0B0F0B with subtle #172018 architectural frame lines)
const bgPrimaryPath = path.join(outDir, 'angora-bg-primary.png');
execFileSync('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  'color=c=#0B0F0B:s=1080x1920:d=1',
  '-vf',
  [
    'drawbox=x=64:y=120:w=952:h=1680:color=#172018@0.90:t=2',
    'drawbox=x=64:y=120:w=72:h=4:color=#D7E83F@0.75:t=fill',
    'drawbox=x=944:y=1796:w=72:h=4:color=#D7E83F@0.75:t=fill',
  ].join(','),
  '-frames:v',
  '1',
  bgPrimaryPath,
]);
console.log('Generated primary 9:16 background:', bgPrimaryPath);

// 4. Generate Secondary Watermark Background Plate (1080x1920 seamless #0B0F0B + extracted olive watermark Ribbon-A)
const bgWatermarkPath = path.join(outDir, 'angora-bg-watermark.png');
execFileSync('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  'color=c=#0B0F0B:s=1080x1920:d=1',
  '-i',
  watermarkCopy,
  '-filter_complex',
  "[1:v]scale=1160:1160:flags=lanczos,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='clip((g(X,Y)-31)*10,0,200)'[wm];[0:v][wm]overlay=-40:380,drawbox=x=64:y=120:w=952:h=1680:color=#172018@0.95:t=2,drawbox=x=64:y=120:w=952:h=3:color=#D7E83F@0.45:t=fill,drawbox=x=64:y=1797:w=952:h=3:color=#D7E83F@0.45:t=fill",
  '-frames:v',
  '1',
  bgWatermarkPath,
]);
console.log('Generated watermark 9:16 background:', bgWatermarkPath);

// 5. Generate Lime Accent Line Graphic Element (1080x40 RGBA PNG)
const accentLinePath = path.join(outDir, 'angora-accent-line.png');
execFileSync('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  'color=c=black@0.0:s=1080x40:d=1,format=rgba',
  '-vf',
  'drawbox=x=140:y=15:w=800:h=10:color=#D7E83F@1.0:t=fill:replace=1,drawbox=x=140:y=15:w=180:h=10:color=#C8FF20@1.0:t=fill:replace=1',
  '-frames:v',
  '1',
  accentLinePath,
]);
console.log('Generated lime accent line:', accentLinePath);

// 6. Generate Geometric Service Card Frame (1080x420 RGBA PNG)
// Secondary background #172018 with #D7E83F border and #C8FF20 left structural bar
const serviceCardPath = path.join(outDir, 'angora-service-card.png');
execFileSync('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  'color=c=black@0.0:s=1080x420:d=1,format=rgba',
  '-vf',
  [
    'drawbox=x=90:y=30:w=900:h=360:color=#172018@0.94:t=fill:replace=1',
    'drawbox=x=90:y=30:w=900:h=360:color=#D7E83F@0.85:t=4:replace=1',
    'drawbox=x=90:y=30:w=16:h=360:color=#C8FF20@1.0:t=fill:replace=1',
    'drawbox=x=920:y=60:w=40:h=6:color=#D7E83F@1.0:t=fill:replace=1',
  ].join(','),
  '-frames:v',
  '1',
  serviceCardPath,
]);
console.log('Generated geometric service card:', serviceCardPath);

// 7. Generate Audio Track A1: Minimal Electronic Background Pulse (15.0s stereo 44.1kHz WAV)
const bgmWavPath = path.join(outDir, 'angora-electronic-pulse-bgm.wav');
const pulseExpr =
  '0.18*sin(2*PI*55*t)*(0.65+0.35*sin(2*PI*2*t))+' +
  '0.10*sin(2*PI*110*t)*(0.5+0.5*cos(2*PI*4*t))+' +
  '0.06*sin(2*PI*220*t)*exp(-mod(t,0.5)*6)+' +
  '0.04*sin(2*PI*329.63*t)*exp(-mod(t+0.25,0.5)*7)';
execFileSync('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  `aevalsrc='${pulseExpr}':s=44100:c=stereo:d=15`,
  '-af',
  'afade=t=in:st=0:d=0.8,afade=t=out:st=13.8:d=1.2',
  '-c:a',
  'pcm_s16le',
  bgmWavPath,
]);
console.log('Generated 15s minimal electronic BGM:', bgmWavPath);

// 8. Generate Audio SFX 1: Soft Logo Reveal Sound (1.5s stereo WAV)
const sfxLogoPath = path.join(outDir, 'angora-sfx-logo-reveal.wav');
execFileSync('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  `aevalsrc='0.22*sin(2*PI*440*t)*exp(-t*2.2)+0.16*sin(2*PI*659.25*t)*exp(-t*1.8)+0.12*sin(2*PI*880*t)*exp(-t*2.8)':s=44100:c=stereo:d=1.5`,
  '-af',
  'afade=t=in:st=0:d=0.12,afade=t=out:st=0.9:d=0.6',
  '-c:a',
  'pcm_s16le',
  sfxLogoPath,
]);
console.log('Generated logo reveal SFX:', sfxLogoPath);

// 9. Generate Audio SFX 2: Subtle Transition Whoosh (0.65s stereo WAV)
const sfxWhooshPath = path.join(outDir, 'angora-sfx-whoosh.wav');
execFileSync('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  `aevalsrc='0.24*sin(2*PI*(140+360*t)*t)*sin(PI*t/0.65)':s=44100:c=stereo:d=0.65`,
  '-af',
  'afade=t=in:st=0:d=0.1,afade=t=out:st=0.35:d=0.3',
  '-c:a',
  'pcm_s16le',
  sfxWhooshPath,
]);
console.log('Generated transition whoosh SFX:', sfxWhooshPath);

// 10. Generate Audio SFX 3: Soft CTA Impact (1.2s stereo WAV)
const sfxImpactPath = path.join(outDir, 'angora-sfx-cta-impact.wav');
execFileSync('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  `aevalsrc='0.28*sin(2*PI*82.41*t)*exp(-t*3.5)+0.15*sin(2*PI*220*t)*exp(-t*2.5)+0.12*sin(2*PI*329.63*t)*exp(-t*2.2)':s=44100:c=stereo:d=1.2`,
  '-af',
  'afade=t=in:st=0:d=0.04,afade=t=out:st=0.6:d=0.6',
  '-c:a',
  'pcm_s16le',
  sfxImpactPath,
]);
console.log('Generated CTA impact SFX:', sfxImpactPath);

// 11. V2 Oversized Lime Accent Block (1080x260 RGBA PNG)
const v2LimeBlockPath = path.join(outDir, 'angora-v2-lime-block.png');
execFileSync('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  'color=c=black@0.0:s=1080x260:d=1,format=rgba',
  '-vf',
  [
    'drawbox=x=80:y=20:w=920:h=220:color=#D7E83F@1.0:t=fill:replace=1',
    'drawbox=x=80:y=20:w=22:h=220:color=#0B0F0B@1.0:t=fill:replace=1',
    'drawbox=x=964:y=44:w=16:h=16:color=#0B0F0B@1.0:t=fill:replace=1',
  ].join(','),
  '-frames:v',
  '1',
  v2LimeBlockPath,
]);

// 12. V2 Service 01 — Web Design UI Wireframe Plate (1080x760 RGBA PNG)
const v2WebDesignPath = path.join(outDir, 'angora-v2-ui-webdesign.png');
execFileSync('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  'color=c=black@0.0:s=1080x760:d=1,format=rgba',
  '-vf',
  [
    'drawbox=x=80:y=20:w=920:h=720:color=#172018@0.96:t=fill:replace=1',
    'drawbox=x=80:y=20:w=920:h=720:color=#D7E83F@0.90:t=3:replace=1',
    // Browser Navbar
    'drawbox=x=80:y=20:w=920:h=68:color=#0B0F0B@1.0:t=fill:replace=1',
    'drawbox=x=80:y=86:w=920:h=3:color=#D7E83F@0.85:t=fill:replace=1',
    'drawbox=x=112:y=46:w=14:h=14:color=#D7E83F@1.0:t=fill:replace=1',
    'drawbox=x=136:y=46:w=14:h=14:color=#FFFFFF@0.5:t=fill:replace=1',
    'drawbox=x=160:y=46:w=14:h=14:color=#FFFFFF@0.25:t=fill:replace=1',
    // Hero Section Container
    'drawbox=x=116:y=118:w=848:h=310:color=#0B0F0B@0.95:t=fill:replace=1',
    'drawbox=x=116:y=118:w=10:h=310:color=#D7E83F@1.0:t=fill:replace=1',
    // 3 Content Feature Cards
    'drawbox=x=116:y=458:w=264:h=244:color=#0B0F0B@0.95:t=fill:replace=1',
    'drawbox=x=116:y=458:w=264:h=6:color=#D7E83F@1.0:t=fill:replace=1',
    'drawbox=x=408:y=458:w=264:h=244:color=#0B0F0B@0.95:t=fill:replace=1',
    'drawbox=x=408:y=458:w=264:h=6:color=#FFFFFF@0.85:t=fill:replace=1',
    'drawbox=x=700:y=458:w=264:h=244:color=#0B0F0B@0.95:t=fill:replace=1',
    'drawbox=x=700:y=458:w=264:h=6:color=#D7E83F@1.0:t=fill:replace=1',
  ].join(','),
  '-frames:v',
  '1',
  v2WebDesignPath,
]);

// 13. V2 Service 02 — Web Development Code Editor + Preview Plate (1080x760 RGBA PNG)
const v2WebDevPath = path.join(outDir, 'angora-v2-ui-webdev.png');
execFileSync('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  'color=c=black@0.0:s=1080x760:d=1,format=rgba',
  '-vf',
  [
    // Code Editor Top Window
    'drawbox=x=80:y=20:w=920:h=440:color=#0B0F0B@0.97:t=fill:replace=1',
    'drawbox=x=80:y=20:w=920:h=440:color=#D7E83F@0.85:t=3:replace=1',
    'drawbox=x=80:y=20:w=920:h=54:color=#172018@1.0:t=fill:replace=1',
    'drawbox=x=80:y=74:w=68:h=386:color=#172018@0.75:t=fill:replace=1',
    // Code token bars
    'drawbox=x=176:y=112:w=140:h=10:color=#D7E83F@0.9:t=fill:replace=1',
    'drawbox=x=330:y=112:w=260:h=10:color=#FFFFFF@0.75:t=fill:replace=1',
    'drawbox=x=206:y=146:w=380:h=10:color=#FFFFFF@0.45:t=fill:replace=1',
    'drawbox=x=206:y=180:w=290:h=10:color=#D7E83F@0.85:t=fill:replace=1',
    // Bottom Live Browser Preview & Telemetry Panel
    'drawbox=x=80:y=486:w=920:h=254:color=#172018@0.96:t=fill:replace=1',
    'drawbox=x=80:y=486:w=920:h=254:color=#D7E83F@0.90:t=3:replace=1',
    'drawbox=x=80:y=486:w=14:h=254:color=#D7E83F@1.0:t=fill:replace=1',
    'drawbox=x=124:y=684:w=832:h=16:color=#0B0F0B@1.0:t=fill:replace=1',
    'drawbox=x=124:y=684:w=790:h=16:color=#D7E83F@1.0:t=fill:replace=1',
  ].join(','),
  '-frames:v',
  '1',
  v2WebDevPath,
]);

// 14. V2 Service 03 — Graphic Design Swiss Poster Grid Plate (1080x760 RGBA PNG)
const v2GraphicPath = path.join(outDir, 'angora-v2-ui-graphic.png');
execFileSync('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  'color=c=black@0.0:s=1080x760:d=1,format=rgba',
  '-vf',
  [
    'drawbox=x=80:y=20:w=920:h=720:color=#172018@0.96:t=fill:replace=1',
    'drawbox=x=80:y=20:w=920:h=720:color=#D7E83F@0.90:t=4:replace=1',
    // Swiss Grid Quadrants
    'drawbox=x=540:y=20:w=3:h=720:color=#D7E83F@0.55:t=fill:replace=1',
    'drawbox=x=80:y=450:w=920:h=3:color=#D7E83F@0.55:t=fill:replace=1',
    // Brand Swatch Blocks
    'drawbox=x=116:y=56:w=120:h=120:color=#D7E83F@1.0:t=fill:replace=1',
    'drawbox=x=252:y=56:w=120:h=120:color=#0B0F0B@1.0:t=fill:replace=1',
    'drawbox=x=388:y=56:w=120:h=120:color=#FFFFFF@0.95:t=fill:replace=1',
    // Poster Canvas Frame Right
    'drawbox=x=576:y=56:w=388:h=358:color=#0B0F0B@0.95:t=fill:replace=1',
  ].join(','),
  '-frames:v',
  '1',
  v2GraphicPath,
]);

// 15. V2 Service 04 — Video Editing NLE Timeline & Monitor Plate (1080x760 RGBA PNG)
const v2VideoPath = path.join(outDir, 'angora-v2-ui-video.png');
execFileSync('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  'color=c=black@0.0:s=1080x760:d=1,format=rgba',
  '-vf',
  [
    'drawbox=x=80:y=20:w=920:h=720:color=#0B0F0B@0.97:t=fill:replace=1',
    'drawbox=x=80:y=20:w=920:h=720:color=#D7E83F@0.90:t=3:replace=1',
    // Top Program Monitor Viewport
    'drawbox=x=260:y=46:w=560:h=270:color=#172018@1.0:t=fill:replace=1',
    'drawbox=x=260:y=46:w=560:h=270:color=#D7E83F@0.75:t=2:replace=1',
    // Multitrack Timeline Lanes (V3, V2, V1, A1)
    'drawbox=x=110:y=350:w=860:h=72:color=#172018@0.95:t=fill:replace=1',
    'drawbox=x=180:y=360:w=340:h=52:color=#D7E83F@0.90:t=fill:replace=1',
    'drawbox=x=540:y=360:w=380:h=52:color=#D7E83F@0.45:t=fill:replace=1',
    'drawbox=x=110:y=436:w=860:h=72:color=#172018@0.95:t=fill:replace=1',
    'drawbox=x=140:y=446:w=520:h=52:color=#FFFFFF@0.85:t=fill:replace=1',
    'drawbox=x=110:y=522:w=860:h=72:color=#172018@0.95:t=fill:replace=1',
    'drawbox=x=260:y=532:w=640:h=52:color=#D7E83F@0.85:t=fill:replace=1',
    'drawbox=x=110:y=608:w=860:h=72:color=#172018@0.95:t=fill:replace=1',
    'drawbox=x=120:y=624:w=830:h=40:color=#D7E83F@0.35:t=fill:replace=1',
  ].join(','),
  '-frames:v',
  '1',
  v2VideoPath,
]);

// 16. V2 Service 05 — Automation Node Graph Diagram Plate (1080x760 RGBA PNG)
const v2AutomationPath = path.join(outDir, 'angora-v2-ui-automation.png');
execFileSync('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  'color=c=black@0.0:s=1080x760:d=1,format=rgba',
  '-vf',
  [
    'drawbox=x=80:y=20:w=920:h=720:color=#0B0F0B@0.96:t=fill:replace=1',
    'drawbox=x=80:y=20:w=920:h=720:color=#D7E83F@0.85:t=3:replace=1',
    // Connector Conduits
    'drawbox=x=340:y=256:w=80:h=8:color=#172018@1.0:t=fill:replace=1',
    'drawbox=x=660:y=256:w=80:h=8:color=#172018@1.0:t=fill:replace=1',
    // Node 01 (Trigger)
    'drawbox=x=110:y=130:w=230:h=260:color=#172018@1.0:t=fill:replace=1',
    'drawbox=x=110:y=130:w=230:h=260:color=#D7E83F@0.95:t=3:replace=1',
    'drawbox=x=110:y=130:w=230:h=14:color=#D7E83F@1.0:t=fill:replace=1',
    // Node 02 (AI Router)
    'drawbox=x=420:y=130:w=240:h=260:color=#172018@1.0:t=fill:replace=1',
    'drawbox=x=420:y=130:w=240:h=260:color=#FFFFFF@0.90:t=3:replace=1',
    'drawbox=x=420:y=130:w=240:h=14:color=#FFFFFF@1.0:t=fill:replace=1',
    // Node 03 (Deploy)
    'drawbox=x=740:y=130:w=230:h=260:color=#172018@1.0:t=fill:replace=1',
    'drawbox=x=740:y=130:w=230:h=260:color=#D7E83F@0.95:t=3:replace=1',
    'drawbox=x=740:y=130:w=230:h=14:color=#D7E83F@1.0:t=fill:replace=1',
    // Bottom Execution Telemetry Panel
    'drawbox=x=110:y=440:w=860:h=250:color=#172018@0.95:t=fill:replace=1',
    'drawbox=x=110:y=440:w=12:h=250:color=#D7E83F@1.0:t=fill:replace=1',
  ].join(','),
  '-frames:v',
  '1',
  v2AutomationPath,
]);

// 17. Generate 23.0s Master Motion Design Film Score (angora-beyond-bgm-23s.wav)
const bgmBeyond23sPath = path.join(outDir, 'angora-beyond-bgm-23s.wav');
const beyondPulseExpr =
  '0.20*sin(2*PI*55*t)*(0.68+0.32*sin(2*PI*2*t))+' +
  '0.11*sin(2*PI*110*t)*(0.5+0.5*cos(2*PI*4*t))+' +
  '0.07*sin(2*PI*220*t)*exp(-mod(t,0.5)*5.5)+' +
  '0.05*sin(2*PI*329.63*t)*exp(-mod(t+0.25,0.5)*6.5)+' +
  '0.04*sin(2*PI*440*t)*exp(-mod(t,1.0)*4.0)';
execFileSync('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  `aevalsrc='${beyondPulseExpr}':s=44100:c=stereo:d=23`,
  '-af',
  'afade=t=in:st=0:d=0.9,afade=t=out:st=21.4:d=1.6',
  '-c:a',
  'pcm_s16le',
  bgmBeyond23sPath,
]);
console.log('Generated 23s Beyond Ordinary soundtrack:', bgmBeyond23sPath);

// 18. Generate Audio SFX 4: Geometric Convergence Riser (1.8s stereo WAV)
const sfxRiserPath = path.join(outDir, 'angora-sfx-riser.wav');
execFileSync('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  `aevalsrc='0.22*sin(2*PI*(110+260*t*t)*t)*(t/1.8)+0.12*sin(2*PI*(220+420*t)*t)*(t/1.8)':s=44100:c=stereo:d=1.8`,
  '-af',
  'afade=t=in:st=0:d=0.25,afade=t=out:st=1.55:d=0.25',
  '-c:a',
  'pcm_s16le',
  sfxRiserPath,
]);
console.log('Generated geometric riser SFX:', sfxRiserPath);

// 19. Generate Audio SFX 5: Kinetic Typography Sub Hit (0.85s stereo WAV)
const sfxKineticHitPath = path.join(outDir, 'angora-sfx-kinetic-hit.wav');
execFileSync('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  `aevalsrc='0.30*sin(2*PI*(65+90*exp(-t*18))*t)*exp(-t*5.0)+0.14*sin(2*PI*587.33*t)*exp(-t*9.0)':s=44100:c=stereo:d=0.85`,
  '-af',
  'afade=t=in:st=0:d=0.02,afade=t=out:st=0.45:d=0.4',
  '-c:a',
  'pcm_s16le',
  sfxKineticHitPath,
]);
console.log('Generated kinetic hit SFX:', sfxKineticHitPath);

console.log('All Angora Web Services V1, V2 & Beyond Ordinary (23s) production assets prepared.');

