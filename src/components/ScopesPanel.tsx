/**
 * MotionLab 3.0 — Real-Time Video Scopes Monitor
 * Visualizes RGB Parade, Luma Histogram, Waveform Monitor,
 * and Vectorscope telemetry for professional color grading.
 */

import React, { useRef, useEffect, useState } from 'react';
import { BarChart3, Activity, Compass, Eye, Maximize2, Minimize2 } from 'lucide-react';
import { extractVideoScopes, drawVectorscopeCanvas } from '../videoFx/scopesEngine';
import { VideoScopesData } from '../videoFx/types';

interface ScopesPanelProps {
  getCanvasElement?: () => HTMLCanvasElement | null;
  className?: string;
}

type ScopeMode = 'waveform' | 'vectorscope' | 'rgb-histogram' | 'luma-histogram';

export const ScopesPanel: React.FC<ScopesPanelProps> = ({ getCanvasElement, className }) => {
  const [activeScope, setActiveScope] = useState<ScopeMode>('waveform');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let isRunning = true;

    const renderScope = () => {
      if (!isRunning) return;

      const sourceCanvas = getCanvasElement
        ? getCanvasElement()
        : (document.getElementById('motionlab-canvas') as HTMLCanvasElement | null) ||
          (document.querySelector('canvas') as HTMLCanvasElement | null);

      const targetCanvas = canvasRef.current;

      if (sourceCanvas && targetCanvas) {
        const tCtx = targetCanvas.getContext('2d');
        const sCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });

        if (tCtx && sCtx && sourceCanvas.width > 0 && sourceCanvas.height > 0) {
          const w = targetCanvas.width;
          const h = targetCanvas.height;

          try {
            // Get pixel data from source (downsampled to 320x180 for 60fps performance)
            const offscreen = document.createElement('canvas');
            offscreen.width = 320;
            offscreen.height = 180;
            const offCtx = offscreen.getContext('2d');
            if (offCtx) {
              offCtx.drawImage(sourceCanvas, 0, 0, 320, 180);
              const imgData = offCtx.getImageData(0, 0, 320, 180);
              const scopes = extractVideoScopes(imgData.data, 320, 180, w);

              tCtx.clearRect(0, 0, w, h);

              // 1. WAVEFORM
              if (activeScope === 'waveform') {
                tCtx.fillStyle = '#09090d';
                tCtx.fillRect(0, 0, w, h);

                // Grid lines (0, 25%, 50%, 75%, 100% IRE)
                tCtx.strokeStyle = '#1e1e2c';
                tCtx.lineWidth = 1;
                for (let ire = 0; ire <= 4; ire++) {
                  const y = Math.round((ire / 4) * (h - 20) + 10);
                  tCtx.beginPath();
                  tCtx.moveTo(0, y);
                  tCtx.lineTo(w, y);
                  tCtx.stroke();
                }

                // Draw waveform column dots
                const colW = w / scopes.waveformWidth;
                for (let y = 0; y < 256; y++) {
                  for (let x = 0; x < scopes.waveformWidth; x++) {
                    const density = scopes.waveform[y * scopes.waveformWidth + x];
                    if (density > 0) {
                      const alpha = Math.min(1.0, density / 100);
                      tCtx.fillStyle = `rgba(52, 211, 153, ${alpha})`;
                      const py = (y / 256) * (h - 20) + 10;
                      tCtx.fillRect(x * colW, py, 1.2, 1.2);
                    }
                  }
                }
              }

              // 2. VECTORSCOPE
              else if (activeScope === 'vectorscope') {
                drawVectorscopeCanvas(tCtx, w, h, scopes.vectorscope);
              }

              // 3. RGB HISTOGRAM
              else if (activeScope === 'rgb-histogram') {
                tCtx.fillStyle = '#09090d';
                tCtx.fillRect(0, 0, w, h);

                const maxCount = Math.max(
                  ...scopes.rgbHistogram.r,
                  ...scopes.rgbHistogram.g,
                  ...scopes.rgbHistogram.b,
                  10
                );

                const binW = w / 256;
                // Draw Red
                tCtx.fillStyle = 'rgba(239, 68, 68, 0.45)';
                for (let b = 0; b < 256; b++) {
                  const barH = (scopes.rgbHistogram.r[b] / maxCount) * (h - 10);
                  tCtx.fillRect(b * binW, h - barH, binW, barH);
                }
                // Draw Green
                tCtx.fillStyle = 'rgba(34, 197, 94, 0.45)';
                for (let b = 0; b < 256; b++) {
                  const barH = (scopes.rgbHistogram.g[b] / maxCount) * (h - 10);
                  tCtx.fillRect(b * binW, h - barH, binW, barH);
                }
                // Draw Blue
                tCtx.fillStyle = 'rgba(59, 130, 246, 0.45)';
                for (let b = 0; b < 256; b++) {
                  const barH = (scopes.rgbHistogram.b[b] / maxCount) * (h - 10);
                  tCtx.fillRect(b * binW, h - barH, binW, barH);
                }
              }

              // 4. LUMA HISTOGRAM
              else if (activeScope === 'luma-histogram') {
                tCtx.fillStyle = '#09090d';
                tCtx.fillRect(0, 0, w, h);

                const maxCount = Math.max(...scopes.lumaHistogram, 10);
                const binW = w / 256;

                tCtx.fillStyle = '#a1a1aa';
                for (let b = 0; b < 256; b++) {
                  const barH = (scopes.lumaHistogram[b] / maxCount) * (h - 10);
                  tCtx.fillRect(b * binW, h - barH, binW, barH);
                }
              }
            }
          } catch {
            // Ignore cross-origin frame read restrictions during warm-up
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(renderScope);
    };

    animFrameRef.current = requestAnimationFrame(renderScope);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [activeScope, getCanvasElement]);

  return (
    <div
      className={`bg-[#0e0e14] border border-[#20202c] rounded-xl flex flex-col overflow-hidden select-none transition-all ${
        isExpanded ? 'h-64' : 'h-48'
      } ${className || ''}`}
    >
      {/* Header Tabs */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#14141e] border-b border-[#20202c] text-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveScope('waveform')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
              activeScope === 'waveform'
                ? 'bg-indigo-600 text-white'
                : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            <Activity className="w-3 h-3" />
            <span>Waveform</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveScope('vectorscope')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
              activeScope === 'vectorscope'
                ? 'bg-indigo-600 text-white'
                : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            <Compass className="w-3 h-3" />
            <span>Vectorscope</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveScope('rgb-histogram')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
              activeScope === 'rgb-histogram'
                ? 'bg-indigo-600 text-white'
                : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            <BarChart3 className="w-3 h-3" />
            <span>RGB</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveScope('luma-histogram')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
              activeScope === 'luma-histogram'
                ? 'bg-indigo-600 text-white'
                : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Luma</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? 'Collapse scope' : 'Expand scope'}
          className="text-[#71717a] hover:text-white p-0.5 rounded"
        >
          {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Scope Render Canvas */}
      <div className="flex-1 relative flex items-center justify-center p-1 bg-[#09090d]">
        <canvas
          ref={canvasRef}
          width={280}
          height={isExpanded ? 210 : 150}
          className="w-full h-full object-contain rounded"
        />
      </div>
    </div>
  );
};
