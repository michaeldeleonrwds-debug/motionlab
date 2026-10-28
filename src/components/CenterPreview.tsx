import { useEditorSelection } from '../store/useEditorSelection';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Scissors,
  Grid,
  ZoomIn,
  RotateCw,
  Monitor,
  Maximize2,
  Minimize2,
  Sliders,
  Tv,
  Hand,
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import {
  useWorkspaceStore,
  type MonitorZoomMode,
  type PreviewQuality,
} from '../store/useWorkspaceStore';
import {
  clipTimelineToSourceTime,
  formatTimecode,
  getCompositedVisualClipsAtTime,
  getProjectDuration,
  getResolutionDimensions,
} from '../engine/timelineEngine';
import { computeClipAudioGain } from '../engine/audioEngine';
import { evaluateClipTransform } from '../engine/keyframeEngine';
import {
  renderCompositionAtTime,
  type MediaElementSource,
} from '../engine/compositionRenderer';
import { memoryManager, DEFAULT_MEMORY_BUDGET } from '../engine/memoryManager';

export const CenterPreview: React.FC = () => {
  const {
    project,
    currentTime,
    isPlaying,
    canvasZoom,
    showSafeGuides,
    selectedClipId,
    setCurrentTime,
    setIsPlaying,
    togglePlayPause,
    stepFrames,
    splitSelectedClipAtPlayhead,
    setCanvasZoom,
    toggleSafeGuides,
    updateClipProperties,
  } = useEditorSelection([
    'project',
    'currentTime',
    'isPlaying',
    'canvasZoom',
    'showSafeGuides',
    'selectedClipId',
    'setCurrentTime',
    'setIsPlaying',
    'togglePlayPause',
    'stepFrames',
    'splitSelectedClipAtPlayhead',
    'setCanvasZoom',
    'toggleSafeGuides',
    'updateClipProperties',
  ]);

  const monitorZoom = useWorkspaceStore((s) => s.monitorZoom);
  const setMonitorZoom = useWorkspaceStore((s) => s.setMonitorZoom);
  const monitorCustomZoom = useWorkspaceStore((s) => s.monitorCustomZoom);
  const setMonitorCustomZoom = useWorkspaceStore((s) => s.setMonitorCustomZoom);
  const previewQuality = useWorkspaceStore((s) => s.previewQuality);
  const setPreviewQuality = useWorkspaceStore((s) => s.setPreviewQuality);
  const isMonitorMaximized = useWorkspaceStore((s) => s.isMonitorMaximized);
  const toggleMonitorMaximized = useWorkspaceStore((s) => s.toggleMonitorMaximized);
  const isFocusMode = useWorkspaceStore((s) => s.isFocusMode);
  const toggleFocusMode = useWorkspaceStore((s) => s.toggleFocusMode);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [mediaVersion, setMediaVersion] = useState(0);

  useEffect(() => () => {
    // Workspaces remount the monitor. Release its decoders before another pool is created.
    for (const element of [...videoElementsRef.current.values(), ...audioElementsRef.current.values()]) {
      element.onloadeddata = null;
      element.onseeked = null;
      element.pause();
      element.removeAttribute('src');
      element.load();
    }
    for (const image of imageElementsRef.current.values()) {
      image.onload = null;
      image.removeAttribute('src');
    }
    videoElementsRef.current.clear();
    audioElementsRef.current.clear();
    imageElementsRef.current.clear();
  }, []);

  // Responsive stage container dimensions
  const [containerSize, setContainerSize] = useState({ width: 800, height: 500 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Direct manipulation drag state
  const [dragMode, setDragMode] = useState<
    null | {
      type: 'move' | 'scale' | 'rotate';
      clipId: string;
      startMouseX: number;
      startMouseY: number;
      initialX: number;
      initialY: number;
      initialScale: number;
      initialRotation: number;
    }
  >(null);

  // Ref to throttle rapid scrubbing seeks per element
  const lastSeekTimesRef = useRef<Map<string, number>>(new Map());

  // Sync bounded HTMLVideoElement / HTMLImageElement / HTMLAudioElement pool without recreating per frame
  useEffect(() => {
    const assetMap = new Map(project.mediaAssets.map((a) => [a.id, a]));
    const currentVideoIds = new Set<string>();
    const currentAudioIds = new Set<string>();
    const currentImageIds = new Set<string>();

    // 1. BOUNDED VIDEO POOL: Only allocate decoders for video clips within the proximity window [-4s, +5s]
    const PROXIMITY_BEFORE = 4.0;
    const PROXIMITY_AFTER = 5.0;

    const candidateVideoClips = project.clips
      .filter((clip) => {
        if (clip.type !== 'video' || !clip.mediaId) return false;
        const clipEnd = clip.startTime + clip.duration;
        return clipEnd >= currentTime - PROXIMITY_BEFORE && clip.startTime <= currentTime + PROXIMITY_AFTER;
      })
      .sort((a, b) => {
        const distA = Math.abs(currentTime - (a.startTime + a.duration / 2));
        const distB = Math.abs(currentTime - (b.startTime + b.duration / 2));
        return distA - distB;
      })
      .slice(0, DEFAULT_MEMORY_BUDGET.maxActiveVideoElements);

    for (const clip of candidateVideoClips) {
      const asset = assetMap.get(clip.mediaId!);
      if (!asset || !asset.objectUrl) continue;

      currentVideoIds.add(clip.id);
      const existing = videoElementsRef.current.get(clip.id);
      if (!existing || existing.dataset.srcUrl !== asset.objectUrl) {
        if (existing) {
          memoryManager.unregisterVideoElement(existing);
        }
        const v = document.createElement('video');
        v.crossOrigin = 'anonymous';
        v.playsInline = true;
        v.preload = 'metadata';
        v.dataset.srcUrl = asset.objectUrl;
        v.src = asset.objectUrl;
        v.onloadeddata = () => setMediaVersion((n) => n + 1);
        v.onseeked = () => setMediaVersion((n) => n + 1);
        memoryManager.registerVideoElement(v);
        videoElementsRef.current.set(clip.id, v);
      }
    }

    // 2. BOUNDED AUDIO POOL
    const candidateAudioClips = project.clips
      .filter((clip) => {
        if (clip.type !== 'audio' || !clip.mediaId) return false;
        const clipEnd = clip.startTime + clip.duration;
        return clipEnd >= currentTime - PROXIMITY_BEFORE && clip.startTime <= currentTime + PROXIMITY_AFTER;
      })
      .slice(0, DEFAULT_MEMORY_BUDGET.maxActiveAudioElements);

    for (const clip of candidateAudioClips) {
      const asset = assetMap.get(clip.mediaId!);
      if (!asset || !asset.objectUrl) continue;

      currentAudioIds.add(clip.id);
      const existing = audioElementsRef.current.get(clip.id);
      if (!existing || existing.dataset.srcUrl !== asset.objectUrl) {
        if (existing) {
          memoryManager.unregisterAudioElement(existing);
        }
        const a = document.createElement('audio');
        a.crossOrigin = 'anonymous';
        a.preload = 'metadata';
        a.dataset.srcUrl = asset.objectUrl;
        a.src = asset.objectUrl;
        memoryManager.registerAudioElement(a);
        audioElementsRef.current.set(clip.id, a);
      }
    }

    // 3. IMAGE ELEMENTS: Load via memoryManager with LRU caching
    for (const clip of project.clips) {
      if (clip.type !== 'image' || !clip.mediaId) continue;
      const asset = assetMap.get(clip.mediaId);
      if (!asset || !asset.objectUrl) continue;

      currentImageIds.add(asset.id);
      const existing = imageElementsRef.current.get(asset.id);
      if (!existing || existing.dataset.srcUrl !== asset.objectUrl) {
        const img = memoryManager.getOrLoadImage(asset.id, asset.objectUrl, () => {
          setMediaVersion((n) => n + 1);
        });
        imageElementsRef.current.set(asset.id, img);
      }
    }

    // 4. EVICT UNUSED DECODERS IMMEDIATELY
    for (const [id, v] of videoElementsRef.current.entries()) {
      if (!currentVideoIds.has(id)) {
        memoryManager.unregisterVideoElement(v);
        videoElementsRef.current.delete(id);
        lastSeekTimesRef.current.delete(id);
      }
    }
    for (const [id, a] of audioElementsRef.current.entries()) {
      if (!currentAudioIds.has(id)) {
        memoryManager.unregisterAudioElement(a);
        audioElementsRef.current.delete(id);
      }
    }
    for (const [id, img] of imageElementsRef.current.entries()) {
      if (!currentImageIds.has(id)) {
        img.onload = null;
        img.removeAttribute('src');
        imageElementsRef.current.delete(id);
      }
    }
  }, [project.clips, project.mediaAssets, currentTime]);

  // Synchronize playback state across HTMLMediaElements during playhead scrub and transport play
  useEffect(() => {
    const trackMap = new Map(project.tracks.map((t) => [t.id, t]));
    const now = performance.now();

    for (const clip of project.clips) {
      if (clip.type === 'video') {
        const v = videoElementsRef.current.get(clip.id);
        if (!v) continue;
        const targetSrcTime = clipTimelineToSourceTime(clip, currentTime);
        const isClipActive =
          currentTime >= clip.startTime &&
          currentTime <= clip.startTime + clip.duration;

        const track = trackMap.get(clip.trackId);
        const isTrackMuted = track ? track.muted : false;
        const gain = computeClipAudioGain(clip, isTrackMuted, currentTime);

        v.volume = Math.max(0, Math.min(1, gain));
        v.playbackRate = clip.playbackSpeed || 1;

        if (isClipActive) {
          const lastSeek = lastSeekTimesRef.current.get(clip.id) || 0;
          const timeDiff = Math.abs(v.currentTime - targetSrcTime);
          // Throttle rapid scrubbing seeks to max 30 seeks/sec to avoid decoder starvation
          if (!v.seeking && timeDiff > 0.04 && (now - lastSeek > 32 || isPlaying)) {
            lastSeekTimesRef.current.set(clip.id, now);
            v.currentTime = targetSrcTime;
          }
          if (isPlaying && v.paused) {
            v.play().catch(() => {});
          } else if (!isPlaying && !v.paused) {
            v.pause();
          }
        } else {
          if (!v.paused) v.pause();
        }
      } else if (clip.type === 'audio') {
        const a = audioElementsRef.current.get(clip.id);
        if (!a) continue;
        const targetSrcTime = clipTimelineToSourceTime(clip, currentTime);
        const isClipActive =
          currentTime >= clip.startTime &&
          currentTime <= clip.startTime + clip.duration;

        const track = trackMap.get(clip.trackId);
        const isTrackMuted = track ? track.muted : false;
        const gain = computeClipAudioGain(clip, isTrackMuted, currentTime);

        a.volume = Math.max(0, Math.min(1, gain));
        a.playbackRate = clip.playbackSpeed || 1;

        if (isClipActive) {
          if (!a.seeking && Math.abs(a.currentTime - targetSrcTime) > 0.05) {
            a.currentTime = targetSrcTime;
          }
          if (isPlaying && a.paused) {
            a.play().catch(() => {});
          } else if (!isPlaying && !a.paused) {
            a.pause();
          }
        } else {
          if (!a.paused) a.pause();
        }
      }
    }
  }, [currentTime, isPlaying, project.clips, project.tracks]);

  // Pan and Zoom stage interactions
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const panStartRef = useRef<{
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  // Track Space bar for pan cursor & activation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInput =
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable;
      if (isInput) return;

      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed]);

  const handleStageMouseDown = (e: React.MouseEvent) => {
    // Middle click (button 1) or Left click (button 0) with Space held down activates pan
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: containerRef.current?.scrollLeft || 0,
        scrollTop: containerRef.current?.scrollTop || 0,
      };
    }
  };

  useEffect(() => {
    if (!isPanning) return;
    const handlePanMove = (e: MouseEvent) => {
      if (!panStartRef.current || !containerRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      containerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
      containerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
    };

    const handlePanUp = () => {
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handlePanMove);
    window.addEventListener('mouseup', handlePanUp);
    return () => {
      window.removeEventListener('mousemove', handlePanMove);
      window.removeEventListener('mouseup', handlePanUp);
    };
  }, [isPanning]);

  const handleStageWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      const currentScale = effectiveScale;
      const nextScale = Math.max(
        0.1,
        Math.min(8.0, Number((currentScale * factor).toFixed(3)))
      );
      setMonitorCustomZoom(nextScale);
      setMonitorZoom('custom');
    }
  };

  const { width: compW, height: compH } = getResolutionDimensions(
    project.aspectRatio,
    project.resolution,
    project.customWidth,
    project.customHeight
  );
  const projectDuration = getProjectDuration(project.clips);

  const selectedVisualClip = project.clips.find(
    (c) =>
      c.id === selectedClipId &&
      c.type !== 'audio' &&
      currentTime >= c.startTime &&
      currentTime <= c.startTime + c.duration
  );

  const evaluatedSelectedTransform = selectedVisualClip
    ? evaluateClipTransform(
        selectedVisualClip,
        Math.max(0, currentTime - selectedVisualClip.startTime)
      )
    : null;

  // Responsive dynamic fit calculation using ResizeObserver dimensions
  const availableW = Math.max(120, containerSize.width - 24);
  const availableH = Math.max(120, containerSize.height - 24);
  const fitScale = Math.min(availableW / compW, availableH / compH);
  const fillScale = Math.max(availableW / compW, availableH / compH);

  let effectiveScale: number;
  switch (monitorZoom) {
    case 'fill':
      effectiveScale = fillScale;
      break;
    case '25':
      effectiveScale = 0.25;
      break;
    case '50':
      effectiveScale = 0.5;
      break;
    case '75':
      effectiveScale = 0.75;
      break;
    case '100':
      effectiveScale = 1.0;
      break;
    case '200':
      effectiveScale = 2.0;
      break;
    case '400':
      effectiveScale = 4.0;
      break;
    case 'custom':
      effectiveScale = monitorCustomZoom || fitScale;
      break;
    case 'fit':
    default:
      effectiveScale = fitScale * (canvasZoom || 1.0);
      break;
  }

  const displayWidth = Math.max(64, Math.round(compW * effectiveScale));
  const displayHeight = Math.max(64, Math.round(compH * effectiveScale));

  // Determine active preview rendering scale (Adaptive Preview Quality)
  let activeRenderScale = 1.0;
  if (previewQuality === 'quarter') {
    activeRenderScale = 0.25;
  } else if (previewQuality === 'half') {
    activeRenderScale = 0.5;
  } else if (previewQuality === 'full') {
    activeRenderScale = 1.0;
  } else {
    // 'auto': if effective scale is <= 0.45, half raster resolution is visually identical & 4x lighter
    if (effectiveScale <= 0.45) {
      activeRenderScale = 0.5;
    } else {
      activeRenderScale = 1.0;
    }
  }

  // Main Canvas Render Loop (RAF driven)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sources: MediaElementSource = {
      videoElements: videoElementsRef.current,
      imageElements: imageElementsRef.current,
    };

    renderCompositionAtTime(ctx, project, currentTime, sources, {
      showSafeGuides,
      renderScale: activeRenderScale,
    });
  }, [
    currentTime,
    mediaVersion,
    project,
    showSafeGuides,
    containerSize,
    monitorZoom,
    canvasZoom,
    isMonitorMaximized,
    isFocusMode,
    activeRenderScale,
    effectiveScale,
  ]);

  // Direct manipulation mouse event handlers (1:1 cursor locking via effectiveScale division)
  useEffect(() => {
    if (!dragMode) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragMode.startMouseX;
      const deltaY = e.clientY - dragMode.startMouseY;

      if (dragMode.type === 'move') {
        const compDeltaX = deltaX / effectiveScale;
        const compDeltaY = deltaY / effectiveScale;
        updateClipProperties(
          dragMode.clipId,
          {
            x: Math.round(dragMode.initialX + compDeltaX),
            y: Math.round(dragMode.initialY + compDeltaY),
          },
          false
        );
      } else if (dragMode.type === 'scale') {
        const factor = 1 + (deltaX / effectiveScale) * 0.003;
        const nextScale = Math.max(0.05, Math.min(10, dragMode.initialScale * factor));
        updateClipProperties(
          dragMode.clipId,
          { scale: Number(nextScale.toFixed(2)) },
          false
        );
      } else if (dragMode.type === 'rotate') {
        const nextRot = (dragMode.initialRotation + deltaX * 0.5) % 360;
        updateClipProperties(
          dragMode.clipId,
          { rotation: Math.round(nextRot) },
          false
        );
      }
    };

    const handleMouseUp = () => {
      setDragMode(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragMode, effectiveScale, updateClipProperties]);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };
  // Direct manipulation layer box coordinates
  const clipScreenCenterX =
    displayWidth / 2 +
    (evaluatedSelectedTransform ? (evaluatedSelectedTransform.x / compW) * displayWidth : 0);
  const clipScreenCenterY =
    displayHeight / 2 +
    (evaluatedSelectedTransform ? (evaluatedSelectedTransform.y / compH) * displayHeight : 0);

  const layerBaseW =
    selectedVisualClip?.shapeStyle?.width ||
    (selectedVisualClip?.type === 'text' ? 600 : compW * 0.75);
  const layerBaseH =
    selectedVisualClip?.shapeStyle?.height ||
    (selectedVisualClip?.type === 'text' ? 180 : compH * 0.75);

  const gizmoWidth = Math.max(
    40,
    layerBaseW * effectiveScale * (evaluatedSelectedTransform?.scale || 1)
  );
  const gizmoHeight = Math.max(
    30,
    layerBaseH * effectiveScale * (evaluatedSelectedTransform?.scale || 1)
  );

  return (
    <main
      data-testid="center-preview-container"
      className="flex-1 bg-[#0B0F16] flex flex-col h-full overflow-hidden select-none min-w-0"
    >
      {/* Top Program Monitor Header */}
      <div className="h-9 bg-[#141A23] border-b border-[#2A3341] px-3.5 flex items-center justify-between text-[11px] text-[#94A3B8] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Monitor className="w-3.5 h-3.5 text-[#8B82F6] shrink-0" />
          <span className="font-semibold text-[#E8EDF5] tracking-tight whitespace-nowrap">
            Program Monitor
          </span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#0B0F16] border border-[#2A3341] rounded text-[#94A3B8] whitespace-nowrap">
            {compW}×{compH} • {project.aspectRatio} • {project.fps}fps
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Safe-Area Guides Toggle */}
          <button
            type="button"
            data-testid="safe-guides-btn"
            onClick={toggleSafeGuides}
            className={`h-6 px-2 rounded-md border text-[11px] font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              showSafeGuides
                ? 'bg-[#8B82F6]/20 border-[#8B82F6] text-[#E8EDF5]'
                : 'bg-[#0B0F16] border-[#2A3341] text-[#94A3B8] hover:text-[#E8EDF5]'
            }`}
            title="Toggle Broadcast Safe Guides (Action 90%, Title 80%, Crosshair, Grid)"
          >
            <Grid className="w-3 h-3" />
            <span className="hidden sm:inline">Safe Guides</span>
          </button>

          {/* Preview Quality / Resolution Selector */}
          <div className="flex items-center gap-1 bg-[#0B0F16] border border-[#2A3341] rounded-md pl-2 pr-1 h-6">
            <Sliders className="w-3 h-3 text-[#94A3B8] shrink-0" />
            <select
              aria-label="Preview Quality"
              data-testid="preview-quality-select"
              value={previewQuality}
              onChange={(e) => setPreviewQuality(e.target.value as PreviewQuality)}
              className="bg-transparent pr-3 text-[11px] font-mono text-[#E8EDF5] focus:outline-none cursor-pointer"
              title="Preview Rendering Resolution (Exports always render at 100% full master resolution)"
            >
              <option value="auto" className="bg-[#141A23]">
                Auto ({activeRenderScale === 1.0 ? 'Full' : 'Half'})
              </option>
              <option value="full" className="bg-[#141A23]">Full (100%)</option>
              <option value="half" className="bg-[#141A23]">Half (50%)</option>
              <option value="quarter" className="bg-[#141A23]">Quarter (25%)</option>
            </select>
          </div>

          {/* Canvas Zoom Selector */}
          <div className="flex items-center gap-1 bg-[#0B0F16] border border-[#2A3341] rounded-md pl-2 pr-1 h-6">
            <ZoomIn className="w-3 h-3 text-[#94A3B8] shrink-0" />
            <select
              aria-label="Canvas Zoom"
              data-testid="canvas-zoom-select"
              value={monitorZoom}
              onChange={(e) => {
                const val = e.target.value as MonitorZoomMode;
                setMonitorZoom(val);
                if (val === 'fit') setCanvasZoom(1);
              }}
              className="bg-transparent pr-3 text-[11px] font-mono text-[#E8EDF5] focus:outline-none cursor-pointer"
            >
              <option value="fit" className="bg-[#141A23]">
                Fit ({Math.round(fitScale * 100)}%)
              </option>
              <option value="fill" className="bg-[#141A23]">
                Fill ({Math.round(fillScale * 100)}%)
              </option>
              <option value="25" className="bg-[#141A23]">25%</option>
              <option value="50" className="bg-[#141A23]">50%</option>
              <option value="75" className="bg-[#141A23]">75%</option>
              <option value="100" className="bg-[#141A23]">100%</option>
              <option value="200" className="bg-[#141A23]">200%</option>
              <option value="400" className="bg-[#141A23]">400%</option>
              {monitorZoom === 'custom' && (
                <option value="custom" className="bg-[#141A23]">
                  Custom ({Math.round(effectiveScale * 100)}%)
                </option>
              )}
            </select>
          </div>

          {/* Focus / Cinema Mode Toggle */}
          <button
            type="button"
            data-testid="toggle-focus-mode-btn"
            onClick={toggleFocusMode}
            className={`h-6 px-2 rounded-md border text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              isFocusMode
                ? 'bg-[#8B82F6] text-white border-[#8B82F6]'
                : 'bg-[#0B0F16] border-[#2A3341] text-[#94A3B8] hover:text-[#E8EDF5]'
            }`}
            title="Toggle Focus / Cinema Mode (F or Esc)"
          >
            <Tv className="w-3 h-3" />
            <span className="hidden lg:inline">Focus (F)</span>
          </button>

          {/* Maximize Monitor Toggle */}
          <button
            type="button"
            data-testid="toggle-monitor-max-btn"
            onClick={toggleMonitorMaximized}
            className={`h-6 w-6 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
              isMonitorMaximized
                ? 'bg-[#8B82F6] text-white border-[#8B82F6]'
                : 'bg-[#0B0F16] border-[#2A3341] text-[#94A3B8] hover:text-[#E8EDF5]'
            }`}
            title={isMonitorMaximized ? 'Restore Workspace Panels' : 'Maximize Program Monitor'}
          >
            {isMonitorMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Center Canvas Stage Container with ResizeObserver, Pan, and Ctrl+Wheel Zoom */}
      <div
        ref={containerRef}
        onWheel={handleStageWheel}
        onMouseDown={handleStageMouseDown}
        onDoubleClick={toggleMonitorMaximized}
        style={{
          cursor: isPanning ? 'grabbing' : isSpacePressed ? 'grab' : 'default',
        }}
        className="flex-1 overflow-auto flex flex-col items-center justify-center p-2 sm:p-2.5 relative bg-[#070A0F]"
      >
        <div
          style={{ width: displayWidth, height: displayHeight }}
          className="relative shadow-2xl border border-[#2A3341] rounded-xs bg-black shrink-0 transition-[width,height] duration-75"
        >
          <canvas
            ref={canvasRef}
            data-testid="preview-canvas"
            className="w-full h-full block"
          />

          {/* Broadcast Safe Guides Overlay */}
          {showSafeGuides && (
            <div className="absolute inset-0 pointer-events-none z-10">
              {/* Action Safe (90%) */}
              <div
                style={{ inset: '5%' }}
                className="absolute border border-dashed border-[#38BDF8]/40"
              >
                <span className="absolute top-0.5 left-1 text-[8px] font-mono text-[#38BDF8]/70">
                  ACTION SAFE 90%
                </span>
              </div>

              {/* Title Safe (80%) */}
              <div
                style={{ inset: '10%' }}
                className="absolute border border-dashed border-[#F59E0B]/50"
              >
                <span className="absolute top-0.5 left-1 text-[8px] font-mono text-[#F59E0B]/80">
                  TITLE SAFE 80%
                </span>
              </div>

              {/* Rule of Thirds Grid */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                <div className="border-r border-b border-white/10" />
                <div className="border-r border-b border-white/10" />
                <div className="border-b border-white/10" />
                <div className="border-r border-b border-white/10" />
                <div className="border-r border-b border-white/10" />
                <div className="border-b border-white/10" />
                <div className="border-r border-white/10" />
                <div className="border-r border-white/10" />
                <div />
              </div>

              {/* Center Crosshair */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none">
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/40 -translate-x-1/2" />
                <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/40 -translate-y-1/2" />
              </div>
            </div>
          )}

          {/* Direct Manipulation Bounding Box & Handles for Selected Active Visual Clip */}
          {selectedVisualClip && evaluatedSelectedTransform && (
            <div
              data-testid="direct-manipulation-gizmo"
              onMouseDown={(e) => {
                if (isSpacePressed) return;
                e.stopPropagation();
                useEditorStore.getState().pushHistory();
                setDragMode({
                  type: 'move',
                  clipId: selectedVisualClip.id,
                  startMouseX: e.clientX,
                  startMouseY: e.clientY,
                  initialX: selectedVisualClip.x,
                  initialY: selectedVisualClip.y,
                  initialScale: selectedVisualClip.scale,
                  initialRotation: selectedVisualClip.rotation,
                });
              }}
              style={{
                width: `${gizmoWidth}px`,
                height: `${gizmoHeight}px`,
                left: `${clipScreenCenterX}px`,
                top: `${clipScreenCenterY}px`,
                transform: `translate(-50%, -50%) rotate(${evaluatedSelectedTransform.rotation}deg)`,
              }}
              className="absolute border border-[#8B82F6] cursor-move pointer-events-auto"
              title="Drag to position layer, drag corners to scale, drag top handle to rotate"
            >
              {/* Rotation Handle */}
              <div
                data-testid="gizmo-rotate-handle"
                onMouseDown={(e) => {
                  if (isSpacePressed) return;
                  e.stopPropagation();
                  useEditorStore.getState().pushHistory();
                  setDragMode({
                    type: 'rotate',
                    clipId: selectedVisualClip.id,
                    startMouseX: e.clientX,
                    startMouseY: e.clientY,
                    initialX: selectedVisualClip.x,
                    initialY: selectedVisualClip.y,
                    initialScale: selectedVisualClip.scale,
                    initialRotation: selectedVisualClip.rotation,
                  });
                }}
                className="absolute -top-5 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#8B82F6] border border-white rounded-full flex items-center justify-center cursor-grab"
              >
                <RotateCw className="w-2.5 h-2.5 text-white" />
              </div>

              {/* 4 Corner Scale Handles */}
              {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(
                (corner) => (
                  <div
                    key={corner}
                    data-testid={`gizmo-scale-${corner}`}
                    onMouseDown={(e) => {
                      if (isSpacePressed) return;
                      e.stopPropagation();
                      useEditorStore.getState().pushHistory();
                      setDragMode({
                        type: 'scale',
                        clipId: selectedVisualClip.id,
                        startMouseX: e.clientX,
                        startMouseY: e.clientY,
                        initialX: selectedVisualClip.x,
                        initialY: selectedVisualClip.y,
                        initialScale: selectedVisualClip.scale,
                        initialRotation: selectedVisualClip.rotation,
                      });
                    }}
                    className={`absolute w-2.5 h-2.5 bg-white border border-[#8B82F6] rounded-xs cursor-nwse-resize ${
                      corner === 'top-left'
                        ? '-top-1.5 -left-1.5'
                        : corner === 'top-right'
                          ? '-top-1.5 -right-1.5'
                          : corner === 'bottom-left'
                            ? '-bottom-1.5 -left-1.5'
                            : '-bottom-1.5 -right-1.5'
                    }`}
                  />
                )
              )}

              {/* Active Mask Boundary Overlay inside Gizmo */}
              {selectedVisualClip.mask &&
                selectedVisualClip.mask.shape !== 'none' && (
                  <div
                    data-testid="gizmo-mask-overlay"
                    style={{
                      width: `${Math.max(4, evaluatedSelectedTransform.maskWidth)}%`,
                      height: `${Math.max(4, evaluatedSelectedTransform.maskHeight)}%`,
                      left: `${50 + evaluatedSelectedTransform.maskX}%`,
                      top: `${50 + evaluatedSelectedTransform.maskY}%`,
                      transform: `translate(-50%, -50%) rotate(${
                        selectedVisualClip.mask.rotation || 0
                      }deg)`,
                      borderRadius:
                        selectedVisualClip.mask.shape === 'ellipse' ||
                        selectedVisualClip.mask.shape === 'circle'
                          ? '9999px'
                          : `${Math.min(
                              48,
                              (selectedVisualClip.mask.radius || 0) * 0.25
                            )}px`,
                    }}
                    className="absolute border-1.5 border-dashed border-[#D7E83F] bg-[#D7E83F]/5 pointer-events-none flex items-start justify-start"
                  >
                    <span className="px-1 py-0 text-[8px] font-mono uppercase bg-[#0B0F0B]/90 text-[#D7E83F] border-b border-r border-[#D7E83F]/60 rounded-br-xs">
                      MASK: {selectedVisualClip.mask.shape} (
                      {Math.round(evaluatedSelectedTransform.maskWidth)}%)
                    </span>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {/* Floating-Style Linear Transport Bar */}
      <div className="h-9 bg-[#0B0F16] border-t border-[#1C2330] px-3 flex items-center justify-center shrink-0">
        <div className="bg-[#141A23] border border-[#252E3E] rounded-full px-3 py-0.5 flex items-center gap-3.5 shadow-md">
          {/* Left: Timecode Readout */}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              data-testid="timecode-display"
              className="font-mono text-xs font-semibold text-[#E8EDF5] tabular-nums"
            >
              {formatTimecode(currentTime, project.fps)}
            </span>
            <span className="text-[#94A3B8]/60 font-mono text-xs">/</span>
            <span
              data-testid="duration-display"
              className="font-mono text-xs text-[#94A3B8] tabular-nums"
            >
              {formatTimecode(projectDuration, project.fps)}
            </span>
          </div>

          <div className="h-4 w-px bg-[#2A3341]" />

          {/* Center: Transport Controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="jump-start-btn"
              onClick={() => {
                setIsPlaying(false);
                setCurrentTime(0);
              }}
              className="w-7 h-7 hover:bg-[#1D2531] rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#E8EDF5] transition-colors cursor-pointer"
              title="Jump to Start (Home)"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              data-testid="step-backward-btn"
              onClick={() => stepFrames(-1)}
              className="w-7 h-7 hover:bg-[#1D2531] rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#E8EDF5] transition-colors cursor-pointer"
              title="Previous Frame (Left Arrow)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              data-testid="play-pause-btn"
              onClick={togglePlayPause}
              className="w-8 h-8 bg-[#8B82F6] hover:bg-[#7a71f0] text-white rounded-full flex items-center justify-center transition-colors shadow-xs cursor-pointer mx-0.5"
              title="Play / Pause (Space)"
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              data-testid="step-forward-btn"
              onClick={() => stepFrames(1)}
              className="w-7 h-7 hover:bg-[#1D2531] rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#E8EDF5] transition-colors cursor-pointer"
              title="Next Frame (Right Arrow)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              data-testid="jump-end-btn"
              onClick={() => {
                setIsPlaying(false);
                setCurrentTime(projectDuration);
              }}
              className="w-7 h-7 hover:bg-[#1D2531] rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#E8EDF5] transition-colors cursor-pointer"
              title="Jump to End"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-[#2A3341]" />

          {/* Right: Quick Split Action */}
          <button
            type="button"
            data-testid="split-clip-btn"
            onClick={() => splitSelectedClipAtPlayhead()}
            className="h-7 px-2.5 bg-[#1D2531] hover:bg-[#2A3341] border border-[#2A3341] rounded-full flex items-center gap-1.5 text-[11px] font-medium text-[#E8EDF5] transition-colors whitespace-nowrap cursor-pointer"
            title="Split Clip at Playhead (S)"
          >
            <Scissors className="w-3 h-3 text-[#8B82F6]" />
            <span>Split (S)</span>
          </button>
        </div>
      </div>
    </main>
  );
};

export default CenterPreview;
