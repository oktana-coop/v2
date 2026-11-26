import { type Extension } from '@codemirror/state';
import { type EditorView } from '@codemirror/view';
import * as Either from 'effect/Either';
import {
  type FocusEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import { plainTextLanguages } from '../../../../../../modules/domain/plain-text';
import {
  InvalidMetadataError,
  type prosemirror,
} from '../../../../../../modules/domain/rich-text';
import { getDocumentContentErrorMessage } from '../../../../../../modules/domain/rich-text/react/document-content-errors';
import { ErrorMessage, Field } from '../../../inputs/Fieldset';
import {
  type ContentBinding,
  PlainTextEditorBase,
} from '../../../plain-text-editing/PlainTextEditorBase';
import { useLinter } from '../../../plain-text-editing/use-plain-text-language';
import { useTextDraft } from '../use-text-draft';
import { draftKeymap, draftSync, replaceWithDocumentText } from './draft-sync';
import { fittedToText } from './theme';

const failureMessage = (failure: prosemirror.FrontMatterEditFailure): string =>
  failure.error instanceof InvalidMetadataError
    ? "This YAML can't be saved as properties."
    : (getDocumentContentErrorMessage(failure.error) ??
      "The properties can't be saved.");

export const FrontMatterEditor = ({
  frontMatter,
  failure,
  onEdit,
  onClearFailure,
}: {
  frontMatter: string | null;
  failure: prosemirror.FrontMatterEditFailure | null;
  onEdit: (edit: prosemirror.FrontMatterEdit) => void;
  onClearFailure: () => void;
}) => {
  const source = frontMatter ?? '';
  const draft = useTextDraft({
    source,
    failedText: failure?.edit.frontMatter ?? null,
    validate: Either.right,
    onFocus: onClearFailure,
    onCommit: ({ base, text }) => onEdit({ base, frontMatter: text }),
  });
  const linter = useLinter(plainTextLanguages.YAML);
  const view = useRef<EditorView | null>(null);
  const renderedFrontMatter = useRef({ draft, source });

  useLayoutEffect(() => {
    renderedFrontMatter.current = { draft, source };
  });

  const { binding, extensions } = useMemo(
    (): { binding: ContentBinding; extensions: Extension } => ({
      binding: {
        doc: draft.text,
        syncExtension: draftSync({
          onChange: (text) => renderedFrontMatter.current.draft.onChange(text),
          onViewChange: (editorView) => {
            view.current = editorView;
          },
        }),
      },
      extensions: [
        fittedToText,
        draftKeymap({
          commit: () => renderedFrontMatter.current.draft.commit(),
          getSource: () => renderedFrontMatter.current.source,
        }),
      ],
    }),
    // The editor starts from the text first shown; later texts reach it as
    // changes, keeping its undo history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    const editorView = view.current;

    if (editorView && editorView.state.doc.toString() !== draft.text) {
      replaceWithDocumentText({ view: editorView, text: draft.text });
    }
  }, [draft.text]);

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      draft.onFocus();
    }
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      draft.onBlur();
    }
  };

  return (
    <Field>
      <div onFocus={handleFocus} onBlur={handleBlur}>
        <PlainTextEditorBase
          binding={binding}
          language={plainTextLanguages.YAML}
          linter={linter}
          extensions={extensions}
        />
      </div>
      {failure && (
        <ErrorMessage className="mt-1">{failureMessage(failure)}</ErrorMessage>
      )}
    </Field>
  );
};
