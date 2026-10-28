import type { MediaAsset, ProjectData, TimelineClip } from '../types/editor';
import { getProjectDuration } from './timelineEngine';

/**
 * Computes the effective audio linear gain (0..2) for a clip at a given timeline timestamp,
 * accounting for track mute, clip mute, clip volume, fade-in, and fade-out.
 */
export function computeClipAudioGain(
  clip: TimelineClip,
  trackMuted: boolean,
  timelineTime: number
): number {
  if (trackMuted || clip.muted || clip.volume <= 0) {
    return 0;
  }

  const clipEnd = clip.startTime + clip.duration;
  if (timelineTime < clip.startTime || timelineTime > clipEnd) {
    return 0;
  }

  const localTime = timelineTime - clip.startTime;
  const remainingTime = clipEnd - timelineTime;

  let fadeMultiplier = 1;
  if (clip.fadeIn > 0 && localTime < clip.fadeIn) {
    fadeMultiplier *= Math.max(0, Math.min(1, localTime / clip.fadeIn));
  }
  if (clip.fadeOut > 0 && remainingTime < clip.fadeOut) {
    fadeMultiplier *= Math.max(0, Math.min(1, remainingTime / clip.fadeOut));
  }

  return Number((clip.volume * fadeMultiplier).toFixed(4));
}

/**
 * Encodes an AudioBuffer (or stereo Float32Array channels) into a standard 16-bit PCM WAV ArrayBuffer.
 */
export function encodeAudioBufferToWav(
  leftChannel: Float32Array,
  rightChannel: Float32Array,
  sampleRate: number
): ArrayBuffer {
  const numChannels = 2;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const numFrames = leftChannel.length;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format = 1
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    const l = Math.max(-1, Math.min(1, leftChannel[i]));
    const r = Math.max(-1, Math.min(1, rightChannel[i]));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    offset += 4;
  }

  return buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

/**
 * Offline mixes all audible clips in `project` (both audio tracks and video tracks with audio)
 * into a base64-encoded 16-bit 44.1kHz stereo WAV string for deterministic export.
 */
