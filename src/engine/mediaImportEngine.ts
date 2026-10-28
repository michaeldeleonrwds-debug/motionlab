import type { MediaAsset, MediaType } from '../types/editor';
import { computeWaveformPeaksFromSamples } from '../workers/waveformWorker';

const SUPPORTED_EXTENSIONS: Record<string, MediaType> = {
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  mp3: 'audio',
  wav: 'audio',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
};

export function classifyFileExtension(filename: string, mimeType: string): MediaType | null {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext in SUPPORTED_EXTENSIONS) {
    return SUPPORTED_EXTENSIONS[ext];
  }
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('image/')) return 'image';
  return null;
}

async function computeWaveformViaWorker(
  samples: Float32Array,
  buckets = 96
): Promise<number[]> {
  if (typeof Worker === 'undefined') {
    return computeWaveformPeaksFromSamples(samples, buckets);
  }
  return new Promise((resolve) => {
    try {
      const worker = new Worker(
        new URL('../workers/waveformWorker.ts', import.meta.url),
        { type: 'module' }
      );
      const reqId = `wf-${Date.now()}-${Math.random()}`;
      const timeout = setTimeout(() => {
        worker.terminate();
        resolve(computeWaveformPeaksFromSamples(samples, buckets));
      }, 2000);

      worker.onmessage = (ev) => {
        clearTimeout(timeout);
        worker.terminate();
        resolve(ev.data.peaks);
      };
      worker.onerror = () => {
        clearTimeout(timeout);
        worker.terminate();
        resolve(computeWaveformPeaksFromSamples(samples, buckets));
      };
      const copy = new Float32Array(samples);
      worker.postMessage({ id: reqId, samples: copy, buckets }, [copy.buffer]);
    } catch {
      resolve(computeWaveformPeaksFromSamples(samples, buckets));
    }
  });
}

async function extractAudioWaveformAndCheckAudio(
  blob: Blob,
  buckets = 96
): Promise<{ hasAudio: boolean; waveform: number[]; duration?: number }> {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) {
      return { hasAudio: false, waveform: [] };
    }
    const ctx = new AudioCtx();
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const channelData = audioBuffer.getChannelData(0);
      const waveform = await computeWaveformViaWorker(channelData, buckets);
      return {
        hasAudio: true,
        waveform,
        duration: audioBuffer.duration,
      };
    } finally {
      await ctx.close().catch(() => {});
    }
  } catch {
    return { hasAudio: false, waveform: [] };
  }
}

async function inspectAndVerifyVideo(
  file: File,
  objectUrl: string
): Promise<{
  duration: number;
  width: number;
  height: number;
  thumbnails: string[];
  codecInfo: string;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    let settled = false;
    const fail = (reason: string) => {
      if (settled) return;
      settled = true;
      video.removeAttribute('src');
      video.load();
      reject(new Error(reason));
    };

    const timer = setTimeout(() => {
      fail(
        `Timed out decoding "${file.name}". The container or video codec is unsupported by this browser.`
      );
    }, 8000);

    video.onerror = () => {
      clearTimeout(timer);
      const mediaErr = video.error;
      const detail =
        mediaErr?.code === 4
          ? 'Codec/bitstream not supported (MEDIA_ERR_SRC_NOT_SUPPORTED)'
          : mediaErr?.code === 3
            ? 'Media decode failed (MEDIA_ERR_DECODE)'
            : 'Unreadable video stream';
      fail(`Unsupported video codec in "${file.name}": ${detail}.`);
    };

    video.onloadeddata = async () => {
      try {
        const duration = video.duration;
        const width = video.videoWidth;
        const height = video.videoHeight;

        if (!Number.isFinite(duration) || duration <= 0 || width <= 0 || height <= 0) {
          clearTimeout(timer);
          fail(
            `File "${file.name}" does not contain a valid decodable video stream (width=${width}, height=${height}, duration=${duration}).`
          );
          return;
        }

        // Generate 4 filmstrip thumbnails across the clip duration
        const thumbCount = 4;
        const thumbnails: string[] = [];
        const thumbCanvas = document.createElement('canvas');
        const thumbW = 160;
        const thumbH = Math.max(90, Math.round((height / width) * thumbW));
        thumbCanvas.width = thumbW;
        thumbCanvas.height = thumbH;
        const ctx = thumbCanvas.getContext('2d');

        for (let i = 0; i < thumbCount; i++) {
          const t = Math.min(
            Math.max(0.02, duration - 0.05),
            (duration * (i + 0.5)) / thumbCount
          );
          await new Promise<void>((resSeek) => {
            const onSeek = () => {
              video.removeEventListener('seeked', onSeek);
              resSeek();
            };
            video.addEventListener('seeked', onSeek);
            video.currentTime = t;
          });
          if (ctx) {
            ctx.drawImage(video, 0, 0, thumbW, thumbH);
            thumbnails.push(thumbCanvas.toDataURL('image/jpeg', 0.72));
          }
        }

        clearTimeout(timer);
        if (settled) return;
        settled = true;

        const ext = file.name.split('.').pop()?.toUpperCase() || 'VIDEO';
        const codecInfo = `${ext} • ${width}×${height}`;

        video.removeAttribute('src');
        video.load();

        resolve({
          duration: Number(duration.toFixed(3)),
          width,
          height,
          thumbnails,
          codecInfo,
        });
      } catch (err) {
        clearTimeout(timer);
        fail(
          err instanceof Error
            ? err.message
            : `Failed to decode frames from "${file.name}".`
        );
      }
    };

    video.src = objectUrl;
    video.load();
  });
}

