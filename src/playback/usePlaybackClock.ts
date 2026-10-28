import { useEffect } from 'react';
import { getProjectDuration } from '../engine/timelineEngine';
import { useEditorStore } from '../store/useEditorStore';

/** One transport clock for the app, independent of the mounted monitor/workspace. */
export function usePlaybackClock(): void {
  const isPlaying = useEditorStore((state) => state.isPlaying);

  useEffect(() => {
    if (!isPlaying) return;

    let frameId: number | null = null;
    let previousTimestamp: number | null = null;
    let elapsed = 0;
    let disposed = false;

    const tick = (timestamp: number) => {
      if (disposed) return;
      const state = useEditorStore.getState();
      if (!state.isPlaying) return;

      const duration = getProjectDuration(state.project.clips);
      if (duration <= 0 || state.currentTime >= duration) {
        useEditorStore.setState({ currentTime: duration, isPlaying: false });
        return;
      }

      if (previousTimestamp !== null) {
        elapsed += Math.max(0, timestamp - previousTimestamp) / 1000;
      }
      previousTimestamp = timestamp;

      // Render at the sequence frame rate, preserving elapsed wall time on slow frames.
      if (elapsed + 1e-8 >= 1 / state.project.fps) {
        const nextTime = Math.min(duration, state.currentTime + elapsed);
        elapsed = 0;
        if (nextTime >= duration) {
          useEditorStore.setState({ currentTime: duration, isPlaying: false });
          return;
        }
        state.setCurrentTime(nextTime);
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [isPlaying]);
}
