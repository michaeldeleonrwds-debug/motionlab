import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNewProject, createTextClip } from '../engine/projectFactory';
import { useEditorStore } from '../store/useEditorStore';
import { usePlaybackClock } from './usePlaybackClock';

describe('preview transport clock', () => {
  let callbacks: Map<number, FrameRequestCallback>;
  let nextId: number;

  function frame(timestamp: number) {
    act(() => {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback(timestamp));
    });
  }

  beforeEach(() => {
    callbacks = new Map();
    nextId = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.set(++nextId, callback);
      return nextId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
    const project = createNewProject();
    const title = createTextClip(project.tracks[0].id, 0, 'Playback test');
    title.duration = 2;
    title.outPoint = 2;
    project.clips = [title];
    useEditorStore.setState({ project, currentTime: 0, isPlaying: false });
  });

  afterEach(() => {
    cleanup();
    useEditorStore.setState({ isPlaying: false });
    vi.unstubAllGlobals();
  });

  it('advances when the shared Play/Space transport action is triggered', () => {
    renderHook(usePlaybackClock);
    act(() => useEditorStore.getState().togglePlayPause());
    frame(0);
    frame(16);
    expect(useEditorStore.getState().currentTime).toBe(0);
    frame(40);
    expect(useEditorStore.getState().currentTime).toBeCloseTo(0.04, 4);
    expect(callbacks.size).toBe(1);
  });

  it('pauses without leaving a scheduled playback loop', () => {
    renderHook(usePlaybackClock);
    act(() => useEditorStore.getState().togglePlayPause());
    frame(0);
    frame(100);
    act(() => useEditorStore.getState().togglePlayPause());
    frame(1000);
    expect(useEditorStore.getState().currentTime).toBeCloseTo(0.1);
    expect(callbacks.size).toBe(0);
  });

  it('continues from a seek and preserves elapsed time on a slow frame', () => {
    renderHook(usePlaybackClock);
    act(() => useEditorStore.getState().setIsPlaying(true));
    frame(0);
    frame(100);
    act(() => useEditorStore.getState().setCurrentTime(1));
    frame(600);
    expect(useEditorStore.getState().currentTime).toBeCloseTo(1.5);
  });

  it('clamps to the end, stops, and restarts from zero on Play', () => {
    renderHook(usePlaybackClock);
    act(() => useEditorStore.setState({ currentTime: 1.9, isPlaying: true }));
    frame(0);
    frame(200);
    expect(useEditorStore.getState()).toMatchObject({ currentTime: 2, isPlaying: false });
    expect(callbacks.size).toBe(0);
    act(() => useEditorStore.getState().togglePlayPause());
    expect(useEditorStore.getState()).toMatchObject({ currentTime: 0, isPlaying: true });
    frame(5000);
    frame(5100);
    expect(useEditorStore.getState().currentTime).toBeCloseTo(0.1);
  });

  it('cancels the clock on unmount and stops on an empty sequence', () => {
    const hook = renderHook(usePlaybackClock);
    act(() => useEditorStore.getState().setIsPlaying(true));
    expect(callbacks.size).toBe(1);
    hook.unmount();
    expect(callbacks.size).toBe(0);
    act(() => useEditorStore.setState({ project: createNewProject(), isPlaying: false }));
    renderHook(usePlaybackClock);
    act(() => useEditorStore.getState().setIsPlaying(true));
    frame(0);
    expect(useEditorStore.getState().isPlaying).toBe(false);
    expect(callbacks.size).toBe(0);
  });
});
