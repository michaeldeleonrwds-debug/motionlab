import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BASE_URL = 'http://127.0.0.1:5170';

async function main() {
  console.log('=== VERIFYING 1080x1920 (9:16) PORTRAIT EXPORT VIA FFMPEG ENGINE ===');

  const width = 1080;
  const height = 1920;
  const fps = 30;
  const totalFrames = 30; // 1 second
  const jobId = `job-portrait-test-${Date.now().toString(36)}`;

  console.log(`1. Initializing export job: ${jobId} (${width}x${height} @ ${fps}fps, ${totalFrames} frames)...`);
  const startRes = await fetch(`${BASE_URL}/api/export/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId,
      width,
      height,
      fps,
      totalFrames,
    }),
  });

  if (!startRes.ok) {
    throw new Error(`Failed to start export: ${startRes.status} ${await startRes.text()}`);
  }
  console.log(`   Export Job started successfully: ${jobId}`);

  // Create a 1080x1920 JPEG test frame using ffmpeg
  console.log('2. Generating 1080x1920 test frame via FFmpeg...');
  const testJpgPath = path.resolve('public', 'temp-1080x1920-frame.jpg');
  execSync(
    `ffmpeg -y -f lavfi -i "testsrc=size=${width}x${height}:rate=${fps}" -frames:v 1 "${testJpgPath}"`,
    { stdio: 'pipe' }
  );
  const jpegBuf = fs.readFileSync(testJpgPath);
  console.log(`   Generated JPEG test frame: ${(jpegBuf.length / 1024).toFixed(1)} KB`);

  console.log('3. Streaming 30 frames to FFmpeg stdin...');
  for (let f = 0; f < totalFrames; f++) {
    const frameRes = await fetch(`${BASE_URL}/api/export/frame`, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg',
        'x-job-id': jobId,
      },
      body: jpegBuf,
    });
    if (!frameRes.ok) {
      throw new Error(`Failed to send frame ${f}: ${frameRes.status} ${await frameRes.text()}`);
    }
  }
  console.log('   All 30 frames streamed successfully.');

  console.log('4. Finalizing export job...');
  const finishRes = await fetch(`${BASE_URL}/api/export/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId }),
  });

  if (!finishRes.ok) {
    throw new Error(`Failed to finish export: ${finishRes.status} ${await finishRes.text()}`);
  }

  const result = await finishRes.json();
  console.log('   Export result:', result);

  const downloadUrl = `${BASE_URL}${result.downloadUrl}`;
  console.log(`5. Downloading exported video from ${downloadUrl}...`);
  const videoRes = await fetch(downloadUrl);
  const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

  const outPath = path.resolve('public', 'verify-1080x1920-master.mp4');
  fs.writeFileSync(outPath, videoBuffer);
  console.log(`   Saved video to ${outPath} (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

  console.log('6. Probing exported video with ffprobe...');
  const ffprobeJson = execSync(
    `ffprobe -v quiet -print_format json -show_streams -show_format "${outPath}"`,
    { encoding: 'utf-8' }
  );
  const probeData = JSON.parse(ffprobeJson);
  const videoStream = probeData.streams.find((s) => s.codec_type === 'video');

  console.log(`   Probed Video Codec: ${videoStream.codec_name}`);
  console.log(`   Probed Dimensions: ${videoStream.width} x ${videoStream.height}`);
  console.log(`   Probed Duration: ${probeData.format.duration}s`);
  console.log(`   Probed Pixel Format: ${videoStream.pix_fmt}`);

  if (videoStream.width === 1080 && videoStream.height === 1920) {
    console.log('>>> SUCCESS: Output video is verified 1080x1920 9:16 portrait master! <<<');
  } else {
    throw new Error(`Dimension mismatch: expected 1080x1920, got ${videoStream.width}x${videoStream.height}`);
  }
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
