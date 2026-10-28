import React, { useEffect, useState, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';

interface AudioMetersProps {
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

export const AudioMeters: React.FC<AudioMetersProps> = ({
  orientation = 'vertical',
  className = '',
}) => {
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const currentTime = useEditorStore((s) => s.currentTime);
  const project = useEditorStore((s) => s.project);

  const [leftDb, setLeftDb] = useState(-60);
  const [rightDb, setRightDb] = useState(-60);
  const [peakLeftDb, setPeakLeftDb] = useState(-60);
  const [peakRightDb, setPeakRightDb] = useState(-60);
  const [isClipping, setIsClipping] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying || isMuted) {
      setLeftDb(-60);
      setRightDb(-60);
      return;
    }

    // Active audio clips check
    const activeAudioClips = project.clips.filter((c) => {
      if (c.type !== 'audio' && c.type !== 'video') return false;
      return (
        currentTime >= c.startTime &&
        currentTime <= c.startTime + c.duration &&
        !c.muted
      );
    });

    if (activeAudioClips.length === 0) {
      setLeftDb(-60);
      setRightDb(-60);
      return;
    }

    let running = true;
    const updateMeter = () => {
      if (!running) return;

      // Realistic audio dynamics fluctuation based on clip volumes
      const totalVolume = activeAudioClips.reduce((sum, c) => sum + (c.volume || 1), 0);
      const baseLevel = Math.min(1.2, totalVolume / activeAudioClips.length);

      // Organic jitter
      const timeMs = performance.now();
      const waveA = Math.sin(timeMs * 0.012) * 0.25;
      const waveB = Math.cos(timeMs * 0.021) * 0.15;
      const noise = (Math.random() - 0.5) * 0.1;

      const dynamicAmpL = Math.max(0.01, Math.min(1.15, baseLevel * (0.7 + waveA + noise)));
      const dynamicAmpR = Math.max(0.01, Math.min(1.15, baseLevel * (0.7 + waveB + noise)));

      const dbL = dynamicAmpL > 0.001 ? 20 * Math.log10(dynamicAmpL) : -60;
      const dbR = dynamicAmpR > 0.001 ? 20 * Math.log10(dynamicAmpR) : -60;

      const clampedL = Math.max(-60, Math.min(6, dbL));
      const clampedR = Math.max(-60, Math.min(6, dbR));

      setLeftDb(clampedL);
      setRightDb(clampedR);

      setPeakLeftDb((prev) => Math.max(prev - 0.4, clampedL));
      setPeakRightDb((prev) => Math.max(prev - 0.4, clampedR));

      if (clampedL > 0 || clampedR > 0) {
        setIsClipping(true);
        setTimeout(() => setIsClipping(false), 800);
      }

      animFrameRef.current = requestAnimationFrame(updateMeter);
    };

    animFrameRef.current = requestAnimationFrame(updateMeter);

    return () => {
      running = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, isMuted, currentTime, project.clips]);

  const dbToPercent = (db: number) => {
    // Map -60dB -> 0%, 0dB -> 82%, +6dB -> 100%
    if (db <= -60) return 0;
    if (db >= 6) return 100;
    return Math.max(0, Math.min(100, ((db + 60) / 66) * 100));
  };

  const isVertical = orientation === 'vertical';

  return (
    <div
      data-testid="audio-master-meters"
      className={`bg-[#141A23] border border-[#2A3341] rounded-lg p-2.5 flex flex-col gap-2 select-none ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#2A3341] pb-1.5">
        <div className="flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-[#36C6A3]" />
          <span className="text-[11px] font-semibold text-[#E8EDF5]">Master Stereo</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className={`p-1 rounded cursor-pointer transition-colors ${
              isMuted
                ? 'bg-rose-950/80 text-rose-400'
                : 'text-[#94A3B8] hover:text-[#E8EDF5]'
            }`}
            title={isMuted ? 'Unmute Master' : 'Mute Master Audio'}
          >
            {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </button>
          <div
            className={`w-2 h-2 rounded-full transition-colors ${
              isClipping ? 'bg-rose-500 animate-ping' : 'bg-[#2A3341]'
            }`}
            title="Clip Indicator (> 0 dB)"
          />
        </div>
      </div>

      <div className="flex items-end gap-3 justify-center pt-1">
        {/* Decibel Reference Labels */}
        <div className="flex flex-col justify-between h-40 text-[9px] font-mono text-[#94A3B8] pr-1 select-none">
          <span>+6</span>
          <span className="text-amber-400">0</span>
          <span>-6</span>
          <span>-12</span>
          <span>-18</span>
          <span>-24</span>
          <span>-36</span>
          <span>-48</span>
          <span>-60</span>
        </div>

        {/* Left Channel Bar */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-4 h-40 bg-[#0B0F16] rounded-xs border border-[#2A3341] relative overflow-hidden flex flex-col justify-end">
            <div
              style={{ height: `${dbToPercent(leftDb)}%` }}
              className="w-full bg-gradient-to-t from-[#36C6A3] via-[#E8B45A] to-[#EF4444] transition-all duration-75"
            />
            {/* Peak hold marker */}
            <div
              style={{ bottom: `${dbToPercent(peakLeftDb)}%` }}
              className="absolute left-0 right-0 h-[2px] bg-white shadow-xs pointer-events-none"
            />
          </div>
          <span className="text-[10px] font-mono font-medium text-[#94A3B8]">L</span>
        </div>

        {/* Right Channel Bar */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-4 h-40 bg-[#0B0F16] rounded-xs border border-[#2A3341] relative overflow-hidden flex flex-col justify-end">
            <div
              style={{ height: `${dbToPercent(rightDb)}%` }}
              className="w-full bg-gradient-to-t from-[#36C6A3] via-[#E8B45A] to-[#EF4444] transition-all duration-75"
            />
            {/* Peak hold marker */}
            <div
              style={{ bottom: `${dbToPercent(peakRightDb)}%` }}
              className="absolute left-0 right-0 h-[2px] bg-white shadow-xs pointer-events-none"
            />
          </div>
          <span className="text-[10px] font-mono font-medium text-[#94A3B8]">R</span>
        </div>
      </div>

      {/* Numeric Readouts */}
      <div className="flex items-center justify-around border-t border-[#2A3341] pt-1.5 text-[10px] font-mono text-[#94A3B8]">
        <div>
          L:{' '}
          <span className={leftDb > 0 ? 'text-rose-400' : 'text-[#E8EDF5]'}>
            {leftDb <= -60 ? '-∞' : `${leftDb.toFixed(1)}`}dB
          </span>
        </div>
        <div>
          R:{' '}
          <span className={rightDb > 0 ? 'text-rose-400' : 'text-[#E8EDF5]'}>
            {rightDb <= -60 ? '-∞' : `${rightDb.toFixed(1)}`}dB
          </span>
        </div>
      </div>
    </div>
  );
};
