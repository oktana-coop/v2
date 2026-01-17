import { type Node } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { DecorationSet } from 'prosemirror-view';

import { type TextRichTextRepresentation } from '../../constants';
import {
  getDocumentRichTextContent,
  type RichTextDocument,
} from '../../models';
import {
  type ProseMirrorDiffArgs,
  type ProseMirrorDiffResult,
} from '../../ports';
import { type DiffDecorationClasses } from './decorations';

export const diffPluginKey = new PluginKey('pm-diff');

type ProseMirrorDiffFn = (
  args: ProseMirrorDiffArgs
) => Promise<ProseMirrorDiffResult>;

export type ConvertFromProseMirrorArgs = {
  pmDoc: Node;
  to: TextRichTextRepresentation;
};

type DiffPluginArgs = {
  decorations: DecorationSet;
  proseMirrorDiff: ProseMirrorDiffFn;
  convertFromProseMirror: (args: ConvertFromProseMirrorArgs) => Promise<string>;
  decorationClasses: DiffDecorationClasses;
  diffWith?: RichTextDocument;
};

export const diffPlugin = (args: DiffPluginArgs) =>
  new Plugin({
    key: diffPluginKey,
    state: {
      init: () => {
        return args.decorations;
      },
      apply(tr, oldDecorations) {
        const trDecorations = tr.getMeta(diffPluginKey);
        if (trDecorations) {
          return trDecorations;
        }

        return oldDecorations.map(tr.mapping, tr.doc);
      },
    },
    view(editorView) {
      let aborted = false;

      async function runDiff(diffWith: RichTextDocument) {
        const contentBefore = getDocumentRichTextContent(diffWith);
        const contentAfter = await args.convertFromProseMirror({
          pmDoc: editorView.state.doc,
          to: diffWith.representation,
        });

        const { decorations } = await args.proseMirrorDiff({
          representation: diffWith.representation,
          proseMirrorSchema: editorView.state.schema,
          decorationClasses: args.decorationClasses,
          docBefore: contentBefore,
          docAfter: contentAfter,
        });

        if (aborted) return;

        const tr = editorView.state.tr.setMeta(diffPluginKey, decorations);
        editorView.dispatch(tr);
      }

      return {
        update(view, prevState) {
          if (args.diffWith && view.state.doc !== prevState.doc) {
            runDiff(args.diffWith);
          }
        },
        destroy() {
          aborted = true;
        },
      };
    },
    props: {
      decorations(state) {
        // The plugin's state just contains the decorations
        return diffPluginKey.getState(state);
      },
    },
  });
