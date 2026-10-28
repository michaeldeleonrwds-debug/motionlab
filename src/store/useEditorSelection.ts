import { useShallow } from 'zustand/react/shallow';
import { useEditorStore, type EditorState } from './useEditorStore';

/** Subscribe only to the fields this panel displays, not every transport tick. */
export function useEditorSelection<K extends keyof EditorState>(keys: readonly K[]): Pick<EditorState, K> {
  return useEditorStore(useShallow((state) => {
    const selected = {} as Pick<EditorState, K>;
    for (const key of keys) selected[key] = state[key];
    return selected;
  }));
}
