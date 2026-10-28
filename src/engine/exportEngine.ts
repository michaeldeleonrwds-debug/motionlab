import type {
  ExportSettings,
  MediaAsset,
  ProjectData,
} from '../types/editor';
import {
  getCompositedVisualClipsAtTime,
  getProjectDuration,
  getResolutionDimensions,
} from './timelineEngine';
import { mixProjectAudioToWavBase64 } from './audioEngine';
import {
  renderCompositionAtTime,
  type MediaElementSource,
} from './compositionRenderer';

export interface ExportCompositionSpec {
  projectId: string;
  projectName: string;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  totalFrames: number;
  estimatedBitrateMbps: number;
  estimatedSizeBytes: number;
  videoClipCount: number;
  audioClipCount: number;
  textClipCount: number;
  imageClipCount: number;
  transitionCount: number;
  ffmpegArgsPreview: string[];
}

export function generateExportCompositionSpec(
  project: ProjectData,
  settings: ExportSettings
): ExportCompositionSpec {
  const { width, height } = getResolutionDimensions(
    project.aspectRatio,
    settings.resolution,
    project.customWidth,
    project.customHeight
  );
  const rawDuration = getProjectDuration(project.clips);
  const durationSeconds = Math.max(0.5, Number(rawDuration.toFixed(3)));
  const totalFrames = Math.max(1, Math.ceil(durationSeconds * settings.fps));

  const pixelsPerSec = width * height * settings.fps;
  const qualityFactor =
    settings.quality === 'high'
      ? 0.14
      : settings.quality === 'standard'
        ? 0.09
        : 0.05;
  const estimatedBitrateMbps = Number(
    Math.max(1.2, (pixelsPerSec * qualityFactor) / 1_000_000).toFixed(2)
  );
  const estimatedSizeBytes = Math.round(
    ((estimatedBitrateMbps * 1_000_000) / 8) * durationSeconds +
      (192_000 / 8) * durationSeconds
  );

  const videoClipCount = project.clips.filter((c) => c.type === 'video').length;
  const audioClipCount = project.clips.filter((c) => c.type === 'audio').length;
  const textClipCount = project.clips.filter((c) => c.type === 'text').length;
  const imageClipCount = project.clips.filter((c) => c.type === 'image').length;
  const transitionCount = project.clips.filter(
    (c) => c.transitionIn.type !== 'none' || c.transitionOut.type !== 'none'
  ).length;

  const crf =
    settings.quality === 'high'
      ? '18'
      : settings.quality === 'standard'
        ? '21'
        : '25';

  const ffmpegArgsPreview = [
    'ffmpeg',
    '-f',
    'image2pipe',
    '-framerate',
    String(settings.fps),
    '-i',
    'pipe:0',
    '-i',
    'mixed-audio.wav',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    crf,
    '-pix_fmt',
    'yuv420p',
    '-vf',
    `scale=${width}:${height}:flags=lanczos`,
    '-r',
    String(settings.fps),
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`,
  ];

  return {
    projectId: project.id,
    projectName: project.name,
    width,
    height,
    fps: settings.fps,
    durationSeconds,
    totalFrames,
    estimatedBitrateMbps,
    estimatedSizeBytes,
    videoClipCount,
    audioClipCount,
    textClipCount,
    imageClipCount,
    transitionCount,
    ffmpegArgsPreview,
  };
}

export interface ExportProgressState {
  phase: 'preparing-media' | 'mixing-audio' | 'rendering-frames' | 'muxing-mp4' | 'completed';
  currentFrame: number;
  totalFrames: number;
  percent: number;
  message: string;
}

export interface ExportResult {
  jobId: string;
  downloadUrl: string;
  fileSize: number;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  durationSeconds: number;
  probe?: Record<string, unknown>;
}

function seekVideoElement(video: HTMLVideoElement, targetTime: number): Promise<void> {
  return new Promise((resolve) => {
    const clamped = Math.max(0, Math.min(video.duration || targetTime, targetTime));
    if (Math.abs(video.currentTime - clamped) < 0.008 && video.readyState >= 2) {
      resolve();
      return;
    }
    const onSeeked = () => {
      clearTimeout(timer);
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    const timer = setTimeout(() => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    }, 350);
    video.addEventListener('seeked', onSeeked);
    video.currentTime = clamped;
  });
}

function loadExportVideoElement(srcUrl: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    const onLoaded = () => {
      cleanup();
      resolve(v);
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Failed to load video asset for export: ${srcUrl}`));
    };
    const cleanup = () => {
      v.removeEventListener('loadeddata', onLoaded);
      v.removeEventListener('error', onError);
    };
    v.addEventListener('loadeddata', onLoaded);
    v.addEventListener('error', onError);
    v.src = srcUrl;
    v.load();
  });
}

