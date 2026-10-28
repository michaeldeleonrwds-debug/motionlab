import type { Plugin } from 'vite';
import { spawn, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';

interface ExportJob {
  jobId: string;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  receivedFrames: number;
  workDir: string;
  audioPath: string | null;
  outputPath: string;
  ffmpegProc: ChildProcessWithoutNullStreams | null;
  status: 'running' | 'completed' | 'cancelled' | 'error';
  errorMessage?: string;
  stderrLog: string;
  exitPromise?: Promise<number>;
}

const jobs = new Map<string, ExportJob>();

function readBodyBuffer(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function probeMediaFile(filePath: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    execFile(
      'ffprobe',
      [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        filePath,
      ],
      (err, stdout) => {
        if (err) {
          resolve({ error: err.message });
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          resolve({ raw: stdout });
        }
      }
    );
  });
}

export function ffmpegExportPlugin(): Plugin {
  const handleApi = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url || '';
    if (!url.startsWith('/api/export')) {
      next();
      return;
    }

    try {
      if (url === '/api/export/capabilities' && req.method === 'GET') {
        execFile('ffmpeg', ['-version'], (err, stdout) => {
          if (err) {
            sendJson(res, 200, { available: false, error: err.message });
            return;
          }
          const firstLine = stdout.split('\n')[0]?.trim() || 'ffmpeg';
          sendJson(res, 200, {
            available: true,
            version: firstLine,
            videoCodecs: ['H.264 (libx264)'],
            audioCodecs: ['AAC (aac)'],
            resolutions: ['720p (1280x720)', '1080p (1920x1080)'],
            fpsOptions: [24, 30, 60],
          });
        });
        return;
      }

      if (url === '/api/export/start' && req.method === 'POST') {
        const bodyBuf = await readBodyBuffer(req);
        const payload = JSON.parse(bodyBuf.toString('utf-8')) as {
          jobId: string;
          width: number;
          height: number;
          fps: number;
          totalFrames: number;
          audioWavBase64?: string | null;
        };

        const { jobId, width, height, fps, totalFrames, audioWavBase64 } = payload;
        const safeWidth = Math.max(2, Math.round(width / 2) * 2);
        const safeHeight = Math.max(2, Math.round(height / 2) * 2);
        const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `motionlab-export-${jobId}-`));
        const outputPath = path.join(workDir, `export-${jobId}.mp4`);
        let audioPath: string | null = null;

        if (audioWavBase64 && audioWavBase64.length > 0) {
          audioPath = path.join(workDir, 'mixed-audio.wav');
          fs.writeFileSync(audioPath, Buffer.from(audioWavBase64, 'base64'));
        }

        const args: string[] = [
          '-y',
          '-f',
          'image2pipe',
          '-vcodec',
          'mjpeg',
          '-framerate',
          String(fps),
          '-i',
          '-',
        ];

        if (audioPath) {
          args.push('-i', audioPath);
        } else {
          // Generate silent audio track so exported MP4 always contains valid AAC stream
          const durationSec = Math.max(0.1, totalFrames / fps);
          args.push(
            '-f',
            'lavfi',
            '-t',
            durationSec.toFixed(3),
            '-i',
            'anullsrc=channel_layout=stereo:sample_rate=44100'
          );
        }

        args.push(
          '-map',
          '0:v:0',
          '-map',
          '1:a:0',
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-crf',
          '20',
          '-pix_fmt',
          'yuv420p',
          '-vf',
          `scale=${safeWidth}:${safeHeight}:flags=lanczos`,
          '-r',
          String(fps),
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-ar',
          '44100',
          '-ac',
          '2',
          '-movflags',
          '+faststart',
          '-shortest',
          outputPath
        );

        const proc = spawn('ffmpeg', args);
        const job: ExportJob = {
          jobId,
          width: safeWidth,
          height: safeHeight,
          fps,
          totalFrames,
          receivedFrames: 0,
          workDir,
          audioPath,
          outputPath,
          ffmpegProc: proc,
          status: 'running',
          stderrLog: '',
        };

        proc.stderr.on('data', (chunk: Buffer) => {
          job.stderrLog += chunk.toString();
          if (job.stderrLog.length > 16000) {
            job.stderrLog = job.stderrLog.slice(-16000);
          }
        });

        job.exitPromise = new Promise<number>((resolve) => {
          proc.on('close', (code) => {
            if (job.status === 'cancelled') {
              resolve(code ?? -1);
              return;
            }
            if (code === 0) {
              job.status = 'completed';
            } else {
              job.status = 'error';
              job.errorMessage = `FFmpeg exited with code ${code}`;
            }
            resolve(code ?? 1);
          });
          proc.on('error', (err) => {
            job.status = 'error';
            job.errorMessage = err.message;
            resolve(1);
          });
        });

        jobs.set(jobId, job);
        sendJson(res, 200, { ok: true, jobId, width: safeWidth, height: safeHeight, fps });
        return;
      }

      if (url === '/api/export/frame' && req.method === 'POST') {
        const jobId = String(req.headers['x-job-id'] || '');
        const job = jobs.get(jobId);
        if (!job) {
          sendJson(res, 404, { error: 'Export job not found' });
          return;
        }
        if (job.status !== 'running' || !job.ffmpegProc || !job.ffmpegProc.stdin.writable) {
          sendJson(res, 409, { error: `Job is not running (status: ${job.status})` });
          return;
        }

        const frameBuf = await readBodyBuffer(req);
        const canWrite = job.ffmpegProc.stdin.write(frameBuf);
        if (!canWrite) {
          await new Promise<void>((resolve) => job.ffmpegProc!.stdin.once('drain', resolve));
        }
        job.receivedFrames += 1;

        sendJson(res, 200, {
          ok: true,
          receivedFrames: job.receivedFrames,
          totalFrames: job.totalFrames,
        });
        return;
      }

      if (url === '/api/export/finish' && req.method === 'POST') {
        const bodyBuf = await readBodyBuffer(req);
        const { jobId } = JSON.parse(bodyBuf.toString('utf-8')) as { jobId: string };
        const job = jobs.get(jobId);
        if (!job) {
          sendJson(res, 404, { error: 'Export job not found' });
          return;
        }
        if (job.status === 'cancelled') {
          sendJson(res, 499, { error: 'Export job was cancelled' });
          return;
        }

        if (job.ffmpegProc && job.ffmpegProc.stdin.writable) {
          job.ffmpegProc.stdin.end();
        }
        const exitCode = await job.exitPromise;
        if (exitCode !== 0 || !fs.existsSync(job.outputPath)) {
          sendJson(res, 500, {
            error: job.errorMessage || 'FFmpeg failed to encode output video',
            stderr: job.stderrLog.slice(-1500),
          });
          return;
        }

        const stat = fs.statSync(job.outputPath);
        const probe = await probeMediaFile(job.outputPath);

        sendJson(res, 200, {
          ok: true,
          jobId,
          fileSize: stat.size,
          downloadUrl: `/api/export/download/${encodeURIComponent(jobId)}`,
          probe,
        });
        return;
      }

      if (url === '/api/export/cancel' && req.method === 'POST') {
        const bodyBuf = await readBodyBuffer(req);
        const { jobId } = JSON.parse(bodyBuf.toString('utf-8')) as { jobId: string };
        const job = jobs.get(jobId);
        if (!job) {
          sendJson(res, 200, { ok: true, alreadyGone: true });
          return;
        }
        job.status = 'cancelled';
        if (job.ffmpegProc) {
          try {
            job.ffmpegProc.stdin.destroy();
            job.ffmpegProc.kill('SIGKILL');
          } catch {
            // ignore kill errors
          }
        }
        try {
          fs.rmSync(job.workDir, { recursive: true, force: true });
        } catch {
          // ignore cleanup errors
        }
        sendJson(res, 200, { ok: true, status: 'cancelled' });
        return;
      }

      if (url.startsWith('/api/export/download/') && req.method === 'GET') {
        const jobId = decodeURIComponent(url.replace('/api/export/download/', '').split('?')[0]);
        const job = jobs.get(jobId);
        if (!job || !fs.existsSync(job.outputPath)) {
          sendJson(res, 404, { error: 'Exported video file not found' });
          return;
        }
        const stat = fs.statSync(job.outputPath);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Length', String(stat.size));
        res.setHeader('Content-Disposition', `attachment; filename="MotionLab-${jobId}.mp4"`);
        const stream = fs.createReadStream(job.outputPath);
        stream.pipe(res);
        return;
      }

      sendJson(res, 404, { error: 'Unknown export endpoint' });
    } catch (err) {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Internal export server error',
      });
    }
  };

  return {
    name: 'motionlab-ffmpeg-export',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleApi(req, res, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleApi(req, res, next);
      });
    },
  };
}
