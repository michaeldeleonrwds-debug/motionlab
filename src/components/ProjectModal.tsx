import React, { useEffect, useState } from 'react';
import {
  X,
  Plus,
  FolderOpen,
  Copy,
  Trash2,
  Check,
  Film,
  Smartphone,
  Monitor,
  ArrowRightLeft,
  Sliders,
  LayoutGrid,
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import type { AspectRatio, FrameRate, ResolutionPreset } from '../types/editor';
import {
  SEQUENCE_TEMPLATES,
  type SequenceTemplate,
} from '../constants/sequenceTemplates';

type CategoryFilter =
  | 'all'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'broadcast'
  | 'custom';

export const ProjectModal: React.FC = () => {
  const {
    project,
    projectList,
    isProjectModalOpen,
    setProjectModalOpen,
    createNewProjectAction,
    openExistingProject,
    duplicateProjectAction,
    deleteProjectAction,
    refreshProjectList,
  } = useEditorStore();

  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<string>('ig-story-reels');

  const [newName, setNewName] = useState('New Sequence');
  const [customWidth, setCustomWidth] = useState<number>(1080);
  const [customHeight, setCustomHeight] = useState<number>(1920);
  const [newAspect, setNewAspect] = useState<AspectRatio>('9:16');
  const [newRes, setNewRes] = useState<ResolutionPreset>('1080p');
  const [newFps, setNewFps] = useState<FrameRate>(30);

  useEffect(() => {
    if (isProjectModalOpen) {
      void refreshProjectList();
    }
  }, [isProjectModalOpen, refreshProjectList]);

  if (!isProjectModalOpen) return null;

  const recalculateAspect = (w: number, h: number) => {
    if (w <= 0 || h <= 0) return;
    if (w === 1920 && h === 1080) {
      setNewAspect('16:9');
    } else if (w === 1080 && h === 1920) {
      setNewAspect('9:16');
    } else if (w === h) {
      setNewAspect('1:1');
    } else if (w === 1080 && h === 1350) {
      setNewAspect('4:5');
    } else {
      const ratio = w / h;
      if (Math.abs(ratio - 16 / 9) < 0.05) setNewAspect('16:9');
      else if (Math.abs(ratio - 9 / 16) < 0.05) setNewAspect('9:16');
      else if (Math.abs(ratio - 1) < 0.05) setNewAspect('1:1');
      else if (Math.abs(ratio - 4 / 5) < 0.05) setNewAspect('4:5');
      else setNewAspect('custom');
    }
  };

  const handleSelectTemplate = (tpl: SequenceTemplate) => {
    setSelectedTemplateId(tpl.id);
    setCustomWidth(tpl.width);
    setCustomHeight(tpl.height);
    setNewAspect(tpl.aspectRatio);
    setNewRes(tpl.resolution);
    setNewFps(tpl.defaultFps);
    if (
      !newName ||
      newName === 'New Sequence' ||
      SEQUENCE_TEMPLATES.some((t) => t.name === newName)
    ) {
      setNewName(tpl.name);
    }
  };

  const handleWidthChange = (w: number) => {
    const val = Math.max(100, Math.min(7680, w || 1080));
    setCustomWidth(val);
    recalculateAspect(val, customHeight);
    setSelectedTemplateId('custom');
  };

  const handleHeightChange = (h: number) => {
    const val = Math.max(100, Math.min(7680, h || 1920));
    setCustomHeight(val);
    recalculateAspect(customWidth, val);
    setSelectedTemplateId('custom');
  };

  const handleSwapOrientation = () => {
    const nextW = customHeight;
    const nextH = customWidth;
    setCustomWidth(nextW);
    setCustomHeight(nextH);
    recalculateAspect(nextW, nextH);
  };

  const handleSetOrientation = (orientation: 'landscape' | 'portrait') => {
    if (orientation === 'landscape' && customHeight > customWidth) {
      handleSwapOrientation();
    } else if (orientation === 'portrait' && customWidth > customHeight) {
      handleSwapOrientation();
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createNewProjectAction({
      name: newName.trim() || 'Untitled Sequence',
      aspectRatio: newAspect,
      resolution: newRes,
      fps: newFps,
      customWidth,
      customHeight,
    });
    setProjectModalOpen(false);
  };

  const filteredTemplates =
    activeCategory === 'all'
      ? SEQUENCE_TEMPLATES
      : activeCategory === 'custom'
        ? []
        : SEQUENCE_TEMPLATES.filter(
            (t) =>
              t.platform === activeCategory ||
              (activeCategory === 'tiktok' &&
                (t.platform === 'tiktok' || t.id === 'yt-shorts')) ||
              (activeCategory === 'youtube' &&
                (t.platform === 'youtube' || t.category === 'broadcast'))
          );

  const isPortrait = customHeight >= customWidth;

  // Aspect Ratio preview box aspect ratio style
  const previewRatio = Math.max(0.2, Math.min(3, customWidth / customHeight));

  return (
    <div
      data-testid="project-modal"
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 select-none backdrop-blur-xs"
    >
      <div className="w-full max-w-4xl bg-[#0d0d12] border border-[#242430] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="h-12 px-5 bg-[#111116] border-b border-[#22222c] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#5e6ad2]/20 border border-[#5e6ad2]/30 flex items-center justify-center text-[#8b93ff]">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold tracking-tight text-[#f4f4f5]">
                New Document & Sequence Manager
              </div>
              <div className="text-[10px] text-[#71717a] font-mono">
                Social presets, broadcast standards, and custom Photoshop dimensions
              </div>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-project-modal-btn"
            onClick={() => setProjectModalOpen(false)}
            className="p-1.5 text-[#71717a] hover:text-[#f4f4f5] hover:bg-[#1a1a24] rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          {/* Main New Sequence Creator */}
          <div className="bg-[#121218] border border-[#22222e] rounded-xl overflow-hidden shadow-lg">
            {/* Category Tabs */}
            <div className="px-4 pt-3 pb-2 border-b border-[#1f1f28] flex items-center gap-1.5 overflow-x-auto text-[11px] font-medium">
              {[
                { id: 'all', label: 'All Templates', icon: LayoutGrid },
                { id: 'instagram', label: 'Instagram', icon: Smartphone },
                { id: 'facebook', label: 'Facebook', icon: Smartphone },
                { id: 'tiktok', label: 'TikTok & Shorts', icon: Smartphone },
                { id: 'youtube', label: 'YouTube & Cinema', icon: Monitor },
                { id: 'custom', label: 'Custom Size', icon: Sliders },
              ].map((tab) => {
                const isActive = activeCategory === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCategory(tab.id as CategoryFilter)}
                    className={`h-7 px-3 rounded-md flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-[#5e6ad2] text-white shadow-xs'
                        : 'text-[#8e8e98] hover:text-[#f4f4f5] hover:bg-[#1a1a24]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Split Creator Layout */}
            <form onSubmit={handleCreate} className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#1f1f28]">
              {/* Left Column: Template Cards Grid */}
              <div className="lg:col-span-7 p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-[#71717a] uppercase font-semibold tracking-wider">
                  <span>
                    {activeCategory === 'custom'
                      ? 'Photoshop Custom Presets'
                      : 'Choose Preset Template'}
                  </span>
                  <span className="font-mono text-[10px] text-[#8e8e98]">
                    {activeCategory === 'custom'
                      ? 'DIRECT PX ENTRY'
                      : `${filteredTemplates.length} TEMPLATES`}
                  </span>
                </div>

                {activeCategory === 'custom' ? (
                  /* Custom Category Quick Buttons */
                  <div className="space-y-3 py-1">
                    <p className="text-xs text-[#a1a1aa] leading-relaxed">
                      Enter any custom width and height in the Preset Details panel on the right, or click a popular starting ratio below:
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { name: '1080 × 1920 (9:16 Vertical)', w: 1080, h: 1920, a: '9:16' as AspectRatio },
                        { name: '1920 × 1080 (16:9 Landscape)', w: 1920, h: 1080, a: '16:9' as AspectRatio },
                        { name: '1080 × 1080 (1:1 Square)', w: 1080, h: 1080, a: '1:1' as AspectRatio },
                        { name: '1080 × 1350 (4:5 Portrait)', w: 1080, h: 1350, a: '4:5' as AspectRatio },
                        { name: '2560 × 1080 (21:9 Ultrawide)', w: 2560, h: 1080, a: 'custom' as AspectRatio },
                        { name: '1200 × 630 (1.91:1 Link Post)', w: 1200, h: 630, a: 'custom' as AspectRatio },
                      ].map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => {
                            setCustomWidth(item.w);
                            setCustomHeight(item.h);
                            setNewAspect(item.a);
                            setSelectedTemplateId('custom');
                          }}
                          className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                            customWidth === item.w && customHeight === item.h
                              ? 'bg-[#5e6ad2]/20 border-[#5e6ad2] text-white'
                              : 'bg-[#15151c] hover:bg-[#1a1a24] border-[#252532] text-[#d4d4d8]'
                          }`}
                        >
                          <div className="font-semibold text-xs">{item.name}</div>
                          <div className="font-mono text-[10px] text-[#71717a] mt-0.5">
                            {item.w}px × {item.h}px
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Templates Grid */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[340px] overflow-y-auto pr-1">
                    {filteredTemplates.map((tpl) => {
                      const isSelected = selectedTemplateId === tpl.id;
                      return (
                        <div
                          key={tpl.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectTemplate(tpl)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSelectTemplate(tpl);
                            }
                          }}
                          className={`p-3 rounded-lg border text-left transition-all cursor-pointer select-none flex flex-col justify-between ${
                            isSelected
                              ? 'bg-[#181928] border-[#5e6ad2] shadow-sm'
                              : 'bg-[#14141b] hover:bg-[#181822] border-[#22222d]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1f1f2a] text-[#8e8e98]">
                                {tpl.tag}
                              </span>
                              {tpl.badge && (
                                <span className="text-[9px] font-bold font-mono px-1.5 py-0.2 rounded bg-[#5e6ad2]/30 text-[#a5afff]">
                                  {tpl.badge}
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-semibold text-[#f4f4f5] leading-snug">
                              {tpl.name}
                            </div>
                            <div className="text-[11px] text-[#71717a] line-clamp-1 mt-0.5">
                              {tpl.description}
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#1e1e28] text-[11px] font-mono">
                            <span className="text-[#e4e4e7] font-medium">
                              {tpl.width} × {tpl.height}
                            </span>
                            <span className="text-[#8e8e98]">{tpl.aspectRatio}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Photoshop-Style Preset Details */}
              <div className="lg:col-span-5 p-4 bg-[#101015] flex flex-col justify-between space-y-4">
                <div className="space-y-3.5">
                  <div className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider">
                    Preset Details
                  </div>

                  {/* Project Name */}
                  <div>
                    <label className="block text-[11px] text-[#8e8e98] mb-1 font-medium">
                      Sequence Name
                    </label>
                    <input
                      type="text"
                      data-testid="new-project-name-input"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full h-8 px-2.5 bg-[#09090c] border border-[#262632] rounded-md text-xs text-[#f4f4f5] focus:outline-none focus:border-[#5e6ad2]"
                      placeholder="Sequence name..."
                      required
                    />
                  </div>

                  {/* Width & Height with Orientation (Photoshop Style) */}
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-[#8e8e98] mb-1 font-medium">
                          Width (px)
                        </label>
                        <input
                          type="number"
                          data-testid="custom-width-input"
                          min={100}
                          max={7680}
                          value={customWidth}
                          onChange={(e) => handleWidthChange(Number(e.target.value))}
                          className="w-full h-8 px-2.5 bg-[#09090c] border border-[#262632] rounded-md text-xs font-mono text-[#f4f4f5] focus:outline-none focus:border-[#5e6ad2]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#8e8e98] mb-1 font-medium">
                          Height (px)
                        </label>
                        <input
                          type="number"
                          data-testid="custom-height-input"
                          min={100}
                          max={7680}
                          value={customHeight}
                          onChange={(e) => handleHeightChange(Number(e.target.value))}
                          className="w-full h-8 px-2.5 bg-[#09090c] border border-[#262632] rounded-md text-xs font-mono text-[#f4f4f5] focus:outline-none focus:border-[#5e6ad2]"
                        />
                      </div>
                    </div>

                    {/* Orientation Switcher Buttons */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-[#71717a] font-mono mr-1">Orientation:</span>
                      <button
                        type="button"
                        data-testid="orientation-portrait-btn"
                        onClick={() => handleSetOrientation('portrait')}
                        className={`h-6 px-2 text-[10px] rounded border flex items-center gap-1 transition-colors cursor-pointer ${
                          isPortrait
                            ? 'bg-[#5e6ad2]/20 border-[#5e6ad2] text-white font-medium'
                            : 'bg-[#141419] border-[#22222a] text-[#8e8e98] hover:text-[#f4f4f5]'
                        }`}
                        title="Portrait Mode"
                      >
                        <div className="w-2.5 h-3.5 border border-current rounded-xs" />
                        <span>Portrait</span>
                      </button>

                      <button
                        type="button"
                        data-testid="orientation-landscape-btn"
                        onClick={() => handleSetOrientation('landscape')}
                        className={`h-6 px-2 text-[10px] rounded border flex items-center gap-1 transition-colors cursor-pointer ${
                          !isPortrait
                            ? 'bg-[#5e6ad2]/20 border-[#5e6ad2] text-white font-medium'
                            : 'bg-[#141419] border-[#22222a] text-[#8e8e98] hover:text-[#f4f4f5]'
                        }`}
                        title="Landscape Mode"
                      >
                        <div className="w-3.5 h-2.5 border border-current rounded-xs" />
                        <span>Landscape</span>
                      </button>

                      <button
                        type="button"
                        data-testid="swap-dimensions-btn"
                        onClick={handleSwapOrientation}
                        className="h-6 px-2 text-[10px] rounded border bg-[#141419] hover:bg-[#1c1c24] border-[#22222a] text-[#8e8e98] hover:text-white flex items-center gap-1 transition-colors cursor-pointer ml-auto"
                        title="Swap Width and Height"
                      >
                        <ArrowRightLeft className="w-3 h-3 text-[#8b93ff]" />
                        <span>Swap</span>
                      </button>
                    </div>
                  </div>

                  {/* Resolution Preset & FPS */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[11px] text-[#8e8e98] mb-1 font-medium">
                        Resolution Preset
                      </label>
                      <select
                        data-testid="new-project-res-select"
                        value={newRes}
                        onChange={(e) => setNewRes(e.target.value as ResolutionPreset)}
                        className="w-full h-8 pl-2 pr-6 bg-[#09090c] border border-[#262632] rounded-md text-xs font-mono text-[#f4f4f5]"
                      >
                        <option value="1080p">1080p (Full HD)</option>
                        <option value="720p">720p (HD)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#8e8e98] mb-1 font-medium">
                        Frame Rate
                      </label>
                      <select
                        data-testid="new-project-fps-select"
                        value={newFps}
                        onChange={(e) => setNewFps(Number(e.target.value) as FrameRate)}
                        className="w-full h-8 pl-2 pr-6 bg-[#09090c] border border-[#262632] rounded-md text-xs font-mono text-[#f4f4f5]"
                      >
                        <option value={24}>24 fps (Cinema)</option>
                        <option value={30}>30 fps (Standard)</option>
                        <option value={60}>60 fps (Smooth)</option>
                      </select>
                    </div>
                  </div>

                  {/* Silhouette Visual Ratio Box */}
                  <div className="p-2.5 bg-[#0a0a0e] border border-[#1d1d26] rounded-lg flex items-center justify-between">
                    <div className="text-[11px] space-y-0.5">
                      <div className="text-[#a1a1aa] font-medium">Output Canvas</div>
                      <div className="font-mono text-[10px] text-[#8b93ff]">
                        {customWidth} × {customHeight} px ({newAspect})
                      </div>
                    </div>
                    <div className="w-12 h-10 flex items-center justify-center">
                      <div
                        className="border-2 border-[#5e6ad2] bg-[#5e6ad2]/20 rounded-xs transition-all"
                        style={{
                          width: `${Math.min(44, Math.max(14, 24 * Math.sqrt(previewRatio)))}px`,
                          height: `${Math.min(36, Math.max(14, 24 / Math.sqrt(previewRatio)))}px`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  data-testid="create-project-submit-btn"
                  className="w-full h-9 px-4 bg-[#5e6ad2] hover:bg-[#6e79de] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Project ({customWidth}×{customHeight})</span>
                </button>
              </div>
            </form>
          </div>

          {/* Saved Projects in Local IndexedDB */}
          <div className="space-y-2.5">
            <div className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider flex items-center justify-between">
              <span>Saved Projects in Local IndexedDB ({projectList.length})</span>
              <span className="text-[10px] text-[#71717a] font-mono">AUTOMATIC LOCAL PERSISTENCE</span>
            </div>

            <div className="border border-[#22222c] rounded-xl divide-y divide-[#1c1c25] bg-[#121217] overflow-hidden">
              {projectList.map((item) => {
                const isActive = item.id === project.id;
                return (
                  <div
                    key={item.id}
                    data-testid={`project-row-${item.id}`}
                    className={`p-3 flex items-center justify-between text-xs transition-colors ${
                      isActive ? 'bg-[#191a26]' : 'hover:bg-[#16161d]'
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#f4f4f5] truncate">
                          {item.name}
                        </span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#5e6ad2] text-white rounded flex items-center gap-1 shrink-0">
                            <Check className="w-2.5 h-2.5" /> Active
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-[#71717a]">
                        {item.aspectRatio} • {item.resolution} • {item.fps}fps •{' '}
                        {item.clipCount} clips • {item.assetCount} assets
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isActive && (
                        <button
                          type="button"
                          data-testid={`open-project-btn-${item.id}`}
                          onClick={async () => {
                            await openExistingProject(item.id);
                            setProjectModalOpen(false);
                          }}
                          className="h-7 px-2.5 bg-[#191922] hover:bg-[#22222e] border border-[#282836] text-[#e4e4e7] rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <FolderOpen className="w-3 h-3 text-[#8b93ff]" />
                          <span>Open</span>
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid={`duplicate-project-btn-${item.id}`}
                        onClick={() => void duplicateProjectAction(item.id)}
                        className="h-7 px-2.5 bg-[#191922] hover:bg-[#22222e] border border-[#282836] text-[#d4d4d8] rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                        title="Duplicate Project"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Duplicate</span>
                      </button>
                      <button
                        type="button"
                        data-testid={`delete-project-btn-${item.id}`}
                        onClick={() => void deleteProjectAction(item.id)}
                        className="h-7 px-2 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 text-rose-300 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                        title="Delete Project"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
