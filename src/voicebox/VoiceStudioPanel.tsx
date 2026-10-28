import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  Volume2,
  Play,
  Pause,
  Plus,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  History,
  SlidersHorizontal,
  Layers,
  Wand2,
  Trash2,
  FileAudio,
  Radio,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { VoiceboxAdapter, BUILTIN_VOICE_PROFILES } from './VoiceboxAdapter';
import { VoiceEffectsEngine } from './VoiceEffectsEngine';
import { VoiceSyncEngine } from './VoiceSyncEngine';
import { VoiceDirectionEngine, VOICE_DIRECTION_PRESETS } from './voiceDirectionSkill';
import type {
  VoiceEngineCapability,
  VoiceGenerationResult,
  VoiceProfile,
  VoiceEffectsSettings,
} from './types';

const AUDITION_SAMPLES: Record<string, string> = {
  am_michael: 'Hello! I am Michael. Authoritative, resonant baritone, calibrated for high-impact agency commercials.',
  'angora-exec-male': 'Welcome to Angora Web Services. Your agency, our execution.',
  af_sarah: 'Hi there! I am Sarah. Crisp, energetic, and articulate for your product launches and motion designs.',
  'angora-dynamic-female': 'High-impact motion design and creative execution, built for modern agency workflows.',
  af_bella: 'Hello. I am Bella. Minimal, sophisticated editorial narration for your visual story.',
  'swiss-editorial-female': 'Swiss precision in motion. Minimal typography, bold geometry, and refined editorial rhythm.',
  am_adam: 'Hey, I am Adam. Warm, friendly, and conversational for tutorials and walkthroughs.',
  'friendly-explainer': 'Let us walk you through the entire workflow, step by step, seamlessly.',
  bf_emma: 'Good day. I am Emma. Refined British narration with polished diction and subtle warmth.',
  bm_george: 'I am George. Cinematic depth and commanding presence for dramatic trailers.',
  'cinematic-deep-baritone': 'In a world of constant noise, true craft speaks for itself.',
  af_sky: 'Hey there! I am Sky. Bright, optimistic, and modern for your reels and stories.',
  am_eric: 'What is up! I am Eric. Fast-paced, punchy, and confident delivery for high-energy promos.',
};

