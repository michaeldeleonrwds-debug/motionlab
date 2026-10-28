/**
 * MotionLab 3.0 — Video FX & Color Studio Panel
 * Professional non-destructive primary color correction, 3D LUTs,
 * cinematic video filters, Before/After bypass, and real-time scopes.
 */

import React, { useState } from 'react';
import {
  Sliders,
  Sun,
  Flame,
  Sparkles,
  Upload,
  RotateCcw,
  Eye,
  EyeOff,
  Layers,
  Wand2,
  Film,
  Camera,
  CircleDot,
  Check,
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import {
  ColorCorrectionParams,
  DEFAULT_COLOR_CORRECTION,
  VideoEffect,
  VignetteParams,
  FilmGrainParams,
  SharpenParams,
} from '../videoFx/types';
import {
  BUILTIN_LUT_PRESETS,
  parseCubeLUT,
  generatePresetLUT,
} from '../videoFx/colorEngine';
import { ScopesPanel } from './ScopesPanel';

type ColorSubTab = 'grade' | 'luts' | 'filters' | 'scopes';

export const VideoFxStudioPanel: React.FC = () => {
  const store = useEditorStore();
  const selectedClip = store.project.clips.find((c) => c.id === store.selectedClipId);

  const [activeTab, setActiveTab] = useState<ColorSubTab>('grade');
  const [bypassGrade, setBypassGrade] = useState<boolean>(false);

  // Read or initialize primary color correction from clip's videoEffects
  const colorCorrectionEffect = selectedClip?.videoEffects?.find(
    (e) => e.type === 'color-correction'
  );
  const currentGrade: ColorCorrectionParams =
    (colorCorrectionEffect?.params as ColorCorrectionParams) || DEFAULT_COLOR_CORRECTION;

  // Read or initialize LUT
  const lutEffect = selectedClip?.videoEffects?.find((e) => e.type === 'lut');
  const currentLut = lutEffect
    ? (lutEffect.params as { presetId: string; intensity: number; name: string })
    : { presetId: 'none', intensity: 1.0, name: 'None' };

  // Helper to commit video effects stack to the active clip
  const updateClipEffects = (newEffects: VideoEffect[]) => {
    if (!selectedClip) return;
    store.pushHistory();

    useEditorStore.setState((state) => ({
      project: {
        ...state.project,
        clips: state.project.clips.map((clip) =>
          clip.id === selectedClip.id ? { ...clip, videoEffects: newEffects } : clip
        ),
        updatedAt: Date.now(),
      },
    }));
  };

  const setGradeParam = <K extends keyof ColorCorrectionParams>(
    key: K,
    value: ColorCorrectionParams[K]
  ) => {
    if (!selectedClip) return;

    const existingStack = selectedClip.videoEffects || [];
    const newGrade: ColorCorrectionParams = { ...currentGrade, [key]: value };

    const hasGradeEffect = existingStack.some((e) => e.type === 'color-correction');
    const updatedStack: VideoEffect[] = hasGradeEffect
      ? existingStack.map((e) =>
          e.type === 'color-correction' ? { ...e, params: newGrade } : e
        )
      : [
          ...existingStack,
          {
            id: `fx-grade-${Date.now().toString(36)}`,
            type: 'color-correction',
            name: 'Primary Grade',
            enabled: true,
            params: newGrade,
          },
        ];

    // Also mirror basic sliders to legacy clip.effects for 100% backwards compatibility
    if (key === 'exposure') {
      store.updateClipColorEffects(selectedClip.id, { exposure: value as number });
    } else if (key === 'contrast') {
      store.updateClipColorEffects(selectedClip.id, { contrast: value as number });
    } else if (key === 'saturation') {
      store.updateClipColorEffects(selectedClip.id, { saturation: value as number });
    }

    updateClipEffects(updatedStack);
  };

  const handleApplyPresetLUT = (presetId: string, name: string) => {
    if (!selectedClip) return;

    const existingStack = selectedClip.videoEffects || [];
    const lutData = generatePresetLUT(presetId);

    const newLutEffect: VideoEffect = {
      id: `fx-lut-${Date.now().toString(36)}`,
      type: 'lut',
      name: `LUT: ${name}`,
      enabled: true,
      params: {
        presetId,
        name,
        intensity: currentLut.intensity || 1.0,
        cubeSize: 17,
        cubeData: lutData,
      },
    };

    const updatedStack = existingStack.filter((e) => e.type !== 'lut').concat(newLutEffect);
    updateClipEffects(updatedStack);
  };

  const handleCustomCubeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClip) return;

    try {
      const text = await file.text();
      const parsed = parseCubeLUT(text);
      const lutName = parsed.title || file.name.replace(/\.cube$/i, '');

      const existingStack = selectedClip.videoEffects || [];
      const newLutEffect: VideoEffect = {
        id: `fx-lut-${Date.now().toString(36)}`,
        type: 'lut',
        name: `LUT: ${lutName}`,
        enabled: true,
        params: {
          presetId: 'custom',
          name: lutName,
          intensity: 1.0,
          cubeSize: parsed.size,
          cubeData: parsed.data,
        },
      };

      const updatedStack = existingStack.filter((e) => e.type !== 'lut').concat(newLutEffect);
      updateClipEffects(updatedStack);
    } catch (err) {
      alert(`Failed to load .cube LUT file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleResetGrade = () => {
    if (!selectedClip) return;
    const existingStack = (selectedClip.videoEffects || []).filter(
      (e) => e.type !== 'color-correction'
    );
    updateClipEffects(existingStack);
    store.updateClipColorEffects(selectedClip.id, {
      exposure: 0,
      contrast: 0,
      saturation: 0,
      brightness: 0,
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d12] text-[#e4e4e7] overflow-hidden select-none">
      {/* Studio Header */}
      <div className="p-3 border-b border-[#1f1f28] flex items-center justify-between bg-[#121218]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-sm">
            <Flame className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
              Color Studio & Video FX
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-mono">
                3.0
              </span>
            </h2>
            <div className="text-[10px] text-[#a1a1aa] font-mono truncate max-w-[200px]">
              {selectedClip ? `Target: ${selectedClip.name}` : 'No clip selected'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setBypassGrade(!bypassGrade)}
            title="Bypass all grades (\)"
            className={`p-1.5 rounded transition-colors ${
              bypassGrade ? 'bg-amber-500/20 text-amber-400' : 'text-[#71717a] hover:text-white'
            }`}
          >
            {bypassGrade ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleResetGrade}
            title="Reset color grade"
            disabled={!selectedClip}
            className="p-1.5 rounded hover:bg-[#1f1f28] text-[#71717a] hover:text-white disabled:opacity-30 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="grid grid-cols-4 p-1.5 bg-[#14141c] border-b border-[#1f1f28] gap-1 text-[11px] font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('grade')}
          className={`py-1.5 px-1 rounded flex items-center justify-center gap-1 transition-all ${
            activeTab === 'grade'
              ? 'bg-[#222230] text-amber-300 font-semibold shadow-xs'
              : 'text-[#71717a] hover:text-[#e4e4e7]'
          }`}
        >
          <Sun className="w-3 h-3" />
          <span>Grade</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('luts')}
          className={`py-1.5 px-1 rounded flex items-center justify-center gap-1 transition-all ${
            activeTab === 'luts'
              ? 'bg-[#222230] text-amber-300 font-semibold shadow-xs'
              : 'text-[#71717a] hover:text-[#e4e4e7]'
          }`}
        >
          <Sliders className="w-3 h-3" />
          <span>3D LUTs</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('filters')}
          className={`py-1.5 px-1 rounded flex items-center justify-center gap-1 transition-all ${
            activeTab === 'filters'
              ? 'bg-[#222230] text-amber-300 font-semibold shadow-xs'
              : 'text-[#71717a] hover:text-[#e4e4e7]'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>Filters</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('scopes')}
          className={`py-1.5 px-1 rounded flex items-center justify-center gap-1 transition-all ${
            activeTab === 'scopes'
              ? 'bg-[#222230] text-amber-300 font-semibold shadow-xs'
              : 'text-[#71717a] hover:text-[#e4e4e7]'
          }`}
        >
          <Layers className="w-3 h-3" />
          <span>Scopes</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {!selectedClip && (
          <div className="p-4 border border-dashed border-[#272736] rounded-xl text-center space-y-2">
            <Film className="w-6 h-6 text-[#71717a] mx-auto" />
            <div className="text-xs text-[#a1a1aa] font-medium">No Clip Selected</div>
            <p className="text-[11px] text-[#71717a]">
              Select a video, title, or image clip on the timeline to inspect and edit its color grade.
            </p>
          </div>
        )}

        {selectedClip && (
          <>
            {/* ================= TAB 1: PRIMARY COLOR CORRECTION ================= */}
            {activeTab === 'grade' && (
              <div className="space-y-3.5 text-xs">
                {/* Exposure */}
                <div className="p-2.5 bg-[#14141d] border border-[#20202c] rounded-lg space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#a1a1aa]">Exposure</span>
                    <span className="font-mono text-amber-400">
                      {currentGrade.exposure > 0 ? `+${currentGrade.exposure}` : currentGrade.exposure}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={currentGrade.exposure}
                    onChange={(e) => setGradeParam('exposure', parseInt(e.target.value, 10))}
                    className="w-full accent-amber-500 h-1 bg-[#222230] rounded cursor-pointer"
                  />
                </div>

                {/* Contrast */}
                <div className="p-2.5 bg-[#14141d] border border-[#20202c] rounded-lg space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#a1a1aa]">Contrast</span>
                    <span className="font-mono text-amber-400">
                      {currentGrade.contrast > 0 ? `+${currentGrade.contrast}` : currentGrade.contrast}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={currentGrade.contrast}
                    onChange={(e) => setGradeParam('contrast', parseInt(e.target.value, 10))}
                    className="w-full accent-amber-500 h-1 bg-[#222230] rounded cursor-pointer"
                  />
                </div>

                {/* Saturation */}
                <div className="p-2.5 bg-[#14141d] border border-[#20202c] rounded-lg space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#a1a1aa]">Saturation</span>
                    <span className="font-mono text-amber-400">
                      {currentGrade.saturation > 0
                        ? `+${currentGrade.saturation}`
                        : currentGrade.saturation}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={currentGrade.saturation}
                    onChange={(e) => setGradeParam('saturation', parseInt(e.target.value, 10))}
                    className="w-full accent-amber-500 h-1 bg-[#222230] rounded cursor-pointer"
                  />
                </div>

                {/* Temperature & Tint */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-[#14141d] border border-[#20202c] rounded-lg space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[#a1a1aa]">Temp</span>
                      <span className="font-mono text-amber-400">{currentGrade.temperature}</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={currentGrade.temperature}
                      onChange={(e) => setGradeParam('temperature', parseInt(e.target.value, 10))}
                      className="w-full accent-amber-500 h-1 bg-[#222230] rounded cursor-pointer"
                    />
                  </div>

                  <div className="p-2.5 bg-[#14141d] border border-[#20202c] rounded-lg space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[#a1a1aa]">Tint</span>
                      <span className="font-mono text-amber-400">{currentGrade.tint}</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={currentGrade.tint}
                      onChange={(e) => setGradeParam('tint', parseInt(e.target.value, 10))}
                      className="w-full accent-amber-500 h-1 bg-[#222230] rounded cursor-pointer"
                    />
                  </div>
                </div>

                {/* Highlights & Shadows */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-[#14141d] border border-[#20202c] rounded-lg space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[#a1a1aa]">Highlights</span>
                      <span className="font-mono text-amber-400">{currentGrade.highlights}</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={currentGrade.highlights}
                      onChange={(e) => setGradeParam('highlights', parseInt(e.target.value, 10))}
                      className="w-full accent-amber-500 h-1 bg-[#222230] rounded cursor-pointer"
                    />
                  </div>

                  <div className="p-2.5 bg-[#14141d] border border-[#20202c] rounded-lg space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[#a1a1aa]">Shadows</span>
                      <span className="font-mono text-amber-400">{currentGrade.shadows}</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={currentGrade.shadows}
                      onChange={(e) => setGradeParam('shadows', parseInt(e.target.value, 10))}
                      className="w-full accent-amber-500 h-1 bg-[#222230] rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 2: 3D LUT STUDIO ================= */}
            {activeTab === 'luts' && (
              <div className="space-y-3.5">
                {/* Custom .CUBE upload */}
                <div className="p-3 bg-[#161622] border border-dashed border-[#2a2a3e] rounded-xl text-center space-y-2">
                  <Upload className="w-5 h-5 text-amber-400 mx-auto" />
                  <div className="text-xs font-semibold text-white">Import Custom .cube LUT</div>
                  <p className="text-[10px] text-[#71717a]">
                    Compatible with Adobe Premiere, DaVinci Resolve, and Final Cut 3D LUTs.
                  </p>
                  <label className="inline-block py-1.5 px-3 bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer">
                    <span>Browse .cube File...</span>
                    <input
                      type="file"
                      accept=".cube"
                      onChange={handleCustomCubeUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Preset LUT Cards */}
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold text-[#71717a] uppercase tracking-wider">
                    Curated Master Looks
                  </div>

                  {BUILTIN_LUT_PRESETS.map((lut) => {
                    const isSelected = currentLut.presetId === lut.id;
                    return (
                      <div
                        key={lut.id}
                        onClick={() => handleApplyPresetLUT(lut.id, lut.name)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-amber-950/30 border-amber-500/60 shadow-sm'
                            : 'bg-[#14141d] border-[#20202c] hover:border-[#303042]'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-white truncate">
                              {lut.name}
                            </span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                          </div>
                          <p className="text-[10px] text-[#71717a] truncate mt-0.5">
                            {lut.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ================= TAB 3: VIDEO FILTERS ================= */}
            {activeTab === 'filters' && (
              <div className="space-y-3 text-xs">
                <div className="text-[10px] font-semibold text-[#71717a] uppercase tracking-wider mb-1">
                  Creative Optical Filters
                </div>

                {/* Vignette */}
                <div className="p-2.5 bg-[#14141d] border border-[#20202c] rounded-lg space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-white">Cinematic Vignette</span>
                    <button
                      type="button"
                      onClick={() => {
                        const existing = selectedClip.videoEffects || [];
                        const hasVignette = existing.some((e) => e.type === 'vignette');
                        if (hasVignette) {
                          updateClipEffects(existing.filter((e) => e.type !== 'vignette'));
                        } else {
                          updateClipEffects([
                            ...existing,
                            {
                              id: `fx-vig-${Date.now().toString(36)}`,
                              type: 'vignette',
                              name: 'Vignette',
                              enabled: true,
                              params: { amount: 0.5, radius: 0.75, feather: 0.5, roundness: 1.0 },
                            },
                          ]);
                        }
                      }}
                      className="text-[10px] px-2 py-0.5 rounded bg-[#222230] text-amber-400 hover:bg-amber-600 hover:text-white transition-colors"
                    >
                      {selectedClip.videoEffects?.some((e) => e.type === 'vignette')
                        ? 'Disable'
                        : 'Enable'}
                    </button>
                  </div>
                </div>

                {/* Film Grain */}
                <div className="p-2.5 bg-[#14141d] border border-[#20202c] rounded-lg space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-white">35mm Film Grain</span>
                    <button
                      type="button"
                      onClick={() => {
                        const existing = selectedClip.videoEffects || [];
                        const hasGrain = existing.some((e) => e.type === 'film-grain');
                        if (hasGrain) {
                          updateClipEffects(existing.filter((e) => e.type !== 'film-grain'));
                        } else {
                          updateClipEffects([
                            ...existing,
                            {
                              id: `fx-grain-${Date.now().toString(36)}`,
                              type: 'film-grain',
                              name: 'Film Grain',
                              enabled: true,
                              params: { intensity: 0.25, size: 1.5, monochrome: true },
                            },
                          ]);
                        }
                      }}
                      className="text-[10px] px-2 py-0.5 rounded bg-[#222230] text-amber-400 hover:bg-amber-600 hover:text-white transition-colors"
                    >
                      {selectedClip.videoEffects?.some((e) => e.type === 'film-grain')
                        ? 'Disable'
                        : 'Enable'}
                    </button>
                  </div>
                </div>

                {/* Sharpen */}
                <div className="p-2.5 bg-[#14141d] border border-[#20202c] rounded-lg space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-white">Optical Sharpen</span>
                    <button
                      type="button"
                      onClick={() => {
                        const existing = selectedClip.videoEffects || [];
                        const hasSharpen = existing.some((e) => e.type === 'sharpen');
                        if (hasSharpen) {
                          updateClipEffects(existing.filter((e) => e.type !== 'sharpen'));
                        } else {
                          updateClipEffects([
                            ...existing,
                            {
                              id: `fx-sharp-${Date.now().toString(36)}`,
                              type: 'sharpen',
                              name: 'Sharpen',
                              enabled: true,
                              params: { amount: 0.8, radiusPx: 1.0 },
                            },
                          ]);
                        }
                      }}
                      className="text-[10px] px-2 py-0.5 rounded bg-[#222230] text-amber-400 hover:bg-amber-600 hover:text-white transition-colors"
                    >
                      {selectedClip.videoEffects?.some((e) => e.type === 'sharpen')
                        ? 'Disable'
                        : 'Enable'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 4: REAL-TIME SCOPES ================= */}
            {activeTab === 'scopes' && (
              <div className="space-y-3">
                <div className="text-[10px] font-semibold text-[#71717a] uppercase tracking-wider">
                  Live Video Scopes Telemetry
                </div>
                <ScopesPanel />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
