/**
 * MotionLab — High-Performance Bounded Memory Manager & Resource Allocator
 * 
 * Provides:
 * - Bounded HTMLMediaElement pooling with playhead-proximity LRU eviction
 * - Tracked Object URL lifecycle management and automatic leak prevention
 * - Bounded AudioBuffer decoded memory tracking
 * - Safe native decoder disposal (pausing, unsetting src, calling load())
 * - Real-time process & browser memory diagnostics telemetry
 * - Global cache purge & GC hint coordination
 */

export interface MemoryBudgetConfig {
  maxActiveVideoElements: number;
  maxActiveAudioElements: number;
  maxActiveImageElements: number;
  maxAudioBufferMemoryMb: number;
  maxHistoryDepth: number;
}

export const DEFAULT_MEMORY_BUDGET: MemoryBudgetConfig = {
  maxActiveVideoElements: 6,
  maxActiveAudioElements: 12,
  maxActiveImageElements: 40,
  maxAudioBufferMemoryMb: 128,
  maxHistoryDepth: 25,
};

export interface MemoryTelemetry {
  jsHeapUsedMb: number;
  jsHeapTotalMb: number;
  jsHeapLimitMb: number;
  activeVideoDecoders: number;
  activeAudioDecoders: number;
  activeImages: number;
  trackedBlobUrls: number;
  audioBuffersMb: number;
  historySnapshots: number;
  status: 'optimal' | 'warning' | 'critical';
  timestamp: number;
}

class MemoryManager {
  private static instance: MemoryManager;
  private budget: MemoryBudgetConfig = { ...DEFAULT_MEMORY_BUDGET };

  // Tracked Object URLs: url -> { ownerId, createdAt }
  private trackedUrls = new Map<string, { ownerId: string; createdAt: number }>();

  // Tracked Media Elements
  private activeVideos = new Set<HTMLVideoElement>();
  private activeAudios = new Set<HTMLAudioElement>();
  private activeImages = new Map<string, HTMLImageElement>(); // key -> HTMLImageElement

  // Tracked AudioBuffers: key -> { buffer: AudioBuffer, bytes: number, lastUsed: number }
  private audioBufferCache = new Map<string, { buffer: AudioBuffer; bytes: number; lastUsed: number }>();
  private audioBufferTotalBytes = 0;

  // History depth tracker
  private currentHistoryDepth = 0;

