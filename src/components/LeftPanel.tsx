import React, { useRef, useState } from 'react';
import {
  FolderOpen,
  Type,
  Music,
  Sparkles,
  Sliders,
  Layers,
  Upload,
  Plus,
  Trash2,
  AlertTriangle,
  X,
  Play,
  Pause,
  Film,
  Image as ImageIcon,
  Wand2,
  ArrowRightLeft,
  Loader2,
  FolderKanban,
  Mic,
  Volume2,
  Search,
} from 'lucide-react';
import { useEditorStore, type LeftSidebarTab } from '../store/useEditorStore';
import { importMediaFile } from '../engine/mediaImportEngine';
import type { MediaAsset, TextStyle, TransitionType } from '../types/editor';
import { createDefaultColorEffects } from '../engine/projectFactory';
import { VoiceStudioPanel } from '../voicebox/VoiceStudioPanel';
import { SoundFxStudioPanel } from '../sfx/SoundFxStudioPanel';
import { VideoFxStudioPanel } from './VideoFxStudioPanel';

const NAV_ITEMS: {
  id: LeftSidebarTab;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'media', label: 'Media', icon: FolderOpen },
  { id: 'text', label: 'Titles', icon: Type },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'sfx', label: 'SFX', icon: Volume2 },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'transitions', label: 'Moves', icon: ArrowRightLeft },
  { id: 'effects', label: 'FX', icon: Wand2 },
  { id: 'filters', label: 'Color', icon: Sliders },
  { id: 'ai-mcp', label: 'Copilot', icon: Sparkles },
  { id: 'projects', label: 'Bins', icon: FolderKanban },
];

const TEXT_PRESETS: {
  id: string;
  title: string;
  subtitle: string;
  sampleContent: string;
  style: Partial<TextStyle>;
}[] = [
  {
    id: 'headline-fade',
    title: 'Studio Headline',
    subtitle: 'Fade In/Out • 68pt Bold',
    sampleContent: 'STUDIO MASTER',
    style: {
      fontSize: 68,
      fontWeight: 700,
      color: '#ffffff',
      backgroundColor: '#000000',
      backgroundOpacity: 0.45,
      animationIn: 'fade-in',
      animationOut: 'fade-out',
      animationDuration: 0.5,
    },
  },
  {
    id: 'lower-third-slide',
    title: 'Broadcast Lower Third',
    subtitle: 'Slide In/Out • Plate',
    sampleContent: 'DIRECTOR CUT • SCENE 01',
    style: {
      fontSize: 44,
      fontWeight: 600,
      color: '#f8fafc',
      align: 'center',
      backgroundColor: '#1e3a8a',
      backgroundOpacity: 0.85,
      animationIn: 'slide-in',
      animationOut: 'slide-out',
      animationDuration: 0.55,
    },
  },
  {
    id: 'kinetic-zoom',
    title: 'Kinetic Impact Title',
    subtitle: 'Zoom In • Stroke Outline',
    sampleContent: 'BREAKING HORIZON',
    style: {
      fontSize: 78,
      fontWeight: 800,
      color: '#38bdf8',
      backgroundColor: '#000000',
      backgroundOpacity: 0,
      strokeColor: '#0f172a',
      strokeWidth: 4,
      shadowColor: '#000000',
      shadowBlur: 12,
      animationIn: 'zoom-in',
      animationOut: 'fade-out',
      animationDuration: 0.5,
    },
  },
  {
    id: 'doc-typewriter',
    title: 'Documentary Typewriter',
    subtitle: 'Character Reveal • Mono',
    sampleContent: 'OCTOBER 27 // LOCATION LOG',
    style: {
      fontFamily: 'JetBrains Mono',
      fontSize: 46,
      fontWeight: 600,
      color: '#e2e8f0',
      backgroundColor: '#090d16',
      backgroundOpacity: 0.78,
      animationIn: 'typewriter',
      animationOut: 'fade-out',
      animationDuration: 0.9,
    },
  },
];

const TRANSITION_ITEMS: {
  type: TransitionType;
  name: string;
  desc: string;
}[] = [
  {
    type: 'cross-dissolve',
    name: 'Cross Dissolve',
    desc: 'Smooth opacity blend between adjacent clips',
  },
  {
    type: 'fade-from-black',
    name: 'Fade from Black',
    desc: 'Gradually dip in from studio black at start',
  },
  {
    type: 'fade-to-black',
    name: 'Fade to Black',
    desc: 'Gradually dip out to studio black at end',
  },
  {
    type: 'slide-left',
    name: 'Slide Push',
    desc: 'Incoming clip slides horizontally across frame',
  },
  {
    type: 'wipe-right',
    name: 'Linear Wipe',
    desc: 'Geometric hard wipe reveal left to right',
  },
];

