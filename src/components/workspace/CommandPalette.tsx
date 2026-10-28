import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Sparkles,
  Layers,
  Palette,
  Volume2,
  Film,
  Scissors,
  Download,
  Save,
  RotateCcw,
  RotateCw,
  Plus,
  Tv,
  Zap,
} from 'lucide-react';
import { useWorkspaceStore, type WorkspaceId } from '../../store/useWorkspaceStore';
import { useEditorStore } from '../../store/useEditorStore';

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Workspace' | 'Action' | 'Effects' | 'Format';
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
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

export const CommandPalette: React.FC = () => {
  const isCommandPaletteOpen = useWorkspaceStore((s) => s.isCommandPaletteOpen);
  const setCommandPaletteOpen = useWorkspaceStore((s) => s.setCommandPaletteOpen);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);

  const {
    saveCurrentProject,
    setExportModalOpen,
    setProjectModalOpen,
    togglePlayPause,
    undo,
    redo,
    splitSelectedClipAtPlayhead,
    deleteClip,
    setProjectFormat,
    addTextClipToTimeline,
    selectedClipId,
    project,
  } = useEditorStore();

  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  const commands: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      // Workspaces
      {
        id: 'ws-edit',
        title: 'Switch to Edit Workspace',
        subtitle: 'Main timeline, media bin, program monitor & inspector',
        category: 'Workspace',
        shortcut: 'Alt+1',
        icon: <Film className="w-4 h-4 text-[#8B82F6]" />,
        action: () => setActiveWorkspace('edit'),
      },
      {
        id: 'ws-motion',
        title: 'Switch to Motion Graphics Workspace',
        subtitle: 'Kinetic typography, shape animations & keyframe curves',
        category: 'Workspace',
        shortcut: 'Alt+2',
        icon: <Zap className="w-4 h-4 text-[#38BDF8]" />,
        action: () => setActiveWorkspace('motion'),
      },
      {
        id: 'ws-color',
        title: 'Switch to Color Grading Workspace',
        subtitle: 'Video FX, 3D LUTs, Color Wheels, Waveform & Vectorscope',
        category: 'Workspace',
        shortcut: 'Alt+3',
        icon: <Palette className="w-4 h-4 text-[#F43F5E]" />,
        action: () => setActiveWorkspace('color'),
      },
      {
        id: 'ws-audio',
        title: 'Switch to Audio & Sound FX Workspace',
        subtitle: 'Voice Studio neural TTS, Soundbox SFX, Audio DSP & Multitrack',
        category: 'Workspace',
        shortcut: 'Alt+4',
        icon: <Volume2 className="w-4 h-4 text-[#10B981]" />,
        action: () => setActiveWorkspace('audio'),
      },
      {
        id: 'ws-ai',
        title: 'Switch to AI Copilot & Memory Workspace',
        subtitle: 'MCIE Creative Director, Obsidian Memory Vault & MCP Tools',
        category: 'Workspace',
        shortcut: 'Alt+5',
        icon: <Sparkles className="w-4 h-4 text-[#A855F7]" />,
        action: () => setActiveWorkspace('ai'),
      },

      // Project Actions
      {
        id: 'act-save',
        title: 'Save Project',
        subtitle: 'Save current sequence & clips to IndexedDB',
        category: 'Action',
        shortcut: 'Ctrl+S',
        icon: <Save className="w-4 h-4 text-[#36C6A3]" />,
        action: () => void saveCurrentProject(),
      },
      {
        id: 'act-export',
        title: 'Export Video MP4',
        subtitle: 'Open high-speed FFmpeg master render dialog',
        category: 'Action',
        shortcut: 'Ctrl+E',
        icon: <Download className="w-4 h-4 text-[#8B82F6]" />,
        action: () => setExportModalOpen(true),
      },
      {
        id: 'act-play',
        title: 'Play / Pause',
        subtitle: 'Toggle timeline preview playback',
        category: 'Action',
        shortcut: 'Space',
        icon: <Film className="w-4 h-4 text-[#E8EDF5]" />,
        action: () => togglePlayPause(),
      },
      {
        id: 'act-split',
        title: 'Split Clip at Playhead',
        subtitle: 'Cut currently selected clip at cursor position',
        category: 'Action',
        shortcut: 'S',
        icon: <Scissors className="w-4 h-4 text-[#E8B45A]" />,
        action: () => splitSelectedClipAtPlayhead(),
      },
      {
        id: 'act-delete',
        title: 'Delete Selected Clip',
        subtitle: 'Remove active clip from timeline',
        category: 'Action',
        shortcut: 'Del',
        icon: <RotateCcw className="w-4 h-4 text-[#EF4444]" />,
        action: () => deleteClip(),
      },
      {
        id: 'act-undo',
        title: 'Undo',
        subtitle: 'Revert last timeline or property edit',
        category: 'Action',
        shortcut: 'Ctrl+Z',
        icon: <RotateCcw className="w-4 h-4 text-[#94A3B8]" />,
        action: () => undo(),
      },
      {
        id: 'act-redo',
        title: 'Redo',
        subtitle: 'Re-apply reverted edit',
        category: 'Action',
        shortcut: 'Ctrl+Shift+Z',
        icon: <RotateCw className="w-4 h-4 text-[#94A3B8]" />,
        action: () => redo(),
      },
      {
        id: 'act-text',
        title: 'Add New Text Layer',
        subtitle: 'Insert editable kinetic text at current playhead',
        category: 'Action',
        shortcut: 'T',
        icon: <Plus className="w-4 h-4 text-[#8B82F6]" />,
        action: () =>
          addTextClipToTimeline('Title Heading', {
            fontSize: 64,
            fontWeight: 800,
            color: '#FFFFFF',
          }),
      },
      {
        id: 'act-projects',
        title: 'Open Project Manager',
        subtitle: 'Switch, create, duplicate, or inspect sequences',
        category: 'Action',
        shortcut: 'P',
        icon: <Layers className="w-4 h-4 text-[#38BDF8]" />,
        action: () => setProjectModalOpen(true),
      },

      // Aspect Ratios
      {
        id: 'fmt-16-9',
        title: 'Set Format: 16:9 Landscape (1920×1080)',
        subtitle: 'YouTube, presentation, desktop film format',
        category: 'Format',
        icon: <Tv className="w-4 h-4 text-[#94A3B8]" />,
        action: () => setProjectFormat({ aspectRatio: '16:9' }),
      },
      {
        id: 'fmt-9-16',
        title: 'Set Format: 9:16 Vertical (1080×1920)',
        subtitle: 'TikTok, Instagram Reels, YouTube Shorts format',
        category: 'Format',
        icon: <Tv className="w-4 h-4 text-[#94A3B8]" />,
        action: () => setProjectFormat({ aspectRatio: '9:16' }),
      },
      {
        id: 'fmt-1-1',
        title: 'Set Format: 1:1 Square (1080×1080)',
        subtitle: 'Instagram Feed, LinkedIn square video',
        category: 'Format',
        icon: <Tv className="w-4 h-4 text-[#94A3B8]" />,
        action: () => setProjectFormat({ aspectRatio: '1:1' }),
      },

      // Effects & Color LUTs
      {
        id: 'fx-lut-warm',
        title: 'Apply LUT: Cinematic Warm Golden',
        subtitle: 'Warm rich film contrast and golden skin tones',
        category: 'Effects',
        icon: <Palette className="w-4 h-4 text-[#F59E0B]" />,
        action: () => {
          setActiveWorkspace('color');
          applyLutToSelectedClip('/luts/cinematic_warm.cube', 'Cinematic Warm');
        },
      },
      {
        id: 'fx-lut-cyberpunk',
        title: 'Apply LUT: Cyberpunk Teal & Orange Neon',
        subtitle: 'High contrast cyan shadows and neon amber highlights',
        category: 'Effects',
        icon: <Palette className="w-4 h-4 text-[#06B6D4]" />,
        action: () => {
          setActiveWorkspace('color');
          applyLutToSelectedClip('/luts/cyberpunk_neon.cube', 'Cyberpunk Neon');
        },
      },
      {
        id: 'fx-lut-bw',
        title: 'Apply LUT: Film Noir High-Contrast B&W',
        subtitle: 'Punchy monochrome with rich silver midtones',
        category: 'Effects',
        icon: <Palette className="w-4 h-4 text-[#94A3B8]" />,
        action: () => {
          setActiveWorkspace('color');
          applyLutToSelectedClip('/luts/film_noir_bw.cube', 'Film Noir B&W');
        },
      },
      {
        id: 'fx-bloom',
        title: 'Apply Effect: Dreamy Anamorphic Bloom',
        subtitle: 'Soft highlight glow and diffusion',
        category: 'Effects',
        icon: <Tv className="w-4 h-4 text-[#8B82F6]" />,
        action: () => {
          if (selectedClipId) {
            applyVideoEffectToClip(selectedClipId, {
              id: `fx-bloom-${Date.now().toString(36)}`,
              type: 'bloom',
              name: 'Anamorphic Bloom',
              enabled: true,
              params: { threshold: 0.8, intensity: 0.5, radius: 14 },
            });
          }
        },
      },
      {
        id: 'fx-grain',
        title: 'Apply Effect: 35mm Analog Film Grain',
        subtitle: 'Fine organic silver halide film texture',
        category: 'Effects',
        icon: <Film className="w-4 h-4 text-[#E8B45A]" />,
        action: () => {
          if (selectedClipId) {
            applyVideoEffectToClip(selectedClipId, {
              id: `fx-grain-${Date.now().toString(36)}`,
              type: 'film-grain',
              name: '35mm Film Grain',
              enabled: true,
              params: { intensity: 0.45, size: 1.5, monochrome: true },
            });
          }
        },
      },
      {
        id: 'fx-chromatic',
        title: 'Apply Effect: Chromatic Aberration',
        subtitle: 'Color fringe lens displacement distortion',
        category: 'Effects',
        icon: <Zap className="w-4 h-4 text-[#EC4899]" />,
        action: () => {
          if (selectedClipId) {
            applyVideoEffectToClip(selectedClipId, {
              id: `fx-chromatic-${Date.now().toString(36)}`,
              type: 'chromatic-aberration',
              name: 'Chromatic Aberration',
              enabled: true,
              params: { offsetPx: 4, angleDeg: 45 },
            });
          }
        },
      },
    ];

    return list;
  }, [
    setActiveWorkspace,
    saveCurrentProject,
    setExportModalOpen,
    setProjectModalOpen,
    togglePlayPause,
    splitSelectedClipAtPlayhead,
    deleteClip,
    undo,
    redo,
    addTextClipToTimeline,
    setProjectFormat,
    selectedClipId,
  ]);

  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;
    const query = search.toLowerCase();
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.subtitle.toLowerCase().includes(query) ||
        c.category.toLowerCase().includes(query)
    );
  }, [commands, search]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredCommands.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCommands.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        setCommandPaletteOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setCommandPaletteOpen(false);
    }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div
      data-testid="command-palette-backdrop"
      onClick={() => setCommandPaletteOpen(false)}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-24 select-none animate-in fade-in duration-100"
    >
      <div
        data-testid="command-palette-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[580px] bg-[#141A23] border border-[#2A3341] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#E8EDF5]"
      >
        {/* Search Input Bar */}
        <div className="h-12 border-b border-[#2A3341] px-4 flex items-center gap-3 bg-[#0B0F16]/50">
          <Search className="w-4 h-4 text-[#94A3B8] shrink-0" />
          <input
            ref={inputRef}
            data-testid="command-palette-input"
            type="text"
            placeholder="Type a command, workspace, tool, or effect... (Esc to close)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-[#E8EDF5] placeholder-[#94A3B8]/60 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[#1D2531] border border-[#2A3341] rounded text-[#94A3B8]">
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <div className="max-h-[380px] overflow-y-auto p-1.5 space-y-0.5">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#94A3B8]">
              No matching commands or effects found for "{search}"
            </div>
          ) : (
            filteredCommands.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  data-testid={`command-item-${item.id}`}
                  onClick={() => {
                    item.action();
                    setCommandPaletteOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2 rounded-lg flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#8B82F6]/15 border border-[#8B82F6]/40 text-[#FFFFFF]'
                      : 'border border-transparent hover:bg-[#1D2531]/70 text-[#E8EDF5]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-[#8B82F6]/30 text-[#FFFFFF]'
                          : 'bg-[#1D2531] text-[#94A3B8]'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium truncate flex items-center gap-1.5">
                        <span>{item.title}</span>
                        <span className="text-[10px] font-normal px-1 py-0.2 bg-[#0B0F16] border border-[#2A3341] rounded text-[#94A3B8]">
                          {item.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#94A3B8] truncate">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  {item.shortcut && (
                    <kbd className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono bg-[#0B0F16] border border-[#2A3341] rounded text-[#94A3B8]">
                      {item.shortcut}
                    </kbd>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="h-8 border-t border-[#2A3341] px-3.5 flex items-center justify-between text-[11px] text-[#94A3B8] bg-[#0B0F16]/40">
          <div className="flex items-center gap-2">
            <span>
              <kbd className="px-1 py-0.2 bg-[#1D2531] rounded text-[10px]">↑</kbd>
              <kbd className="px-1 py-0.2 bg-[#1D2531] rounded text-[10px] ml-0.5">↓</kbd> navigate
            </span>
            <span>•</span>
            <span>
              <kbd className="px-1 py-0.2 bg-[#1D2531] rounded text-[10px]">↵</kbd> select
            </span>
          </div>
          <span className="text-[10px] font-mono">MotionLab 4.0 Command Engine</span>
        </div>
      </div>
    </div>
  );
};