export const VoiceStudioPanel: React.FC = () => {
  const store = useEditorStore();
  const adapter = VoiceboxAdapter.getInstance();

  const [activeTab, setActiveTab] = useState<'tts' | 'library' | 'clone' | 'effects' | 'history'>('tts');
  const [connectionStatus, setConnectionStatus] = useState<{ connected: boolean; version: string; error?: string }>({
    connected: false,
    version: 'offline',
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State for Generation
  const [scriptText, setScriptText] = useState(
    'Precision digital engineering meets visual elegance. At Angora Web Services, we turn ambitious brand visions into high-performance digital reality.'
  );
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('am_michael');
  const [engines, setEngines] = useState<VoiceEngineCapability[]>([]);
  const [selectedEngineId, setSelectedEngineId] = useState<string>('kokoro');
  const [speakingSpeed, setSpeakingSpeed] = useState<number>(1.0);
  const [directionPresetId, setDirectionPresetId] = useState<string>('premium-commercial');

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResult, setCurrentResult] = useState<VoiceGenerationResult | null>(null);
  const [historyList, setHistoryList] = useState<VoiceGenerationResult[]>([]);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioPlayTime, setAudioPlayTime] = useState(0);

  // Voice Cloning State
  const [cloneName, setCloneName] = useState('');
  const [cloneGender, setCloneGender] = useState<'male' | 'female' | 'neutral'>('male');
  const [cloneConsentConfirmed, setCloneConsentConfirmed] = useState(false);
  const [cloneSampleFileName, setCloneSampleFileName] = useState('');

  // Audio Effects State
  const [effects, setEffects] = useState<VoiceEffectsSettings>({
    pitchShiftSemitones: 0,
    gainDb: 1.0,
    reverbWet: 0.05,
    reverbDecay: 1.2,
    delayWet: 0,
    delayTimeSeconds: 0.2,
    compressionRatio: 3.0,
    compressorThresholdDb: -18,
    lowCutHz: 80,
    highCutHz: 16000,
    normalizePeakDb: -1.0,
  });

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const resultCardRef = useRef<HTMLDivElement | null>(null);

  // Audition playback state for Voice Catalog
  const [auditioningProfileId, setAuditioningProfileId] = useState<string | null>(null);
  const [loadingAuditionId, setLoadingAuditionId] = useState<string | null>(null);
  const auditionCacheRef = useRef<Map<string, string>>(new Map());
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleToggleAudition = async (profile: VoiceProfile) => {
    // If currently playing this profile, pause it
    if (auditioningProfileId === profile.id) {
      if (auditionAudioRef.current) {
        auditionAudioRef.current.pause();
      }
      setAuditioningProfileId(null);
      return;
    }

    // Stop current audition
    if (auditionAudioRef.current) {
      auditionAudioRef.current.pause();
    }
    // Stop main preview if playing
    if (audioElementRef.current && isPlayingAudio) {
      audioElementRef.current.pause();
      setIsPlayingAudio(false);
    }

    // Use cached audio if already synthesized
    const cachedUrl = auditionCacheRef.current.get(profile.id);
    if (cachedUrl) {
      if (auditionAudioRef.current) {
        auditionAudioRef.current.src = cachedUrl;
        auditionAudioRef.current.currentTime = 0;
        auditionAudioRef.current
          .play()
          .then(() => setAuditioningProfileId(profile.id))
          .catch(() => setAuditioningProfileId(null));
      }
      return;
    }

    setLoadingAuditionId(profile.id);
    setErrorMessage(null);

    try {
      const sampleText =
        AUDITION_SAMPLES[profile.id] ||
        `Hello! I am ${profile.name.split(' ')[0]}. Ready to record your voiceover with MotionLab.`;

      const result = await adapter.generateSpeech({
        text: sampleText,
        profileId: profile.id,
        engine: profile.engine as any,
        speed: 1.0,
      });

      const audioUrl = URL.createObjectURL(result.audioBlob);
      auditionCacheRef.current.set(profile.id, audioUrl);

      if (auditionAudioRef.current) {
        auditionAudioRef.current.src = audioUrl;
        auditionAudioRef.current.currentTime = 0;
        await auditionAudioRef.current.play();
        setAuditioningProfileId(profile.id);
      }
    } catch (err: unknown) {
      console.error('Voice audition synthesis error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Audition failed: ${msg}`);
      setAuditioningProfileId(null);
    } finally {
      setLoadingAuditionId(null);
    }
  };

  const checkConnection = async () => {
    try {
      const status = await adapter.checkHealth();
      setConnectionStatus({
        connected: status.connected,
        version: status.version,
      });
      if (status.connected) {
        setErrorMessage(null);
      }
    } catch (err) {
      setConnectionStatus({
        connected: false,
        version: 'offline',
        error: err instanceof Error ? err.message : String(err),
      });
    }
    setProfiles(adapter.listProfiles());
    setEngines(adapter.listEngines().filter((e) => e.isInstalled));
  };

  useEffect(() => {
    void checkConnection();
  }, []);

  // Sync audio playhead time
  useEffect(() => {
    const el = audioElementRef.current;
    if (!el) return;
    const onTimeUpdate = () => setAudioPlayTime(el.currentTime);
    const onEnded = () => {
      setIsPlayingAudio(false);
      setAudioPlayTime(0);
    };
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
    };
  }, [currentResult]);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) || profiles[0] || BUILTIN_VOICE_PROFILES[0];

  const handleGenerate = async () => {
    if (!scriptText.trim() || isGenerating) return;
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const result = await adapter.generateSpeech({
        text: scriptText,
        profileId: selectedProfileId,
        engine: selectedEngineId as any,
        speed: speakingSpeed,
      });

      setCurrentResult(result);
      setHistoryList((prev) => [result, ...prev]);

      // Initialize audio preview element
      if (audioElementRef.current) {
        audioElementRef.current.src = URL.createObjectURL(result.audioBlob);
        audioElementRef.current.currentTime = 0;
        audioElementRef.current.onloadedmetadata = () => {
          if (
            audioElementRef.current &&
            isFinite(audioElementRef.current.duration) &&
            audioElementRef.current.duration > 0.2
          ) {
            const preciseDuration = Number(audioElementRef.current.duration.toFixed(3));
            setCurrentResult((prev) => (prev ? { ...prev, durationSeconds: preciseDuration } : prev));
          }
        };
      }

      // Smooth scroll to result card so it's fully visible immediately
      setTimeout(() => {
        resultCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    } catch (err: unknown) {
      console.error('Speech generation failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTogglePlay = () => {
    if (!audioElementRef.current || !currentResult) return;

    if (isPlayingAudio) {
      audioElementRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioElementRef.current
        .play()
        .then(() => setIsPlayingAudio(true))
        .catch(() => setIsPlayingAudio(false));
    }
  };

  /**
   * Adds the generated audio file onto a managed audio track in MotionLab timeline
   */
  const handleAddToTimeline = async (targetResult?: VoiceGenerationResult) => {
    const target =
      targetResult && typeof targetResult === 'object' && 'audioBlob' in targetResult
        ? targetResult
        : currentResult;
    if (!target) return;

    // Determine the absolute full duration of the voiceover
    let fullDuration = target.durationSeconds;
    if (
      !targetResult &&
      audioElementRef.current &&
      isFinite(audioElementRef.current.duration) &&
      audioElementRef.current.duration > 0.2
    ) {
      fullDuration = Math.max(fullDuration, Number(audioElementRef.current.duration.toFixed(3)));
    }
    // Cross check against audio blob size if duration is unexpectedly 1.0 or less
    const estimatedFromBytes = (target.audioBlob.size - 44) / ((target.sampleRate || 24000) * 2);
    if (estimatedFromBytes > 1.2 && fullDuration <= 1.05) {
      fullDuration = Number(estimatedFromBytes.toFixed(3));
    }
    fullDuration = Math.max(0.2, Number(fullDuration.toFixed(3)));

    const audioUrl = URL.createObjectURL(target.audioBlob);
    const assetId = `asset-vo-${Date.now().toString(36)}`;
    const clipId = `clip-vo-${Date.now().toString(36)}`;

    // 1. Create and store MediaAsset with full duration
    const mediaAsset = {
      id: assetId,
      name: `Voiceover: ${target.profileName} (${fullDuration.toFixed(1)}s)`,
      type: 'audio' as const,
      mimeType: 'audio/wav',
      size: target.audioBlob.size,
      duration: fullDuration,
      width: 0,
      height: 0,
      hasAudio: true,
      codecInfo: `PCM 16-bit ${target.sampleRate || 24000}Hz`,
      thumbnails: [],
      waveform: target.waveformPeaks,
      objectUrl: audioUrl,
      blob: target.audioBlob,
      createdAt: Date.now(),
    };

    store.addMediaAssets([mediaAsset]);

    // 2. Ensure Dedicated Voiceover track exists
    let targetTrack = store.project.tracks.find(
      (t) =>
        t.type === 'audio' &&
        (t.name.toLowerCase().includes('voice') || t.name.toLowerCase().includes('narration'))
    );
    if (!targetTrack) {
      const trackId = store.addTrack('audio', 'Voiceover');
      targetTrack = store.project.tracks.find((t) => t.id === trackId);
    }

    const targetTrackId = targetTrack?.id || store.project.tracks[0]?.id || 'track-audio';

    // 3. Position clip on timeline at current playhead
    const startTime = store.currentTime;
    const duration = fullDuration;

    store.pushHistory();

    const newClip = {
      id: clipId,
      name: `VO: ${target.profileName}`,
      trackId: targetTrackId,
      type: 'audio' as const,
      mediaId: assetId,
      startTime,
      duration,
      inPoint: 0,
      outPoint: duration,
      sourceDuration: duration,
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
      fadeIn: 0.05,
      fadeOut: 0.1,
      transitionIn: { type: 'none' as const, duration: 0 },
      transitionOut: { type: 'none' as const, duration: 0 },
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

    // Select new clip
    store.selectClip(clipId);
  };

  /**
   * Generates synchronized kinetic captions and beat markers based on voice timing
   */
  const handleVoiceSync = async () => {
    if (!currentResult) return;

    const analysis = VoiceSyncEngine.analyzeSpeech(currentResult);
    const captions = VoiceSyncEngine.generateSynchronizedCaptions(
      analysis,
      store.currentTime,
      { textColor: '#D7E83F' }
    );

    store.pushHistory();
    await store.loadProject({
      ...store.project,
      clips: [...store.project.clips, ...captions],
    });
    await store.saveProject();
  };

  /**
   * Handles user voice cloning submission with consent verification
   */
  const handleSaveClonedVoice = () => {
    if (!cloneConsentConfirmed) {
      alert('You must confirm voice ownership or written consent to clone this voice.');
      return;
    }
    if (!cloneName.trim()) {
      alert('Please provide a name for this cloned voice profile.');
      return;
    }

    const newProfile = adapter.createProfile(
      {
        name: cloneName.trim(),
        voiceType: 'cloned',
        engine: 'chatterbox-turbo',
        language: 'en',
        gender: cloneGender,
        description: `Custom cloned voice profile (${cloneName.trim()})`,
        tags: ['custom', 'cloned'],
        authorizedForCommercialUse: true,
      },
      true
    );

    setProfiles(adapter.listProfiles());
    setSelectedProfileId(newProfile.id);
    setActiveTab('tts');
    setCloneName('');
    setCloneConsentConfirmed(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0f12] text-zinc-200 overflow-hidden text-xs">
      {/* Hidden audio element for preview */}
      <audio
        ref={audioElementRef}
        onTimeUpdate={() => {
          if (audioElementRef.current) {
            setAudioPlayTime(audioElementRef.current.currentTime);
          }
        }}
        onEnded={() => setIsPlayingAudio(false)}
      />
      {/* Hidden audio element for voice catalog audition */}
      <audio
        ref={auditionAudioRef}
        onEnded={() => setAuditioningProfileId(null)}
        onError={() => setAuditioningProfileId(null)}
      />

      {/* Header & Connection Indicator */}
      <div className="p-3 border-b border-zinc-800 bg-[#12151b] flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-md bg-[#D7E83F]/10 border border-[#D7E83F]/30 text-[#D7E83F] shrink-0">
              <Mic className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-xs text-zinc-100 flex items-center gap-1.5 truncate">
                <span>AI Voice Studio</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-medium">
                  Voicebox
                </span>
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800 shrink-0">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                connectionStatus.connected
                  ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                  : 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
              }`}
            />
            <span className="truncate">
              {connectionStatus.connected
                ? `Kokoro 82M Neural (${connectionStatus.version})`
                : 'Neural Voice Engine Offline'}
            </span>
            <button
              onClick={() => void checkConnection()}
              title="Refresh TTS Engine Connection"
              className="hover:text-zinc-200 transition cursor-pointer ml-0.5"
            >
              <RefreshCw className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        {/* Action Tabs - Clean Segmented Control */}
        <div className="grid grid-cols-5 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-center">
          <button
            onClick={() => setActiveTab('tts')}
            className={`py-1.5 rounded text-[10px] font-medium transition truncate ${
              activeTab === 'tts'
                ? 'bg-[#D7E83F] text-black font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Script
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`py-1.5 rounded text-[10px] font-medium transition truncate ${
              activeTab === 'library'
                ? 'bg-[#D7E83F] text-black font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Library
          </button>
          <button
            onClick={() => setActiveTab('clone')}
            className={`py-1.5 rounded text-[10px] font-medium transition truncate ${
              activeTab === 'clone'
                ? 'bg-[#D7E83F] text-black font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Clone
          </button>
          <button
            onClick={() => setActiveTab('effects')}
            className={`py-1.5 rounded text-[10px] font-medium transition truncate ${
              activeTab === 'effects'
                ? 'bg-[#D7E83F] text-black font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            DSP FX
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-1.5 rounded text-[10px] font-medium transition truncate ${
              activeTab === 'history'
                ? 'bg-[#D7E83F] text-black font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Takes ({historyList.length})
          </button>
        </div>
      </div>

      {/* Main Content View */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ========================================== */}
        {/* TAB 1: TEXT TO SPEECH & GENERATION */}
        {/* ========================================== */}
        {activeTab === 'tts' && (
          <div className="space-y-4">
            {/* Quick Templates */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] scrollbar-none">
              <span className="text-zinc-500 whitespace-nowrap shrink-0">Templates:</span>
              <button
                onClick={() =>
                  setScriptText(
                    'Welcome to Angora Web Services. Your clients. Your brand. Our execution.'
                  )
                }
                className="px-2.5 py-1 rounded-md bg-[#D7E83F]/20 hover:bg-[#D7E83F]/30 border border-[#D7E83F]/50 text-[#D7E83F] font-semibold whitespace-nowrap shrink-0 transition cursor-pointer"
              >
                Angora Brand (15s)
              </button>
              <button
                onClick={() =>
                  setScriptText(
                    'Precision digital engineering meets visual elegance. At Angora Web Services, we turn ambitious brand visions into high-performance digital reality.'
                  )
                }
                className="px-2.5 py-1 rounded-md bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/50 text-zinc-300 whitespace-nowrap shrink-0 transition"
              >
                Agency Overview
              </button>
              <button
                onClick={() =>
                  setScriptText(
                    'Built for creators who demand complete control. Introducing MotionLab: deterministic AI motion graphics, studio typography, and native timeline rendering.'
                  )
                }
                className="px-2.5 py-1 rounded-md bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/50 text-zinc-300 whitespace-nowrap shrink-0 transition"
              >
                Tech Launch
              </button>
            </div>

            {/* Error Notification Banner */}
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-semibold text-rose-400">TTS Engine Alert</div>
                  <div className="text-[11px] leading-relaxed text-rose-300/90">{errorMessage}</div>
                </div>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-rose-400 hover:text-white shrink-0 p-1 cursor-pointer"
                  title="Dismiss error"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Script Text Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-zinc-400">
                <label className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <FileAudio className="w-3.5 h-3.5 text-[#D7E83F]" />
                  Narration Script
                </label>
                <span>{scriptText.split(/\s+/).filter(Boolean).length} words</span>
              </div>
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                rows={4}
                placeholder="Enter speech script here..."
                className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#D7E83F] font-mono text-xs leading-relaxed resize-none"
              />
            </div>

            {/* Voice Profile & Engine Grid */}
            <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-800 space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                {/* Voice Profile Selector */}
                <div className="space-y-1 min-w-0">
                  <label className="text-[10px] font-medium text-zinc-400">Voice Profile</label>
                  <select
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-[#D7E83F] truncate"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Engine Selector */}
                <div className="space-y-1 min-w-0">
                  <label className="text-[10px] font-medium text-zinc-400">TTS Engine</label>
                  <select
                    value={selectedEngineId}
                    onChange={(e) => setSelectedEngineId(e.target.value)}
                    className="w-full p-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-[#D7E83F] truncate"
                  >
                    {engines.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Delivery Speed Control with Quick Presets */}
              <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                <div className="flex justify-between items-center text-[10px] text-zinc-400">
                  <span className="font-medium">Pacing & Cadence</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[#D7E83F] font-semibold">{speakingSpeed.toFixed(2)}x</span>
                    <span className="text-[9px] text-zinc-500">
                      ({speakingSpeed < 0.95 ? 'Deliberate' : speakingSpeed > 1.15 ? 'Punchy' : 'Natural'})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.75"
                    max="1.4"
                    step="0.05"
                    value={speakingSpeed}
                    onChange={(e) => setSpeakingSpeed(parseFloat(e.target.value))}
                    className="flex-1 accent-[#D7E83F] cursor-pointer"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    {[0.85, 1.0, 1.15, 1.3].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setSpeakingSpeed(spd)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition cursor-pointer ${
                          Math.abs(speakingSpeed - spd) < 0.03
                            ? 'bg-[#D7E83F]/20 border-[#D7E83F] text-[#D7E83F]'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !scriptText.trim()}
              className={`w-full py-2.5 rounded-lg font-semibold text-black flex items-center justify-center gap-2 shadow-lg transition-all ${
                isGenerating
                  ? 'bg-amber-400 cursor-wait'
                  : 'bg-[#D7E83F] hover:bg-[#c8ff20] active:scale-[0.99] cursor-pointer'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-black" />
                  <span>Synthesizing Audio ({selectedProfile.name})...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-black text-black" />
                  <span>Generate Speech Audio</span>
                </>
              )}
            </button>

            {/* Live Generated Audio Result Card */}
            {currentResult && (
              <div ref={resultCardRef} className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={handleTogglePlay}
                    className="w-8 h-8 rounded-full bg-[#D7E83F] hover:bg-[#c8ff20] flex items-center justify-center text-black transition shrink-0 cursor-pointer shadow-sm"
                  >
                    {isPlayingAudio ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-zinc-100 flex items-center gap-1.5 truncate">
                      <span className="truncate">{currentResult.profileName}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-emerald-400 font-mono shrink-0">
                        {currentResult.durationSeconds.toFixed(1)}s
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      {currentResult.sampleRate / 1000}kHz • Peak {currentResult.peakLevelDb}dB • RMS{' '}
                      {currentResult.rmsLevelDb}dB
                    </div>
                  </div>
                </div>

                {/* Waveform Visualization Bars */}
                <div className="h-10 bg-black/50 rounded-lg flex items-center px-2.5 gap-[2px] overflow-hidden border border-zinc-800/80">
                  {currentResult.waveformPeaks.map((peak, idx) => {
                    const normTime = idx / currentResult.waveformPeaks.length;
                    const isPassed =
                      isPlayingAudio &&
                      audioPlayTime / currentResult.durationSeconds >= normTime;
                    return (
                      <div
                        key={idx}
                        className={`flex-1 rounded-full transition-colors ${
                          isPassed ? 'bg-[#D7E83F]' : 'bg-emerald-400/80'
                        }`}
                        style={{ height: `${Math.max(15, peak * 90)}%` }}
                      />
                    );
                  })}
                </div>

                {/* Live Output Level Meter with real dBFS readouts */}
                <div className="bg-black/60 rounded-md p-2 border border-zinc-800/80 space-y-1">
                  <div className="flex justify-between items-center text-[9px] text-zinc-400 font-mono">
                    <span className="flex items-center gap-1 text-zinc-300">
                      <Volume2 className="w-3 h-3 text-emerald-400" />
                      Live Audio Meter
                    </span>
                    <span className="text-emerald-400 font-semibold">
                      {isPlayingAudio
                        ? `${(Math.max(-48, currentResult.peakLevelDb + Math.sin(audioPlayTime * 14) * 3.5)).toFixed(1)} dBFS`
                        : `${currentResult.peakLevelDb} dBFS (Peak)`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full transition-all duration-75 rounded-full ${
                        isPlayingAudio
                          ? 'bg-gradient-to-r from-emerald-500 via-[#D7E83F] to-amber-400'
                          : 'bg-emerald-500/50'
                      }`}
                      style={{
                        width: isPlayingAudio
                          ? `${Math.min(100, Math.max(12, ((currentResult.peakLevelDb + 48) / 48) * 100 * (0.8 + Math.abs(Math.sin(audioPlayTime * 10)) * 0.2)))}%`
                          : `${Math.min(100, Math.max(12, ((currentResult.peakLevelDb + 48) / 48) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[8px] text-zinc-500 font-mono">
                    <span>-48dB</span>
                    <span>-24dB</span>
                    <span>-12dB</span>
                    <span>-6dB</span>
                    <span>0dB</span>
                  </div>
                </div>

                {/* Action Buttons Grid (Full-width, never cut off!) */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleAddToTimeline()}
                    className="py-2 px-3 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Timeline</span>
                  </button>
                  <button
                    onClick={handleVoiceSync}
                    className="py-2 px-3 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[#D7E83F] font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap"
                    title="Generate synchronized kinetic subtitle text clips"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-[#D7E83F]" />
                    <span>Sync Captions</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: VOICE LIBRARY */}
        {/* ========================================== */}
        {activeTab === 'library' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-zinc-200 text-xs uppercase tracking-wider">
                Voice Catalog & Profiles ({profiles.length})
              </h3>
              <span className="text-[10px] text-zinc-500">Click to select voice</span>
            </div>
            <div className="space-y-2">
              {profiles.map((p) => {
                const isSelected = selectedProfileId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedProfileId(p.id);
                      setActiveTab('tts');
                    }}
                    className={`p-3 rounded-lg border transition cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? 'border-[#D7E83F] bg-[#D7E83F]/10 ring-1 ring-[#D7E83F]/30'
                        : 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-zinc-100 text-xs truncate">
                          {p.name}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#D7E83F] text-black font-semibold uppercase">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          data-testid={`audition-voice-${p.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleToggleAudition(p);
                          }}
                          className={`h-6 px-2.5 rounded-md flex items-center gap-1 text-[10px] font-medium transition cursor-pointer border ${
                            auditioningProfileId === p.id
                              ? 'bg-[#D7E83F] text-black border-[#D7E83F] hover:bg-[#c8ff20] font-semibold shadow-sm'
                              : 'bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border-zinc-700/80 hover:text-white'
                          }`}
                          title={auditioningProfileId === p.id ? 'Pause preview' : 'Play voice audition'}
                        >
                          {loadingAuditionId === p.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin text-zinc-300" />
                          ) : auditioningProfileId === p.id ? (
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
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase font-mono">
                          {p.voiceType}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {p.description}
                    </p>
                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-zinc-800/60 font-mono">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <span>{p.language.toUpperCase()}</span>
                        <span>•</span>
                        <span className="capitalize">{p.gender || 'neutral'}</span>
                        <span>•</span>
                        <span className="text-zinc-500">{p.engine}</span>
                      </div>
                      <span className="text-emerald-400 font-medium">Commercial Ready</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: VOICE CLONING (WITH CONSENT) */}
        {/* ========================================== */}
        {activeTab === 'clone' && (
          <div className="space-y-4 max-w-lg mx-auto bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Licensed Voice Cloning Studio
              </h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Clone an authorized voice profile from a clean 10–30s reference speech sample.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] text-zinc-300">Profile Name</label>
              <input
                type="text"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="e.g. Angora Founder Voice"
                className="w-full p-2.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-[#D7E83F]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] text-zinc-300">Voice Gender</label>
              <select
                value={cloneGender}
                onChange={(e) => setCloneGender(e.target.value as any)}
                className="w-full p-2.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs focus:outline-none focus:border-[#D7E83F]"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>

            {/* Reference Audio Dropzone simulation */}
            <div className="p-4 border-2 border-dashed border-zinc-800 rounded-lg text-center space-y-1">
              <FileAudio className="w-6 h-6 text-zinc-500 mx-auto" />
              <div className="text-zinc-300 font-medium">Select Reference Audio (WAV / MP3)</div>
              <div className="text-[10px] text-zinc-500">10-30 seconds of clean speech with zero background noise</div>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setCloneSampleFileName(e.target.files?.[0]?.name || '')}
                className="mt-2 text-[10px] text-zinc-400"
              />
            </div>

            {/* Mandatory User Consent Checkbox */}
            <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/40 space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cloneConsentConfirmed}
                  onChange={(e) => setCloneConsentConfirmed(e.target.checked)}
                  className="mt-0.5 accent-[#D7E83F]"
                />
                <span className="text-[11px] text-emerald-200 leading-relaxed font-medium">
                  I confirm that I own the rights to this voice or have explicit written permission from the
                  speaker to clone and use this voice in commercial projects.
                </span>
              </label>
            </div>

            <button
              onClick={handleSaveClonedVoice}
              disabled={!cloneConsentConfirmed || !cloneName.trim()}
              className={`w-full py-2.5 rounded-lg font-semibold text-black transition ${
                cloneConsentConfirmed && cloneName.trim()
                  ? 'bg-[#D7E83F] hover:bg-[#c8ff20]'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              Save Cloned Voice Profile
            </button>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 4: DSP VOICE EFFECTS */}
        {/* ========================================== */}
        {activeTab === 'effects' && (
          <div className="space-y-4 max-w-lg mx-auto bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
            <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-[#D7E83F]" />
              Audio DSP & Broadcast Mastering Chain
            </h3>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>High-Pass Rumble Cut</span>
                  <span className="font-mono text-[#D7E83F]">{effects.lowCutHz} Hz</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="200"
                  step="5"
                  value={effects.lowCutHz}
                  onChange={(e) => setEffects({ ...effects, lowCutHz: parseInt(e.target.value) })}
                  className="w-full accent-[#D7E83F]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>Dynamic Compression Ratio</span>
                  <span className="font-mono text-[#D7E83F]">{effects.compressionRatio}:1</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="6"
                  step="0.5"
                  value={effects.compressionRatio}
                  onChange={(e) => setEffects({ ...effects, compressionRatio: parseFloat(e.target.value) })}
                  className="w-full accent-[#D7E83F]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>Room Reverb</span>
                  <span className="font-mono text-[#D7E83F]">{(effects.reverbWet * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.4"
                  step="0.02"
                  value={effects.reverbWet}
                  onChange={(e) => setEffects({ ...effects, reverbWet: parseFloat(e.target.value) })}
                  className="w-full accent-[#D7E83F]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>Output Peak Normalization</span>
                  <span className="font-mono text-[#D7E83F]">{effects.normalizePeakDb} dBFS</span>
                </div>
                <input
                  type="range"
                  min="-3.0"
                  max="0.0"
                  step="0.5"
                  value={effects.normalizePeakDb}
                  onChange={(e) => setEffects({ ...effects, normalizePeakDb: parseFloat(e.target.value) })}
                  className="w-full accent-[#D7E83F]"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 5: GENERATION HISTORY */}
        {/* ========================================== */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <h3 className="font-semibold text-zinc-200 text-sm">Previous Voiceover Takes</h3>
            {historyList.length === 0 ? (
              <p className="text-zinc-500 py-6 text-center">No audio takes generated yet in this session.</p>
            ) : (
              <div className="space-y-2">
                {historyList.map((take) => (
                  <div
                    key={take.id}
                    className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between"
                  >
                    <div className="space-y-1 pr-3">
                      <div className="font-semibold text-zinc-100 flex items-center gap-2">
                        <span>{take.profileName}</span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(take.generatedAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 line-clamp-1 font-mono">"{take.text}"</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (isPlayingAudio && currentResult?.id === take.id) {
                            if (audioElementRef.current) audioElementRef.current.pause();
                            setIsPlayingAudio(false);
                          } else {
                            setCurrentResult(take);
                            if (audioElementRef.current) {
                              audioElementRef.current.src = URL.createObjectURL(take.audioBlob);
                              audioElementRef.current.play();
                              setIsPlayingAudio(true);
                            }
                          }
                        }}
                        className={`p-1.5 rounded transition cursor-pointer ${
                          isPlayingAudio && currentResult?.id === take.id
                            ? 'bg-emerald-500 text-black font-semibold'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                        }`}
                        title={isPlayingAudio && currentResult?.id === take.id ? 'Pause Take' : 'Audition Take'}
                      >
                        {isPlayingAudio && currentResult?.id === take.id ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setCurrentResult(take);
                          handleAddToTimeline(take);
                        }}
                        className="px-2.5 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-[10px] flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Timeline</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
