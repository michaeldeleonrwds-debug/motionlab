import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useEditorStore } from './useEditorStore';
import { useEditorSelection } from './useEditorSelection';

describe('panel subscriptions', () => {
  it('ignores transport ticks but responds to project edits', () => {
    let renders = 0;
    const original = useEditorStore.getState();
    const { result, unmount } = renderHook(() => {
      renders++;
      return useEditorSelection(['project', 'selectedClipId']);
    });
    const initial = renders;
    act(() => { for (let frame = 0; frame < 300; frame++) useEditorStore.setState({ currentTime: frame / 30 }); });
    expect(renders).toBe(initial);
    act(() => useEditorStore.setState({ project: { ...original.project, name: 'Edited' } }));
    expect(result.current.project.name).toBe('Edited');
    expect(renders).toBe(initial + 1);
    unmount();
    useEditorStore.setState(original);
  });
});
