import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../public/test-media');
fs.mkdirSync(outDir, { recursive: true });

console.log('Generating local test media in', outDir);

// 1. Video Clip A: 3.0s 1280x720 30fps SMPTE bars + moving counter box + 440Hz sine tone
const clipAPath = path.join(outDir, 'clip-a-studio.mp4');
execFileSync('ffmpeg', [
  '-y',
  '-f', 'lavfi',
  '-i', 'testsrc2=size=1280x720:rate=30:duration=3',
  '-f', 'lavfi',
  '-i', 'sine=frequency=440:sample_rate=44100:duration=3',
  '-c:v', 'libx264',
  '-preset', 'ultrafast',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '128k',
  '-movflags', '+faststart',
  clipAPath,
]);
console.log('Generated:', clipAPath);

// 2. Video Clip B: 3.0s 1280x720 30fps color grid / mandelbrot + 660Hz sine tone
const clipBPath = path.join(outDir, 'clip-b-motion.mp4');
execFileSync('ffmpeg', [
  '-y',
  '-f', 'lavfi',
  '-i', 'smptebars=size=1280x720:rate=30:duration=3',
  '-f', 'lavfi',
  '-i', 'sine=frequency=660:sample_rate=44100:duration=3',
  '-vf', 'negate,hue=h=120:s=1.5',
  '-c:v', 'libx264',
  '-preset', 'ultrafast',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '128k',
  '-movflags', '+faststart',
  clipBPath,
]);
console.log('Generated:', clipBPath);

// 3. Background Audio Track: 4.0s stereo harmonic chord WAV
const audioWavPath = path.join(outDir, 'ambient-score.wav');
execFileSync('ffmpeg', [
  '-y',
  '-f', 'lavfi',
  '-i', 'aevalsrc=0.25*sin(2*PI*261.63*t)+0.2*sin(2*PI*329.63*t)+0.2*sin(2*PI*392.00*t):s=44100:c=stereo:d=4',
  '-c:a', 'pcm_s16le',
  audioWavPath,
]);
console.log('Generated:', audioWavPath);

// 4. Image Overlay Asset: 640x360 PNG graphic card
const imagePngPath = path.join(outDir, 'graphic-card.png');
execFileSync('ffmpeg', [
  '-y',
  '-f', 'lavfi',
  '-i', 'color=c=#1e40af:s=640x360:d=1',
  '-vf', 'drawbox=x=20:y=20:w=600:h=320:color=white@0.85:t=6',
  '-frames:v', '1',
  imagePngPath,
]);
console.log('Generated:', imagePngPath);

// 5. Invalid/Unsupported codec file (.mov with corrupted/non-decodable bitstream) to test codec verification
const badCodecPath = path.join(outDir, 'unsupported-raw-codec.mov');
fs.writeFileSync(badCodecPath, Buffer.from('NOT_A_VALID_MOV_BITSTREAM_FOR_CODEC_DETECTION_TEST'));
console.log('Generated:', badCodecPath);

console.log('All local test media fixtures generated successfully.');
