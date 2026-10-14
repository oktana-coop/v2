import { unifiedMergeView } from '@codemirror/merge';
import { type Extension } from '@codemirror/state';

export const diffWith = (original: string): Extension =>
  unifiedMergeView({ original, mergeControls: false });
