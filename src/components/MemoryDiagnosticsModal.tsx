/**
 * MotionLab — Developer Memory Diagnostics & Telemetry HUD
 * Provides live profiling gauges: JS Heap, Video Decoders, Tracked URLs,
 * Audio Buffer caches, and manual Purge Caches / GC triggers.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Activity,
  Cpu,
  Layers,
  Trash2,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { memoryManager, type MemoryTelemetry } from '../engine/memoryManager';
import { useEditorStore } from '../store/useEditorStore';

interface MemoryDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MemoryDiagnosticsModal: React.FC<MemoryDiagnosticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [telemetry, setTelemetry] = useState<MemoryTelemetry>(memoryManager.getTelemetry());
  const [isStressTesting, setIsStressTesting] = useState(false);
  const [stressProgress, setStressProgress] = useState(0);
  const [stressReport, setStressReport] = useState<string | null>(null);

  const { project, currentTime } = useEditorStore();

  useEffect(() => {
    if (!isOpen) return;

    // Refresh telemetry every 800ms while modal is open
    const interval = setInterval(() => {
      setTelemetry(memoryManager.getTelemetry());
    }, 800);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePurge = () => {
    memoryManager.purgeAllCaches();
    setTelemetry(memoryManager.getTelemetry());
  };

  const handleRunStressTest = async () => {
    if (isStressTesting) return;
    setIsStressTesting(true);
    setStressProgress(0);
    setStressReport(null);

    const initialMem = memoryManager.getTelemetry();
    const duration = 12.0; // Simulated timeline span
    const steps = 120; // 120 rapid scrub seeks

    for (let i = 0; i <= steps; i++) {
      const scrubTime = (i / steps) * duration;
      useEditorStore.setState({ currentTime: scrubTime });
      setStressProgress(Math.round((i / steps) * 100));
      await new Promise((r) => setTimeout(r, 25));
    }

    // Return to start
    useEditorStore.setState({ currentTime: 0 });

    const finalMem = memoryManager.getTelemetry();
    const deltaHeap = finalMem.jsHeapUsedMb - initialMem.jsHeapUsedMb;

    setStressReport(
      `Scrub test complete (120 rapid seeks): Heap Δ = ${deltaHeap >= 0 ? '+' : ''}${deltaHeap} MB. Active decoders bounded at ${finalMem.activeVideoDecoders}/6.`
    );
    setIsStressTesting(false);
    setTelemetry(finalMem);
  };

  const getStatusBadge = () => {
    if (telemetry.status === 'optimal') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Optimal (&lt; 1.2 GB)
        </span>
      );
    }
    if (telemetry.status === 'warning') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertTriangle className="w-3.5 h-3.5" />
          Warning (&gt; 1.2 GB)
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <AlertTriangle className="w-3.5 h-3.5" />
        Critical (&gt; 2.5 GB)
      </span>
    );
  };

    return createPortal(
      <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#101018] border border-[#262638] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#202030] flex items-center justify-between bg-[#141420]">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Memory Diagnostics & Resource Profiler
              </h2>
              <p className="text-[11px] text-[#71717a]">
                Live memory budget telemetry, decoder pooling & leak mitigation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge()}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#202030] text-[#a1a1aa] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Main Gauges Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* JS Heap */}
            <div className="p-3.5 bg-[#161624] border border-[#222234] rounded-xl space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  JS Heap Memory
                </span>
                <span className="font-mono text-white font-medium">
                  {telemetry.jsHeapUsedMb > 0 ? `${telemetry.jsHeapUsedMb} MB` : 'N/A (Non-Chromium)'}
                </span>
              </div>
              <div className="h-2 bg-[#0c0c14] rounded-full overflow-hidden border border-[#20202e]">
                <div
                  className={`h-full transition-all duration-300 ${
                    telemetry.jsHeapUsedMb > 2000
                      ? 'bg-rose-500'
                      : telemetry.jsHeapUsedMb > 1000
                        ? 'bg-amber-400'
                        : 'bg-indigo-500'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(5, (telemetry.jsHeapUsedMb / (telemetry.jsHeapLimitMb || 4096)) * 100)
                    )}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#71717a] font-mono">
                <span>Total: {telemetry.jsHeapTotalMb} MB</span>
                <span>Limit: {telemetry.jsHeapLimitMb} MB</span>
              </div>
            </div>

            {/* Video Decoders Pool */}
            <div className="p-3.5 bg-[#161624] border border-[#222234] rounded-xl space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  Active Video Decoders
                </span>
                <span className="font-mono text-white font-medium">
                  {telemetry.activeVideoDecoders} / 6 max
                </span>
              </div>
              <div className="h-2 bg-[#0c0c14] rounded-full overflow-hidden border border-[#20202e]">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (telemetry.activeVideoDecoders / 6) * 100)}%`,
                  }}
                />
              </div>
              <div className="text-[10px] text-[#71717a]">
                LRU bounded pooling active (evicts distant clips)
              </div>
            </div>

            {/* Tracked Blob URLs */}
            <div className="p-3.5 bg-[#161624] border border-[#222234] rounded-xl space-y-1">
              <span className="text-[11px] text-[#a1a1aa] block">Tracked Object URLs</span>
              <div className="text-lg font-bold font-mono text-white">
                {telemetry.trackedBlobUrls}
              </div>
              <p className="text-[10px] text-[#71717a]">
                Auto-revoked on project switch & reload
              </p>
            </div>

            {/* Audio Buffers Cache */}
            <div className="p-3.5 bg-[#161624] border border-[#222234] rounded-xl space-y-1">
              <span className="text-[11px] text-[#a1a1aa] block">Decoded Audio Cache</span>
              <div className="text-lg font-bold font-mono text-white">
                {telemetry.audioBuffersMb} MB
              </div>
              <p className="text-[10px] text-[#71717a]">
                Bounded to max 128 MB budget
              </p>
            </div>
          </div>

          {/* Secondary Stats Row */}
          <div className="p-3 bg-[#13131e] border border-[#202030] rounded-xl flex items-center justify-between text-xs text-[#a1a1aa]">
            <div>
              <span className="text-[#71717a]">Active Audio Nodes: </span>
              <span className="font-mono text-white">{telemetry.activeAudioDecoders}</span>
            </div>
            <div>
              <span className="text-[#71717a]">Cached Images: </span>
              <span className="font-mono text-white">{telemetry.activeImages}</span>
            </div>
            <div>
              <span className="text-[#71717a]">History Snapshots: </span>
              <span className="font-mono text-white">{telemetry.historySnapshots} / 25</span>
            </div>
          </div>

          {/* Stress Test Report (if available) */}
          {stressReport && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{stressReport}</span>
            </div>
          )}

          {/* Controls & Actions */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={handlePurge}
              className="flex-1 py-2 px-3 bg-[#202030] hover:bg-[#2b2b40] text-white text-xs font-medium rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer border border-[#2d2d42]"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Purge Caches & Run GC</span>
            </button>

            <button
              type="button"
              disabled={isStressTesting}
              onClick={handleRunStressTest}
              className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              {isStressTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing Scrub ({stressProgress}%)...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Run Scrub Stress Test</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