function loadExportImageElement(srcUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image asset for export: ${srcUrl}`));
    img.src = srcUrl;
  });
}

function canvasToJpegBuffer(canvas: HTMLCanvasElement, quality: number): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode canvas frame'));
          return;
        }
        blob.arrayBuffer().then(resolve).catch(reject);
      },
      'image/jpeg',
      quality
    );
  });
}

export async function runDeterministicExport(
  project: ProjectData,
  mediaAssets: MediaAsset[],
  settings: ExportSettings,
  onProgress: (state: ExportProgressState) => void,
  abortSignal: AbortSignal
): Promise<ExportResult> {
  const spec = generateExportCompositionSpec(project, settings);
  const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  onProgress({
    phase: 'preparing-media',
    currentFrame: 0,
    totalFrames: spec.totalFrames,
    percent: 2,
    message: 'Loading source media decoders for frame-accurate render...',
  });

  const assetMap = new Map(mediaAssets.map((a) => [a.id, a]));
  const videoElements = new Map<string, HTMLVideoElement>();
  const imageElements = new Map<string, HTMLImageElement>();
  const tempUrls: string[] = [];

  try {
    // Prepare dedicated video elements per clip so concurrent transitions on the same asset never conflict
    for (const clip of project.clips) {
      if (abortSignal.aborted) throw new Error('EXPORT_CANCELLED');
      if (!clip.mediaId) continue;
      const asset = assetMap.get(clip.mediaId);
      if (!asset) continue;

      let url = asset.objectUrl;
      if (asset.blob) {
        url = URL.createObjectURL(asset.blob);
        tempUrls.push(url);
      }
      if (!url) continue;

      if (clip.type === 'video') {
        const videoEl = await loadExportVideoElement(url);
        videoElements.set(clip.id, videoEl);
      } else if (clip.type === 'image' && !imageElements.has(asset.id)) {
        const imgEl = await loadExportImageElement(url);
        imageElements.set(asset.id, imgEl);
      }
    }

    if (abortSignal.aborted) throw new Error('EXPORT_CANCELLED');

    onProgress({
      phase: 'mixing-audio',
      currentFrame: 0,
      totalFrames: spec.totalFrames,
      percent: 6,
      message: 'Mixing multitrack audio and applying volume/fade envelopes...',
    });

    const audioWavBase64 = await mixProjectAudioToWavBase64(project, mediaAssets);

    if (abortSignal.aborted) throw new Error('EXPORT_CANCELLED');

    const startRes = await fetch('/api/export/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        width: spec.width,
        height: spec.height,
        fps: spec.fps,
        totalFrames: spec.totalFrames,
        audioWavBase64,
      }),
    });

    if (!startRes.ok) {
      const errData = await startRes.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to initialize FFmpeg export job');
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = spec.width;
    exportCanvas.height = spec.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not initialize 2D rendering context for export');

    const exportProject: ProjectData = {
      ...project,
      resolution: settings.resolution,
      fps: settings.fps,
    };

    const mediaSources: MediaElementSource = {
      videoElements,
      imageElements,
    };

    const jpegQuality =
      settings.quality === 'high'
        ? 0.94
        : settings.quality === 'standard'
          ? 0.88
          : 0.78;

    for (let frameIdx = 0; frameIdx < spec.totalFrames; frameIdx++) {
      if (abortSignal.aborted) {
        await fetch('/api/export/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId }),
        }).catch(() => {});
        throw new Error('EXPORT_CANCELLED');
      }

      const timelineTime = frameIdx / spec.fps;
      const activeLayers = getCompositedVisualClipsAtTime(
        exportProject.tracks,
        exportProject.clips,
        timelineTime
      );

      // Seek all active video elements for this exact frame
      const seekPromises: Promise<void>[] = [];
      for (const layer of activeLayers) {
        if (layer.clip.type === 'video') {
          const v = videoElements.get(layer.clip.id);
          if (v) seekPromises.push(seekVideoElement(v, layer.sourceTime));
        }
        if (
          layer.outgoingTransition &&
          layer.outgoingTransition.previousClip.type === 'video'
        ) {
          const prevV = videoElements.get(
            layer.outgoingTransition.previousClip.id
          );
          if (prevV) {
            seekPromises.push(
              seekVideoElement(prevV, layer.outgoingTransition.previousSourceTime)
            );
          }
        }
      }
      if (seekPromises.length > 0) {
        await Promise.all(seekPromises);
      }

      renderCompositionAtTime(ctx, exportProject, timelineTime, mediaSources, {
        showSafeGuides: false,
      });

      const frameBuffer = await canvasToJpegBuffer(exportCanvas, jpegQuality);

      const frameRes = await fetch('/api/export/frame', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-job-id': jobId,
        },
        body: frameBuffer,
      });

      if (!frameRes.ok) {
        const errData = await frameRes.json().catch(() => ({}));
        throw new Error(errData.error || `Failed encoding frame ${frameIdx + 1}`);
      }

      const completedFrames = frameIdx + 1;
      const percent = Math.min(
        94,
        8 + Math.round((completedFrames / spec.totalFrames) * 86)
      );
      onProgress({
        phase: 'rendering-frames',
        currentFrame: completedFrames,
        totalFrames: spec.totalFrames,
        percent,
        message: `Rendering frame ${completedFrames} of ${spec.totalFrames} (${spec.width}×${spec.height} @ ${spec.fps}fps)...`,
      });
    }

    onProgress({
      phase: 'muxing-mp4',
      currentFrame: spec.totalFrames,
      totalFrames: spec.totalFrames,
      percent: 97,
      message: 'Finalizing H.264 + AAC MP4 container (+faststart)...',
    });

    const finishRes = await fetch('/api/export/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });

    if (!finishRes.ok) {
      const errData = await finishRes.json().catch(() => ({}));
      throw new Error(errData.error || 'FFmpeg failed to finalize MP4 file');
    }

    const finishData = await finishRes.json();

    onProgress({
      phase: 'completed',
      currentFrame: spec.totalFrames,
      totalFrames: spec.totalFrames,
      percent: 100,
      message: 'Export complete! Ready for download.',
    });

    return {
      jobId,
      downloadUrl: finishData.downloadUrl,
      fileSize: finishData.fileSize,
      width: spec.width,
      height: spec.height,
      fps: spec.fps,
      totalFrames: spec.totalFrames,
      durationSeconds: spec.durationSeconds,
      probe: finishData.probe,
    };
  } finally {
    for (const v of videoElements.values()) {
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
    for (const u of tempUrls) {
      URL.revokeObjectURL(u);
    }
  }
}