export const LeftPanel: React.FC = () => {
  const {
    project,
    activeLeftTab,
    isAiDrawerOpen,
    setActiveLeftTab,
    toggleAiDrawer,
    addMediaAssets,
    removeMediaAsset,
    addMediaClipToTimeline,
    addTextClipToTimeline,
    selectedClipId,
    setClipTransition,
    updateClipColorEffects,
    importError,
    setImportError,
    isImporting,
    setIsImporting,
    setProjectModalOpen,
  } = useEditorStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'video' | 'audio' | 'image'>('all');
  const [mediaSearchQuery, setMediaSearchQuery] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [customTitleText, setCustomTitleText] = useState('MOTIONLAB 1080P');
  const [transitionDuration, setTransitionDuration] = useState(0.6);

  // Playable media audition preview state
  const [playingAssetId, setPlayingAssetId] = useState<string | null>(null);
  const mediaPreviewAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleTogglePlayMedia = (asset: MediaAsset) => {
    if (playingAssetId === asset.id) {
      if (mediaPreviewAudioRef.current) {
        mediaPreviewAudioRef.current.pause();
      }
      setPlayingAssetId(null);
      return;
    }

    const audioUrl = asset.objectUrl || (asset.blob ? URL.createObjectURL(asset.blob) : '');
    if (!audioUrl) return;

    if (mediaPreviewAudioRef.current) {
      mediaPreviewAudioRef.current.src = audioUrl;
      mediaPreviewAudioRef.current.currentTime = 0;
      mediaPreviewAudioRef.current
        .play()
        .then(() => setPlayingAssetId(asset.id))
        .catch((err) => {
          console.warn('Media preview play error:', err);
          setPlayingAssetId(null);
        });
    }
  };

  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsImporting(true);
    setImportError(null);

    const imported: MediaAsset[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const asset = await importMediaFile(file);
        imported.push(asset);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : `Failed to import ${file.name}`);
      }
    }

    if (imported.length > 0) {
      addMediaAssets(imported);
    }
    if (errors.length > 0) {
      setImportError(errors.join(' | '));
    }
    setIsImporting(false);
  };

  const handleLoadBuiltInFixtures = async () => {
    setIsImporting(true);
    setImportError(null);
    try {
      const fixtureFiles = [
        { url: '/test-media/clip-a-studio.mp4', name: 'clip-a-studio.mp4', type: 'video/mp4' },
        { url: '/test-media/clip-b-motion.mp4', name: 'clip-b-motion.mp4', type: 'video/mp4' },
        { url: '/test-media/ambient-score.wav', name: 'ambient-score.wav', type: 'audio/wav' },
        { url: '/test-media/graphic-card.png', name: 'graphic-card.png', type: 'image/png' },
      ];
      const files: File[] = [];
      for (const item of fixtureFiles) {
        if (project.mediaAssets.some((a) => a.name === item.name)) continue;
        const res = await fetch(item.url);
        if (!res.ok) continue;
        const blob = await res.blob();
        files.push(new File([blob], item.name, { type: item.type }));
      }
      if (files.length > 0) {
        await handleFilesSelected(files);
      }
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Failed to load local studio fixtures'
      );
    } finally {
      setIsImporting(false);
    }
  };

  const applyTransitionToTarget = (type: TransitionType) => {
    const edge = type === 'fade-to-black' ? 'out' : 'in';
    if (selectedClipId) {
      setClipTransition(selectedClipId, edge, {
        type,
        duration: transitionDuration,
      });
      return;
    }
    const videoClips = project.clips
      .filter((c) => c.type === 'video' || c.type === 'image')
      .sort((a, b) => a.startTime - b.startTime);

    if (videoClips.length >= 2 && edge === 'in') {
      setClipTransition(videoClips[1].id, 'in', {
        type,
        duration: transitionDuration,
      });
    } else if (videoClips.length >= 1) {
      setClipTransition(videoClips[0].id, edge, {
        type,
        duration: transitionDuration,
      });
    }
  };

  const filteredAssets = project.mediaAssets.filter((asset) => {
    if (mediaFilter !== 'all' && asset.type !== mediaFilter) {
      return false;
    }
    if (mediaSearchQuery.trim()) {
      const q = mediaSearchQuery.toLowerCase().trim();
      const matchName = asset.name.toLowerCase().includes(q);
      const matchCodec = asset.codecInfo?.toLowerCase().includes(q);
      const matchMime = asset.mimeType?.toLowerCase().includes(q);
      if (!matchName && !matchCodec && !matchMime) {
        return false;
      }
    }
    return true;
  });

  return (
    <aside className={`${activeLeftTab === 'voice' || activeLeftTab === 'sfx' || activeLeftTab === 'filters' ? 'w-[420px]' : 'w-[336px]'} bg-[#0c0c10] border-r border-[#1f1f26] flex shrink-0 select-none h-full overflow-hidden transition-all duration-150`}>
      {/* Minimalist Linear Vertical Icon Dock */}
      <nav className="w-13 bg-[#09090c] border-r border-[#1f1f26] flex flex-col items-center py-2.5 gap-1 shrink-0">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            item.id === 'ai-mcp' ? isAiDrawerOpen : activeLeftTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`left-tab-${item.id}`}
              onClick={() => {
                if (item.id === 'ai-mcp') {
                  toggleAiDrawer();
                } else {
                  setActiveLeftTab(item.id);
                }
              }}
              className={`w-10 py-1.5 rounded-md flex flex-col items-center gap-1 text-[9px] font-medium transition-all cursor-pointer relative ${
                active
                  ? 'bg-[#181822] text-[#f4f4f5]'
                  : 'text-[#71717a] hover:text-[#d4d4d8] hover:bg-[#131319]'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-[#5e6ad2] rounded-r" />
              )}
              <Icon
                className={`w-4 h-4 ${
                  active ? 'text-[#8b93ff]' : 'text-current'
                }`}
              />
              <span className="whitespace-nowrap tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Active Bin Content Column */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Hidden Multi-file Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          data-testid="media-file-input"
          accept=".mp4,.webm,.mov,.mp3,.wav,.png,.jpg,.jpeg,.webp,video/*,audio/*,image/*"
          onChange={(e) => {
            if (e.target.files) {
              void handleFilesSelected(e.target.files);
              e.target.value = '';
            }
          }}
          className="hidden"
        />
        {/* Hidden preview audio element */}
        <audio
          ref={mediaPreviewAudioRef}
          onEnded={() => setPlayingAssetId(null)}
          onError={() => setPlayingAssetId(null)}
        />

        {/* TAB 1: MEDIA LIBRARY */}
        {activeLeftTab === 'media' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden p-3 gap-2.5">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-semibold tracking-tight text-[#f4f4f5] whitespace-nowrap">
                Media Bin{' '}
                <span className="text-[#71717a] font-mono text-[11px] font-normal">
                  ({project.mediaAssets.length})
                </span>
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  data-testid="load-sample-media-btn"
                  onClick={() => void handleLoadBuiltInFixtures()}
                  disabled={isImporting}
                  className="h-6 px-2 bg-[#14141b] hover:bg-[#1d1d27] border border-[#262632] rounded-md text-[10px] font-medium text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors whitespace-nowrap cursor-pointer"
                  title="Import locally generated studio test media"
                >
                  + Studio Media
                </button>
                <button
                  type="button"
                  data-testid="import-media-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="h-6 px-2.5 bg-[#5e6ad2] hover:bg-[#6e79de] text-white rounded-md text-[10px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Upload className="w-3 h-3" />
                  <span>Import</span>
                </button>
              </div>
            </div>

            {/* Codec / Import Error Banner */}
            {importError && (
              <div
                data-testid="import-error-banner"
                className="p-2.5 bg-rose-950/40 border border-rose-500/40 rounded-md text-[11px] text-rose-200 flex items-start justify-between gap-2"
              >
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{importError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setImportError(null)}
                  className="text-rose-300 hover:text-white shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Drag and Drop Zone */}
            <div
              data-testid="media-dropzone"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                if (e.dataTransfer.files?.length) {
                  void handleFilesSelected(e.dataTransfer.files);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-lg p-2.5 text-center cursor-pointer transition-all ${
                isDraggingOver
                  ? 'border-[#5e6ad2] bg-[#5e6ad2]/10'
                  : 'border-[#24242f] bg-[#111116] hover:border-[#343444] hover:bg-[#14141a]'
              }`}
            >
              {isImporting ? (
                <div className="flex items-center justify-center gap-2 text-xs text-[#a5acff] py-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Probing codecs & waveforms...</span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="text-[11px] font-medium text-[#d4d4d8]">
                    Drop video, audio, or image files
                  </div>
                  <div className="text-[9px] font-mono text-[#71717a] whitespace-nowrap">
                    MP4 • WebM • MOV • MP3 • WAV • PNG • WebP
                  </div>
                </div>
              )}
            </div>

            {/* Search Input with Clear Button */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-[#71717a] pointer-events-none" />
              <input
                type="text"
                data-testid="media-search-input"
                value={mediaSearchQuery}
                onChange={(e) => setMediaSearchQuery(e.target.value)}
                placeholder="Search media by name or format..."
                className="w-full bg-[#111116] border border-[#1f1f27] focus:border-[#5e6ad2] rounded-md pl-8 pr-7 py-1 text-xs text-[#f4f4f5] placeholder-[#52525b] outline-none transition-colors"
              />
              {mediaSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMediaSearchQuery('')}
                  className="absolute right-2 text-[#71717a] hover:text-[#f4f4f5] p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Segmented Filter Control */}
            <div className="grid grid-cols-4 gap-1 p-0.5 bg-[#111116] border border-[#1f1f27] rounded-md">
              {(['all', 'video', 'audio', 'image'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setMediaFilter(f)}
                  className={`h-5 text-[10px] capitalize font-medium rounded transition-colors cursor-pointer ${
                    mediaFilter === f
                      ? 'bg-[#20202b] text-[#f4f4f5] shadow-2xs'
                      : 'text-[#71717a] hover:text-[#d4d4d8]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Asset List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
              {filteredAssets.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-center px-4 text-[#63636e] text-xs">
                  <Layers className="w-5 h-5 mb-2 opacity-40" />
                  <p className="text-[#8e8e98] font-medium">No media assets yet</p>
                  <p className="text-[11px] mt-0.5 text-[#63636e]">
                    Drop files above or click &ldquo;+ Studio Media&rdquo;.
                  </p>
                </div>
              ) : (
                filteredAssets.map((asset) => (
                  <div
                    key={asset.id}
                    data-testid={`media-asset-card-${asset.name}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        'application/x-motionlab-asset',
                        asset.id
                      );
                    }}
                    className="bg-[#121217] border border-[#22222c] hover:border-[#323241] rounded-lg p-2.5 flex flex-col gap-2 group transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        onClick={(e) => {
                          if (asset.type === 'audio' || asset.type === 'video') {
                            e.stopPropagation();
                            handleTogglePlayMedia(asset);
                          }
                        }}
                        className={`w-16 h-10 bg-[#09090c] border rounded overflow-hidden shrink-0 flex items-center justify-center relative ${
                          asset.type === 'audio' || asset.type === 'video' ? 'cursor-pointer group/thumb' : ''
                        } ${
                          playingAssetId === asset.id ? 'border-emerald-500 ring-1 ring-emerald-500/50' : 'border-[#22222c]'
                        }`}
                        title={asset.type === 'audio' || asset.type === 'video' ? 'Click to preview audio' : undefined}
                      >
                        {asset.type === 'audio' ? (
                          <Music className="w-4 h-4 text-emerald-400" />
                        ) : asset.type === 'image' ? (
                          <ImageIcon className="w-4 h-4 text-sky-400" />
                        ) : (
                          <Film className="w-4 h-4 text-[#8b93ff]" />
                        )}
                        {asset.thumbnails[0] && (
                          <img
                            src={asset.thumbnails[0]}
                            alt=""
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        )}
                        {(asset.type === 'audio' || asset.type === 'video') && (
                          <div
                            className={`absolute inset-0 bg-black/45 flex items-center justify-center transition-opacity ${
                              playingAssetId === asset.id ? 'opacity-100' : 'opacity-0 group-hover/thumb:opacity-100'
                            }`}
                          >
                            {playingAssetId === asset.id ? (
                              <Pause className="w-4 h-4 text-emerald-400 fill-current" />
                            ) : (
                              <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                            )}
                          </div>
                        )}
                        <span className="absolute bottom-0.5 right-0.5 px-1 py-0 bg-black/80 text-[9px] font-mono text-[#e4e4e7] rounded-xs">
                          {asset.duration.toFixed(1)}s
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div
                          className="text-xs font-medium text-[#f4f4f5] truncate"
                          title={asset.name}
                        >
                          {asset.name}
                        </div>
                        <div className="text-[10px] font-mono text-[#71717a] truncate mt-0.5">
                          {asset.codecInfo}
                        </div>
                      </div>
                    </div>

                    {asset.waveform.length > 0 && (
                      <div className="h-3.5 bg-[#0a0a0e] px-1 flex items-end gap-[1px] rounded overflow-hidden">
                        {asset.waveform.slice(0, 48).map((peak, idx) => (
                          <div
                            key={idx}
                            style={{ height: `${Math.max(15, peak * 100)}%` }}
                            className={`flex-1 rounded-t-xs ${
                              asset.type === 'audio'
                                ? 'bg-emerald-500/70'
                                : 'bg-[#7c86ff]/60'
                            }`}
                          />
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-0.5 gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <button
                          type="button"
                          data-testid={`add-asset-btn-${asset.name}`}
                          onClick={() => addMediaClipToTimeline(asset.id)}
                          className="h-6 px-2.5 bg-[#191922] hover:bg-[#5e6ad2] border border-[#282836] hover:border-[#5e6ad2] text-[#e4e4e7] hover:text-white rounded-md text-[10px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add to Timeline</span>
                        </button>

                        {(asset.type === 'audio' || asset.type === 'video') && (
                          <button
                            type="button"
                            data-testid={`preview-asset-btn-${asset.name}`}
                            onClick={() => handleTogglePlayMedia(asset)}
                            className={`h-6 px-2 rounded-md text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer border ${
                              playingAssetId === asset.id
                                ? 'bg-emerald-500 text-black border-emerald-500 hover:bg-emerald-400 font-semibold'
                                : 'bg-[#191922] hover:bg-[#252532] border-[#282836] text-[#e4e4e7] hover:text-white'
                            }`}
                            title={playingAssetId === asset.id ? 'Pause preview' : 'Play / audition media'}
                          >
                            {playingAssetId === asset.id ? (
                              <>
                                <Pause className="w-3 h-3 fill-current" />
                                <span>Pause</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 fill-current ml-0.5" />
                                <span>Play</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        data-testid={`delete-asset-btn-${asset.name}`}
                        onClick={() => {
                          if (playingAssetId === asset.id && mediaPreviewAudioRef.current) {
                            mediaPreviewAudioRef.current.pause();
                            setPlayingAssetId(null);
                          }
                          removeMediaAsset(asset.id);
                        }}
                        className="h-6 w-6 flex items-center justify-center text-[#63636e] hover:text-rose-400 rounded transition-colors cursor-pointer shrink-0"
                        title="Remove from project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TEXT & ANIMATED TITLES */}
        {activeLeftTab === 'text' && (
          <div className="flex-1 flex flex-col h-full overflow-y-auto p-3 space-y-3">
            <div className="text-xs font-semibold tracking-tight text-[#f4f4f5]">
              Text & Motion Titles
            </div>

            <div className="bg-[#121217] border border-[#22222c] p-3 rounded-lg space-y-2.5">
              <label className="block text-[11px] font-medium text-[#8e8e98]">
                Custom Title Content
              </label>
              <input
                type="text"
                data-testid="custom-text-input"
                value={customTitleText}
                onChange={(e) => setCustomTitleText(e.target.value)}
                className="w-full h-7 px-2.5 bg-[#09090c] border border-[#262632] rounded-md text-xs text-white focus:outline-none focus:border-[#5e6ad2]"
                placeholder="Enter title text..."
              />
              <button
                type="button"
                data-testid="add-text-clip-btn"
                onClick={() =>
                  addTextClipToTimeline(customTitleText || 'MotionLab Title')
                }
                className="w-full h-7 bg-[#5e6ad2] hover:bg-[#6e79de] text-white text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Animated Text Layer</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-[#71717a] uppercase tracking-wider">
                Broadcast Motion Presets
              </div>
              {TEXT_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className="bg-[#121217] border border-[#22222c] hover:border-[#323241] p-2.5 rounded-lg flex items-center justify-between gap-2 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#f4f4f5] truncate">
                      {preset.title}
                    </div>
                    <div className="text-[10px] font-mono text-[#71717a] truncate">
                      {preset.subtitle}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid={`add-text-preset-${preset.id}`}
                    onClick={() =>
                      addTextClipToTimeline(
                        customTitleText.trim() || preset.sampleContent,
                        preset.style
                      )
                    }
                    className="h-7 px-2.5 bg-[#191922] hover:bg-[#5e6ad2] border border-[#282836] hover:border-[#5e6ad2] text-xs text-white rounded-md shrink-0 flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: AUDIO */}
        {activeLeftTab === 'audio' && (
          <div className="flex-1 flex flex-col h-full overflow-y-auto p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-tight text-[#f4f4f5]">
                Audio & Score
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-6 px-2.5 bg-[#5e6ad2] hover:bg-[#6e79de] text-white rounded-md text-[11px] font-medium flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>Import Audio</span>
              </button>
            </div>

            {project.mediaAssets.filter((a) => a.type === 'audio').length === 0 ? (
              <div className="p-4 bg-[#121217] border border-[#22222c] rounded-lg text-center space-y-2.5">
                <Music className="w-5 h-5 text-emerald-400 mx-auto" />
                <div className="text-xs text-[#a1a1aa]">
                  No standalone audio files imported yet.
                </div>
                <button
                  type="button"
                  onClick={() => void handleLoadBuiltInFixtures()}
                  className="h-7 px-3 bg-[#191922] hover:bg-[#22222e] border border-[#2a2a38] text-xs text-[#d4d4d8] rounded-md cursor-pointer"
                >
                  Load Studio Ambient Score (.WAV)
                </button>
              </div>
            ) : (
              project.mediaAssets
                .filter((a) => a.type === 'audio')
                .map((asset) => (
                  <div
                    key={asset.id}
                    className="bg-[#121217] border border-[#22222c] p-2.5 rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#f4f4f5] truncate">
                          {asset.name}
                        </div>
                        <div className="text-[10px] font-mono text-[#71717a] truncate">
                          {asset.duration.toFixed(2)}s • {asset.codecInfo}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          data-testid={`preview-audio-${asset.name}`}
                          onClick={() => handleTogglePlayMedia(asset)}
                          className={`h-7 px-2.5 text-xs font-medium rounded-md flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer transition border ${
                            playingAssetId === asset.id
                              ? 'bg-emerald-500 text-black border-emerald-500 hover:bg-emerald-400 font-semibold shadow-sm'
                              : 'bg-[#191922] hover:bg-[#252532] border-[#2a2a38] text-[#d4d4d8] hover:text-white'
                          }`}
                          title={playingAssetId === asset.id ? 'Pause preview' : 'Play audio preview'}
                        >
                          {playingAssetId === asset.id ? (
                            <>
                              <Pause className="w-3 h-3 fill-current" />
                              <span>Pause</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 fill-current ml-0.5" />
                              <span>Play</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          data-testid={`add-audio-asset-${asset.name}`}
                          onClick={() => addMediaClipToTimeline(asset.id)}
                          className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-md flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add to A1</span>
                        </button>
                      </div>
                    </div>
                    {asset.waveform.length > 0 && (
                      <div className="h-5 bg-[#09090c] p-1 flex items-end gap-[1px] rounded">
                        {asset.waveform.slice(0, 56).map((p, i) => (
                          <div
                            key={i}
                            style={{ height: `${Math.max(15, p * 100)}%` }}
                            className="flex-1 bg-emerald-500/80 rounded-t-xs"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        )}

        {/* TAB 4: TRANSITIONS */}
        {activeLeftTab === 'transitions' && (
          <div className="flex-1 flex flex-col h-full overflow-y-auto p-3 space-y-3">
            <div className="text-xs font-semibold tracking-tight text-[#f4f4f5]">
              Video Transitions
            </div>

            <div className="bg-[#121217] border border-[#22222c] p-3 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#8e8e98]">Transition Duration</span>
                <span className="font-mono text-[#f4f4f5]">
                  {transitionDuration.toFixed(2)}s
                </span>
              </div>
              <input
                type="range"
                data-testid="transition-duration-slider"
                min={0.2}
                max={2.0}
                step={0.1}
                value={transitionDuration}
                onChange={(e) => setTransitionDuration(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              {TRANSITION_ITEMS.map((item) => (
                <div
                  key={item.type}
                  className="bg-[#121217] border border-[#22222c] hover:border-[#323241] p-2.5 rounded-lg flex items-center justify-between gap-2 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#f4f4f5]">
                      {item.name}
                    </div>
                    <div className="text-[10px] text-[#71717a] leading-snug">
                      {item.desc}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid={`apply-transition-${item.type}`}
                    onClick={() => applyTransitionToTarget(item.type)}
                    className="h-7 px-2.5 bg-[#191922] hover:bg-[#5e6ad2] border border-[#282836] hover:border-[#5e6ad2] text-white text-xs font-medium rounded-md shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: EFFECTS */}
        {activeLeftTab === 'effects' && (
          <div className="flex-1 flex flex-col h-full overflow-y-auto p-3 space-y-3">
            <div className="text-xs font-semibold tracking-tight text-[#f4f4f5]">
              Optical & Motion Effects
            </div>
            {!selectedClipId && (
              <div className="text-[11px] text-amber-300 bg-amber-950/30 border border-amber-700/40 p-2.5 rounded-lg">
                Select a video, image, or text clip on the timeline to apply optical effects.
              </div>
            )}
            {[
              {
                id: 'exposure-boost',
                name: 'Studio Exposure Boost',
                desc: '+28 Exposure • +12 Contrast',
                fx: { exposure: 28, contrast: 12 },
              },
              {
                id: 'gaussian-soft',
                name: 'Dreamy Gaussian Blur',
                desc: '8px Optical Blur • +15 Brightness',
                fx: { blur: 8, brightness: 15 },
              },
              {
                id: 'mirror-flip-h',
                name: 'Horizontal Mirror Flip',
                desc: 'Invert horizontal axis',
                fx: { flipH: true },
              },
              {
                id: 'reset-effects',
                name: 'Reset All Optical Effects',
                desc: 'Restore neutral optical state',
                fx: createDefaultColorEffects(),
              },
            ].map((preset) => (
              <div
                key={preset.id}
                className="bg-[#121217] border border-[#22222c] p-2.5 rounded-lg flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#f4f4f5] truncate">
                    {preset.name}
                  </div>
                  <div className="text-[10px] font-mono text-[#71717a] truncate">
                    {preset.desc}
                  </div>
                </div>
                <button
                  type="button"
                  data-testid={`apply-effect-${preset.id}`}
                  disabled={!selectedClipId}
                  onClick={() => {
                    if (selectedClipId) {
                      updateClipColorEffects(selectedClipId, preset.fx);
                    }
                  }}
                  className="h-7 px-2.5 bg-[#191922] hover:bg-[#5e6ad2] border border-[#282836] disabled:opacity-35 text-xs text-white rounded-md shrink-0 whitespace-nowrap cursor-pointer"
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        )}

        {/* TAB 6: COLOR STUDIO & VIDEO FX */}
        {activeLeftTab === 'filters' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <VideoFxStudioPanel />
          </div>
        )}

        {/* TAB 8: PROJECTS QUICK ACCESS */}
        {activeLeftTab === 'projects' && (
          <div className="flex-1 flex flex-col h-full overflow-y-auto p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-tight text-[#f4f4f5]">
                Sequence Manager
              </span>
              <button
                type="button"
                onClick={() => setProjectModalOpen(true)}
                className="h-6 px-2.5 bg-[#5e6ad2] hover:bg-[#6e79de] text-white text-[10px] font-medium rounded-md flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Full Manager</span>
              </button>
            </div>
            <div className="bg-[#121217] border border-[#22222c] p-3 rounded-lg space-y-2 text-xs">
              <div className="text-[#71717a] text-[10px] uppercase font-mono">
                Active Sequence
              </div>
              <div className="font-semibold text-[#f4f4f5] text-sm truncate">
                {project.name}
              </div>
              <div className="font-mono text-[11px] text-[#8b93ff]">
                {project.aspectRatio} • {project.resolution} • {project.fps} FPS
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  data-testid="sidebar-new-project-btn"
                  onClick={() => setProjectModalOpen(true)}
                  className="w-full h-7 bg-[#191922] hover:bg-[#22222e] border border-[#282836] text-[#e4e4e7] text-xs rounded-md cursor-pointer"
                >
                  Create / Switch Project...
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8.5: SOUND FX STUDIO */}
        {activeLeftTab === 'sfx' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <SoundFxStudioPanel />
          </div>
        )}

        {/* TAB 9: AI VOICE STUDIO */}
        {activeLeftTab === 'voice' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <VoiceStudioPanel />
          </div>
        )}
      </div>
    </aside>
  );
};
