import React, { useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
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
  } = useEditorStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [mediaVersion, setMediaVersion] = useState(0);

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

  // Sync persistent HTMLVideoElement / HTMLImageElement / HTMLAudioElement pool without recreating per frame
  useEffect(() => {
    const assetMap = new Map(project.mediaAssets.map((a) => [a.id, a]));
    const currentVideoIds = new Set<string>();
    const currentAudioIds = new Set<string>();
    const currentImageIds = new Set<string>();

    for (const clip of project.clips) {
      if (!clip.mediaId) continue;
      const asset = assetMap.get(clip.mediaId);
      if (!asset || !asset.objectUrl) continue;

      if (clip.type === 'video') {
        currentVideoIds.add(clip.id);
        const existing = videoElementsRef.current.get(clip.id);
        if (!existing || existing.dataset.srcUrl !== asset.objectUrl) {
          if (existing) {
            existing.pause();
            existing.removeAttribute('src');
          }
          const v = document.createElement('video');
          v.crossOrigin = 'anonymous';
          v.playsInline = true;
          v.preload = 'auto';
          v.dataset.srcUrl = asset.objectUrl;
          v.src = asset.objectUrl;
          v.onloadeddata = () => setMediaVersion((n) => n + 1);
          v.onseeked = () => setMediaVersion((n) => n + 1);
          videoElementsRef.current.set(clip.id, v);
        }
      } else if (clip.type === 'audio') {
        currentAudioIds.add(clip.id);
        const existing = audioElementsRef.current.get(clip.id);
        if (!existing || existing.dataset.srcUrl !== asset.objectUrl) {
          if (existing) {
            existing.pause();
            existing.removeAttribute('src');
          }
          const a = document.createElement('audio');
          a.crossOrigin = 'anonymous';
          a.preload = 'auto';
          a.dataset.srcUrl = asset.objectUrl;
          a.src = asset.objectUrl;
          audioElementsRef.current.set(clip.id, a);
        }
      } else if (clip.type === 'image') {
        currentImageIds.add(asset.id);
        const existing = imageElementsRef.current.get(asset.id);
        if (!existing || existing.dataset.srcUrl !== asset.objectUrl) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.dataset.srcUrl = asset.objectUrl;
          img.onload = () => setMediaVersion((n) => n + 1);
          img.src = asset.objectUrl;
          imageElementsRef.current.set(asset.id, img);
        }
      }
    }

    // Cleanup removed clip elements
    for (const [id, v] of videoElementsRef.current.entries()) {
      if (!currentVideoIds.has(id)) {
        v.pause();
        v.removeAttribute('src');
        v.load();
        videoElementsRef.current.delete(id);
      }
    }
    for (const [id, a] of audioElementsRef.current.entries()) {
      if (!currentAudioIds.has(id)) {
        a.pause();
        a.removeAttribute('src');
        a.load();
        audioElementsRef.current.delete(id);
      }
    }
  }, [project.clips, project.mediaAssets]);

  // Cleanup all media elements on unmount
  useEffect(() => {
    const videos = videoElementsRef.current;
    const audios = audioElementsRef.current;
    return () => {
      for (const v of videos.values()) {
        v.pause();
        v.removeAttribute('src');
      }
      for (const a of audios.values()) {
        a.pause();
        a.removeAttribute('src');
      }
    };
  }, []);

  // Synchronize video/audio elements and render composition
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const trackMap = new Map(project.tracks.map((t) => [t.id, t]));
    const activeLayers = getCompositedVisualClipsAtTime(
      project.tracks,
      project.clips,
      currentTime
    );

    const activeVideoClipTargets = new Map<string, number>();
    for (const layer of activeLayers) {
      if (layer.clip.type === 'video') {
        activeVideoClipTargets.set(layer.clip.id, layer.sourceTime);
      }
      if (
        layer.outgoingTransition &&
        layer.outgoingTransition.previousClip.type === 'video'
      ) {
        activeVideoClipTargets.set(
          layer.outgoingTransition.previousClip.id,
          layer.outgoingTransition.previousSourceTime
        );
      }
    }

    for (const clip of project.clips) {
      if (clip.type === 'video') {
        const v = videoElementsRef.current.get(clip.id);
        if (!v) continue;
        const targetSourceTime = activeVideoClipTargets.get(clip.id);
        const track = trackMap.get(clip.trackId);
        const gain = computeClipAudioGain(clip, !!track?.muted, currentTime);
        v.volume = Math.max(0, Math.min(1, gain));
        v.muted = gain <= 0.001;
        v.playbackRate = clip.playbackSpeed;

        if (targetSourceTime !== undefined) {
          if (isPlaying) {
            if (Math.abs(v.currentTime - targetSourceTime) > 0.22) {
              v.currentTime = targetSourceTime;
            }
            if (v.paused && v.readyState >= 2) {
              void v.play().catch(() => {});
            }
          } else {
            if (!v.paused) v.pause();
            if (Math.abs(v.currentTime - targetSourceTime) > 0.015) {
              v.currentTime = targetSourceTime;
            }
          }
        } else {
          if (!v.paused) v.pause();
        }
      } else if (clip.type === 'audio') {
        const a = audioElementsRef.current.get(clip.id);
        if (!a) continue;
        const track = trackMap.get(clip.trackId);
        const isClipActive =
          currentTime >= clip.startTime &&
          currentTime < clip.startTime + clip.duration;
        const gain = computeClipAudioGain(clip, !!track?.muted, currentTime);
        a.volume = Math.max(0, Math.min(1, gain));
        a.muted = gain <= 0.001;
        a.playbackRate = clip.playbackSpeed;

        if (isClipActive && isPlaying) {
          const targetSourceTime = clipTimelineToSourceTime(clip, currentTime);
          if (Math.abs(a.currentTime - targetSourceTime) > 0.22) {
            a.currentTime = targetSourceTime;
          }
          if (a.paused && a.readyState >= 2) {
            void a.play().catch(() => {});
          }
        } else {
          if (!a.paused) a.pause();
          if (isClipActive && !isPlaying) {
            const targetSourceTime = clipTimelineToSourceTime(clip, currentTime);
            if (Math.abs(a.currentTime - targetSourceTime) > 0.03) {
              a.currentTime = targetSourceTime;
            }
          }
        }
      }
    }

    const sources: MediaElementSource = {
      videoElements: videoElementsRef.current,
      imageElements: imageElementsRef.current,
    };

    renderCompositionAtTime(ctx, project, currentTime, sources, {
      showSafeGuides,
      selectedClipId,
    });
  }, [project, currentTime, isPlaying, showSafeGuides, selectedClipId, mediaVersion]);

  // High-precision playback clock
  useEffect(() => {
    if (!isPlaying) return;

    let rafId = 0;
    let lastTimestamp = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      const state = useEditorStore.getState();
      const totalDur = Math.max(0.5, getProjectDuration(state.project.clips));
      const nextTime = state.currentTime + dt;

      if (nextTime >= totalDur) {
        state.setCurrentTime(totalDur);
        state.setIsPlaying(false);
        return;
      }

      state.setCurrentTime(nextTime);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  // Direct Manipulation Handle Dragging on Preview Viewport
  useEffect(() => {
    if (!dragMode) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragMode.startMouseX;
      const dy = e.clientY - dragMode.startMouseY;

      if (dragMode.type === 'move') {
        updateClipProperties(
          dragMode.clipId,
          {
            x: Math.round(dragMode.initialX + dx * 2),
            y: Math.round(dragMode.initialY + dy * 2),
          },
          false
        );
      } else if (dragMode.type === 'scale') {
        const scaleDelta = (dx - dy) / 180;
        const nextScale = Number(
          Math.max(0.1, Math.min(4.0, dragMode.initialScale + scaleDelta)).toFixed(2)
        );
        updateClipProperties(dragMode.clipId, { scale: nextScale }, false);
      } else if (dragMode.type === 'rotate') {
        const nextRot = Math.round(dragMode.initialRotation + dx * 0.8);
        updateClipProperties(dragMode.clipId, { rotation: nextRot }, false);
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
  }, [dragMode, updateClipProperties]);

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

  const basePreviewHeight = compH > compW ? 340 : 300;
  const displayHeight = Math.round(basePreviewHeight * canvasZoom);
  const displayWidth = Math.round((compW / compH) * displayHeight);

  return (
    <main className="flex-1 bg-[#08080b] flex flex-col h-full overflow-hidden select-none min-w-0">
      {/* Top Program Monitor Header */}
      <div className="h-9 bg-[#0c0c10] border-b border-[#1f1f26] px-3.5 flex items-center justify-between text-[11px] text-[#8e8e98] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Monitor className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
          <span className="font-medium text-[#e4e4e7] tracking-tight whitespace-nowrap">
            Program Monitor
          </span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#14141a] border border-[#23232c] rounded text-[#8e8e98] whitespace-nowrap">
            {compW}×{compH} • {project.aspectRatio} • {project.fps}fps
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Safe-Area Guides Toggle */}
          <button
            type="button"
            data-testid="safe-guides-btn"
            onClick={toggleSafeGuides}
            className={`h-6 px-2 rounded-md border text-[11px] font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              showSafeGuides
                ? 'bg-[#5e6ad2]/15 border-[#5e6ad2]/60 text-[#c7ceff]'
                : 'bg-[#121217] border-[#23232c] text-[#8e8e98] hover:text-[#e4e4e7]'
            }`}
            title="Toggle Broadcast Action/Title Safe Guides"
          >
            <Grid className="w-3 h-3" />
            <span>Safe Guides</span>
          </button>

          {/* Canvas Zoom Control */}
          <div className="flex items-center gap-1 bg-[#121217] border border-[#23232c] rounded-md pl-2 pr-1 h-6">
            <ZoomIn className="w-3 h-3 text-[#71717a] shrink-0" />
            <select
              aria-label="Canvas Zoom"
              data-testid="canvas-zoom-select"
              value={canvasZoom}
              onChange={(e) => setCanvasZoom(Number(e.target.value))}
              className="bg-transparent pr-5 text-[11px] font-mono text-[#e4e4e7] focus:outline-none cursor-pointer"
            >
              <option value={0.5} className="bg-[#121217]">
                50%
              </option>
              <option value={0.75} className="bg-[#121217]">
                75%
              </option>
              <option value={1} className="bg-[#121217]">
                100% Fit
              </option>
              <option value={1.25} className="bg-[#121217]">
                125%
              </option>
              <option value={1.5} className="bg-[#121217]">
                150%
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Center Canvas Stage */}
      <div className="flex-1 overflow-auto flex flex-col items-center justify-center p-4 relative bg-[#070709]">
        <div
          style={{ width: displayWidth, height: displayHeight }}
          className="relative shadow-2xl border border-[#24242e] rounded-xs bg-black shrink-0"
        >
          <canvas
            ref={canvasRef}
            data-testid="preview-canvas"
            width={compW}
            height={compH}
            className="w-full h-full block"
          />

          {/* Direct Manipulation Bounding Box & Handles for Selected Active Visual Clip */}
          {selectedVisualClip && evaluatedSelectedTransform && (
            <div
              data-testid="direct-manipulation-gizmo"
              onMouseDown={(e) => {
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
                transform: `translate(${
                  (evaluatedSelectedTransform.x / compW) * displayWidth
                }px, ${
                  (evaluatedSelectedTransform.y / compH) * displayHeight
                }px) rotate(${evaluatedSelectedTransform.rotation}deg) scale(${
                  evaluatedSelectedTransform.scale
                })`,
              }}
              className="absolute inset-6 border border-[#7c86ff] cursor-move pointer-events-auto"
              title="Drag to position layer, drag corners to scale, drag top handle to rotate"
            >
              {/* Rotation Handle */}
              <div
                data-testid="gizmo-rotate-handle"
                onMouseDown={(e) => {
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
                className="absolute -top-5 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#5e6ad2] border border-white rounded-full flex items-center justify-center cursor-grab"
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
                    className={`absolute w-2.5 h-2.5 bg-white border border-[#5e6ad2] rounded-xs cursor-nwse-resize ${
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
      <div className="h-11 bg-[#0b0b0e] border-t border-[#1f1f26] px-4 flex items-center justify-center shrink-0">
        <div className="bg-[#121217] border border-[#24242f] rounded-full px-3.5 py-1 flex items-center gap-4 shadow-lg">
          {/* Left: Timecode Readout */}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              data-testid="timecode-display"
              className="font-mono text-xs font-semibold text-[#f4f4f5] tabular-nums"
            >
              {formatTimecode(currentTime, project.fps)}
            </span>
            <span className="text-[#52525b] font-mono text-xs">/</span>
            <span
              data-testid="duration-display"
              className="font-mono text-xs text-[#71717a] tabular-nums"
            >
              {formatTimecode(projectDuration, project.fps)}
            </span>
          </div>

          <div className="h-4 w-px bg-[#24242f]" />

          {/* Center: Transport Controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="jump-start-btn"
              onClick={() => {
                setIsPlaying(false);
                setCurrentTime(0);
              }}
              className="w-7 h-7 hover:bg-[#1e1e26] rounded-full flex items-center justify-center text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors cursor-pointer"
              title="Jump to Start (Home)"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              data-testid="step-backward-btn"
              onClick={() => stepFrames(-1)}
              className="w-7 h-7 hover:bg-[#1e1e26] rounded-full flex items-center justify-center text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors cursor-pointer"
              title="Previous Frame (Left Arrow)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              data-testid="play-pause-btn"
              onClick={togglePlayPause}
              className="w-8 h-8 bg-[#5e6ad2] hover:bg-[#6e79de] text-white rounded-full flex items-center justify-center transition-colors shadow-xs cursor-pointer mx-0.5"
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
              className="w-7 h-7 hover:bg-[#1e1e26] rounded-full flex items-center justify-center text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors cursor-pointer"
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
              className="w-7 h-7 hover:bg-[#1e1e26] rounded-full flex items-center justify-center text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors cursor-pointer"
              title="Jump to End"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-[#24242f]" />

          {/* Right: Quick Split Action */}
          <button
            type="button"
            data-testid="split-clip-btn"
            onClick={() => splitSelectedClipAtPlayhead()}
            className="h-7 px-2.5 bg-[#191922] hover:bg-[#23232f] border border-[#2a2a38] rounded-full flex items-center gap-1.5 text-[11px] font-medium text-[#e4e4e7] transition-colors whitespace-nowrap cursor-pointer"
            title="Split Clip at Playhead (S)"
          >
            <Scissors className="w-3 h-3 text-[#8b93ff]" />
            <span>Split (S)</span>
          </button>
        </div>
      </div>
    </main>
  );
};
