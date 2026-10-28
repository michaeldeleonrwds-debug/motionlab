import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Scissors,
  Copy,
  Trash2,
  Magnet,
  ZoomIn,
  ZoomOut,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Film,
  Type,
  Music,
  Layers,
  Diamond,
  ArrowRightLeft,
  Minimize2,
  Maximize2,
  Maximize,
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import {
  findSnapTarget,
  formatTimecode,
  getProjectDuration,
  isTrackCompatibleWithClip,
} from '../engine/timelineEngine';
import type { TimelineClip, TimelineTrack } from '../types/editor';

export const TimelinePanel: React.FC = () => {
  const timelineHeight = useWorkspaceStore((s) => s.panelSizes.timelineHeight);
  const timelineDensity = useWorkspaceStore((s) => s.timelineDensity);
  const setTimelineDensity = useWorkspaceStore((s) => s.setTimelineDensity);
  const {
    project,
    selectedClipId,
    selectedKeyframeId,
    currentTime,
    timelineZoom,
    snapEnabled,
    activeSnapTime,
    selectClip,
    selectKeyframe,
    setCurrentTime,
    setIsPlaying,
    setTimelineZoom,
    toggleSnap,
    setActiveSnapTime,
    addTrack,
    toggleTrackMute,
    toggleTrackVisible,
    toggleTrackLock,
    addMediaClipToTimeline,
    moveClip,
    trimClipLeftAction,
    trimClipRightAction,
    splitSelectedClipAtPlayhead,
    splitClipById,
    deleteClip,
    duplicateClip,
    setClipTransition,
    updateClipProperties,
    updateClipKeyframe,
  } = useEditorStore();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trackHeadersRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  const handleLanesScroll = () => {
    if (isSyncingScroll.current) return;
    if (trackHeadersRef.current && scrollContainerRef.current) {
      isSyncingScroll.current = true;
      trackHeadersRef.current.scrollTop = scrollContainerRef.current.scrollTop;
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    }
  };

  const handleHeadersScroll = () => {
    if (isSyncingScroll.current) return;
    if (trackHeadersRef.current && scrollContainerRef.current) {
      isSyncingScroll.current = true;
      scrollContainerRef.current.scrollTop = trackHeadersRef.current.scrollTop;
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    }
  };

  const [dragState, setDragState] = useState<
    | null
    | {
        mode: 'scrub';
      }
    | {
        mode: 'move-keyframe';
        clipId: string;
        keyframeId: string;
        startX: number;
        initialKfTime: number;
        clipStartTime: number;
        clipDuration: number;
      }
    | {
        mode: 'move' | 'trim-left' | 'trim-right';
        clipId: string;
        startX: number;
        initialStartTime: number;
        initialDuration: number;
        currentTrackId: string;
      }
  >(null);

  const [contextMenu, setContextMenu] = useState<null | {
    x: number;
    y: number;
    clipId: string;
  }>(null);

  const totalProjectDuration = getProjectDuration(project.clips);
  const timelineSpanSeconds = Math.max(24, Math.ceil(totalProjectDuration + 10));
  const timelineWidthPx = Math.max(1800, timelineSpanSeconds * timelineZoom);

  const clientXToTimelineSeconds = (clientX: number): number => {
    const scroller = scrollContainerRef.current;
    if (!scroller) return 0;
    const rect = scroller.getBoundingClientRect();
    const offsetX = clientX - rect.left + scroller.scrollLeft;
    return Math.max(0, offsetX / timelineZoom);
  };

  const trackHeightPx =
    timelineDensity === 'compact'
      ? 28
      : timelineDensity === 'expanded'
        ? 64
        : 40;

  // Alt + Mouse Wheel Zoom on timeline ruler / scroll area
  useEffect(() => {
    const scroller = scrollContainerRef.current;
    if (!scroller) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.altKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 15 : -15;
        const currentZoom = useEditorStore.getState().timelineZoom;
        useEditorStore
          .getState()
          .setTimelineZoom(Math.max(30, Math.min(260, currentZoom + delta)));
      }
    };

    scroller.addEventListener('wheel', handleWheel, { passive: false });
    return () => scroller.removeEventListener('wheel', handleWheel);
  }, []);

  // Pointer drag handling for Scrubbing, Moving Clips, Trimming Clips, and Moving Keyframes
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dragState.mode === 'scrub') {
        const t = clientXToTimelineSeconds(e.clientX);
        setCurrentTime(t);
        return;
      }

      if (dragState.mode === 'move-keyframe') {
        const deltaPx = e.clientX - dragState.startX;
        const deltaSeconds = deltaPx / timelineZoom;
        const nextKfTime = Math.max(
          0,
          Math.min(dragState.clipDuration, dragState.initialKfTime + deltaSeconds)
        );
        updateClipKeyframe(
          dragState.clipId,
          dragState.keyframeId,
          { time: Number(nextKfTime.toFixed(3)) },
          false
        );
        setCurrentTime(dragState.clipStartTime + nextKfTime);
        return;
      }

      const deltaPx = e.clientX - dragState.startX;
      const deltaSeconds = deltaPx / timelineZoom;
      const snapThresholdSec = 10 / timelineZoom;

      if (dragState.mode === 'move') {
        let proposedStart = Math.max(0, dragState.initialStartTime + deltaSeconds);

        if (snapEnabled) {
          const snapStart = findSnapTarget(
            proposedStart,
            project.clips,
            currentTime,
            snapThresholdSec,
            [dragState.clipId]
          );
          const snapEnd = findSnapTarget(
            proposedStart + dragState.initialDuration,
            project.clips,
            currentTime,
            snapThresholdSec,
            [dragState.clipId]
          );

          if (snapStart.isSnapped) {
            proposedStart = snapStart.snappedTime;
            setActiveSnapTime(snapStart.snapPoint);
          } else if (snapEnd.isSnapped) {
            proposedStart = Math.max(
              0,
              snapEnd.snappedTime - dragState.initialDuration
            );
            setActiveSnapTime(snapEnd.snapPoint);
          } else {
            setActiveSnapTime(null);
          }
        }

        const elUnder = document.elementFromPoint(e.clientX, e.clientY);
        const trackRow = elUnder?.closest('[data-track-id]') as HTMLElement | null;
        const hoveredTrackId = trackRow?.dataset.trackId || dragState.currentTrackId;

        moveClip(dragState.clipId, proposedStart, hoveredTrackId, false);
      } else if (dragState.mode === 'trim-left') {
        let proposedStart = Math.max(0, dragState.initialStartTime + deltaSeconds);
        if (snapEnabled) {
          const snap = findSnapTarget(
            proposedStart,
            project.clips,
            currentTime,
            snapThresholdSec,
            [dragState.clipId]
          );
          if (snap.isSnapped) {
            proposedStart = snap.snappedTime;
            setActiveSnapTime(snap.snapPoint);
          } else {
            setActiveSnapTime(null);
          }
        }
        trimClipLeftAction(dragState.clipId, proposedStart, false);
      } else if (dragState.mode === 'trim-right') {
        let proposedDuration = Math.max(
          0.15,
          dragState.initialDuration + deltaSeconds
        );
        if (snapEnabled) {
          const proposedEnd = dragState.initialStartTime + proposedDuration;
          const snap = findSnapTarget(
            proposedEnd,
            project.clips,
            currentTime,
            snapThresholdSec,
            [dragState.clipId]
          );
          if (snap.isSnapped) {
            proposedDuration = Math.max(
              0.15,
              snap.snappedTime - dragState.initialStartTime
            );
            setActiveSnapTime(snap.snapPoint);
          } else {
            setActiveSnapTime(null);
          }
        }
        trimClipRightAction(dragState.clipId, proposedDuration, false);
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
      setActiveSnapTime(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    dragState,
    timelineZoom,
    snapEnabled,
    project.clips,
    currentTime,
    moveClip,
    trimClipLeftAction,
    trimClipRightAction,
    updateClipKeyframe,
    setCurrentTime,
    setActiveSnapTime,
  ]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  const sortedTracks = [...project.tracks].sort((a, b) => a.order - b.order);
  const assetMap = new Map(project.mediaAssets.map((a) => [a.id, a]));

  const renderTrackIcon = (type: TimelineTrack['type']) => {
    switch (type) {
      case 'video':
        return <Film className="w-3.5 h-3.5 text-[#8b93ff]" />;
      case 'overlay':
        return <Layers className="w-3.5 h-3.5 text-purple-400" />;
      case 'text':
        return <Type className="w-3.5 h-3.5 text-amber-400" />;
      case 'audio':
        return <Music className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  const renderClipCard = (clip: TimelineClip, track: TimelineTrack) => {
    const isSelected = clip.id === selectedClipId;
    const leftPx = clip.startTime * timelineZoom;
    const widthPx = Math.max(18, clip.duration * timelineZoom);
    const asset = clip.mediaId ? assetMap.get(clip.mediaId) : undefined;
    const hasActiveMask = Boolean(clip.mask && clip.mask.shape !== 'none');

    const bgStyle =
      clip.type === 'video'
        ? 'bg-[#1a1c30] border-[#42497a]'
        : clip.type === 'image'
          ? 'bg-[#251d38] border-[#574185]'
          : clip.type === 'text'
            ? 'bg-[#332414] border-[#7c5324]'
            : 'bg-[#122b23] border-[#25634f]';

    return (
      <div
        key={clip.id}
        data-testid={`timeline-clip-${clip.id}`}
        data-clip-name={clip.name}
        data-clip-type={clip.type}
        style={{
          left: `${leftPx}px`,
          width: `${widthPx}px`,
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          selectClip(clip.id);
          if (track.locked || e.button !== 0) return;
          useEditorStore.getState().pushHistory();
          setDragState({
            mode: 'move',
            clipId: clip.id,
            startX: e.clientX,
            initialStartTime: clip.startTime,
            initialDuration: clip.duration,
            currentTrackId: clip.trackId,
          });
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          selectClip(clip.id);
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            clipId: clip.id,
          });
        }}
        className={`absolute top-1 bottom-1 rounded-md border overflow-hidden select-none group cursor-grab active:cursor-grabbing transition-shadow ${bgStyle} ${
          isSelected
            ? 'ring-1.5 ring-white border-white z-20 shadow-md'
            : 'hover:brightness-110 z-10'
        }`}
      >
        {/* Filmstrip Thumbnails for Video/Image Clips */}
        {asset && asset.thumbnails.length > 0 && (
          <div className="absolute inset-0 flex opacity-35 pointer-events-none overflow-hidden">
            {Array.from({
              length: Math.max(1, Math.ceil(widthPx / 64)),
            }).map((_, idx) => {
              const thumb = asset.thumbnails[idx % asset.thumbnails.length];
              return (
                <img
                  key={idx}
                  src={thumb}
                  alt=""
                  className="h-full w-16 object-cover shrink-0"
                />
              );
            })}
          </div>
        )}

        {/* Audio Waveform Bars */}
        {asset && asset.waveform.length > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-5 flex items-end gap-[1px] px-1 opacity-70 pointer-events-none">
            {asset.waveform.map((peak, i) => (
              <div
                key={i}
                style={{ height: `${Math.max(12, peak * 100)}%` }}
                className={`flex-1 rounded-t-xs ${
                  clip.type === 'audio' ? 'bg-emerald-300' : 'bg-[#949cff]'
                }`}
              />
            ))}
          </div>
        )}

        {/* Transition In / Out Badges */}
        {clip.transitionIn.type !== 'none' && (
          <div
            data-testid={`clip-transition-badge-${clip.id}`}
            style={{
              width: `${Math.min(
                widthPx * 0.5,
                clip.transitionIn.duration * timelineZoom
              )}px`,
            }}
            className="absolute left-0 top-0 bottom-0 bg-[#7c86ff]/25 border-r border-[#a5acff]/60 pointer-events-none flex items-center justify-center"
          >
            <ArrowRightLeft className="w-3 h-3 text-[#c7ceff]" />
          </div>
        )}

        {/* Clip Header Label */}
        <div className="relative z-10 px-2 py-0.5 flex items-center justify-between text-[10px] font-medium text-[#f4f4f5] truncate pointer-events-none">
          <span className="truncate flex items-center gap-1">
            {hasActiveMask && (
              <span
                data-testid={`clip-mask-badge-${clip.id}`}
                className="px-1 py-0 text-[8px] font-mono uppercase bg-[#D7E83F]/20 text-[#D7E83F] border border-[#D7E83F]/50 rounded-xs shrink-0"
              >
                MASK
              </span>
            )}
            <span className="truncate">
              {clip.type === 'text' && clip.textStyle
                ? `T: ${clip.textStyle.content}`
                : clip.name}
            </span>
          </span>
          <span className="font-mono text-[9px] text-white/70 ml-1 shrink-0">
            {clip.duration.toFixed(1)}s
          </span>
        </div>

        {/* Keyframe Markers on Clip */}
        {clip.keyframes.length > 0 && (
          <div className="absolute bottom-0.5 inset-x-0 h-3 z-25 pointer-events-none">
            {clip.keyframes.map((kf) => {
              const isKfSelected = isSelected && selectedKeyframeId === kf.id;
              const leftPos = Math.min(
                widthPx - 10,
                Math.max(2, kf.time * timelineZoom)
              );

              if (!isSelected) {
                // Clean subtle keyframe indicator dots when unselected (preserves clip name visibility)
                return (
                  <div
                    key={kf.id}
                    style={{ left: `${leftPos}px` }}
                    className="absolute bottom-0.5 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400/80 shadow-xs"
                    title={`${kf.property.toUpperCase()} @ ${kf.time.toFixed(2)}s`}
                  />
                );
              }

              // Full interactive draggable diamonds when clip is selected
              return (
                <button
                  key={kf.id}
                  type="button"
                  data-testid={`timeline-keyframe-${kf.id}`}
                  data-keyframe-prop={kf.property}
                  title={`${kf.property.toUpperCase()} @ ${kf.time.toFixed(2)}s = ${Number(
                    kf.value.toFixed(2)
                  )} (${kf.easing}) — Click to select, drag to retime`}
                  style={{ left: `${leftPos}px` }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    selectKeyframe(clip.id, kf.id, true);
                    if (track.locked || e.button !== 0) return;
                    useEditorStore.getState().pushHistory();
                    setDragState({
                      mode: 'move-keyframe',
                      clipId: clip.id,
                      keyframeId: kf.id,
                      startX: e.clientX,
                      initialKfTime: kf.time,
                      clipStartTime: clip.startTime,
                      clipDuration: clip.duration,
                    });
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectKeyframe(clip.id, kf.id, true);
                  }}
                  className={`pointer-events-auto absolute bottom-0 -translate-x-1/2 p-0.5 rounded-xs cursor-ew-resize transition-transform ${
                    isKfSelected
                      ? 'text-[#C8FF20] scale-125 ring-1 ring-white bg-black/80 z-30'
                      : 'text-amber-300 hover:text-white hover:scale-110 z-20'
                  }`}
                >
                  <Diamond className="w-2.5 h-2.5 fill-current" />
                </button>
              );
            })}
          </div>
        )}

        {/* Left Trim Handle */}
        <div
          data-testid={`trim-left-${clip.id}`}
          onMouseDown={(e) => {
            e.stopPropagation();
            selectClip(clip.id);
            if (track.locked) return;
            useEditorStore.getState().pushHistory();
            setDragState({
              mode: 'trim-left',
              clipId: clip.id,
              startX: e.clientX,
              initialStartTime: clip.startTime,
              initialDuration: clip.duration,
              currentTrackId: clip.trackId,
            });
          }}
          className="absolute left-0 top-0 bottom-0 w-2.5 bg-white/0 group-hover:bg-white/25 hover:!bg-[#7c86ff] cursor-ew-resize z-30 flex items-center justify-center"
          title="Drag to trim clip In-Point"
        >
          <div className="w-0.5 h-3.5 bg-white/80 rounded-full" />
        </div>

        {/* Right Trim Handle */}
        <div
          data-testid={`trim-right-${clip.id}`}
          onMouseDown={(e) => {
            e.stopPropagation();
            selectClip(clip.id);
            if (track.locked) return;
            useEditorStore.getState().pushHistory();
            setDragState({
              mode: 'trim-right',
              clipId: clip.id,
              startX: e.clientX,
              initialStartTime: clip.startTime,
              initialDuration: clip.duration,
              currentTrackId: clip.trackId,
            });
          }}
          className="absolute right-0 top-0 bottom-0 w-2.5 bg-white/0 group-hover:bg-white/25 hover:!bg-[#7c86ff] cursor-ew-resize z-30 flex items-center justify-center"
          title="Drag to trim clip Out-Point"
        >
          <div className="w-0.5 h-3.5 bg-white/80 rounded-full" />
        </div>
      </div>
    );
  };

  // Generate Time Ruler ticks across the entire timelineWidthPx
  const maxSecondsOnRuler = Math.ceil(timelineWidthPx / timelineZoom);
  const rulerTicks: number[] = [];
  const stepSec = timelineZoom >= 140 ? 0.5 : timelineZoom >= 60 ? 1 : 2;
  for (let s = 0; s <= maxSecondsOnRuler; s += stepSec) {
    rulerTicks.push(Number(s.toFixed(1)));
  }

  return (
    <section
      data-testid="timeline-panel"
      style={{ height: `${timelineHeight}px` }}
      className="bg-[#0B0F16] border-t border-[#2A3341] flex flex-col select-none shrink-0 transition-[height] duration-75"
    >
      {/* Timeline Action Toolbar */}
      <div className="h-9 bg-[#141A23] border-b border-[#2A3341] px-3 flex items-center justify-between gap-2 shrink-0">
        {/* Left: Add Track Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="add-video-track-btn"
            onClick={() => addTrack('video')}
            className="h-6 px-2 bg-[#1D2531] hover:bg-[#2A3341] border border-[#2A3341] rounded-md text-[11px] font-medium text-[#E8EDF5] flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors"
          >
            <Plus className="w-3 h-3 text-[#8B82F6]" />
            <span className="hidden sm:inline">Video Track</span>
          </button>
          <button
            type="button"
            data-testid="add-text-track-btn"
            onClick={() => addTrack('text')}
            className="h-6 px-2 bg-[#1D2531] hover:bg-[#2A3341] border border-[#2A3341] rounded-md text-[11px] font-medium text-[#E8EDF5] flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors"
          >
            <Plus className="w-3 h-3 text-[#E8B45A]" />
            <span className="hidden sm:inline">Text Track</span>
          </button>
          <button
            type="button"
            data-testid="add-audio-track-btn"
            onClick={() => addTrack('audio')}
            className="h-6 px-2 bg-[#1D2531] hover:bg-[#2A3341] border border-[#2A3341] rounded-md text-[11px] font-medium text-[#E8EDF5] flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors"
          >
            <Plus className="w-3 h-3 text-[#36C6A3]" />
            <span className="hidden sm:inline">Audio Track</span>
          </button>
        </div>

        {/* Center: Clip Editing Tools & Density Presets */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="toolbar-split-btn"
            onClick={() => splitSelectedClipAtPlayhead()}
            className="h-6 px-2 bg-[#1D2531] hover:bg-[#2A3341] border border-[#2A3341] rounded-md text-[11px] font-medium text-[#E8EDF5] flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors"
            title="Split Clip at Playhead (S)"
          >
            <Scissors className="w-3 h-3 text-[#8B82F6]" />
            <span>Split</span>
          </button>

          <button
            type="button"
            data-testid="toolbar-duplicate-btn"
            disabled={!selectedClipId}
            onClick={() => duplicateClip()}
            className="h-6 px-2 bg-[#1D2531] hover:bg-[#2A3341] disabled:opacity-35 border border-[#2A3341] rounded-md text-[11px] font-medium text-[#E8EDF5] flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors"
            title="Duplicate Selected Clip"
          >
            <Copy className="w-3 h-3" />
            <span className="hidden md:inline">Duplicate</span>
          </button>

          <button
            type="button"
            data-testid="toolbar-delete-btn"
            disabled={!selectedClipId}
            onClick={() => deleteClip()}
            className="h-6 px-2 bg-[#1D2531] hover:bg-rose-950/50 disabled:opacity-35 border border-[#2A3341] rounded-md text-[11px] font-medium text-rose-300 flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors"
            title="Delete Selected Clip (Delete)"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden md:inline">Delete</span>
          </button>

          <div className="h-4 w-px bg-[#2A3341] mx-0.5" />

          <button
            type="button"
            data-testid="toggle-snap-btn"
            onClick={toggleSnap}
            className={`h-6 px-2 rounded-md border text-[11px] font-medium flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors ${
              snapEnabled
                ? 'bg-[#8B82F6]/20 border-[#8B82F6] text-[#E8EDF5]'
                : 'bg-[#1D2531] border-[#2A3341] text-[#94A3B8]'
            }`}
            title="Toggle Magnetic Snapping (N)"
          >
            <Magnet className="w-3 h-3" />
            <span className="hidden sm:inline">Snap</span>
          </button>

          {/* Track Density Presets */}
          <div className="hidden lg:flex items-center bg-[#0B0F16] border border-[#2A3341] rounded-md p-0.5 gap-0.5">
            <button
              type="button"
              data-testid="density-compact-btn"
              onClick={() => setTimelineDensity('compact')}
              className={`h-5 px-1.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                timelineDensity === 'compact'
                  ? 'bg-[#8B82F6] text-white'
                  : 'text-[#94A3B8] hover:text-[#E8EDF5]'
              }`}
              title="Compact Track Height (28px)"
            >
              Compact
            </button>
            <button
              type="button"
              data-testid="density-standard-btn"
              onClick={() => setTimelineDensity('standard')}
              className={`h-5 px-1.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                timelineDensity === 'standard'
                  ? 'bg-[#8B82F6] text-white'
                  : 'text-[#94A3B8] hover:text-[#E8EDF5]'
              }`}
              title="Standard Track Height (40px)"
            >
              Standard
            </button>
            <button
              type="button"
              data-testid="density-expanded-btn"
              onClick={() => setTimelineDensity('expanded')}
              className={`h-5 px-1.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                timelineDensity === 'expanded'
                  ? 'bg-[#8B82F6] text-white'
                  : 'text-[#94A3B8] hover:text-[#E8EDF5]'
              }`}
              title="Expanded Track Height (64px)"
            >
              Expanded
            </button>
          </div>
        </div>

        {/* Right: Timeline Zoom Controls + Fit */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="zoom-to-fit-btn"
            onClick={() => {
              const scrollerW = scrollContainerRef.current?.clientWidth || 1000;
              const dur = Math.max(10, totalProjectDuration);
              const targetZoom = Math.max(30, Math.min(260, (scrollerW - 80) / dur));
              setTimelineZoom(Math.round(targetZoom));
            }}
            className="h-6 px-2 bg-[#1D2531] hover:bg-[#2A3341] border border-[#2A3341] rounded-md text-[11px] font-medium text-[#94A3B8] hover:text-[#E8EDF5] flex items-center gap-1 transition-colors cursor-pointer"
            title="Zoom to Fit Sequence (Shift+Z)"
          >
            <Maximize className="w-3 h-3" />
            <span className="hidden sm:inline">Fit</span>
          </button>

          <button
            type="button"
            data-testid="timeline-zoom-out-btn"
            onClick={() => setTimelineZoom(timelineZoom - 20)}
            className="p-1 text-[#94A3B8] hover:text-[#E8EDF5] cursor-pointer"
            title="Zoom Out Timeline (Alt+Wheel Down)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <input
            type="range"
            data-testid="timeline-zoom-slider"
            min={30}
            max={260}
            value={timelineZoom}
            onChange={(e) => setTimelineZoom(Number(e.target.value))}
            className="w-20 sm:w-24 accent-[#8B82F6]"
          />
          <button
            type="button"
            data-testid="timeline-zoom-in-btn"
            onClick={() => setTimelineZoom(timelineZoom + 20)}
            className="p-1 text-[#94A3B8] hover:text-[#E8EDF5] cursor-pointer"
            title="Zoom In Timeline (Alt+Wheel Up)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Timeline Body: Track Headers (Left) + Scrollable Tracks & Ruler (Right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Track Headers Column */}
        <div className="w-56 bg-[#0E131B] border-r border-[#2A3341] flex flex-col shrink-0">
          <div className="h-7 border-b border-[#2A3341] px-3 flex items-center justify-between text-[10px] font-mono text-[#94A3B8]">
            <span>TRACKS ({sortedTracks.length})</span>
            <span>M / V / L</span>
          </div>

          <div
            ref={trackHeadersRef}
            onScroll={handleHeadersScroll}
            className="flex-1 overflow-y-auto divide-y divide-[#2A3341]/60 scrollbar-none"
          >
            {sortedTracks.map((track) => (
              <div
                key={track.id}
                data-testid={`track-header-${track.id}`}
                style={{ height: `${trackHeightPx}px` }}
                className="px-3 flex items-center justify-between bg-[#141A23] hover:bg-[#1D2531] transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {renderTrackIcon(track.type)}
                  <span className="text-xs font-medium text-[#E8EDF5] truncate">
                    {track.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    data-testid={`track-mute-btn-${track.id}`}
                    onClick={() => toggleTrackMute(track.id)}
                    className={`p-1 rounded cursor-pointer ${
                      track.muted
                        ? 'bg-rose-950/80 text-rose-400'
                        : 'text-[#63636e] hover:text-[#e4e4e7]'
                    }`}
                    title={track.muted ? 'Unmute Track' : 'Mute Track'}
                  >
                    {track.muted ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {track.type !== 'audio' && (
                    <button
                      type="button"
                      data-testid={`track-visible-btn-${track.id}`}
                      onClick={() => toggleTrackVisible(track.id)}
                      className={`p-1 rounded cursor-pointer ${
                        !track.visible
                          ? 'bg-amber-950/80 text-amber-400'
                          : 'text-[#63636e] hover:text-[#e4e4e7]'
                      }`}
                      title={track.visible ? 'Hide Track' : 'Show Track'}
                    >
                      {track.visible ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid={`track-lock-btn-${track.id}`}
                    onClick={() => toggleTrackLock(track.id)}
                    className={`p-1 rounded cursor-pointer ${
                      track.locked
                        ? 'bg-[#5e6ad2]/20 text-[#a5acff]'
                        : 'text-[#63636e] hover:text-[#e4e4e7]'
                    }`}
                    title={track.locked ? 'Unlock Track' : 'Lock Track'}
                  >
                    {track.locked ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Scrollable Ruler + Track Lanes */}
        <div
          ref={scrollContainerRef}
          onScroll={handleLanesScroll}
          data-testid="timeline-scroll-area"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              selectClip(null);
            }
          }}
          className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#09090c]"
        >
          <div
            style={{ width: `${timelineWidthPx}px` }}
            className="min-w-full min-h-full relative flex flex-col"
          >
            {/* Frame-Based Time Ruler */}
            <div
              data-testid="timeline-ruler"
              onMouseDown={(e) => {
                setIsPlaying(false);
                const t = clientXToTimelineSeconds(e.clientX);
                setCurrentTime(t);
                setDragState({ mode: 'scrub' });
              }}
              className="h-7 bg-[#0d0d12] border-b border-[#1f1f26] relative cursor-pointer sticky top-0 z-30"
            >
              {rulerTicks.map((sec) => {
                const left = sec * timelineZoom;
                const isMajor = Number.isInteger(sec);
                return (
                  <div
                    key={sec}
                    style={{ left: `${left}px` }}
                    className="absolute top-0 bottom-0 flex flex-col justify-end pointer-events-none"
                  >
                    {isMajor && (
                      <span className="text-[10px] font-mono text-[#71717a] pl-1 leading-none mb-1 tabular-nums">
                        {formatTimecode(sec, project.fps).slice(3)}
                      </span>
                    )}
                    <div
                      className={`w-px ${
                        isMajor ? 'h-2.5 bg-[#3f3f4c]' : 'h-1.5 bg-[#23232c]'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Track Lanes */}
            <div className="divide-y divide-[#16161d] relative flex-1">
              {sortedTracks.map((track) => {
                const trackClips = project.clips.filter(
                  (c) => c.trackId === track.id
                );
                return (
                  <div
                    key={track.id}
                    data-testid={`timeline-track-lane-${track.id}`}
                    data-track-id={track.id}
                    onMouseDown={(e) => {
                      if (e.target === e.currentTarget) {
                        selectClip(null);
                        setIsPlaying(false);
                        setCurrentTime(clientXToTimelineSeconds(e.clientX));
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const assetId = e.dataTransfer.getData(
                        'application/x-motionlab-asset'
                      );
                      if (!assetId) return;
                      const asset = assetMap.get(assetId);
                      if (
                        asset &&
                        isTrackCompatibleWithClip(track.type, asset.type)
                      ) {
                        const dropTime = clientXToTimelineSeconds(e.clientX);
                        addMediaClipToTimeline(assetId, track.id, dropTime);
                      } else if (asset) {
                        addMediaClipToTimeline(assetId);
                      }
                    }}
                    style={{ height: `${trackHeightPx}px` }}
                    className={`relative transition-colors border-b border-[#2A3341]/40 ${
                      !track.visible ? 'opacity-40 bg-[#070A0F]' : 'bg-[#0B0F16]'
                    }`}
                  >
                    {trackClips.map((clip) => renderClipCard(clip, track))}
                  </div>
                );
              })}
            </div>

            {/* Magnetic Snap Indicator Line */}
            {activeSnapTime !== null && (
              <div
                style={{ left: `${activeSnapTime * timelineZoom}px` }}
                className="absolute top-0 bottom-0 w-px bg-amber-400 z-40 pointer-events-none"
              />
            )}

            {/* Playhead Line & Scrub Cap */}
            <div
              data-testid="timeline-playhead"
              style={{ left: `${currentTime * timelineZoom}px` }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setIsPlaying(false);
                setDragState({ mode: 'scrub' });
              }}
              className="absolute top-0 bottom-0 w-px bg-rose-500 z-40 cursor-ew-resize"
            >
              <div className="w-3 h-3.5 bg-rose-500 -translate-x-[5.5px] rounded-t-xs clip-path-playhead shadow" />
            </div>
          </div>
        </div>
      </div>

      {/* Right-Click Clip Context Menu */}
      {contextMenu && (
        <div
          data-testid="clip-context-menu"
          style={{ left: contextMenu.x, top: Math.max(40, contextMenu.y - 140) }}
          className="fixed z-50 w-48 bg-[#14141b] border border-[#282836] rounded-lg shadow-2xl py-1 text-xs text-[#e4e4e7]"
        >
          <button
            type="button"
            data-testid="ctx-split-clip"
            onClick={() => {
              splitClipById(contextMenu.clipId, currentTime);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#5e6ad2] hover:text-white flex items-center gap-2 cursor-pointer"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Split at Playhead (S)</span>
          </button>
          <button
            type="button"
            data-testid="ctx-duplicate-clip"
            onClick={() => {
              duplicateClip(contextMenu.clipId);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#5e6ad2] hover:text-white flex items-center gap-2 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplicate Clip</span>
          </button>
          <button
            type="button"
            data-testid="ctx-add-dissolve"
            onClick={() => {
              setClipTransition(contextMenu.clipId, 'in', {
                type: 'cross-dissolve',
                duration: 0.5,
              });
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#5e6ad2] hover:text-white flex items-center gap-2 cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Add Cross Dissolve (0.5s)</span>
          </button>
          <button
            type="button"
            data-testid="ctx-mute-clip"
            onClick={() => {
              const target = project.clips.find(
                (c) => c.id === contextMenu.clipId
              );
              if (target) {
                updateClipProperties(target.id, { muted: !target.muted });
              }
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#5e6ad2] hover:text-white flex items-center gap-2 cursor-pointer"
          >
            <VolumeX className="w-3.5 h-3.5" />
            <span>Toggle Clip Mute</span>
          </button>
          <div className="my-1 border-t border-[#24242f]" />
          <button
            type="button"
            data-testid="ctx-delete-clip"
            onClick={() => {
              deleteClip(contextMenu.clipId);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-rose-600 text-rose-300 hover:text-white flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Clip (Del)</span>
          </button>
        </div>
      )}
    </section>
  );
};
