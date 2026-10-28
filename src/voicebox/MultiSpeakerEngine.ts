/**
 * MotionLab 2.0 — Multi-Speaker Dialogue Engine
 * Parses multi-speaker scripts, maps characters to distinct voice profiles,
 * generates dialogue takes, and places them sequentially across alternating timeline audio tracks.
 */

import type { MultiSpeakerLine, VoiceGenerationResult } from './types';
import { VoiceboxAdapter } from './VoiceboxAdapter';

export interface DialogueScriptParseResult {
  lines: MultiSpeakerLine[];
  uniqueSpeakers: string[];
}

export class MultiSpeakerEngine {
  /**
   * Parses a formatted dialogue text script into structured speaker lines
   * Supports "Speaker: Text" and "[Speaker] Text" conventions
   */
  public static parseScript(scriptText: string): DialogueScriptParseResult {
    const rawLines = scriptText.split('\n').map((l) => l.trim()).filter(Boolean);
    const lines: MultiSpeakerLine[] = [];
    const speakerSet = new Set<string>();

    const adapter = VoiceboxAdapter.getInstance();
    const availableProfiles = adapter.listProfiles();

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      let speakerName = 'Narrator';
      let text = line;

      // Match "Speaker: ..." or "[Speaker] ..."
      const colonMatch = line.match(/^([A-Za-z0-9 _-]+):\s*(.+)$/);
      const bracketMatch = line.match(/^\[([A-Za-z0-9 _-]+)\]\s*(.+)$/);

      if (colonMatch) {
        speakerName = colonMatch[1].trim();
        text = colonMatch[2].trim();
      } else if (bracketMatch) {
        speakerName = bracketMatch[1].trim();
        text = bracketMatch[2].trim();
      }

      speakerSet.add(speakerName);

      // Match profile by name or fallback to alternating profiles
      let matchedProfile = availableProfiles.find(
        (p) =>
          p.name.toLowerCase().includes(speakerName.toLowerCase()) ||
          p.id.toLowerCase().includes(speakerName.toLowerCase())
      );

      if (!matchedProfile) {
        // Assign alternating profiles based on speaker index
        const idx = Array.from(speakerSet).indexOf(speakerName) % availableProfiles.length;
        matchedProfile = availableProfiles[idx];
      }

      lines.push({
        id: `dlg-${i + 1}`,
        speakerId: `spk-${speakerName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        speakerName,
        text,
        profileId: matchedProfile.id,
        engine: matchedProfile.engine,
        preferredTrack: Array.from(speakerSet).indexOf(speakerName) % 2 === 0 ? 'track-dialogue-a' : 'track-dialogue-b',
      });
    }

    return {
      lines,
      uniqueSpeakers: Array.from(speakerSet),
    };
  }

  /**
   * Generates audio for each dialogue line sequentially
   */
  public static async generateDialogue(
    lines: MultiSpeakerLine[],
    onProgress?: (index: number, total: number, currentLine: MultiSpeakerLine) => void
  ): Promise<Array<{ line: MultiSpeakerLine; result: VoiceGenerationResult }>> {
    const adapter = VoiceboxAdapter.getInstance();
    const results: Array<{ line: MultiSpeakerLine; result: VoiceGenerationResult }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (onProgress) {
        onProgress(i, lines.length, line);
      }

      const res = await adapter.generateSpeech({
        text: line.text,
        profileId: line.profileId,
        engine: line.engine,
      });

      line.audioResult = res;
      results.push({ line, result: res });
    }

    return results;
  }
}
