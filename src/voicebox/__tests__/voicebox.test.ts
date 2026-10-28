/**
 * MotionLab 2.0 — Voicebox AI Voice Studio Tests
 * Unit and integration tests for TTS engine capabilities, consent validation,
 * speech synthesis fallback, audio quality reporting, sync engine, multi-speaker dialogue,
 * DSP effects processing, and MCP tools.
 */

import { describe, expect, it } from 'vitest';
import { executeMcpToolCall } from '../../engine/mcpEngine';
import { useEditorStore } from '../../store/useEditorStore';
import {
  DEFAULT_VOICE_EFFECTS,
  MultiSpeakerEngine,
  VoiceboxAdapter,
  VoiceDirectionEngine,
  VoiceEffectsEngine,
  VoiceSyncEngine,
  parseWavMetadata,
} from '../index';

describe('Voicebox AI Voice Studio', () => {
  describe('1. Engine Capability Detection & Profile Management', () => {
    it('lists available TTS engines with complete capability manifests', () => {
      const adapter = VoiceboxAdapter.getInstance();
      const engines = adapter.listEngines();

      expect(engines.length).toBeGreaterThanOrEqual(6);
      const kokoro = engines.find((e) => e.id === 'kokoro');
      expect(kokoro).toBeDefined();
      expect(kokoro?.supportsStreaming).toBe(true);
      expect(kokoro?.sampleRate).toBe(24000);

      const qwen3 = engines.find((e) => e.id === 'qwen3-tts');
      expect(qwen3?.supportsCloning).toBe(true);
      expect(qwen3?.supportsEmotionTags).toBe(true);

      const chatterbox = engines.find((e) => e.id === 'chatterbox-multilingual');
      expect(chatterbox?.supportedLanguages.length).toBeGreaterThan(15);
    });

    it('lists curated voice profiles including Angora executive and dynamic presets', () => {
      const adapter = VoiceboxAdapter.getInstance();
      const profiles = adapter.listProfiles();

      expect(profiles.length).toBeGreaterThanOrEqual(4);
      const execMale = profiles.find((p) => p.id === 'angora-exec-male');
      expect(execMale).toBeDefined();
      expect(execMale?.gender).toBe('male');
      expect(execMale?.authorizedForCommercialUse).toBe(true);

      const dynamicFemale = profiles.find((p) => p.id === 'angora-dynamic-female');
      expect(dynamicFemale).toBeDefined();
      expect(dynamicFemale?.gender).toBe('female');
    });

    it('enforces mandatory user consent validation when creating cloned profiles', () => {
      const adapter = VoiceboxAdapter.getInstance();

      // Should throw if consent is false
      expect(() => {
        adapter.createProfile(
          {
            name: 'Unauthorized Voice Clone',
            voiceType: 'cloned',
            engine: 'qwen3-tts',
            language: 'en',
            description: 'Unauthorized clone attempt',
            authorizedForCommercialUse: false,
            tags: ['test'],
          },
          false
        );
      }).toThrow(/Voice cloning requires explicit user confirmation/);

      // Should succeed when consent is confirmed
      const validProfile = adapter.createProfile(
        {
          name: 'Authorized Executive Voice',
          voiceType: 'cloned',
          engine: 'qwen3-tts',
          language: 'en',
          description: 'Licensed corporate voiceover profile',
          authorizedForCommercialUse: true,
          tags: ['test', 'executive'],
        },
        true
      );

      expect(validProfile.id).toBeDefined();
      expect(validProfile.authorizedForCommercialUse).toBe(true);
      expect(validProfile.consentConfirmedAt).toBeGreaterThan(0);
    });
  });

  describe('2. Speech Synthesis & Audio Quality Validation', () => {
    it('synthesizes speech deterministically with valid quality report and waveform peaks', async () => {
      const adapter = VoiceboxAdapter.getInstance();
      const result = await adapter.generateSpeech({
        text: 'Your Agency. Our Execution. High-end motion graphics and video editing.',
        profileId: 'angora-exec-male',
        speed: 1.0,
      });

      expect(result.id).toBeDefined();
      expect(result.durationSeconds).toBeGreaterThan(1.0);
      expect(result.sampleRate).toBe(44100);
      expect(result.audioBlob).toBeInstanceOf(Blob);
      expect(result.audioBlob.size).toBeGreaterThan(1000);
      expect(result.waveformPeaks.length).toBe(64);

      // Quality report checks
      expect(result.qualityReport.isValid).toBe(true);
      expect(result.qualityReport.hasClipping).toBe(false);
      expect(result.qualityReport.peakDb).toBeLessThanOrEqual(0);
      expect(result.qualityReport.rmsDb).toBeLessThan(0);
    });

    it('rejects empty script text gracefully', async () => {
      const adapter = VoiceboxAdapter.getInstance();
      await expect(
        adapter.generateSpeech({
          text: '   ',
          profileId: 'angora-exec-male',
        })
      ).rejects.toThrow(/cannot be empty/);
    });
  });

  describe('3. Voice Sync Engine & Kinetic Typography', () => {
    it('segments speech into natural phrase cues and beat markers', async () => {
      const adapter = VoiceboxAdapter.getInstance();
      const result = await adapter.generateSpeech({
        text: 'Web Design. Web Development. Automation. Scale your agency today.',
        profileId: 'angora-exec-male',
      });

      const analysis = VoiceSyncEngine.analyzeSpeech(result);
      expect(analysis.segments.length).toBe(4);
      expect(analysis.beatMarkers.length).toBe(4);
      expect(analysis.recommendedSceneCuts.length).toBe(4);

      expect(analysis.segments[0].text).toBe('Web Design.');
      expect(analysis.segments[0].startTime).toBeLessThan(analysis.segments[0].endTime);
      expect(analysis.segments[1].startTime).toBeGreaterThanOrEqual(analysis.segments[0].endTime);
    });

    it('generates synchronized subtitle timeline clips with correct track mapping', async () => {
      const adapter = VoiceboxAdapter.getInstance();
      const result = await adapter.generateSpeech({
        text: 'Your agency. Our execution.',
        profileId: 'angora-dynamic-female',
      });

      const analysis = VoiceSyncEngine.analyzeSpeech(result);
      const clips = VoiceSyncEngine.generateSynchronizedCaptions(analysis, 2.0, {
        targetTrackId: 'track-captions',
        fontSize: 36,
        textColor: '#D7E83F',
      });

      expect(clips.length).toBe(2);
      expect(clips[0].trackId).toBe('track-captions');
      expect(clips[0].type).toBe('text');
      expect(clips[0].startTime).toBeGreaterThanOrEqual(2.0);
      expect(clips[0].textStyle?.color).toBe('#D7E83F');
      expect(clips[0].textStyle?.fontSize).toBe(36);
    });
  });

  describe('4. Multi-Speaker Dialogue Engine', () => {
    it('parses dialogue scripts into structured speaker lines', () => {
      const script = `
        Marcus: Welcome to Angora Web Services.
        Elena: Where creative agencies scale their production.
        Marcus: Premium motion graphics, delivered on demand.
      `;

      const parsed = MultiSpeakerEngine.parseScript(script);
      expect(parsed.lines.length).toBe(3);
      expect(parsed.uniqueSpeakers).toEqual(['Marcus', 'Elena']);
      expect(parsed.lines[0].speakerName).toBe('Marcus');
      expect(parsed.lines[0].text).toBe('Welcome to Angora Web Services.');
      expect(parsed.lines[1].speakerName).toBe('Elena');
    });

    it('generates multi-speaker dialogue lines sequentially', async () => {
      const script = `
        Marcus: Step one.
        Elena: Step two.
      `;

      const parsed = MultiSpeakerEngine.parseScript(script);
      const results = await MultiSpeakerEngine.generateDialogue(parsed.lines);

      expect(results.length).toBe(2);
      expect(results[0].result).toBeDefined();
      expect(results[1].result).toBeDefined();
      expect(results[0].result.durationSeconds).toBeGreaterThan(0.3);
      expect(results[1].result.durationSeconds).toBeGreaterThan(0.3);
    });
  });

  describe('5. Voice DSP Effects Processing', () => {
    it('processes audio with high-pass rumble cut, compression, and peak normalization', async () => {
      const adapter = VoiceboxAdapter.getInstance();
      const result = await adapter.generateSpeech({
        text: 'Mastered studio voiceover.',
        profileId: 'angora-exec-male',
      });

      const processed = await VoiceEffectsEngine.processAudio(result.audioBlob, {
        lowCutHz: 80,
        compressionRatio: 3.0,
        normalizePeakDb: -1.0,
      });

      expect(processed.processedBlob).toBeInstanceOf(Blob);
      expect(processed.processedBlob.size).toBeGreaterThan(500);
      expect(processed.peakDb).toBeLessThanOrEqual(0);
      expect(processed.rmsDb).toBeLessThan(0);
    });

    it('exports default studio voice effect settings', () => {
      expect(DEFAULT_VOICE_EFFECTS.lowCutHz).toBe(80);
      expect(DEFAULT_VOICE_EFFECTS.compressionRatio).toBe(2.5);
      expect(DEFAULT_VOICE_EFFECTS.normalizePeakDb).toBe(-1.0);
    });
  });

  describe('6. Voice Direction Skill', () => {
    it('calculates duration estimations and word counts according to WPM cadence', () => {
      const script = 'Angora Web Services provides elite motion design and video editing for modern creative agencies worldwide.';
      const plan = VoiceDirectionEngine.planVoiceover(script, 'premium-commercial', 15);

      expect(plan.preset.id).toBe('premium-commercial');
      expect(plan.pacingWpm).toBe(135);
      expect(plan.wordCount).toBe(15);
      expect(plan.estimatedDurationSeconds).toBeGreaterThan(5);
      expect(plan.notes.length).toBeGreaterThan(0);
    });
  });

  describe('7. Voicebox MCP Tool Execution', () => {
    it('executes voice_list_engines via MCP', async () => {
      const res = (await executeMcpToolCall('voice_list_engines', {})) as any;
      expect(res.ok).toBe(true);
      expect(Array.isArray(res.engines)).toBe(true);
      expect(res.engines.length).toBeGreaterThanOrEqual(6);
    });

    it('executes voice_list_profiles via MCP', async () => {
      const res = (await executeMcpToolCall('voice_list_profiles', { language: 'en' })) as any;
      expect(res.ok).toBe(true);
      expect(Array.isArray(res.profiles)).toBe(true);
      expect(res.profiles.length).toBeGreaterThan(0);
    });

    it('executes voice_generate via MCP with quality report', async () => {
      const res = (await executeMcpToolCall('voice_generate', {
        text: 'Testing Voicebox MCP speech generation.',
        profileId: 'angora-exec-male',
      })) as any;

      expect(res.ok).toBe(true);
      expect(res.result.profileId).toBe('angora-exec-male');
      expect(res.result.durationSeconds).toBeGreaterThan(0.5);
      expect(res.result.qualityReport.isValid).toBe(true);
    });

    it('executes voice_create_profile via MCP requiring consent', async () => {
      const failure = (await executeMcpToolCall('voice_create_profile', {
        name: 'Clone Without Consent',
        consentConfirmed: false,
      })) as any;
      expect(failure.ok).toBe(false);
      expect(failure.error).toMatch(/authorization|consent|confirmation/i);

      const success = (await executeMcpToolCall('voice_create_profile', {
        name: 'Licensed Spokesperson',
        consentConfirmed: true,
      })) as any;
      expect(success.ok).toBe(true);
      expect(success.profile.name).toBe('Licensed Spokesperson');
    });

    it('executes voice_add_to_timeline via MCP and places audio clip', async () => {
      const initialClipsCount = useEditorStore.getState().project.clips.length;

      const res = (await executeMcpToolCall('voice_add_to_timeline', {
        text: 'Angora Web Services. Your Agency, Our Execution.',
        startTime: 0,
      })) as any;

      expect(res.ok).toBe(true);
      expect(res.clipId).toBeDefined();
      expect(res.duration).toBeGreaterThan(1.5);

      const updatedClips = useEditorStore.getState().project.clips;
      expect(updatedClips.length).toBe(initialClipsCount + 1);
      const addedClip = updatedClips.find((c) => c.id === res.clipId);
      expect(addedClip).toBeDefined();
      expect(addedClip?.type).toBe('audio');
      // Verify full duration is preserved and not truncated to 1.0s
      expect(addedClip?.duration).toBe(res.duration);
      expect(addedClip?.outPoint).toBe(res.duration);
      expect(addedClip?.sourceDuration).toBe(res.duration);
      expect(addedClip?.duration).toBeGreaterThan(1.5);
    });

    it('accurately parses full audio duration from WAV binary buffer', () => {
      // Create a 24000Hz 16-bit mono WAV buffer representing 4.5 seconds
      const sampleRate = 24000;
      const numChannels = 1;
      const bytesPerSample = 2;
      const totalSamples = Math.floor(sampleRate * 4.5);
      const dataSize = totalSamples * bytesPerSample;
      const buffer = new ArrayBuffer(44 + dataSize);
      const view = new DataView(buffer);

      // 'RIFF'
      view.setUint32(0, 0x52494646, false);
      view.setUint32(4, 36 + dataSize, true);
      // 'WAVE'
      view.setUint32(8, 0x57415645, false);
      // 'fmt '
      view.setUint32(12, 0x666d7420, false);
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
      view.setUint16(32, numChannels * bytesPerSample, true);
      view.setUint16(34, 16, true);
      // 'data'
      view.setUint32(36, 0x64617461, false);
      view.setUint32(40, dataSize, true);

      const parsed = parseWavMetadata(buffer);
      expect(parsed.duration).toBeCloseTo(4.5, 2);
      expect(parsed.sampleRate).toBe(24000);
      expect(parsed.channels).toBe(1);
    });

    it('executes voice_sync_to_animation via MCP and adds synchronized caption clips', async () => {
      const initialClipsCount = useEditorStore.getState().project.clips.length;

      const res = (await executeMcpToolCall('voice_sync_to_animation', {
        text: 'High-end motion. Built for agencies.',
      })) as any;

      expect(res.ok).toBe(true);
      expect(res.segmentCount).toBe(2);
      expect(res.generatedClipsCount).toBe(2);

      const updatedClips = useEditorStore.getState().project.clips;
      expect(updatedClips.length).toBe(initialClipsCount + 2);
    });

    it('executes voice_generate_script via MCP', async () => {
      const res = (await executeMcpToolCall('voice_generate_script', {
        topicOrBrief: 'Angora Web Services Agency Promo',
        targetDurationSeconds: 15,
        preset: 'premium-commercial',
      })) as any;

      expect(res.ok).toBe(true);
      expect(res.plan.preset.id).toBe('premium-commercial');
      expect(res.plan.pacingWpm).toBe(135);
    });
  });
});
