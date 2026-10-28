/**
 * Milestone 1 Verification Script:
 * 1. Generate one real sound effect using Soundbox
 * 2. Preview and validate non-silence
 * 3. Export video containing that sound effect using MotionLab FFmpeg engine
 * 4. Verify exported MP4 has synchronized, audible audio stream
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const SOUNDBOX_URL = 'http://127.0.0.1:17494';
const EXPORT_API_URL = 'http://127.0.0.1:5170/api/export';

async function runMilestone1Verification() {
  console.log('=== MILESTONE 1 VERIFICATION: SOUNDBOX SFX TO EXPORTED VIDEO ===');

  // Step 1: Health Check
  console.log('1. Checking Soundbox backend health...');
  const healthRes = await fetch(`${SOUNDBOX_URL}/api/health`);
  if (!healthRes.ok) throw new Error('Soundbox backend offline');
  const health = await healthRes.json();
  console.log('   Soundbox Status:', health);

  // Step 2: Generate Real Sound Effect
  console.log('2. Generating real sound effect: "Deep cinematic bass whoosh with metallic air sweep"...');
  const genRes = await fetch(`${SOUNDBOX_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Deep cinematic bass whoosh with metallic air sweep',
      duration: 1.5,
      model: 'stable-audio-sfx-small',
      seed: 4242,
    }),
  });

  if (!genRes.ok) throw new Error(`Generation failed: ${genRes.statusText}`);
  const genData = await genRes.json();
  console.log('   Generated Sound ID:', genData.id, 'URL:', genData.audio_url);

  // Fetch audio WAV
  const wavUrl = genData.audio_url.startsWith('http')
    ? genData.audio_url
    : `${SOUNDBOX_URL}${genData.audio_url}`;
  const wavRes = await fetch(wavUrl);
  const wavArrayBuf = await wavRes.arrayBuffer();
  const wavBuffer = Buffer.from(wavArrayBuf);
  console.log(`   Fetched WAV: ${wavBuffer.length} bytes`);

  // Step 3: Validate Audio Non-Silence
  const tempWavPath = path.resolve('public', 'sfx', 'test-sfx-audition.wav');
  fs.writeFileSync(tempWavPath, wavBuffer);

  const volumeOut = execSync(
    `ffmpeg -i "${tempWavPath}" -af "volumedetect" -f null - 2>&1`,
    { encoding: 'utf-8' }
  );

  const maxVolMatch = volumeOut.match(/max_volume:\s*(-?[\d.]+)\s*dB/);
  const meanVolMatch = volumeOut.match(/mean_volume:\s*(-?[\d.]+)\s*dB/);
  const maxVol = maxVolMatch ? parseFloat(maxVolMatch[1]) : -100;
  const meanVol = meanVolMatch ? parseFloat(meanVolMatch[1]) : -100;

  console.log(`   Audio Quality Report: Max Volume = ${maxVol} dB, Mean Volume = ${meanVol} dB`);
  if (maxVol < -45) {
    throw new Error('FAIL: Generated sound effect is silent!');
  }
  console.log('   PASS: Sound effect contains real, audible acoustic energy!');

  // Step 4: Export Video with this Sound Effect
  console.log('4. Initializing MotionLab FFmpeg export job with sound effect...');
  const jobId = `job-sfx-test-${Date.now().toString(36)}`;
  const audioWavBase64 = wavBuffer.toString('base64');

  const startRes = await fetch(`${EXPORT_API_URL}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId,
      width: 1280,
      height: 720,
      fps: 30,
      totalFrames: 45, // 1.5 seconds at 30 fps
      audioWavBase64,
    }),
  });

  if (!startRes.ok) throw new Error(`Export start failed: ${await startRes.text()}`);
  console.log('   Export job started successfully:', jobId);

  // Send 45 frames (solid blue canvas with moving white rectangle in base64 PNG)
  console.log('5. Rendering and streaming 45 frames...');
  // A minimal 1280x720 1-pixel or solid PNG header base64 or generated raw frame
  // Using a raw RGBA or simple SVG-to-PNG or simple 1x1 base64 image scaled
  // The FFmpeg plugin accepts base64 dataUrl (e.g. "data:image/png;base64,...")
  // Let's create a real 1280x720 PNG using ffmpeg or pure node buffer
  const sampleFramePath = path.resolve('public', 'test-frame-720p.jpg');
  execSync(
    `ffmpeg -y -f lavfi -i "color=c=#0f172a:s=1280x720" -frames:v 1 "${sampleFramePath}"`,
    { stdio: 'pipe' }
  );
  const sampleFrameBuffer = fs.readFileSync(sampleFramePath);

  for (let f = 0; f < 45; f++) {
    const frameRes = await fetch(`${EXPORT_API_URL}/frame`, {
      method: 'POST',
      headers: {
        'x-job-id': jobId,
        'Content-Type': 'image/jpeg',
      },
      body: sampleFrameBuffer,
    });
    if (!frameRes.ok) throw new Error(`Frame ${f} failed: ${await frameRes.text()}`);
  }
  console.log('   All 45 frames submitted.');

  // Finish Export
  console.log('6. Finalizing MP4 container and muxing audio...');
  const finishRes = await fetch(`${EXPORT_API_URL}/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId }),
  });

  if (!finishRes.ok) throw new Error(`Export finish failed: ${await finishRes.text()}`);
  const finishData = await finishRes.json();
  console.log('   Export Finished Successfully!', finishData);

  // Step 5: Verify Final MP4 with ffprobe
  const downloadUrl = `http://127.0.0.1:5170${finishData.downloadUrl}`;
  console.log(`7. Downloading exported MP4 from: ${downloadUrl}`);
  const mp4Res = await fetch(downloadUrl);
  const mp4Buffer = Buffer.from(await mp4Res.arrayBuffer());
  const exportedMp4Path = path.resolve('public', 'exports', 'milestone1-sfx-master.mp4');
  fs.mkdirSync(path.dirname(exportedMp4Path), { recursive: true });
  fs.writeFileSync(exportedMp4Path, mp4Buffer);
  console.log(`   Saved Master Exported MP4 (${mp4Buffer.length} bytes): ${exportedMp4Path}`);
  const probeOutput = execSync(
    `ffprobe -v error -show_entries stream=codec_type,codec_name,duration,channels -of json "${exportedMp4Path}"`,
    { encoding: 'utf-8' }
  );
  const probe = JSON.parse(probeOutput);
  console.log('   Streams detected:', probe.streams);

  const videoStream = probe.streams.find((s) => s.codec_type === 'video');
  const audioStream = probe.streams.find((s) => s.codec_type === 'audio');

  if (!videoStream || videoStream.codec_name !== 'h264') {
    throw new Error('FAIL: Master video is missing H.264 stream!');
  }
  if (!audioStream || audioStream.codec_name !== 'aac') {
    throw new Error('FAIL: Master video is missing AAC audio stream!');
  }

  // Audio volume verification on exported MP4
  const mp4AudioVol = execSync(
    `ffmpeg -i "${exportedMp4Path}" -af "volumedetect" -f null - 2>&1`,
    { encoding: 'utf-8' }
  );
  const mp4MaxVol = parseFloat(mp4AudioVol.match(/max_volume:\s*(-?[\d.]+)\s*dB/)[1]);
  console.log(`   Exported MP4 Max Volume: ${mp4MaxVol} dB`);

  if (mp4MaxVol < -40) {
    throw new Error('FAIL: Exported video audio stream is silent!');
  }

  console.log('\n============================================================');
  console.log('🎉 VERTICAL SLICE 1 VERIFIED SUCCESSFULLY!');
  console.log('Soundbox AI sound generated, verified audible, placed on audio track,');
  console.log(`and cleanly exported to master video: ${exportedMp4Path}`);
  console.log('============================================================\n');
}

runMilestone1Verification().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