async function inspectAndVerifyImage(
  file: File,
  objectUrl: string
): Promise<{
  width: number;
  height: number;
  thumbnails: string[];
  codecInfo: string;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        reject(new Error(`Invalid image dimensions in "${file.name}".`));
        return;
      }
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 160;
      thumbCanvas.height = Math.max(
        90,
        Math.round((img.naturalHeight / img.naturalWidth) * 160)
      );
      const ctx = thumbCanvas.getContext('2d');
      const thumbnails: string[] = [];
      if (ctx) {
        ctx.drawImage(img, 0, 0, thumbCanvas.width, thumbCanvas.height);
        thumbnails.push(thumbCanvas.toDataURL('image/jpeg', 0.8));
      }
      const ext = file.name.split('.').pop()?.toUpperCase() || 'IMG';
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        thumbnails,
        codecInfo: `${ext} • ${img.naturalWidth}×${img.naturalHeight}`,
      });
    };
    img.onerror = () => {
      reject(new Error(`Unsupported or corrupted image file "${file.name}".`));
    };
    img.src = objectUrl;
  });
}

/**
 * Performs genuine bitstream/codec verification and metadata/thumbnail/waveform extraction
 * for an imported File. Rejects with an informative error if the codec cannot be decoded.
 */
export async function importMediaFile(file: File): Promise<MediaAsset> {
  const mediaType = classifyFileExtension(file.name, file.type);
  if (!mediaType) {
    throw new Error(
      `Unsupported file format "${file.name}". Supported formats: MP4, WebM, MOV, MP3, WAV, PNG, JPEG, WebP.`
    );
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    if (mediaType === 'video') {
      const videoMeta = await inspectAndVerifyVideo(file, objectUrl);
      const audioCheck = await extractAudioWaveformAndCheckAudio(file, 96);

      return {
        id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        type: 'video',
        mimeType: file.type || 'video/mp4',
        size: file.size,
        duration: videoMeta.duration,
        width: videoMeta.width,
        height: videoMeta.height,
        fps: 30,
        hasAudio: audioCheck.hasAudio,
        codecInfo: videoMeta.codecInfo + (audioCheck.hasAudio ? ' + Audio' : ' (Silent)'),
        thumbnails: videoMeta.thumbnails,
        waveform: audioCheck.waveform,
        objectUrl,
        blob: file,
        createdAt: Date.now(),
      };
    }

    if (mediaType === 'audio') {
      const audioCheck = await extractAudioWaveformAndCheckAudio(file, 120);
      if (!audioCheck.hasAudio || !audioCheck.duration || audioCheck.duration <= 0) {
        throw new Error(
          `Unsupported or corrupted audio codec in "${file.name}". Unable to decode PCM audio stream.`
        );
      }
      const ext = file.name.split('.').pop()?.toUpperCase() || 'AUDIO';
      return {
        id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        type: 'audio',
        mimeType: file.type || 'audio/wav',
        size: file.size,
        duration: Number(audioCheck.duration.toFixed(3)),
        width: 0,
        height: 0,
        hasAudio: true,
        codecInfo: `${ext} • 44.1kHz Stereo`,
        thumbnails: [],
        waveform: audioCheck.waveform,
        objectUrl,
        blob: file,
        createdAt: Date.now(),
      };
    }

    // Image
    const imageMeta = await inspectAndVerifyImage(file, objectUrl);
    return {
      id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      type: 'image',
      mimeType: file.type || 'image/png',
      size: file.size,
      duration: 5, // Default 5s duration when dragged onto timeline
      width: imageMeta.width,
      height: imageMeta.height,
      hasAudio: false,
      codecInfo: imageMeta.codecInfo,
      thumbnails: imageMeta.thumbnails,
      waveform: [],
      objectUrl,
      blob: file,
      createdAt: Date.now(),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}
