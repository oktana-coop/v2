import { type DecorationAttrs } from 'prosemirror-view';

export type PMMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type PMInlineNode = {
  type: 'text';
  text: string;
  marks?: PMMark[];
};

export type PMBlockNode = {
  type: string;
  content?: PMNode[];
  attrs?: Record<string, unknown>;
};

export type PMNode = PMInlineNode | PMBlockNode;

export type InlineDiffDecoration = {
  type: 'inline';
  from: number;
  to: number;
  attrs: DecorationAttrs;
};

export type NodeDiffDecoration = {
  type: 'node';
  from: number;
  to: number;
  attrs: DecorationAttrs;
};

export type WidgetDiffDecoration = {
  type: 'widget';
  pos: number;
  node: PMBlockNode | PMInlineNode;
};

export type DiffDecoration =
  InlineDiffDecoration | NodeDiffDecoration | WidgetDiffDecoration;

export type PMSlice = {
  content?: PMNode[];
  openStart?: number;
  openEnd?: number;
};

export type PMReplaceStep = {
  stepType: 'replace';
  from: number;
  to: number;
  slice?: PMSlice;
  structure?: boolean;
};

type PMMarkRangeStep = {
  from: number;
  to: number;
  mark: PMMark;
};

export type PMAddMarkStep = PMMarkRangeStep & { stepType: 'addMark' };

export type PMRemoveMarkStep = PMMarkRangeStep & { stepType: 'removeMark' };

export type PMAttrStep = {
  stepType: 'attr';
  pos: number;
  attr: string;
  value: unknown;
};

export type PMStep =
  PMReplaceStep | PMAddMarkStep | PMRemoveMarkStep | PMAttrStep;
