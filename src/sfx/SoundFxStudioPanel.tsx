/**
 * MotionLab 3.0 — Sound FX Studio Panel
 * Professional UI for local Soundbox AI text-to-sound generation,
 * curated sound effect library, automated cue sheet sound designer,
 * and Web Audio DSP parameter controls.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  Sparkles,
  Music,
  FolderOpen,
  Sliders,
  Play,
  Pause,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Wand2,
  Search,
  Filter,
  Layers,
  ArrowRight,
  Disc,
} from 'lucide-react';
import { soundboxAdapter } from './SoundboxAdapter';
import {
  SoundboxConnectionStatus,
  SoundboxModel,
  SoundGenerationResult,
  SfxCategory,
  SoundLibraryItem,
  SoundDesignCue,
  AudioDspSettings,
  DEFAULT_AUDIO_DSP,
} from './types';
import {
  CURATED_SOUND_LIBRARY,
  searchSoundLibrary,
  analyzeTimelineForSoundDesign,
} from './soundLibrary';
import { useEditorStore } from '../store/useEditorStore';
import type { TimelineClip } from '../types/editor';

type SubTab = 'generator' | 'library' | 'agent' | 'dsp';

const QUICK_PROMPTS = [
  'Deep cinematic bass whoosh with air displacement',
  'Heavy cinematic sub impact with metallic decay',
  'Crisp tactile glass button tap for clean modern UI',
  'High-tech holographic telemetry scan beep',
  'Subwoofer pitch drop falling from 200Hz to 35Hz',
  'Dark analog synth pitch riser building tension',
  'Organic parchment paper rustle and fast slide',
];

export const SoundFxStudioPanel: React.FC = () => {
  const store = useEditorStore();
  const [activeTab, setActiveTab] = useState<SubTab>('generator');

  // Connection & Models
  const [status, setStatus] = useState<SoundboxConnectionStatus>({
    connected: false,
    version: 'checking...',
  });
  const [models, setModels] = useState<SoundboxModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('audiocraft-small');

  // AI Generator state
  const [prompt, setPrompt] = useState<string>('');
  const [durationSeconds, setDurationSeconds] = useState<number>(1.2);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SoundGenerationResult | null>(null);

  // Audition playback state
  const [auditioningId, setAuditioningId] = useState<string | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Library state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<SfxCategory | 'All'>('All');

  // Sound Design Agent state
  const [cues, setCues] = useState<SoundDesignCue[]>([]);
  const [isAnalyzingTimeline, setIsAnalyzingTimeline] = useState<boolean>(false);

  // DSP state
  const [dspSettings, setDspSettings] = useState<AudioDspSettings>(DEFAULT_AUDIO_DSP);

  // Check health on mount
  useEffect(() => {
    void checkBackend();
  }, []);

  const checkBackend = async () => {
    const health = await soundboxAdapter.checkHealth();
    setStatus(health);
    if (health.connected) {
      const modelList = await soundboxAdapter.listModels();
      setModels(modelList);
    }
  };

  // Stop audition audio when unmounting
  useEffect(() => {
    return () => {
      soundboxAdapter.stopAudition();
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
    };
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setGenerationError(null);

    try {
      const result = await soundboxAdapter.generateSound({
        prompt: prompt.trim(),
        durationSeconds,
        model: selectedModel,
      });
      setLastResult(result);
      // Auto audition
      handleAudition(result.id, result.audioBlob);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setGenerationError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAudition = (id: string, blobOrUrl: Blob | string) => {
    if (auditioningId === id) {
      soundboxAdapter.stopAudition();
      setAuditioningId(null);
      return;
    }

    setAuditioningId(id);
    soundboxAdapter.auditionSound(blobOrUrl, () => {
      setAuditioningId(null);
    });
  };

  /**
   * Adds an audio asset and clip to the MotionLab timeline
   */
  const handleAddToTimeline = async (
    name: string,
    blobOrUrl: Blob | string,
    duration: number,
    waveform?: number[]
  ) => {
    const assetId = `asset-sfx-${Date.now().toString(36)}`;
    const clipId = `clip-sfx-${Date.now().toString(36)}`;

    let audioBlob: Blob;
    let objectUrl: string;

    if (typeof blobOrUrl === 'string') {
      objectUrl = blobOrUrl;
      const res = await fetch(blobOrUrl);
      audioBlob = await res.blob();
    } else {
      audioBlob = blobOrUrl;
      objectUrl = URL.createObjectURL(blobOrUrl);
    }

    // Ensure full duration is respected
    const cleanDuration = Math.max(0.2, Number(duration.toFixed(3)));

    // 1. Add to Media Assets
    const mediaAsset = {
      id: assetId,
      name: `SFX: ${name} (${cleanDuration.toFixed(1)}s)`,
      type: 'audio' as const,
      mimeType: 'audio/wav',
      size: audioBlob.size,
      duration: cleanDuration,
      width: 0,
      height: 0,
      hasAudio: true,
      codecInfo: 'PCM 16-bit 44100Hz',
      thumbnails: [],
      waveform: waveform || [0.4, 0.8, 1.0, 0.6, 0.3, 0.1],
      objectUrl,
      blob: audioBlob,
      createdAt: Date.now(),
    };

    store.addMediaAssets([mediaAsset]);

    // 2. Locate or create SFX Track
    let sfxTrack = store.project.tracks.find(
      (t) =>
        t.type === 'audio' &&
        (t.name.toLowerCase().includes('sfx') || t.name.toLowerCase().includes('sound fx'))
    );

    let targetTrackId = sfxTrack?.id;
    if (!targetTrackId) {
      targetTrackId = store.addTrack('audio', 'SFX');
    }

    // 3. Create TimelineClip positioned at current playhead
    const startTime = store.currentTime;

    store.pushHistory();

    const newClip: TimelineClip = {
      id: clipId,
      name: `SFX: ${name}`,
      trackId: targetTrackId,
      type: 'audio',
      mediaId: assetId,
      startTime,
      duration: cleanDuration,
      inPoint: 0,
      outPoint: cleanDuration,
      sourceDuration: cleanDuration,
      playbackSpeed: 1,
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      opacity: 1,
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      effects: {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        exposure: 0,
        blur: 0,
        grayscale: 0,
        sepia: 0,
        flipH: false,
        flipV: false,
      },
      volume: 1.0,
      muted: false,
      fadeIn: 0.02,
      fadeOut: 0.05,
      transitionIn: { type: 'none', duration: 0 },
      transitionOut: { type: 'none', duration: 0 },
      keyframes: [],
    };

    useEditorStore.setState((state) => ({
      project: {
        ...state.project,
        clips: [...state.project.clips, newClip],
        updatedAt: Date.now(),
      },
      selectedClipId: clipId,
    }));

    await store.saveProject();
    store.selectClip(clipId);
  };

  /**
   * Sound Design Agent timeline scan
   */
  const handleScanTimeline = () => {
    setIsAnalyzingTimeline(true);
    setTimeout(() => {
      const generatedCues = analyzeTimelineForSoundDesign(store.project.clips);
      setCues(generatedCues);
      setIsAnalyzingTimeline(false);
    }, 400);
  };

  /**
   * Batch apply approved cues
   */
  const handleApplyApprovedCues = async () => {
    const approvedCues = cues.filter((c) => c.approved);
    for (const cue of approvedCues) {
      if (cue.soundUrl) {
        // Place cue at its exact timestamp
        const prevTime = store.currentTime;
        useEditorStore.setState({ currentTime: cue.timestamp });
        await handleAddToTimeline(cue.suggestedSoundName, cue.soundUrl, cue.duration);
        useEditorStore.setState({ currentTime: prevTime });
      }
    }
    setCues([]);
  };

  const filteredLibrary = searchSoundLibrary({
    query: searchQuery,
    category: selectedCategory,
  });

  return (
    <div className="flex flex-col h-full bg-[#0d0d12] text-[#e4e4e7] overflow-hidden select-none">
      {/* Studio Header */}
      <div className="p-3 border-b border-[#1f1f28] flex items-center justify-between bg-[#121218]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
            <Volume2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
              Sound FX Studio
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-400 font-mono">
                3.0
              </span>
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  status.connected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span className="text-[10px] text-[#a1a1aa] font-mono">
                {status.connected
                  ? `Soundbox Online (${status.version})`
                  : 'Soundbox Synth (Ready)'}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={checkBackend}
          title="Refresh backend status"
          className="p-1.5 rounded hover:bg-[#1f1f28] text-[#71717a] hover:text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="grid grid-cols-4 p-1.5 bg-[#14141c] border-b border-[#1f1f28] gap-1 text-[11px] font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('generator')}
          className={`py-1.5 px-1 rounded flex items-center justify-center gap-1 transition-all ${
            activeTab === 'generator'
              ? 'bg-[#222230] text-indigo-300 font-semibold shadow-xs'
              : 'text-[#71717a] hover:text-[#e4e4e7]'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>AI Gen</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('library')}
          className={`py-1.5 px-1 rounded flex items-center justify-center gap-1 transition-all ${
            activeTab === 'library'
              ? 'bg-[#222230] text-indigo-300 font-semibold shadow-xs'
              : 'text-[#71717a] hover:text-[#e4e4e7]'
          }`}
        >
          <FolderOpen className="w-3 h-3" />
          <span>Library</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('agent')}
          className={`py-1.5 px-1 rounded flex items-center justify-center gap-1 transition-all ${
            activeTab === 'agent'
              ? 'bg-[#222230] text-indigo-300 font-semibold shadow-xs'
              : 'text-[#71717a] hover:text-[#e4e4e7]'
          }`}
        >
          <Wand2 className="w-3 h-3" />
          <span>Designer</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dsp')}
          className={`py-1.5 px-1 rounded flex items-center justify-center gap-1 transition-all ${
            activeTab === 'dsp'
              ? 'bg-[#222230] text-indigo-300 font-semibold shadow-xs'
              : 'text-[#71717a] hover:text-[#e4e4e7]'
          }`}
        >
          <Sliders className="w-3 h-3" />
          <span>DSP FX</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* ================= TAB 1: AI GENERATOR ================= */}
        {activeTab === 'generator' && (
          <div className="space-y-3.5">
            <div>
              <label className="text-[11px] font-semibold text-[#a1a1aa] flex items-center justify-between mb-1.5">
                <span>Text-to-Sound Prompt</span>
                <span className="text-[10px] text-[#71717a]">Soundbox Neural Synth</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Deep cinematic bass whoosh with metallic reverb tail..."
                rows={3}
                className="w-full bg-[#161620] border border-[#262636] focus:border-indigo-500 rounded-lg p-2.5 text-xs text-white placeholder-[#52525b] outline-none resize-none transition-colors"
              />
            </div>

            {/* Quick Prompt Chips */}
            <div>
              <div className="text-[10px] font-semibold text-[#71717a] uppercase tracking-wider mb-1.5">
                Quick Kinetic Sound Prompts
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrompt(p)}
                    className="text-[10px] bg-[#181824] hover:bg-[#232334] text-[#a1a1aa] hover:text-white px-2 py-1 rounded border border-[#242434] transition-colors truncate max-w-full text-left"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#a1a1aa]">Duration</span>
                <span className="font-mono text-indigo-400 font-semibold">
                  {durationSeconds.toFixed(1)}s
                </span>
              </div>
              <input
                type="range"
                min="0.3"
                max="8.0"
                step="0.1"
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-[#222230] rounded-lg cursor-pointer"
              />
            </div>

            {/* Model Selector */}
            {models.length > 0 && (
              <div>
                <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                  Synthesis Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-[#161620] border border-[#262636] rounded-lg p-2 text-xs text-white outline-none cursor-pointer"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.license})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Generate Button */}
            <button
              type="button"
              disabled={isGenerating || !prompt.trim()}
              onClick={handleGenerate}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white font-medium text-xs rounded-lg flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing Soundscape...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Sound Effect</span>
                </>
              )}
            </button>

            {/* Error Message */}
            {generationError && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-tight">{generationError}</span>
              </div>
            )}

            {/* Last Generated Result Card */}
            {lastResult && (
              <div className="p-3 bg-[#161622] border border-indigo-500/30 rounded-xl space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-semibold text-white truncate">
                      {lastResult.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#a1a1aa] bg-[#222230] px-1.5 py-0.5 rounded">
                    {lastResult.durationSeconds.toFixed(2)}s • {lastResult.peakLevelDb.toFixed(1)} dB
                  </span>
                </div>

                {/* Waveform Visualization */}
                <div className="h-10 bg-[#0d0d14] rounded-lg p-1.5 flex items-end gap-0.5 border border-[#222230]">
                  {lastResult.waveformPeaks.map((peak, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-indigo-500 to-purple-400 rounded-xs transition-all"
                      style={{ height: `${Math.max(10, peak * 100)}%` }}
                    />
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleAudition(lastResult.id, lastResult.audioBlob)}
                    className="flex-1 py-1.5 px-3 bg-[#242436] hover:bg-[#32324a] text-white text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {auditioningId === lastResult.id ? (
                      <>
                        <Pause className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Stop Audition</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Audition</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleAddToTimeline(
                        lastResult.name,
                        lastResult.audioBlob,
                        lastResult.durationSeconds,
                        lastResult.waveformPeaks
                      )
                    }
                    className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Timeline</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: SOUND LIBRARY ================= */}
        {activeTab === 'library' && (
          <div className="space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search whooshes, impacts, clicks, risers..."
                className="w-full bg-[#161620] border border-[#262636] focus:border-indigo-500 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-[#52525b] outline-none"
              />
            </div>

            {/* Category Filter Horizontal Scroll */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {(
                [
                  'All',
                  'Whooshes',
                  'Impacts',
                  'UI Clicks',
                  'Transitions',
                  'Risers',
                  'Drops',
                  'Paper & Foley',
                  'Technology',
                  'Cinematic',
                  'Logo Stingers',
                ] as const
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat as SfxCategory | 'All')}
                  className={`text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'bg-[#181824] hover:bg-[#232332] text-[#a1a1aa]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Sound Cards List */}
            <div className="space-y-2 pt-1">
              {filteredLibrary.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 bg-[#14141d] border border-[#20202c] hover:border-[#303042] rounded-xl flex items-center justify-between gap-2.5 transition-all group"
                >
                  {/* Play Button */}
                  <button
                    type="button"
                    onClick={() => handleAudition(item.id, item.url)}
                    className="w-8 h-8 rounded-full bg-[#1f1f2e] hover:bg-indigo-600 text-[#a1a1aa] hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                  >
                    {auditioningId === item.id ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5 ml-0.5" />
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white truncate">{item.name}</span>
                      <span className="text-[9px] bg-[#222230] text-[#a1a1aa] px-1.5 py-0.2 rounded font-mono">
                        {item.duration.toFixed(1)}s
                      </span>
                    </div>
                    <p className="text-[10px] text-[#71717a] truncate mt-0.5">
                      {item.description}
                    </p>
                  </div>

                  {/* Add to Timeline Button */}
                  <button
                    type="button"
                    onClick={() =>
                      handleAddToTimeline(item.name, item.url, item.duration, item.waveform)
                    }
                    title="Insert to timeline"
                    className="p-1.5 rounded-lg bg-[#1f1f2e] hover:bg-indigo-600 text-[#a1a1aa] hover:text-white transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {filteredLibrary.length === 0 && (
                <div className="text-center py-8 text-[#71717a] text-xs">
                  No sound effects match "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: SOUND DESIGN AGENT ================= */}
        {activeTab === 'agent' && (
          <div className="space-y-3.5">
            <div className="p-3 bg-[#151522] border border-[#252538] rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold text-white">Auto Sound Designer</span>
              </div>
              <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                Inspects your video cuts, kinetic titles, and scene transitions to synthesize and align
                a synchronized Hollywood cue sheet.
              </p>
              <button
                type="button"
                disabled={isAnalyzingTimeline}
                onClick={handleScanTimeline}
                className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {isAnalyzingTimeline ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Timeline Cuts & Titles...</span>
                  </>
                ) : (
                  <>
                    <Disc className="w-3.5 h-3.5" />
                    <span>Scan Timeline & Propose Cues</span>
                  </>
                )}
              </button>
            </div>

            {/* Generated Cue Sheet */}
            {cues.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">
                    Proposed Sound Cues ({cues.length})
                  </span>
                  <span className="text-[10px] text-indigo-400 font-mono">
                    {cues.filter((c) => c.approved).length} selected
                  </span>
                </div>

                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {cues.map((cue) => (
                    <div
                      key={cue.id}
                      className="p-2.5 bg-[#14141d] border border-[#20202c] rounded-lg flex items-center justify-between gap-2"
                    >
                      <input
                        type="checkbox"
                        checked={cue.approved}
                        onChange={(e) => {
                          setCues((prev) =>
                            prev.map((c) => (c.id === cue.id ? { ...c, approved: e.target.checked } : c))
                          );
                        }}
                        className="rounded accent-indigo-500 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 px-1 py-0.2 rounded">
                            {cue.timestamp.toFixed(2)}s
                          </span>
                          <span className="text-xs font-medium text-white truncate">
                            {cue.suggestedSoundName}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#71717a] truncate mt-0.5">
                          {cue.desiredTexture}
                        </p>
                      </div>

                      {cue.soundUrl && (
                        <button
                          type="button"
                          onClick={() => handleAudition(cue.id, cue.soundUrl!)}
                          className="p-1 rounded text-[#a1a1aa] hover:text-white"
                        >
                          {auditioningId === cue.id ? (
                            <Pause className="w-3.5 h-3.5 text-indigo-400" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleApplyApprovedCues}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Apply Approved Cues to Timeline</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: AUDIO DSP FX ================= */}
        {activeTab === 'dsp' && (
          <div className="space-y-3.5 text-xs">
            <div className="text-[11px] font-semibold text-[#a1a1aa] mb-1">
              Web Audio DSP Bus Controls
            </div>

            {/* Gain */}
            <div className="p-2.5 bg-[#14141d] border border-[#20202c] rounded-lg space-y-1">
              <div className="flex justify-between">
                <span className="text-[#a1a1aa]">Output Gain</span>
                <span className="font-mono text-indigo-400">{dspSettings.gainDb.toFixed(1)} dB</span>
              </div>
              <input
                type="range"
                min="-24"
                max="12"
                step="0.5"
                value={dspSettings.gainDb}
                onChange={(e) =>
                  setDspSettings({ ...dspSettings, gainDb: parseFloat(e.target.value) })
                }
                className="w-full accent-indigo-500 h-1 bg-[#222230] rounded cursor-pointer"
              />
            </div>

            {/* Pan */}
            <div className="p-2.5 bg-[#14141d] border border-[#20202c] rounded-lg space-y-1">
              <div className="flex justify-between">
                <span className="text-[#a1a1aa]">Stereo Panning</span>
                <span className="font-mono text-indigo-400">
                  {dspSettings.pan === 0
                    ? 'Center'
                    : dspSettings.pan < 0
                    ? `L ${Math.abs(dspSettings.pan * 100).toFixed(0)}%`
                    : `R ${(dspSettings.pan * 100).toFixed(0)}%`}
                </span>
              </div>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.05"
                value={dspSettings.pan}
                onChange={(e) =>
                  setDspSettings({ ...dspSettings, pan: parseFloat(e.target.value) })
                }
                className="w-full accent-indigo-500 h-1 bg-[#222230] rounded cursor-pointer"
              />
            </div>

            {/* Low-Cut Filter */}
            <div className="p-2.5 bg-[#14141d] border border-[#20202c] rounded-lg space-y-1">
              <div className="flex justify-between">
                <span className="text-[#a1a1aa]">High-Pass (Low Cut)</span>
                <span className="font-mono text-indigo-400">{dspSettings.lowCutHz} Hz</span>
              </div>
              <input
                type="range"
                min="20"
                max="500"
                step="10"
                value={dspSettings.lowCutHz}
                onChange={(e) =>
                  setDspSettings({ ...dspSettings, lowCutHz: parseInt(e.target.value, 10) })
                }
                className="w-full accent-indigo-500 h-1 bg-[#222230] rounded cursor-pointer"
              />
            </div>

            {/* High-Cut Filter */}
            <div className="p-2.5 bg-[#14141d] border border-[#20202c] rounded-lg space-y-1">
              <div className="flex justify-between">
                <span className="text-[#a1a1aa]">Low-Pass (High Cut)</span>
                <span className="font-mono text-indigo-400">{dspSettings.highCutHz} Hz</span>
              </div>
              <input
                type="range"
                min="3000"
                max="20000"
                step="250"
                value={dspSettings.highCutHz}
                onChange={(e) =>
                  setDspSettings({ ...dspSettings, highCutHz: parseInt(e.target.value, 10) })
                }
                className="w-full accent-indigo-500 h-1 bg-[#222230] rounded cursor-pointer"
              />
            </div>

            {/* Reverb Wet */}
            <div className="p-2.5 bg-[#14141d] border border-[#20202c] rounded-lg space-y-1">
              <div className="flex justify-between">
                <span className="text-[#a1a1aa]">Algorithmic Reverb Wet</span>
                <span className="font-mono text-indigo-400">
                  {(dspSettings.reverbWet * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={dspSettings.reverbWet}
                onChange={(e) =>
                  setDspSettings({ ...dspSettings, reverbWet: parseFloat(e.target.value) })
                }
                className="w-full accent-indigo-500 h-1 bg-[#222230] rounded cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
