import React from 'react';
import {
  Sliders,
  Diamond,
  Trash2,
  FlipHorizontal,
  FlipVertical,
  Volume2,
  VolumeX,
  AlignLeft,
  AlignCenter,
  AlignRight,
  RotateCcw,
  Crop,
  Sparkles,
  Type,
  ArrowRightLeft,
  Scan,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { evaluateClipTransform } from '../engine/keyframeEngine';
import {
  createDefaultColorEffects,
  createDefaultCrop,
  createDefaultMask,
} from '../engine/projectFactory';
import type {
  KeyframeEasing,
  KeyframeProperty,
  MaskShape,
  TextAnimationPreset,
  TransitionType,
} from '../types/editor';
import { useWorkspaceStore } from '../store/useWorkspaceStore';

export const RightInspector: React.FC = () => {
  const inspectorWidth = useWorkspaceStore((s) => s.panelSizes.rightInspectorWidth);
  const {
    project,
    selectedClipId,
    selectedKeyframeId,
    currentTime,
    selectKeyframe,
    updateClipProperties,
    updateClipColorEffects,
    updateClipCrop,
    updateClipMask,
    updateClipTextStyle,
    updateClipSpeed,
    setClipTransition,
    setClipKeyframe,
    updateClipKeyframe,
    removeClipKeyframe,
    setCurrentTime,
    deleteClip,
  } = useEditorStore();

  const clip = project.clips.find((c) => c.id === selectedClipId);

  if (!clip) {
    return (
      <aside
        data-testid="right-inspector-empty"
        style={{ width: `${inspectorWidth}px` }}
        className="bg-[#141A23] border-l border-[#2A3341] p-3.5 flex flex-col justify-between select-none shrink-0 transition-[width] duration-75 text-[#E8EDF5]"
      >
        <div className="space-y-3.5">
          <div className="flex items-center gap-2 border-b border-[#1f1f26] pb-2.5">
            <Sliders className="w-3.5 h-3.5 text-[#8b93ff]" />
            <span className="text-xs font-semibold tracking-tight text-[#f4f4f5]">
              Inspector
            </span>
          </div>

          <div className="bg-[#121217] border border-[#22222c] rounded-lg p-3 space-y-2 text-xs">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#71717a] pb-1">
              Sequence Properties
            </div>
            <div className="flex justify-between">
              <span className="text-[#8e8e98]">Sequence</span>
              <span className="font-medium text-[#f4f4f5] truncate max-w-[140px]">
                {project.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8e8e98]">Aspect Ratio</span>
              <span className="font-mono text-[#e4e4e7]">{project.aspectRatio}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8e8e98]">Resolution</span>
              <span className="font-mono text-[#e4e4e7]">{project.resolution}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8e8e98]">Timebase</span>
              <span className="font-mono text-[#e4e4e7]">{project.fps} FPS</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8e8e98]">Tracks</span>
              <span className="font-mono text-[#e4e4e7]">{project.tracks.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8e8e98]">Active Clips</span>
              <span className="font-mono text-[#e4e4e7]">{project.clips.length}</span>
            </div>
          </div>

          <div className="p-3 bg-[#111116] border border-[#1f1f27] rounded-lg text-[11px] text-[#71717a] leading-relaxed">
            Select any video, audio, image, or title clip on the timeline to inspect and keyframe its transform, color, crop, audio envelope, and transitions.
          </div>
        </div>

        <div className="border-t border-[#1f1f26] pt-3 space-y-1 text-[10px] font-mono text-[#63636e]">
          <div>SPACE: Play/Pause • S: Split Clip</div>
          <div>DEL: Remove • CTRL+Z: Undo/Redo</div>
          <div>LEFT/RIGHT: Frame Step • CTRL+S: Save</div>
        </div>
      </aside>
    );
  }

  const clipLocalTime = Math.max(
    0,
    Math.min(clip.duration, currentTime - clip.startTime)
  );
  const evaluated = evaluateClipTransform(clip, clipLocalTime);

  const renderKeyframeButton = (prop: KeyframeProperty, currentVal: number) => {
    const hasKfAtTime = clip.keyframes.some(
      (k) => k.property === prop && Math.abs(k.time - clipLocalTime) <= 0.04
    );
    return (
      <button
        type="button"
        data-testid={`add-keyframe-${prop}`}
        onClick={() =>
          setClipKeyframe(clip.id, prop, clipLocalTime, currentVal, 'ease-in-out')
        }
        className={`p-1 rounded transition-colors cursor-pointer ${
          hasKfAtTime
            ? 'text-amber-400 bg-amber-950/50'
            : 'text-[#63636e] hover:text-amber-300'
        }`}
        title={`Add/Update ${prop} keyframe at ${clipLocalTime.toFixed(2)}s`}
      >
        <Diamond className="w-3 h-3 fill-current" />
      </button>
    );
  };

  return (
    <aside
      data-testid="right-inspector"
      style={{ width: `${inspectorWidth}px` }}
      className="bg-[#141A23] border-l border-[#2A3341] flex flex-col h-full overflow-hidden select-none shrink-0 transition-[width] duration-75 text-[#E8EDF5]"
    >
      {/* Inspector Header */}
      <div className="h-9 px-3.5 bg-[#0e0e13] border-b border-[#1f1f26] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase bg-[#5e6ad2]/20 text-[#a5acff] border border-[#5e6ad2]/40 rounded">
            {clip.type}
          </span>
          <span
            data-testid="inspector-clip-name"
            className="text-xs font-medium text-[#f4f4f5] truncate"
          >
            {clip.name}
          </span>
        </div>
        <button
          type="button"
          data-testid="inspector-delete-clip-btn"
          onClick={() => deleteClip(clip.id)}
          className="p-1 text-[#71717a] hover:text-rose-400 rounded transition-colors cursor-pointer"
          title="Delete Selected Clip (Delete)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrollable Inspector Sections */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-3 text-xs">
        {/* 1. TIMING & SPEED */}
        <section className="bg-[#121217] border border-[#22222c] rounded-lg p-2.5 space-y-2 min-w-0 overflow-hidden">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8e8e98]">
            Timing & Speed
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <span className="block text-[#71717a] text-[10px] mb-0.5">Start (s)</span>
              <input
                type="number"
                step={0.1}
                min={0}
                value={Number(clip.startTime.toFixed(2))}
                onChange={(e) =>
                  updateClipProperties(clip.id, {
                    startTime: Math.max(0, Number(e.target.value)),
                  })
                }
                className="w-full h-6 px-1.5 bg-[#09090c] border border-[#262632] rounded font-mono text-[#f4f4f5] focus:outline-none focus:border-[#5e6ad2]"
              />
            </div>
            <div>
              <span className="block text-[#71717a] text-[10px] mb-0.5">Duration (s)</span>
              <input
                type="number"
                data-testid="inspector-clip-duration"
                step={0.1}
                min={0.2}
                value={Number(clip.duration.toFixed(2))}
                onChange={(e) => {
                  const nextDur = Math.max(0.2, Number(e.target.value));
                  updateClipProperties(clip.id, {
                    duration: nextDur,
                    outPoint: clip.inPoint + nextDur * clip.playbackSpeed,
                  });
                }}
                className="w-full h-6 px-1.5 bg-[#09090c] border border-[#262632] rounded font-mono text-[#f4f4f5] focus:outline-none focus:border-[#5e6ad2]"
              />
            </div>
            <div>
              <span className="block text-[#71717a] text-[10px] mb-0.5">Speed</span>
              <select
                data-testid="inspector-speed-select"
                value={clip.playbackSpeed}
                onChange={(e) => updateClipSpeed(clip.id, Number(e.target.value))}
                className="w-full h-6 pl-1.5 pr-5 bg-[#09090c] border border-[#262632] rounded font-mono text-[#f4f4f5] focus:outline-none focus:border-[#5e6ad2]"
              >
                <option value={0.25}>0.25x</option>
                <option value={0.5}>0.5x</option>
                <option value={1}>1.0x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2.0x</option>
                <option value={4}>4.0x</option>
              </select>
            </div>
          </div>
        </section>

        {/* 2. TEXT & MOTION GRAPHICS (Only for Text clips) */}
        {clip.type === 'text' && clip.textStyle && (
          <section className="bg-[#121217] border border-[#22222c] rounded-lg p-2.5 space-y-2.5 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8e8e98]">
              <Type className="w-3 h-3 text-[#8b93ff]" />
              <span>Text & Title Style</span>
            </div>

            <div>
              <label className="block text-[10px] text-[#71717a] mb-1">
                Text Content
              </label>
              <textarea
                data-testid="inspector-text-content"
                rows={2}
                value={clip.textStyle.content}
                onChange={(e) =>
                  updateClipTextStyle(clip.id, { content: e.target.value })
                }
                className="w-full p-2 bg-[#09090c] border border-[#262632] rounded text-xs text-[#f4f4f5] focus:outline-none focus:border-[#5e6ad2]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-[#71717a] mb-0.5">
                  Font Family
                </label>
                <select
                  data-testid="inspector-font-family"
                  value={clip.textStyle.fontFamily}
                  onChange={(e) =>
                    updateClipTextStyle(clip.id, { fontFamily: e.target.value })
                  }
                  className="w-full h-6 pl-1.5 pr-5 bg-[#09090c] border border-[#262632] rounded text-xs text-[#f4f4f5]"
                >
                  <option value="Inter">Inter</option>
                  <option value="JetBrains Mono">JetBrains Mono</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Impact">Impact</option>
                  <option value="Arial">Arial</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="block text-[10px] text-[#71717a] mb-0.5">
                    Size
                  </label>
                  <input
                    type="number"
                    data-testid="inspector-font-size"
                    min={14}
                    max={200}
                    value={clip.textStyle.fontSize}
                    onChange={(e) =>
                      updateClipTextStyle(clip.id, {
                        fontSize: Number(e.target.value),
                      })
                    }
                    className="w-full h-6 px-1 bg-[#09090c] border border-[#262632] rounded font-mono text-[#f4f4f5]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#71717a] mb-0.5">
                    Weight
                  </label>
                  <select
                    value={clip.textStyle.fontWeight}
                    onChange={(e) =>
                      updateClipTextStyle(clip.id, {
                        fontWeight: Number(e.target.value),
                      })
                    }
                    className="w-full h-6 pl-1 pr-4 bg-[#09090c] border border-[#262632] rounded font-mono text-[#f4f4f5]"
                  >
                    <option value={400}>400</option>
                    <option value={600}>600</option>
                    <option value={700}>700</option>
                    <option value={800}>800</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Alignment + Colors */}
            <div className="grid grid-cols-3 gap-2 items-end">
              <div>
                <label className="block text-[10px] text-[#71717a] mb-0.5">
                  Align
                </label>
                <div className="flex bg-[#09090c] border border-[#262632] rounded p-0.5">
                  {(['left', 'center', 'right'] as const).map((al) => (
                    <button
                      key={al}
                      type="button"
                      onClick={() => updateClipTextStyle(clip.id, { align: al })}
                      className={`flex-1 h-5 flex items-center justify-center rounded-xs cursor-pointer ${
                        clip.textStyle?.align === al
                          ? 'bg-[#5e6ad2] text-white'
                          : 'text-[#71717a]'
                      }`}
                    >
                      {al === 'left' && <AlignLeft className="w-3 h-3" />}
                      {al === 'center' && <AlignCenter className="w-3 h-3" />}
                      {al === 'right' && <AlignRight className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-[#71717a] mb-0.5">
                  Text Color
                </label>
                <input
                  type="color"
                  data-testid="inspector-text-color"
                  value={clip.textStyle.color}
                  onChange={(e) =>
                    updateClipTextStyle(clip.id, { color: e.target.value })
                  }
                  className="w-full h-6 bg-[#09090c] border border-[#262632] rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#71717a] mb-0.5">
                  BG Color
                </label>
                <input
                  type="color"
                  value={clip.textStyle.backgroundColor}
                  onChange={(e) =>
                    updateClipTextStyle(clip.id, {
                      backgroundColor: e.target.value,
                    })
                  }
                  className="w-full h-6 bg-[#09090c] border border-[#262632] rounded cursor-pointer"
                />
              </div>
            </div>

            {/* BG Opacity, Stroke, Shadow */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-[#71717a]">
                  BG ({Math.round(clip.textStyle.backgroundOpacity * 100)}%)
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={clip.textStyle.backgroundOpacity}
                  onChange={(e) =>
                    updateClipTextStyle(clip.id, {
                      backgroundOpacity: Number(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#71717a]">
                  Stroke ({clip.textStyle.strokeWidth}px)
                </label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={clip.textStyle.strokeWidth}
                  onChange={(e) =>
                    updateClipTextStyle(clip.id, {
                      strokeWidth: Number(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#71717a]">
                  Shadow ({clip.textStyle.shadowBlur}px)
                </label>
                <input
                  type="range"
                  min={0}
                  max={24}
                  step={1}
                  value={clip.textStyle.shadowBlur}
                  onChange={(e) =>
                    updateClipTextStyle(clip.id, {
                      shadowBlur: Number(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>
            </div>

            {/* Letter Spacing & Box Radius */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-[#71717a]">
                  Tracking ({clip.textStyle.letterSpacing ?? 0}px)
                </label>
                <input
                  type="range"
                  data-testid="inspector-text-tracking"
                  min={-4}
                  max={28}
                  step={1}
                  value={clip.textStyle.letterSpacing ?? 0}
                  onChange={(e) =>
                    updateClipTextStyle(clip.id, {
                      letterSpacing: Number(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#71717a]">
                  Plate Radius ({clip.textStyle.borderRadius ?? 0}px)
                </label>
                <input
                  type="range"
                  min={0}
                  max={64}
                  step={2}
                  value={clip.textStyle.borderRadius ?? 0}
                  onChange={(e) =>
                    updateClipTextStyle(clip.id, {
                      borderRadius: Number(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>
            </div>

            {/* Text Motion Animation Presets */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1f1f27]">
              <div>
                <label className="block text-[10px] text-[#71717a] mb-0.5">
                  Animation In
                </label>
                <select
                  data-testid="inspector-text-anim-in"
                  value={clip.textStyle.animationIn}
                  onChange={(e) =>
                    updateClipTextStyle(clip.id, {
                      animationIn: e.target.value as TextAnimationPreset,
                    })
                  }
                  className="w-full h-6 pl-1.5 pr-5 bg-[#09090c] border border-[#262632] rounded text-[11px] text-[#f4f4f5]"
                >
                  <option value="none">None</option>
                  <option value="fade-in">Fade In</option>
                  <option value="slide-in">Slide In</option>
                  <option value="zoom-in">Zoom In</option>
                  <option value="tracking-in">Tracking In</option>
                  <option value="char-stagger">Char Stagger</option>
                  <option value="word-stagger">Word Stagger</option>
                  <option value="typewriter">Typewriter</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-[#71717a] mb-0.5">
                  Animation Out
                </label>
                <select
                  data-testid="inspector-text-anim-out"
                  value={clip.textStyle.animationOut}
                  onChange={(e) =>
                    updateClipTextStyle(clip.id, {
                      animationOut: e.target.value as TextAnimationPreset,
                    })
                  }
                  className="w-full h-6 pl-1.5 pr-5 bg-[#09090c] border border-[#262632] rounded text-[11px] text-[#f4f4f5]"
                >
                  <option value="none">None</option>
                  <option value="fade-out">Fade Out</option>
                  <option value="slide-out">Slide Out</option>
                </select>
              </div>
            </div>
          </section>
        )}

        {/* 3. TRANSFORM & KEYFRAME ANIMATION (For Video, Image, Text) */}
        {clip.type !== 'audio' && (
          <section className="bg-[#121217] border border-[#22222c] rounded-lg p-2.5 space-y-2 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-1 min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8e8e98] truncate">
                Transform & Keyframes
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  data-testid="inspector-motion-blur-toggle"
                  onClick={() =>
                    updateClipProperties(clip.id, {
                      motionBlur: !clip.motionBlur,
                    })
                  }
                  className={`px-1.5 h-5 rounded border text-[9px] font-mono cursor-pointer ${
                    clip.motionBlur
                      ? 'bg-[#D7E83F]/20 border-[#D7E83F] text-[#D7E83F]'
                      : 'bg-[#09090c] border-[#262632] text-[#71717a]'
                  }`}
                  title="Toggle Directional Velocity Motion Blur"
                >
                  M-Blur
                </button>
                <button
                  type="button"
                  data-testid="flip-h-btn"
                  onClick={() =>
                    updateClipColorEffects(clip.id, {
                      flipH: !clip.effects.flipH,
                    })
                  }
                  className={`p-1 rounded border cursor-pointer ${
                    clip.effects.flipH
                      ? 'bg-[#5e6ad2] border-[#7c86ff] text-white'
                      : 'bg-[#09090c] border-[#262632] text-[#71717a]'
                  }`}
                  title="Flip Horizontal"
                >
                  <FlipHorizontal className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  data-testid="flip-v-btn"
                  onClick={() =>
                    updateClipColorEffects(clip.id, {
                      flipV: !clip.effects.flipV,
                    })
                  }
                  className={`p-1 rounded border cursor-pointer ${
                    clip.effects.flipV
                      ? 'bg-[#5e6ad2] border-[#7c86ff] text-white'
                      : 'bg-[#09090c] border-[#262632] text-[#71717a]'
                  }`}
                  title="Flip Vertical"
                >
                  <FlipVertical className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Parent-Child Transform Link */}
            <div className="flex items-center gap-2 text-[10px] min-w-0">
              <span className="text-[#71717a] shrink-0">Parent Layer</span>
              <select
                data-testid="inspector-parent-select"
                value={clip.parentId || ''}
                onChange={(e) =>
                  updateClipProperties(clip.id, {
                    parentId: e.target.value || undefined,
                  })
                }
                className="flex-1 w-0 min-w-0 h-6 px-1.5 bg-[#09090c] border border-[#262632] rounded font-mono text-[10px] text-[#e4e4e7] truncate focus:outline-none focus:border-[#5e6ad2]"
              >
                <option value="">None (Independent)</option>
                {project.clips
                  .filter(
                    (c) =>
                      c.id !== clip.id &&
                      c.type !== 'audio' &&
                      c.parentId !== clip.id
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name.length > 28 ? `${c.name.slice(0, 28)}…` : c.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Position X & Y */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex items-center justify-between text-[10px] text-[#71717a]">
                  <span>Pos X (px)</span>
                  {renderKeyframeButton('x', evaluated.x)}
                </div>
                <input
                  type="number"
                  data-testid="inspector-pos-x"
                  value={Math.round(evaluated.x)}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (clip.keyframes.some((k) => k.property === 'x')) {
                      setClipKeyframe(clip.id, 'x', clipLocalTime, val);
                    } else {
                      updateClipProperties(clip.id, { x: val });
                    }
                  }}
                  className="w-full h-6 px-1.5 bg-[#09090c] border border-[#262632] rounded font-mono text-[#f4f4f5]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] text-[#71717a]">
                  <span>Pos Y (px)</span>
                  {renderKeyframeButton('y', evaluated.y)}
                </div>
                <input
                  type="number"
                  data-testid="inspector-pos-y"
                  value={Math.round(evaluated.y)}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (clip.keyframes.some((k) => k.property === 'y')) {
                      setClipKeyframe(clip.id, 'y', clipLocalTime, val);
                    } else {
                      updateClipProperties(clip.id, { y: val });
                    }
                  }}
                  className="w-full h-6 px-1.5 bg-[#09090c] border border-[#262632] rounded font-mono text-[#f4f4f5]"
                />
              </div>
            </div>

            {/* Scale, Rotation, Opacity */}
            <div className="space-y-1.5">
              <div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#71717a]">
                    Scale ({Math.round(evaluated.scale * 100)}%)
                  </span>
                  {renderKeyframeButton('scale', evaluated.scale)}
                </div>
                <input
                  type="range"
                  data-testid="inspector-scale-slider"
                  min={0.1}
                  max={3.0}
                  step={0.05}
                  value={evaluated.scale}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (clip.keyframes.some((k) => k.property === 'scale')) {
                      setClipKeyframe(clip.id, 'scale', clipLocalTime, val);
                    } else {
                      updateClipProperties(clip.id, { scale: val });
                    }
                  }}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#71717a]">
                    Rotation ({Math.round(evaluated.rotation)}°)
                  </span>
                  {renderKeyframeButton('rotation', evaluated.rotation)}
                </div>
                <input
                  type="range"
                  data-testid="inspector-rotation-slider"
                  min={-180}
                  max={180}
                  step={1}
                  value={evaluated.rotation}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (clip.keyframes.some((k) => k.property === 'rotation')) {
                      setClipKeyframe(clip.id, 'rotation', clipLocalTime, val);
                    } else {
                      updateClipProperties(clip.id, { rotation: val });
                    }
                  }}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#71717a]">
                    Opacity ({Math.round(evaluated.opacity * 100)}%)
                  </span>
                  {renderKeyframeButton('opacity', evaluated.opacity)}
                </div>
                <input
                  type="range"
                  data-testid="inspector-opacity-slider"
                  min={0}
                  max={1}
                  step={0.02}
                  value={evaluated.opacity}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (clip.keyframes.some((k) => k.property === 'opacity')) {
                      setClipKeyframe(clip.id, 'opacity', clipLocalTime, val);
                    } else {
                      updateClipProperties(clip.id, { opacity: val });
                    }
                  }}
                  className="w-full"
                />
              </div>

              {/* 2.5D Perspective Skew X & Y */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="min-w-0">
                  <div className="flex items-center justify-between text-[10px] text-[#71717a]">
                    <span className="truncate">Skew X ({Math.round(evaluated.skewX)}°)</span>
                    {renderKeyframeButton('skewX', evaluated.skewX)}
                  </div>
                  <input
                    type="range"
                    data-testid="inspector-skew-x"
                    min={-45}
                    max={45}
                    step={1}
                    value={evaluated.skewX}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (clip.keyframes.some((k) => k.property === 'skewX')) {
                        setClipKeyframe(clip.id, 'skewX', clipLocalTime, val);
                      } else {
                        updateClipProperties(clip.id, { skewX: val });
                      }
                    }}
                    className="w-full"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center justify-between text-[10px] text-[#71717a]">
                    <span className="truncate">Skew Y ({Math.round(evaluated.skewY)}°)</span>
                    {renderKeyframeButton('skewY', evaluated.skewY)}
                  </div>
                  <input
                    type="range"
                    data-testid="inspector-skew-y"
                    min={-45}
                    max={45}
                    step={1}
                    value={evaluated.skewY}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (clip.keyframes.some((k) => k.property === 'skewY')) {
                        setClipKeyframe(clip.id, 'skewY', clipLocalTime, val);
                      } else {
                        updateClipProperties(clip.id, { skewY: val });
                      }
                    }}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Procedural Shape Layer Trim Path */}
              {clip.shapeStyle && (
                <div className="pt-1 border-t border-[#1f1f27]">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#D7E83F] font-mono truncate">
                      Trim Path ({Math.round(evaluated.trimEnd)}%) · {clip.shapeStyle.shapeType}
                    </span>
                    {renderKeyframeButton('trimEnd', evaluated.trimEnd)}
                  </div>
                  <input
                    type="range"
                    data-testid="inspector-trim-end"
                    min={0}
                    max={100}
                    step={1}
                    value={evaluated.trimEnd}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (clip.keyframes.some((k) => k.property === 'trimEnd')) {
                        setClipKeyframe(clip.id, 'trimEnd', clipLocalTime, val);
                      } else if (clip.shapeStyle) {
                        updateClipProperties(clip.id, {
                          shapeStyle: { ...clip.shapeStyle, trimEnd: val },
                        });
                      }
                    }}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            {/* Active Keyframes List & Manual Keyframe Editor */}
            {clip.keyframes.length > 0 && (() => {
              const sortedKfs = [...clip.keyframes].sort((a, b) => a.time - b.time);
              const activeKf =
                sortedKfs.find((k) => k.id === selectedKeyframeId) || sortedKfs[0];
              const activeIdx = sortedKfs.findIndex((k) => k.id === activeKf?.id);

              return (
                <div className="pt-2 border-t border-[#1f1f27] space-y-2 min-w-0">
                  <div className="flex items-center justify-between gap-1 min-w-0">
                    <span className="text-[10px] font-semibold uppercase text-amber-400 truncate">
                      Keyframes ({clip.keyframes.length}) — Click to Select
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        data-testid="prev-keyframe-btn"
                        disabled={sortedKfs.length <= 1}
                        onClick={() => {
                          const prevIdx =
                            (activeIdx - 1 + sortedKfs.length) % sortedKfs.length;
                          selectKeyframe(clip.id, sortedKfs[prevIdx].id, true);
                        }}
                        className="p-0.5 bg-[#09090c] hover:bg-[#191922] disabled:opacity-35 border border-[#262632] rounded text-[#d4d4d8] cursor-pointer"
                        title="Previous Keyframe"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        data-testid="next-keyframe-btn"
                        disabled={sortedKfs.length <= 1}
                        onClick={() => {
                          const nextIdx = (activeIdx + 1) % sortedKfs.length;
                          selectKeyframe(clip.id, sortedKfs[nextIdx].id, true);
                        }}
                        className="p-0.5 bg-[#09090c] hover:bg-[#191922] disabled:opacity-35 border border-[#262632] rounded text-[#d4d4d8] cursor-pointer"
                        title="Next Keyframe"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-32 overflow-y-auto overflow-x-hidden space-y-1 pr-0.5">
                    {sortedKfs.map((kf) => {
                      const isKfSelected = activeKf?.id === kf.id;
                      return (
                        <div
                          key={kf.id}
                          data-testid={`keyframe-item-${kf.property}`}
                          data-keyframe-id={kf.id}
                          onClick={() => selectKeyframe(clip.id, kf.id, true)}
                          className={`flex items-center justify-between gap-1.5 px-1.5 py-1 rounded text-[10px] font-mono border cursor-pointer transition-colors min-w-0 ${
                            isKfSelected
                              ? 'bg-[#D7E83F]/10 border-[#D7E83F] text-[#f4f4f5]'
                              : 'bg-[#09090c] border-[#22222c] hover:border-[#343444]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectKeyframe(clip.id, kf.id, true);
                            }}
                            className={`text-left cursor-pointer flex items-center gap-1 min-w-0 flex-1 truncate ${
                              isKfSelected ? 'text-[#C8FF20] font-semibold' : 'text-amber-300'
                            }`}
                          >
                            <Diamond className="w-2.5 h-2.5 fill-current shrink-0" />
                            <span className="truncate">
                              {kf.property.toUpperCase()} @{kf.time.toFixed(2)}s={Number(kf.value.toFixed(2))}
                            </span>
                          </button>
                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <select
                              value={kf.easing}
                              onChange={(e) =>
                                updateClipKeyframe(clip.id, kf.id, {
                                  easing: e.target.value as KeyframeEasing,
                                })
                              }
                              className="w-[84px] bg-[#121217] text-[9px] text-[#d4d4d8] border border-[#262632] rounded px-1 py-0.5 truncate"
                            >
                              <option value="linear">Linear</option>
                              <option value="ease-in">Ease In</option>
                              <option value="ease-out">Ease Out</option>
                              <option value="ease-in-out">Ease In/Out</option>
                              <option value="cubic-bezier">Cubic (AE)</option>
                              <option value="expo-out">Expo Out</option>
                              <option value="back-out">Back Out</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => removeClipKeyframe(clip.id, kf.id)}
                              className="text-[#63636e] hover:text-rose-400 cursor-pointer shrink-0"
                              title="Remove Keyframe"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Manual Selected Keyframe Editor */}
                  {activeKf && (
                    <div
                      data-testid="selected-keyframe-editor"
                      className="bg-[#09090c] border border-[#D7E83F]/40 rounded-md p-2 space-y-1.5 min-w-0 overflow-hidden"
                    >
                      <div className="flex items-center justify-between text-[10px] min-w-0">
                        <span className="font-mono text-[#D7E83F] font-semibold uppercase truncate">
                          Edit Selected: {activeKf.property}
                        </span>
                        <button
                          type="button"
                          data-testid="delete-selected-keyframe-btn"
                          onClick={() => removeClipKeyframe(clip.id, activeKf.id)}
                          className="text-[10px] text-rose-400 hover:underline flex items-center gap-0.5 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                          <span>Delete</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                        <div className="min-w-0">
                          <label className="block text-[#71717a] text-[9px] mb-0.5 truncate">
                            Time (s)
                          </label>
                          <input
                            type="number"
                            data-testid="keyframe-time-input"
                            min={0}
                            max={Number(clip.duration.toFixed(2))}
                            step={0.05}
                            value={Number(activeKf.time.toFixed(2))}
                            onChange={(e) => {
                              const nextT = Math.max(
                                0,
                                Math.min(clip.duration, Number(e.target.value))
                              );
                              updateClipKeyframe(clip.id, activeKf.id, {
                                time: nextT,
                              });
                              setCurrentTime(clip.startTime + nextT);
                            }}
                            className="w-full min-w-0 h-6 px-1.5 bg-[#121217] border border-[#262632] rounded font-mono text-[#f4f4f5]"
                          />
                        </div>

                        <div className="min-w-0">
                          <label className="block text-[#71717a] text-[9px] mb-0.5 truncate">
                            Value
                          </label>
                          <input
                            type="number"
                            data-testid="keyframe-value-input"
                            step={
                              activeKf.property === 'scale' ||
                              activeKf.property === 'opacity'
                                ? 0.05
                                : 1
                            }
                            value={Number(activeKf.value.toFixed(2))}
                            onChange={(e) => {
                              const nextVal = Number(e.target.value);
                              updateClipKeyframe(clip.id, activeKf.id, {
                                value: nextVal,
                              });
                            }}
                            className="w-full min-w-0 h-6 px-1.5 bg-[#121217] border border-[#262632] rounded font-mono text-[#f4f4f5]"
                          />
                        </div>

                        <div className="min-w-0">
                          <label className="block text-[#71717a] text-[9px] mb-0.5 truncate">
                            Curve
                          </label>
                          <select
                            data-testid="keyframe-easing-select"
                            value={activeKf.easing}
                            onChange={(e) =>
                              updateClipKeyframe(clip.id, activeKf.id, {
                                easing: e.target.value as KeyframeEasing,
                              })
                            }
                            className="w-full min-w-0 h-6 px-1 bg-[#121217] border border-[#262632] rounded font-mono text-[10px] text-[#f4f4f5] truncate"
                          >
                            <option value="linear">Linear</option>
                            <option value="ease-in">Ease In</option>
                            <option value="ease-out">Ease Out</option>
                            <option value="ease-in-out">Ease In/Out</option>
                            <option value="cubic-bezier">Cubic (AE)</option>
                            <option value="expo-out">Expo Out</option>
                            <option value="back-out">Back Out</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>
        )}

        {/* 4. COLOR ADJUSTMENTS & EFFECTS */}
        {clip.type !== 'audio' && (
          <section className="bg-[#121217] border border-[#22222c] rounded-lg p-2.5 space-y-2 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8e8e98]">
                <Sparkles className="w-3 h-3 text-[#8b93ff]" />
                <span>Color & Effects</span>
              </div>
              <button
                type="button"
                data-testid="reset-color-btn"
                onClick={() =>
                  updateClipColorEffects(clip.id, createDefaultColorEffects())
                }
                className="text-[10px] text-[#71717a] hover:text-[#f4f4f5] flex items-center gap-0.5 cursor-pointer"
                title="Reset Color & Optical Effects"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            {(
              [
                { key: 'brightness', label: 'Brightness', min: -100, max: 100 },
                { key: 'contrast', label: 'Contrast', min: -100, max: 100 },
                { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
                { key: 'exposure', label: 'Exposure', min: -100, max: 100 },
                { key: 'blur', label: 'Blur (px)', min: 0, max: 40 },
                { key: 'grayscale', label: 'Grayscale (%)', min: 0, max: 100 },
                { key: 'sepia', label: 'Sepia (%)', min: 0, max: 100 },
              ] as const
            ).map((ctrl) => (
              <div key={ctrl.key}>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#71717a]">{ctrl.label}</span>
                  <span className="font-mono text-[#e4e4e7]">
                    {clip.effects[ctrl.key]}
                  </span>
                </div>
                <input
                  type="range"
                  data-testid={`effect-slider-${ctrl.key}`}
                  min={ctrl.min}
                  max={ctrl.max}
                  step={1}
                  value={clip.effects[ctrl.key]}
                  onChange={(e) =>
                    updateClipColorEffects(clip.id, {
                      [ctrl.key]: Number(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>
            ))}
          </section>
        )}

        {/* 4B. MASK & SHAPE REVEAL (For Video, Image, Text) */}
        {clip.type !== 'audio' && (() => {
          const mask = clip.mask || createDefaultMask();
          return (
            <section
              data-testid="inspector-mask-section"
              className="bg-[#121217] border border-[#22222c] rounded-lg p-2.5 space-y-2 min-w-0 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8e8e98]">
                  <Scan className="w-3 h-3 text-[#D7E83F]" />
                  <span>Mask & Shape Reveal</span>
                </div>
                <button
                  type="button"
                  data-testid="reset-mask-btn"
                  onClick={() => updateClipMask(clip.id, createDefaultMask())}
                  className="text-[10px] text-[#71717a] hover:text-[#f4f4f5] cursor-pointer"
                >
                  Reset
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 items-end">
                <div className="col-span-2">
                  <label className="block text-[10px] text-[#71717a] mb-0.5">
                    Mask Shape
                  </label>
                  <select
                    data-testid="inspector-mask-shape"
                    value={mask.shape}
                    onChange={(e) =>
                      updateClipMask(clip.id, {
                        shape: e.target.value as MaskShape,
                      })
                    }
                    className="w-full h-6 pl-1.5 pr-5 bg-[#09090c] border border-[#262632] rounded text-[11px] text-[#f4f4f5]"
                  >
                    <option value="none">None (Full Frame)</option>
                    <option value="rectangle">Rectangle Mask</option>
                    <option value="ellipse">Ellipse Mask</option>
                    <option value="circle">Circle Mask</option>
                    <option value="linear-wipe">Linear Wipe Reveal</option>
                    <option value="radial-reveal">Radial Clock Reveal</option>
                  </select>
                </div>

                <div>
                  <button
                    type="button"
                    data-testid="inspector-mask-invert"
                    onClick={() =>
                      updateClipMask(clip.id, { invert: !mask.invert })
                    }
                    className={`w-full h-6 px-2 rounded border text-[10px] font-mono cursor-pointer ${
                      mask.invert
                        ? 'bg-[#D7E83F]/20 border-[#D7E83F] text-[#D7E83F]'
                        : 'bg-[#09090c] border-[#262632] text-[#71717a]'
                    }`}
                  >
                    {mask.invert ? 'Inverted' : 'Invert'}
                  </button>
                </div>
              </div>

              {mask.shape !== 'none' && (
                <div className="space-y-1.5 pt-1 border-t border-[#1f1f27]">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#71717a]">
                          Width ({Math.round(evaluated.maskWidth)}%)
                        </span>
                        {renderKeyframeButton('maskWidth', evaluated.maskWidth)}
                      </div>
                      <input
                        type="range"
                        data-testid="inspector-mask-width"
                        min={0}
                        max={100}
                        step={1}
                        value={evaluated.maskWidth}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (
                            clip.keyframes.some(
                              (k) => k.property === 'maskWidth'
                            )
                          ) {
                            setClipKeyframe(
                              clip.id,
                              'maskWidth',
                              clipLocalTime,
                              val
                            );
                          } else {
                            updateClipMask(clip.id, { width: val });
                          }
                        }}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#71717a]">
                          Height ({Math.round(evaluated.maskHeight)}%)
                        </span>
                        {renderKeyframeButton(
                          'maskHeight',
                          evaluated.maskHeight
                        )}
                      </div>
                      <input
                        type="range"
                        data-testid="inspector-mask-height"
                        min={0}
                        max={100}
                        step={1}
                        value={evaluated.maskHeight}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (
                            clip.keyframes.some(
                              (k) => k.property === 'maskHeight'
                            )
                          ) {
                            setClipKeyframe(
                              clip.id,
                              'maskHeight',
                              clipLocalTime,
                              val
                            );
                          } else {
                            updateClipMask(clip.id, { height: val });
                          }
                        }}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#71717a]">
                          Center X ({Math.round(evaluated.maskX)}%)
                        </span>
                        {renderKeyframeButton('maskX', evaluated.maskX)}
                      </div>
                      <input
                        type="range"
                        data-testid="inspector-mask-x"
                        min={-50}
                        max={50}
                        step={1}
                        value={evaluated.maskX}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (
                            clip.keyframes.some((k) => k.property === 'maskX')
                          ) {
                            setClipKeyframe(
                              clip.id,
                              'maskX',
                              clipLocalTime,
                              val
                            );
                          } else {
                            updateClipMask(clip.id, { centerX: val });
                          }
                        }}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#71717a]">
                          Center Y ({Math.round(evaluated.maskY)}%)
                        </span>
                        {renderKeyframeButton('maskY', evaluated.maskY)}
                      </div>
                      <input
                        type="range"
                        data-testid="inspector-mask-y"
                        min={-50}
                        max={50}
                        step={1}
                        value={evaluated.maskY}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (
                            clip.keyframes.some((k) => k.property === 'maskY')
                          ) {
                            setClipKeyframe(
                              clip.id,
                              'maskY',
                              clipLocalTime,
                              val
                            );
                          } else {
                            updateClipMask(clip.id, { centerY: val });
                          }
                        }}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-[#71717a]">Feather</span>
                        <span className="font-mono text-[#e4e4e7]">
                          {mask.feather}px
                        </span>
                      </div>
                      <input
                        type="range"
                        data-testid="inspector-mask-feather"
                        min={0}
                        max={60}
                        step={1}
                        value={mask.feather}
                        onChange={(e) =>
                          updateClipMask(clip.id, {
                            feather: Number(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-[#71717a]">Corner Radius</span>
                        <span className="font-mono text-[#e4e4e7]">
                          {mask.radius}px
                        </span>
                      </div>
                      <input
                        type="range"
                        data-testid="inspector-mask-radius"
                        min={0}
                        max={160}
                        step={2}
                        value={mask.radius}
                        onChange={(e) =>
                          updateClipMask(clip.id, {
                            radius: Number(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-[#71717a]">Mask Angle</span>
                        <span className="font-mono text-[#e4e4e7]">
                          {mask.rotation}°
                        </span>
                      </div>
                      <input
                        type="range"
                        data-testid="inspector-mask-rotation"
                        min={-180}
                        max={180}
                        step={1}
                        value={mask.rotation}
                        onChange={(e) =>
                          updateClipMask(clip.id, {
                            rotation: Number(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-[#71717a]">Expansion</span>
                        <span className="font-mono text-[#e4e4e7]">
                          {mask.expansion}px
                        </span>
                      </div>
                      <input
                        type="range"
                        data-testid="inspector-mask-expansion"
                        min={-60}
                        max={60}
                        step={1}
                        value={mask.expansion}
                        onChange={(e) =>
                          updateClipMask(clip.id, {
                            expansion: Number(e.target.value),
                          })
                        }
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })()}

        {/* 5. CROP CONTROLS */}
        {(clip.type === 'video' || clip.type === 'image') && (
          <section className="bg-[#121217] border border-[#22222c] rounded-lg p-2.5 space-y-2 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8e8e98]">
                <Crop className="w-3 h-3 text-[#8b93ff]" />
                <span>Crop (%)</span>
              </div>
              <button
                type="button"
                onClick={() => updateClipCrop(clip.id, createDefaultCrop())}
                className="text-[10px] text-[#71717a] hover:text-[#f4f4f5] cursor-pointer"
              >
                Reset
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['left', 'right', 'top', 'bottom'] as const).map((edge) => (
                <div key={edge}>
                  <div className="flex justify-between text-[10px]">
                    <span className="capitalize text-[#71717a]">{edge}</span>
                    <span className="font-mono text-[#e4e4e7]">
                      {clip.crop[edge]}%
                    </span>
                  </div>
                  <input
                    type="range"
                    data-testid={`crop-slider-${edge}`}
                    min={0}
                    max={45}
                    step={1}
                    value={clip.crop[edge]}
                    onChange={(e) =>
                      updateClipCrop(clip.id, { [edge]: Number(e.target.value) })
                    }
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 6. TRANSITIONS */}
        {clip.type !== 'audio' && (
          <section className="bg-[#121217] border border-[#22222c] rounded-lg p-2.5 space-y-2 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8e8e98]">
              <ArrowRightLeft className="w-3 h-3 text-[#8b93ff]" />
              <span>Clip Transitions</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-[#71717a] mb-0.5">
                  Transition In
                </label>
                <select
                  data-testid="inspector-transition-in-select"
                  value={clip.transitionIn.type}
                  onChange={(e) =>
                    setClipTransition(clip.id, 'in', {
                      type: e.target.value as TransitionType,
                      duration: clip.transitionIn.duration || 0.5,
                    })
                  }
                  className="w-full h-6 pl-1.5 pr-5 bg-[#09090c] border border-[#262632] rounded text-[11px] text-[#f4f4f5]"
                >
                  <option value="none">None</option>
                  <option value="cross-dissolve">Cross Dissolve</option>
                  <option value="fade-from-black">Fade from Black</option>
                  <option value="slide-left">Slide Left</option>
                  <option value="wipe-right">Wipe Right</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-[#71717a] mb-0.5">
                  In Duration (s)
                </label>
                <input
                  type="number"
                  step={0.1}
                  min={0.1}
                  max={2.5}
                  value={clip.transitionIn.duration}
                  onChange={(e) =>
                    setClipTransition(clip.id, 'in', {
                      type: clip.transitionIn.type,
                      duration: Number(e.target.value),
                    })
                  }
                  className="w-full h-6 px-1.5 bg-[#09090c] border border-[#262632] rounded font-mono text-[#f4f4f5]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-[#71717a] mb-0.5">
                  Transition Out
                </label>
                <select
                  data-testid="inspector-transition-out-select"
                  value={clip.transitionOut.type}
                  onChange={(e) =>
                    setClipTransition(clip.id, 'out', {
                      type: e.target.value as TransitionType,
                      duration: clip.transitionOut.duration || 0.5,
                    })
                  }
                  className="w-full h-6 pl-1.5 pr-5 bg-[#09090c] border border-[#262632] rounded text-[11px] text-[#f4f4f5]"
                >
                  <option value="none">None</option>
                  <option value="fade-to-black">Fade to Black</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-[#71717a] mb-0.5">
                  Out Duration (s)
                </label>
                <input
                  type="number"
                  step={0.1}
                  min={0.1}
                  max={2.5}
                  value={clip.transitionOut.duration}
                  onChange={(e) =>
                    setClipTransition(clip.id, 'out', {
                      type: clip.transitionOut.type,
                      duration: Number(e.target.value),
                    })
                  }
                  className="w-full h-6 px-1.5 bg-[#09090c] border border-[#262632] rounded font-mono text-[#f4f4f5]"
                />
              </div>
            </div>
          </section>
        )}

        {/* 7. AUDIO PROPERTIES & FADES (For Audio & Video Clips) */}
        {(clip.type === 'audio' || clip.type === 'video') && (
          <section className="bg-[#121217] border border-[#22222c] rounded-lg p-2.5 space-y-2 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                <Volume2 className="w-3 h-3" />
                <span>Audio Envelope</span>
              </div>
              <button
                type="button"
                data-testid="inspector-clip-mute-btn"
                onClick={() =>
                  updateClipProperties(clip.id, { muted: !clip.muted })
                }
                className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border cursor-pointer ${
                  clip.muted
                    ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                    : 'bg-[#09090c] border-[#262632] text-[#71717a]'
                }`}
              >
                {clip.muted ? (
                  <>
                    <VolumeX className="w-3 h-3" /> Muted
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3 h-3" /> Active
                  </>
                )}
              </button>
            </div>

            <div>
              <div className="flex justify-between text-[10px]">
                <span className="text-[#71717a]">Clip Volume</span>
                <span className="font-mono text-[#e4e4e7]">
                  {Math.round(clip.volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                data-testid="inspector-volume-slider"
                min={0}
                max={2}
                step={0.05}
                value={clip.volume}
                onChange={(e) =>
                  updateClipProperties(clip.id, {
                    volume: Number(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#71717a]">Fade In (s)</span>
                  <span className="font-mono text-[#e4e4e7]">
                    {clip.fadeIn.toFixed(1)}s
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="inspector-fade-in-slider"
                  min={0}
                  max={Math.max(0.5, clip.duration / 2)}
                  step={0.1}
                  value={clip.fadeIn}
                  onChange={(e) =>
                    updateClipProperties(clip.id, {
                      fadeIn: Number(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#71717a]">Fade Out (s)</span>
                  <span className="font-mono text-[#e4e4e7]">
                    {clip.fadeOut.toFixed(1)}s
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="inspector-fade-out-slider"
                  min={0}
                  max={Math.max(0.5, clip.duration / 2)}
                  step={0.1}
                  value={clip.fadeOut}
                  onChange={(e) =>
                    updateClipProperties(clip.id, {
                      fadeOut: Number(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>
            </div>
          </section>
        )}
      </div>
    </aside>
  );
};