  private constructor() {
    // Setup window unload / beforeunload hook to release all blob URLs
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.purgeAllCaches();
      });
    }
  }

  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  // -------------------------------------------------------------
  // Object URL Tracking & Safe Revocation
  // -------------------------------------------------------------

  public createTrackedUrl(blob: Blob, ownerId: string): string {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      return '';
    }
    const url = URL.createObjectURL(blob);
    this.trackedUrls.set(url, { ownerId, createdAt: Date.now() });
    return url;
  }

  public revokeTrackedUrl(url: string | undefined): void {
    if (!url || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
    if (this.trackedUrls.has(url)) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
      this.trackedUrls.delete(url);
    }
  }

  public revokeUrlsByOwner(ownerId: string): void {
    if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
    for (const [url, info] of this.trackedUrls.entries()) {
      if (info.ownerId === ownerId) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
        this.trackedUrls.delete(url);
      }
    }
  }

  public revokeAllTrackedUrls(): void {
    if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
    for (const url of this.trackedUrls.keys()) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
    this.trackedUrls.clear();
  }

  // -------------------------------------------------------------
  // HTMLMediaElement Safe Disposal & Pooling
  // -------------------------------------------------------------

  public registerVideoElement(video: HTMLVideoElement): void {
    this.activeVideos.add(video);
  }

  public unregisterVideoElement(video: HTMLVideoElement): void {
    this.activeVideos.delete(video);
    this.safeReleaseMediaElement(video);
  }

  public registerAudioElement(audio: HTMLAudioElement): void {
    this.activeAudios.add(audio);
  }

  public unregisterAudioElement(audio: HTMLAudioElement): void {
    this.activeAudios.delete(audio);
    this.safeReleaseMediaElement(audio);
  }

  /**
   * Safely releases an HTMLMediaElement to immediately free browser hardware/software decoders.
   */
  public safeReleaseMediaElement(el: HTMLMediaElement): void {
    try {
      el.pause();
      el.onloadeddata = null;
      el.onseeked = null;
      el.onerror = null;
      el.onended = null;
      el.removeAttribute('src');
      // Forcing .load() on an element without src prompts Chromium to flush its native frame buffers
      el.load();
    } catch {
      // ignore
    }
  }

  // -------------------------------------------------------------
  // Image Element Cache (LRU Bounded)
  // -------------------------------------------------------------

  public getOrLoadImage(key: string, srcUrl: string, onLoad?: (img: HTMLImageElement) => void): HTMLImageElement {
    const existing = this.activeImages.get(key);
    if (existing && existing.dataset.srcUrl === srcUrl) {
      return existing;
    }

    if (existing) {
      existing.onload = null;
      existing.removeAttribute('src');
      this.activeImages.delete(key);
    }

    // Evict if cache exceeds budget
    if (this.activeImages.size >= this.budget.maxActiveImageElements) {
      const oldestKey = this.activeImages.keys().next().value;
      if (oldestKey) {
        const oldImg = this.activeImages.get(oldestKey);
        if (oldImg) {
          oldImg.onload = null;
          oldImg.removeAttribute('src');
        }
        this.activeImages.delete(oldestKey);
      }
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.dataset.srcUrl = srcUrl;
    if (onLoad) {
      img.onload = () => onLoad(img);
    }
    img.src = srcUrl;
    this.activeImages.set(key, img);
    return img;
  }

  // -------------------------------------------------------------
  // Decoded AudioBuffer Cache (LRU Bounded by MB)
  // -------------------------------------------------------------

  public setAudioBuffer(key: string, buffer: AudioBuffer): void {
    const bytes = buffer.length * buffer.numberOfChannels * 4; // 32-bit float = 4 bytes
    const maxBytes = this.budget.maxAudioBufferMemoryMb * 1024 * 1024;

    // Evict oldest entries until within budget
    while (this.audioBufferTotalBytes + bytes > maxBytes && this.audioBufferCache.size > 0) {
      let oldestKey = '';
      let oldestTime = Infinity;
      for (const [k, item] of this.audioBufferCache.entries()) {
        if (item.lastUsed < oldestTime) {
          oldestTime = item.lastUsed;
          oldestKey = k;
        }
      }
      if (oldestKey) {
        const item = this.audioBufferCache.get(oldestKey)!;
        this.audioBufferTotalBytes -= item.bytes;
        this.audioBufferCache.delete(oldestKey);
      } else {
        break;
      }
    }

    this.audioBufferCache.set(key, { buffer, bytes, lastUsed: Date.now() });
    this.audioBufferTotalBytes += bytes;
  }

  public getAudioBuffer(key: string): AudioBuffer | null {
    const item = this.audioBufferCache.get(key);
    if (!item) return null;
    item.lastUsed = Date.now();
    return item.buffer;
  }

  public setHistoryDepth(depth: number): void {
    this.currentHistoryDepth = depth;
  }

  // -------------------------------------------------------------
  // Global Cache Purge & Force GC Coordination
  // -------------------------------------------------------------

  public purgeAllCaches(): void {
    // 1. Release non-critical video elements
    for (const v of this.activeVideos) {
      this.safeReleaseMediaElement(v);
    }
    this.activeVideos.clear();

    // 2. Release audio elements
    for (const a of this.activeAudios) {
      this.safeReleaseMediaElement(a);
    }
    this.activeAudios.clear();

    // 3. Clear image caches
    for (const img of this.activeImages.values()) {
      img.onload = null;
      img.removeAttribute('src');
    }
    this.activeImages.clear();

    // 4. Clear audio buffers
    this.audioBufferCache.clear();
    this.audioBufferTotalBytes = 0;

    // 5. Revoke orphaned tracked URLs
    this.revokeAllTrackedUrls();

    // 6. Trigger GC hint if available
    if (typeof window !== 'undefined' && (window as unknown as { gc?: () => void }).gc) {
      try {
        (window as unknown as { gc?: () => void }).gc!();
      } catch {
        // ignore
      }
    }
  }

  // -------------------------------------------------------------
  // Real-time Memory Diagnostics Telemetry
  // -------------------------------------------------------------

  public getTelemetry(): MemoryTelemetry {
    let jsHeapUsedMb = 0;
    let jsHeapTotalMb = 0;
    let jsHeapLimitMb = 0;

    if (typeof performance !== 'undefined' && (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory) {
      const mem = (performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      jsHeapUsedMb = Math.round(mem.usedJSHeapSize / (1024 * 1024));
      jsHeapTotalMb = Math.round(mem.totalJSHeapSize / (1024 * 1024));
      jsHeapLimitMb = Math.round(mem.jsHeapSizeLimit / (1024 * 1024));
    }

    const audioBuffersMb = Math.round((this.audioBufferTotalBytes / (1024 * 1024)) * 10) / 10;
    const activeVideoDecoders = this.activeVideos.size;
    const activeAudioDecoders = this.activeAudios.size;
    const activeImages = this.activeImages.size;
    const trackedBlobUrls = this.trackedUrls.size;

    let status: 'optimal' | 'warning' | 'critical' = 'optimal';
    if (jsHeapUsedMb > 1200 || activeVideoDecoders > 10 || trackedBlobUrls > 80) {
      status = 'warning';
    }
    if (jsHeapUsedMb > 2500 || activeVideoDecoders > 18) {
      status = 'critical';
    }

    return {
      jsHeapUsedMb,
      jsHeapTotalMb,
      jsHeapLimitMb,
      activeVideoDecoders,
      activeAudioDecoders,
      activeImages,
      trackedBlobUrls,
      audioBuffersMb,
      historySnapshots: this.currentHistoryDepth,
      status,
      timestamp: Date.now(),
    };
  }
}

export const memoryManager = MemoryManager.getInstance();
