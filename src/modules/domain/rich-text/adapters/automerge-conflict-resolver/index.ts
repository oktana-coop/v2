// Note the ?url suffix
import wasmUrl from '@automerge/automerge/automerge.wasm?url';
import * as Automerge from '@automerge/automerge/slim';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';

import { mapErrorTo } from '../../../../../utils/errors';
import { versionedArtifactTypes } from '../../../../infrastructure/version-control';
import { richTextRepresentations } from '../../constants';
import {
  RepresentationTransformError,
  ResolveMergeConflictsError,
} from '../../errors';
import { CURRENT_SCHEMA_VERSION, RichTextDocument } from '../../models';
import {
  getSpansString,
  type RichTextDocumentSpan,
} from '../../models/document/automerge';
import {
  type MergeConflictResolver,
  type RepresentationTransform,
} from '../../ports';

export const createAdapter = ({
  transformToText,
}: {
  transformToText: RepresentationTransform['transformToText'];
}): MergeConflictResolver => {
  const getDocumentAutomergeSpans = (
    document: RichTextDocument
  ): Effect.Effect<
    RichTextDocumentSpan[],
    RepresentationTransformError,
    never
  > =>
    pipe(
      Effect.tryPromise({
        try: () => Automerge.initializeWasm(wasmUrl),
        catch: mapErrorTo(
          RepresentationTransformError,
          'Error in converting document to Automerge.'
        ),
      }),
      Effect.flatMap(() =>
        Effect.tryPromise({
          try: async () => {
            const automergeSpansJson = await transformToText({
              from: document.representation,
              to: richTextRepresentations.AUTOMERGE,
              input: document.content,
            });

            return JSON.parse(automergeSpansJson) as RichTextDocumentSpan[];
          },
          catch: mapErrorTo(
            RepresentationTransformError,
            'Error in converting document to Automerge.'
          ),
        })
      )
    );

  const resolveMergeConflicts: MergeConflictResolver['resolveMergeConflicts'] =
    ({ sourceDocument, targetDocument, commonAncestorDocument }) =>
      Effect.Do.pipe(
        Effect.bind('commonAncestorAutomergeDoc', () =>
          pipe(
            getDocumentAutomergeSpans(commonAncestorDocument),
            Effect.flatMap((commonAncestorDocumentAutomergeSpans) =>
              pipe(
                Effect.sync(() =>
                  Automerge.from<RichTextDocument>({
                    type: versionedArtifactTypes.RICH_TEXT_DOCUMENT,
                    schemaVersion: CURRENT_SCHEMA_VERSION,
                    representation: richTextRepresentations.AUTOMERGE,
                    content: '',
                  })
                ),
                Effect.tap((emptyDoc) =>
                  Effect.try({
                    try: () =>
                      Automerge.change(emptyDoc, (doc) =>
                        Automerge.updateSpans(
                          doc,
                          ['content'],
                          commonAncestorDocumentAutomergeSpans
                        )
                      ),
                    catch: mapErrorTo(
                      RepresentationTransformError,
                      'Error in creating an Automerge document corresponding to the common ancestor (base).'
                    ),
                  })
                )
              )
            )
          )
        ),
        Effect.bind(
          'sourceDocumentAutomergeDoc',
          ({ commonAncestorAutomergeDoc }) =>
            pipe(
              getDocumentAutomergeSpans(sourceDocument),
              Effect.flatMap((sourceDocumentAutomergeSpans) =>
                Effect.try({
                  try: () => {
                    const clonedCommonAncestor = Automerge.clone(
                      commonAncestorAutomergeDoc
                    );

                    return Automerge.change(clonedCommonAncestor, (doc) =>
                      Automerge.updateSpans(
                        doc,
                        ['content'],
                        sourceDocumentAutomergeSpans
                      )
                    );
                  },
                  catch: mapErrorTo(
                    RepresentationTransformError,
                    'Error in creating an Automerge document corresponding to the source commit version.'
                  ),
                })
              )
            )
        ),
        Effect.bind(
          'targetDocumentAutomergeDoc',
          ({ commonAncestorAutomergeDoc }) =>
            pipe(
              getDocumentAutomergeSpans(targetDocument),
              Effect.flatMap((targetDocumentAutomergeSpans) =>
                Effect.try({
                  try: () => {
                    const clonedCommonAncestor = Automerge.clone(
                      commonAncestorAutomergeDoc
                    );

                    return Automerge.change(clonedCommonAncestor, (doc) =>
                      Automerge.updateSpans(
                        doc,
                        ['content'],
                        targetDocumentAutomergeSpans
                      )
                    );
                  },
                  catch: mapErrorTo(
                    RepresentationTransformError,
                    'Error in creating an Automerge document corresponding to the target commit version.'
                  ),
                })
              )
            )
        ),
        Effect.flatMap(
          ({ sourceDocumentAutomergeDoc, targetDocumentAutomergeDoc }) =>
            pipe(
              Effect.try({
                try: () =>
                  Automerge.merge(
                    sourceDocumentAutomergeDoc,
                    targetDocumentAutomergeDoc
                  ),
                catch: mapErrorTo(
                  ResolveMergeConflictsError,
                  'Error in merging source and target versions using Automerge.'
                ),
              }),
              Effect.flatMap((mergedAutomergeDoc) =>
                Effect.tryPromise({
                  try: async () => {
                    const mergedDocumentContent = await transformToText({
                      from: richTextRepresentations.AUTOMERGE,
                      to: targetDocument.representation,
                      input: getSpansString(mergedAutomergeDoc),
                    });

                    return {
                      mergedDocument: {
                        type: versionedArtifactTypes.RICH_TEXT_DOCUMENT,
                        schemaVersion: CURRENT_SCHEMA_VERSION,
                        representation: targetDocument.representation,
                        content: mergedDocumentContent,
                      },
                    };
                  },
                  catch: mapErrorTo(
                    RepresentationTransformError,
                    'Error in converting merged document to original representation.'
                  ),
                })
              )
            )
        )
      );

  return {
    resolveMergeConflicts,
  };
};
