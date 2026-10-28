import { useEditorSelection } from '../store/useEditorSelection';
import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Download,
  Film,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Ban,
  PlayCircle,
  Terminal,
} from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import {
  generateExportCompositionSpec,
  runDeterministicExport,
  type ExportProgressState,
  type ExportResult,
} from '../engine/exportEngine';
import type { ExportSettings, FrameRate, ResolutionPreset } from '../types/editor';

export const ExportModal: React.FC = () => {
  const { project, isExportModalOpen, setExportModalOpen } = useEditorSelection(['project', 'isExportModalOpen', 'setExportModalOpen']);

  const [resolution, setResolution] = useState<ResolutionPreset>(
    project.resolution
  );
  const [fps, setFps] = useState<FrameRate>(project.fps);
  const [quality, setQuality] = useState<ExportSettings['quality']>('high');

  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState<ExportProgressState | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean | null>(null);
  const [ffmpegVersion, setFfmpegVersion] = useState<string>('');

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isExportModalOpen) {
      setResolution(project.resolution);
      setFps(project.fps);
      setExportError(null);
      fetch('/api/export/capabilities')
        .then((r) => r.json())
        .then((data) => {
          setFfmpegAvailable(Boolean(data.available));
          setFfmpegVersion(data.version || 'FFmpeg');
        })
        .catch(() => setFfmpegAvailable(false));
    }
  }, [isExportModalOpen, project.resolution, project.fps]);

  if (!isExportModalOpen) return null;

  const settings: ExportSettings = {
    format: 'mp4',
    videoCodec: 'H.264',
    audioCodec: 'AAC',
    resolution,
    fps,
    quality,
  };

  const spec = generateExportCompositionSpec(project, settings);

  const handleStartExport = async () => {
    if (project.clips.length === 0) {
      setExportError(
        'Cannot export an empty timeline. Add at least one video, image, audio, or text clip first.'
      );
      return;
    }

    setIsRendering(true);
    setExportError(null);
    setExportResult(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await runDeterministicExport(
        project,
        project.mediaAssets,
        settings,
        (state) => setProgress(state),
        controller.signal
      );
      setExportResult(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'EXPORT_CANCELLED') {
        setExportError('Render cancelled by user.');
      } else {
        setExportError(
          err instanceof Error ? err.message : 'Export failed unexpectedly.'
        );
      }
      setProgress(null);
    } finally {
      setIsRendering(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelRender = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div
      data-testid="export-modal"
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 select-none"
    >
      <div className="w-full max-w-2xl bg-[#0d0d11] border border-[#24242f] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="h-11 px-4 bg-[#111116] border-b border-[#22222c] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Film className="w-4 h-4 text-[#8b93ff]" />
            <span className="text-xs font-semibold tracking-tight text-[#f4f4f5]">
              Export Master Video (MP4 • H.264 + AAC)
            </span>
          </div>
          {!isRendering && (
            <button
              type="button"
              data-testid="close-export-modal-btn"
              onClick={() => setExportModalOpen(false)}
              className="p-1 text-[#71717a] hover:text-[#f4f4f5] rounded-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {/* Encoder Engine Status */}
          <div className="p-3 bg-[#121217] border border-[#22222c] rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Terminal className="w-4 h-4 text-[#8b93ff]" />
              <div>
                <div className="text-[11px] font-medium text-[#f4f4f5]">
                  Render Pipeline: Deterministic Canvas2D + WebAudio WAV + FFmpeg H.264/AAC
                </div>
                <div className="text-[10px] font-mono text-[#71717a]">
                  {ffmpegAvailable
                    ? `Active Engine: ${ffmpegVersion}`
                    : 'Checking local FFmpeg render service...'}
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full">
              libx264 + aac
            </span>
          </div>

          {/* Export Settings Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-[#8e8e98] mb-1">
                Output Resolution ({project.aspectRatio})
              </label>
              <select
                data-testid="export-resolution-select"
                disabled={isRendering}
                value={resolution}
                onChange={(e) =>
                  setResolution(e.target.value as ResolutionPreset)
                }
                className="w-full h-8 pl-2.5 pr-6 bg-[#121217] border border-[#262632] rounded-md font-mono text-[#f4f4f5]"
              >
                <option value="1080p">1080p Full HD</option>
                <option value="720p">720p Standard HD</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[#8e8e98] mb-1">
                Frame Rate
              </label>
              <select
                data-testid="export-fps-select"
                disabled={isRendering}
                value={fps}
                onChange={(e) => setFps(Number(e.target.value) as FrameRate)}
                className="w-full h-8 pl-2.5 pr-6 bg-[#121217] border border-[#262632] rounded-md font-mono text-[#f4f4f5]"
              >
                <option value={24}>24 FPS (Cinema)</option>
                <option value={30}>30 FPS (Broadcast)</option>
                <option value={60}>60 FPS (High Motion)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[#8e8e98] mb-1">
                Encoding Quality
              </label>
              <select
                data-testid="export-quality-select"
                disabled={isRendering}
                value={quality}
                onChange={(e) =>
                  setQuality(e.target.value as ExportSettings['quality'])
                }
                className="w-full h-8 pl-2.5 pr-6 bg-[#121217] border border-[#262632] rounded-md font-mono text-[#f4f4f5]"
              >
                <option value="high">High (CRF 18 • Master)</option>
                <option value="standard">Standard (CRF 21 • Web)</option>
                <option value="draft">Draft (CRF 25 • Fast)</option>
              </select>
            </div>
          </div>

          {/* Estimated Output Parameters Box */}
          <div
            data-testid="export-estimated-params"
            className="bg-[#121217] border border-[#22222c] rounded-lg p-3 space-y-2"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8e8e98]">
              Estimated Output Parameters
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono">
              <div className="bg-[#09090c] p-2 rounded-md border border-[#1f1f27]">
                <div className="text-[10px] text-[#71717a]">Dimensions</div>
                <div className="text-[#f4f4f5] font-semibold">
                  {spec.width}×{spec.height}
                </div>
              </div>
              <div className="bg-[#09090c] p-2 rounded-md border border-[#1f1f27]">
                <div className="text-[10px] text-[#71717a]">Total Frames</div>
                <div className="text-[#f4f4f5] font-semibold">
                  {spec.totalFrames} ({spec.durationSeconds.toFixed(2)}s)
                </div>
              </div>
              <div className="bg-[#09090c] p-2 rounded-md border border-[#1f1f27]">
                <div className="text-[10px] text-[#71717a]">Est. Bitrate</div>
                <div className="text-[#f4f4f5] font-semibold">
                  ~{spec.estimatedBitrateMbps} Mbps
                </div>
              </div>
              <div className="bg-[#09090c] p-2 rounded-md border border-[#1f1f27]">
                <div className="text-[10px] text-[#71717a]">Composition</div>
                <div className="text-[#f4f4f5] font-semibold">
                  {spec.videoClipCount}V • {spec.audioClipCount}A •{' '}
                  {spec.textClipCount}T • {spec.transitionCount}FX
                </div>
              </div>
            </div>
          </div>

          {/* Real-Time Progress Bar */}
          {(isRendering || progress) && (
            <div
              data-testid="export-progress-container"
              className="bg-[#121217] border border-[#2c2e45] rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-medium text-[#f4f4f5]">
                  {isRendering ? (
                    <Loader2 className="w-4 h-4 text-[#8b93ff] animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                  <span data-testid="export-progress-message">
                    {progress?.message || 'Initializing export...'}
                  </span>
                </div>
                <span
                  data-testid="export-progress-percent"
                  className="font-mono font-semibold text-[#a5acff]"
                >
                  {progress?.percent ?? 0}%
                </span>
              </div>

              <div className="w-full h-2 bg-[#09090c] rounded-full overflow-hidden border border-[#22222c]">
                <div
                  data-testid="export-progress-bar"
                  style={{ width: `${progress?.percent ?? 0}%` }}
                  className="h-full bg-[#5e6ad2] transition-all duration-150"
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-[#71717a]">
                <span>
                  Frame {progress?.currentFrame ?? 0} /{' '}
                  {progress?.totalFrames ?? spec.totalFrames}
                </span>
                <span>Container: MP4 (H.264 / AAC)</span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {exportError && (
            <div
              data-testid="export-error-banner"
              className="p-3 bg-rose-950/40 border border-rose-500/50 rounded-lg text-xs text-rose-200 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{exportError}</span>
            </div>
          )}

          {/* Completed Export Preview & Download */}
          {exportResult && !isRendering && (
            <div
              data-testid="export-complete-panel"
              className="bg-[#101916] border border-emerald-500/40 rounded-lg p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlayCircle className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-emerald-200">
                    Rendered MP4 Verified ({Math.round(exportResult.fileSize / 1024)}{' '}
                    KB • {exportResult.width}×{exportResult.height} @{' '}
                    {exportResult.fps}fps)
                  </span>
                </div>
                <a
                  href={exportResult.downloadUrl}
                  download={`${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`}
                  data-testid="download-export-btn"
                  className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-md flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download MP4</span>
                </a>
              </div>

              {/* Playable Verification Preview of Actual Exported MP4 File */}
              <div className="bg-black border border-[#22222c] rounded-md overflow-hidden flex justify-center">
                <video
                  data-testid="exported-video-player"
                  src={exportResult.downloadUrl}
                  controls
                  className="max-h-52 w-auto"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="h-12 px-4 bg-[#111116] border-t border-[#22222c] flex items-center justify-between">
          <div className="text-[11px] text-[#71717a]">
            Preview and exported MP4 share the unified Canvas2D + OfflineAudio pipeline.
          </div>

          <div className="flex items-center gap-2">
            {isRendering ? (
              <button
                type="button"
                data-testid="cancel-export-btn"
                onClick={handleCancelRender}
                className="h-8 px-3.5 bg-rose-700 hover:bg-rose-600 text-white text-xs font-medium rounded-md flex items-center gap-1.5 cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Cancel Render</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setExportModalOpen(false)}
                  className="h-8 px-3 bg-[#181820] hover:bg-[#22222d] border border-[#282836] text-[#d4d4d8] text-xs rounded-md cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  data-testid="start-export-btn"
                  onClick={() => void handleStartExport()}
                  className="h-8 px-4 bg-[#5e6ad2] hover:bg-[#6e79de] text-white font-medium text-xs rounded-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Start Render</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
