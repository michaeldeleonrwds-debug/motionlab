import React, { useState, useMemo } from 'react';
import {
  Search,
  Wand2,
  Sliders,
  ArrowRightLeft,
  Volume2,
  Type,
  Plus,
  Tv,
  Film,
  Zap,
  Sparkles,
  Palette,
  Check,
} from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import type { TransitionType } from '../../types/editor';

type EffectCategory =
  | 'all'
  | 'videofx'
  | 'transitions'
  | 'color'
  | 'audio'
  | 'typography';

interface EffectDefinition {
  id: string;
  name: string;
  category: EffectCategory;
  categoryLabel: string;
  desc: string;
  icon: React.ReactNode;
  badge?: string;
  onApply: () => void;
}

import type { VideoEffect } from '../../videoFx/types';

function applyVideoEffectToClip(clipId: string, effect: VideoEffect) {
  useEditorStore.getState().pushHistory();
  useEditorStore.setState((state) => ({
    project: {
      ...state.project,
      clips: state.project.clips.map((clip) => {
        if (clip.id !== clipId) return clip;
        const existing = clip.videoEffects || [];
        const filtered = existing.filter((e) => e.type !== effect.type);
        return { ...clip, videoEffects: [...filtered, effect] };
      }),
      updatedAt: Date.now(),
    },
  }));
}

function applyLutToSelectedClip(presetId: string, name: string) {
  const selectedClipId = useEditorStore.getState().selectedClipId;
  const targetId = selectedClipId || useEditorStore.getState().project.clips[0]?.id;
  if (!targetId) return;
  const lutEffect: VideoEffect = {
    id: `fx-lut-${Date.now().toString(36)}`,
    type: 'lut',
    name: `LUT: ${name}`,
    enabled: true,
    params: { presetId, intensity: 1.0, name },
  };
  applyVideoEffectToClip(targetId, lutEffect);
}