export async function mixProjectAudioToWavBase64(
  project: ProjectData,
  mediaAssets: MediaAsset[],
  sampleRate = 44100
): Promise<string | null> {
  const totalDuration = Math.max(0.5, getProjectDuration(project.clips));
  const totalSamples = Math.ceil(totalDuration * sampleRate);

  const trackMap = new Map(project.tracks.map((t) => [t.id, t]));
  const assetMap = new Map(mediaAssets.map((a) => [a.id, a]));

  const audibleClips = project.clips.filter((clip) => {
    if (clip.type !== 'audio' && clip.type !== 'video') return false;
    const track = trackMap.get(clip.trackId);
    if (!track || track.muted || clip.muted || clip.volume <= 0) return false;
    const asset = clip.mediaId ? assetMap.get(clip.mediaId) : undefined;
    if (!asset || (clip.type === 'video' && !asset.hasAudio)) return false;
    return true;
  });

  if (audibleClips.length === 0) {
    return null;
  }

  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;

  if (!OfflineCtx) {
    return null;
  }

  const offlineCtx = new OfflineCtx(2, totalSamples, sampleRate);
  const decodeCache = new Map<string, AudioBuffer>();

  // 1. Detect all active voiceover intervals across the timeline
  const voiceoverIntervals: Array<{ start: number; end: number }> = [];
  for (const clip of audibleClips) {
    const track = trackMap.get(clip.trackId);
    const trackName = (track?.name || '').toLowerCase();
    const asset = clip.mediaId ? assetMap.get(clip.mediaId) : undefined;
    const isVO =
      trackName.includes('voice') ||
      trackName.includes('narration') ||
      clip.name.toLowerCase().startsWith('vo:') ||
      (asset && asset.name.toLowerCase().includes('voiceover'));

    if (isVO) {
      voiceoverIntervals.push({
        start: Math.max(0, clip.startTime),
        end: Math.max(0, clip.startTime + clip.duration),
      });
    }
  }

  for (const clip of audibleClips) {
    const asset = clip.mediaId ? assetMap.get(clip.mediaId) : undefined;
    if (!asset) continue;

    let audioBuffer = decodeCache.get(asset.id);
    if (!audioBuffer) {
      try {
        let rawBuffer: ArrayBuffer;
        if (asset.blob) {
          rawBuffer = await asset.blob.arrayBuffer();
        } else if (asset.objectUrl) {
          const res = await fetch(asset.objectUrl);
          rawBuffer = await res.arrayBuffer();
        } else {
          continue;
        }
        audioBuffer = await offlineCtx.decodeAudioData(rawBuffer.slice(0));
        decodeCache.set(asset.id, audioBuffer);
      } catch {
        // If browser fails to decode audio track from a container, continue gracefully
        continue;
      }
    }

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = clip.playbackSpeed;

    const gainNode = offlineCtx.createGain();
    const startTime = Math.max(0, clip.startTime);
    const clipEnd = startTime + clip.duration;
    const baseVolume = clip.volume;

    const track = trackMap.get(clip.trackId);
    const trackName = (track?.name || '').toLowerCase();
    const isThisVO =
      trackName.includes('voice') ||
      trackName.includes('narration') ||
      clip.name.toLowerCase().startsWith('vo:') ||
      asset.name.toLowerCase().includes('voiceover');

    // Schedule base fade-in / constant / fade-out envelope
    if (clip.fadeIn > 0) {
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(
        baseVolume,
        Math.min(clipEnd, startTime + clip.fadeIn)
      );
    } else {
      gainNode.gain.setValueAtTime(baseVolume, startTime);
    }

    // Dynamic ducking for background tracks during voiceover (-14dB = ~0.20 volume)
    if (!isThisVO && voiceoverIntervals.length > 0) {
      const duckVolume = Number((baseVolume * 0.20).toFixed(4));
      for (const interval of voiceoverIntervals) {
        if (interval.end > startTime && interval.start < clipEnd) {
          const duckInStart = Math.max(startTime, interval.start - 0.12);
          const duckInEnd = Math.max(startTime, interval.start);
          const duckOutStart = Math.min(clipEnd, interval.end);
          const duckOutEnd = Math.min(clipEnd, interval.end + 0.18);

          if (duckInEnd > duckInStart) {
            gainNode.gain.setValueAtTime(baseVolume, duckInStart);
            gainNode.gain.linearRampToValueAtTime(duckVolume, duckInEnd);
          } else {
            gainNode.gain.setValueAtTime(duckVolume, startTime);
          }

          if (duckOutEnd > duckOutStart) {
            gainNode.gain.setValueAtTime(duckVolume, duckOutStart);
            gainNode.gain.linearRampToValueAtTime(baseVolume, duckOutEnd);
          }
        }
      }
    }

    if (clip.fadeOut > 0) {
      const fadeOutStart = Math.max(startTime, clipEnd - clip.fadeOut);
      gainNode.gain.setValueAtTime(baseVolume, fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0, clipEnd);
    } else {
      gainNode.gain.setValueAtTime(baseVolume, clipEnd);
    }

    source.connect(gainNode);
    gainNode.connect(offlineCtx.destination);

    const sourceDuration = Math.max(0.05, clip.duration * clip.playbackSpeed);
    source.start(startTime, clip.inPoint, sourceDuration);
  }

  const renderedBuffer = await offlineCtx.startRendering();
  const left = renderedBuffer.getChannelData(0);
  const right =
    renderedBuffer.numberOfChannels > 1
      ? renderedBuffer.getChannelData(1)
      : renderedBuffer.getChannelData(0);

  const wavBuffer = encodeAudioBufferToWav(left, right, sampleRate);
  return arrayBufferToBase64(wavBuffer);
}