export const EffectsBrowser: React.FC = () => {
  const {
    selectedClipId,
    setClipTransition,
    addTextClipToTimeline,
    addMediaClipToTimeline,
    project,
  } = useEditorStore();

  const effectsFilterCategory = useWorkspaceStore(
    (s) => s.effectsFilterCategory
  ) as EffectCategory;
  const setEffectsFilterCategory = useWorkspaceStore(
    (s) => s.setEffectsFilterCategory
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  const triggerNotice = (msg: string) => {
    setAppliedNotice(msg);
    setTimeout(() => setAppliedNotice(null), 1800);
  };

  const selectedClip = project.clips.find((c) => c.id === selectedClipId);

  const effectItems: EffectDefinition[] = useMemo(() => {
    return [
      // Video FX
      {
        id: 'vfx-bloom',
        name: 'Dreamy Anamorphic Bloom',
        category: 'videofx',
        categoryLabel: 'Video FX',
        desc: 'Soft highlight glow, halation diffusion, and atmospheric shine',
        badge: 'Glow',
        icon: <Tv className="w-4 h-4 text-[#8B82F6]" />,
        onApply: () => {
          if (selectedClipId) {
            applyVideoEffectToClip(selectedClipId, {
              id: `fx-bloom-${Date.now().toString(36)}`,
              type: 'bloom',
              name: 'Anamorphic Bloom',
              enabled: true,
              params: { threshold: 0.8, intensity: 0.5, radius: 14 },
            });
            triggerNotice('Applied Anamorphic Bloom to clip');
          } else {
            triggerNotice('Select a clip first to apply effect');
          }
        },
      },
      {
        id: 'vfx-filmgrain',
        name: '35mm Analog Film Grain',
        category: 'videofx',
        categoryLabel: 'Video FX',
        desc: 'Organic silver halide grain overlay with jitter',
        badge: 'Film',
        icon: <Film className="w-4 h-4 text-[#E8B45A]" />,
        onApply: () => {
          if (selectedClipId) {
            applyVideoEffectToClip(selectedClipId, {
              id: `fx-grain-${Date.now().toString(36)}`,
              type: 'film-grain',
              name: '35mm Film Grain',
              enabled: true,
              params: { intensity: 0.45, size: 1.5, monochrome: true },
            });
            triggerNotice('Applied 35mm Film Grain');
          } else {
            triggerNotice('Select a clip first');
          }
        },
      },
      {
        id: 'vfx-chromatic',
        name: 'Chromatic Aberration',
        category: 'videofx',
        categoryLabel: 'Video FX',
        desc: 'Radial RGB lens displacement and color fringe',
        badge: 'Optical',
        icon: <Zap className="w-4 h-4 text-[#EC4899]" />,
        onApply: () => {
          if (selectedClipId) {
            applyVideoEffectToClip(selectedClipId, {
              id: `fx-chromatic-${Date.now().toString(36)}`,
              type: 'chromatic-aberration',
              name: 'Chromatic Aberration',
              enabled: true,
              params: { offsetPx: 4, angleDeg: 45 },
            });
            triggerNotice('Applied Chromatic Aberration');
          } else {
            triggerNotice('Select a clip first');
          }
        },
      },
      {
        id: 'vfx-vignette',
        name: 'Cinematic Vignette',
        category: 'videofx',
        categoryLabel: 'Video FX',
        desc: 'Gradual edge falloff darkening drawing eye to center',
        badge: 'Focus',
        icon: <Wand2 className="w-4 h-4 text-[#94A3B8]" />,
        onApply: () => {
          if (selectedClipId) {
            applyVideoEffectToClip(selectedClipId, {
              id: `fx-vignette-${Date.now().toString(36)}`,
              type: 'vignette',
              name: 'Cinematic Vignette',
              enabled: true,
              params: { amount: 0.6, radius: 0.75, feather: 0.5, roundness: 1.0 },
            });
            triggerNotice('Applied Cinematic Vignette');
          } else {
            triggerNotice('Select a clip first');
          }
        },
      },

      // Transitions
      {
        id: 'tr-dissolve',
        name: 'Cross Dissolve',
        category: 'transitions',
        categoryLabel: 'Transitions',
        desc: 'Smooth linear opacity blend between adjacent cuts',
        badge: 'Standard',
        icon: <ArrowRightLeft className="w-4 h-4 text-[#38BDF8]" />,
        onApply: () => {
          if (selectedClipId) {
            setClipTransition(selectedClipId, 'in', {
              type: 'cross-dissolve',
              duration: 0.6,
            });
            triggerNotice('Applied Cross Dissolve (0.6s)');
          } else {
            triggerNotice('Select a clip on timeline');
          }
        },
      },
      {
        id: 'tr-fade-black',
        name: 'Fade from Black (Dip In)',
        category: 'transitions',
        categoryLabel: 'Transitions',
        desc: 'Gradual ease-in from cinema pure black',
        badge: 'Scene In',
        icon: <ArrowRightLeft className="w-4 h-4 text-[#94A3B8]" />,
        onApply: () => {
          if (selectedClipId) {
            setClipTransition(selectedClipId, 'in', {
              type: 'fade-from-black',
              duration: 0.75,
            });
            triggerNotice('Applied Fade from Black');
          } else {
            triggerNotice('Select a clip on timeline');
          }
        },
      },
      {
        id: 'tr-fade-out-black',
        name: 'Fade to Black (Dip Out)',
        category: 'transitions',
        categoryLabel: 'Transitions',
        desc: 'Gradual ease-out to cinema pure black',
        badge: 'Scene Out',
        icon: <ArrowRightLeft className="w-4 h-4 text-[#94A3B8]" />,
        onApply: () => {
          if (selectedClipId) {
            setClipTransition(selectedClipId, 'out', {
              type: 'fade-to-black',
              duration: 0.75,
            });
            triggerNotice('Applied Fade to Black');
          } else {
            triggerNotice('Select a clip on timeline');
          }
        },
      },
      {
        id: 'tr-slide',
        name: 'Slide Push Left',
        category: 'transitions',
        categoryLabel: 'Transitions',
        desc: 'Horizontal linear push transition with motion blur',
        badge: 'Push',
        icon: <ArrowRightLeft className="w-4 h-4 text-[#8B82F6]" />,
        onApply: () => {
          if (selectedClipId) {
            setClipTransition(selectedClipId, 'in', {
              type: 'slide-left',
              duration: 0.5,
            });
            triggerNotice('Applied Slide Push (0.5s)');
          } else {
            triggerNotice('Select a clip on timeline');
          }
        },
      },

      // Color / LUTs
      {
        id: 'col-warm',
        name: 'LUT: Cinematic Warm Golden',
        category: 'color',
        categoryLabel: 'Color LUT',
        desc: 'Warm film emulation with rich skin tones & soft rolloff',
        badge: '3D LUT',
        icon: <Palette className="w-4 h-4 text-[#F59E0B]" />,
        onApply: () => {
          applyLutToSelectedClip('/luts/cinematic_warm.cube', 'Cinematic Warm');
          triggerNotice('Applied Cinematic Warm 3D LUT');
        },
      },
      {
        id: 'col-cyberpunk',
        name: 'LUT: Cyberpunk Teal & Orange',
        category: 'color',
        categoryLabel: 'Color LUT',
        desc: 'High contrast cyan shadows and saturated amber highlights',
        badge: '3D LUT',
        icon: <Palette className="w-4 h-4 text-[#06B6D4]" />,
        onApply: () => {
          applyLutToSelectedClip('/luts/cyberpunk_neon.cube', 'Cyberpunk Neon');
          triggerNotice('Applied Cyberpunk Teal & Orange 3D LUT');
        },
      },
      {
        id: 'col-bw',
        name: 'LUT: Film Noir High-Contrast B&W',
        category: 'color',
        categoryLabel: 'Color LUT',
        desc: 'Deep silver shadows and punchy studio monochrome curve',
        badge: '3D LUT',
        icon: <Palette className="w-4 h-4 text-[#E8EDF5]" />,
        onApply: () => {
          applyLutToSelectedClip('/luts/film_noir_bw.cube', 'Film Noir B&W');
          triggerNotice('Applied Film Noir B&W 3D LUT');
        },
      },

      // Typography
      {
        id: 'typo-master',
        name: 'Studio Master Headline',
        category: 'typography',
        categoryLabel: 'Kinetic Type',
        desc: '68pt Bold fade-in headline with dark ambient plate',
        badge: 'Headline',
        icon: <Type className="w-4 h-4 text-[#8B82F6]" />,
        onApply: () => {
          addTextClipToTimeline('STUDIO MASTER', {
            fontSize: 68,
            fontWeight: 800,
            color: '#FFFFFF',
            animationIn: 'fade-in',
            animationOut: 'fade-out',
            animationDuration: 0.5,
          });
          triggerNotice('Added Headline to timeline');
        },
      },
      {
        id: 'typo-lower-third',
        name: 'Broadcast Lower Third',
        category: 'typography',
        categoryLabel: 'Kinetic Type',
        desc: 'Slide-in credential plate for titles & interviews',
        badge: 'Broadcast',
        icon: <Type className="w-4 h-4 text-[#38BDF8]" />,
        onApply: () => {
          addTextClipToTimeline('DIRECTOR CUT • SCENE 01', {
            fontSize: 42,
            fontWeight: 600,
            color: '#FFFFFF',
            backgroundColor: '#1E293B',
            backgroundOpacity: 0.85,
            animationIn: 'slide-in',
            animationOut: 'slide-out',
            animationDuration: 0.55,
          });
          triggerNotice('Added Lower Third');
        },
      },
      {
        id: 'typo-typewriter',
        name: 'Documentary Typewriter',
        category: 'typography',
        categoryLabel: 'Kinetic Type',
        desc: 'Monospace character-by-character typewriter reveal',
        badge: 'Editorial',
        icon: <Type className="w-4 h-4 text-[#36C6A3]" />,
        onApply: () => {
          addTextClipToTimeline('LOCATION LOG // 02:45', {
            fontFamily: 'JetBrains Mono',
            fontSize: 44,
            fontWeight: 600,
            color: '#E8EDF5',
            animationIn: 'typewriter',
            animationOut: 'fade-out',
            animationDuration: 0.9,
          });
          triggerNotice('Added Typewriter Title');
        },
      },

      // Audio / SFX Quick Stems
      {
        id: 'sfx-whoosh',
        name: 'Fast Clean UI Whoosh',
        category: 'audio',
        categoryLabel: 'Sound FX',
        desc: 'Snappy high-frequency air swipe for transitions & text pop',
        badge: 'Transition',
        icon: <Volume2 className="w-4 h-4 text-[#10B981]" />,
        onApply: () => {
          const sfxAsset = project.mediaAssets.find(
            (a) => a.name.includes('whoosh') || a.name.includes('swish')
          );
          if (sfxAsset) {
            addMediaClipToTimeline(sfxAsset.id);
            triggerNotice('Added Whoosh SFX to audio track');
          } else {
            triggerNotice('Open SFX tab to generate or preview sound');
          }
        },
      },
      {
        id: 'sfx-impact',
        name: 'Deep Cinematic Sub Hit',
        category: 'audio',
        categoryLabel: 'Sound FX',
        desc: 'Low-end 50Hz sub bass impact for dramatic title reveals',
        badge: 'Impact',
        icon: <Volume2 className="w-4 h-4 text-[#F43F5E]" />,
        onApply: () => {
          const sfxAsset = project.mediaAssets.find(
            (a) => a.name.includes('impact') || a.name.includes('hit')
          );
          if (sfxAsset) {
            addMediaClipToTimeline(sfxAsset.id);
            triggerNotice('Added Sub Hit to audio track');
          } else {
            triggerNotice('Open SFX tab to audition library');
          }
        },
      },
    ];
  }, [
    selectedClipId,
    setClipTransition,
    addTextClipToTimeline,
    addMediaClipToTimeline,
    project.mediaAssets,
  ]);

  const filteredEffects = useMemo(() => {
    return effectItems.filter((item) => {
      if (
        effectsFilterCategory !== 'all' &&
        item.category !== effectsFilterCategory
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          item.name.toLowerCase().includes(q) ||
          item.desc.toLowerCase().includes(q) ||
          item.categoryLabel.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [effectItems, effectsFilterCategory, searchQuery]);

  const CATEGORIES: { id: EffectCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'videofx', label: 'Video FX' },
    { id: 'transitions', label: 'Transitions' },
    { id: 'color', label: 'Color / LUT' },
    { id: 'typography', label: 'Kinetic Type' },
    { id: 'audio', label: 'Audio / SFX' },
  ];

  return (
    <div
      data-testid="effects-browser-panel"
      className="flex flex-col h-full bg-[#141A23] text-[#E8EDF5] select-none min-w-0 overflow-hidden"
    >
      {/* Top Search & Filter Header */}
      <div className="p-2.5 border-b border-[#2A3341] space-y-2 shrink-0 bg-[#0B0F16]/50">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            data-testid="effects-search-input"
            placeholder="Search effects, LUTs, transitions, type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-7 pl-8 pr-2.5 bg-[#141A23] border border-[#2A3341] rounded-md text-[11px] text-[#E8EDF5] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#8B82F6]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isActive = effectsFilterCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                data-testid={`effects-cat-${cat.id}`}
                onClick={() => setEffectsFilterCategory(cat.id)}
                className={`h-5.5 px-2 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#8B82F6] text-white'
                    : 'bg-[#1D2531] text-[#94A3B8] hover:text-[#E8EDF5] hover:bg-[#2A3341]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Applied toast feedback */}
      {appliedNotice && (
        <div className="bg-[#36C6A3]/20 border-b border-[#36C6A3]/50 text-[#36C6A3] text-[11px] px-3 py-1 flex items-center gap-1.5 animate-in fade-in duration-150">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{appliedNotice}</span>
        </div>
      )}

      {/* Effect List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredEffects.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#94A3B8]">
            No effects match your search.
          </div>
        ) : (
          filteredEffects.map((item) => (
            <div
              key={item.id}
              data-testid={`effect-item-${item.id}`}
              onDoubleClick={item.onApply}
              className="p-2 rounded-lg bg-[#1D2531]/40 hover:bg-[#1D2531] border border-transparent hover:border-[#2A3341] flex items-center justify-between gap-2.5 cursor-pointer transition-colors group"
              title="Double-click to apply to selected clip, or click +"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-md bg-[#141A23] border border-[#2A3341] flex items-center justify-center shrink-0">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-medium text-[#E8EDF5] truncate">
                      {item.name}
                    </span>
                    {item.badge && (
                      <span className="text-[9px] font-mono px-1 py-0.2 bg-[#0B0F16] text-[#94A3B8] border border-[#2A3341] rounded">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#94A3B8] truncate leading-tight">
                    {item.desc}
                  </div>
                </div>
              </div>

              <button
                type="button"
                data-testid={`apply-effect-${item.id}`}
                onClick={item.onApply}
                className="w-6 h-6 rounded-md bg-[#141A23] hover:bg-[#8B82F6] hover:text-white text-[#94A3B8] border border-[#2A3341] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                title="Apply Effect"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Context Hint Footer */}
      <div className="p-2 border-t border-[#2A3341] bg-[#0B0F16]/50 flex items-center justify-between text-[10px] text-[#94A3B8] shrink-0">
        <span>Double-click or click + to apply</span>
        {selectedClip ? (
          <span className="text-[#36C6A3] truncate max-w-[140px]">
            Target: {selectedClip.name}
          </span>
        ) : (
          <span className="text-[#E8B45A]">No clip selected</span>
        )}
      </div>
    </div>
  );
};
