import { type Schema } from 'prosemirror-model';
import { useCallback, useContext } from 'react';

import { type ProjectRelPath } from '../../../../../../modules/domain/project';
import {
  getDocumentRichTextContent,
  hasChanges,
  prosemirror,
  type RichTextDocument,
} from '../../../../../../modules/domain/rich-text';
import { ProseMirrorContext } from '../../../../../../modules/domain/rich-text/react/prosemirror-context';
import { ElectronContext } from '../../../../../../modules/infrastructure/cross-platform/browser';
import { FunctionalityConfigContext } from '../../../../../../modules/personalization/browser';
import { useAssetSrcResolver } from '../../../../app-state';
import { LongTextSkeleton } from '../../../../components/progress/skeletons/LongText';
import { FindBar } from '../../../../components/rich-text-editing/FindBar';
import {
  MetadataPanel,
  type MetadataPanelDiff,
} from '../../../../components/rich-text-editing/metadata';
import {
  type EditorSeed,
  ProseMirrorEditor,
} from '../../../../components/rich-text-editing/ProseMirrorEditor';
import { useEditorSeed } from '../../../../components/rich-text-editing/use-editor-seed';

const {
  assetsPlugin,
  diffPlugin,
  notesPlugin,
  openExternalLinkPlugin,
  codeBlockHighlightPlugin,
  searchPlugin,
  getDocFrontMatter,
} = prosemirror;

export type DiffViewProps = {
  docBefore: RichTextDocument;
  docAfter: RichTextDocument;
  documentPath: ProjectRelPath;
};

export type SingleDocViewProps = {
  doc: RichTextDocument;
  documentPath: ProjectRelPath;
};

const isDiffViewProps = (
  props: DiffViewProps | SingleDocViewProps
): props is DiffViewProps => {
  return (
    (props as DiffViewProps).docBefore !== undefined &&
    (props as DiffViewProps).docAfter !== undefined
  );
};

type ReadOnlyRichTextDocumentViewProps = DiffViewProps | SingleDocViewProps;

export const ReadOnlyRichTextDocumentView = (
  props: ReadOnlyRichTextDocumentViewProps
) => {
  const { representationTransformAdapterReady } =
    useContext(ProseMirrorContext);

  // TODO: Handle adapter readiness with a promise
  const adapterReady =
    isDiffViewProps(props) || representationTransformAdapterReady;

  if (!adapterReady) {
    return <LongTextSkeleton />;
  }

  return <ReadOnlyRichTextDocumentContent {...props} />;
};

type ReadOnlySeed = EditorSeed & {
  metadataPanelDiff: MetadataPanelDiff | null;
};

const ReadOnlyRichTextDocumentContent = (
  props: ReadOnlyRichTextDocumentViewProps
) => {
  const { openExternalLink } = useContext(ElectronContext);
  const { showMetadata } = useContext(FunctionalityConfigContext);
  const resolveAssetSrc = useAssetSrcResolver({ docPath: props.documentPath });
  const { proseMirrorDiff, convertToProseMirror, convertFromProseMirror } =
    useContext(ProseMirrorContext);

  const createSeed = useCallback(
    async (schema: Schema): Promise<ReadOnlySeed> => {
      if (isDiffViewProps(props)) {
        const contentBefore = getDocumentRichTextContent(props.docBefore);
        const contentAfter = getDocumentRichTextContent(props.docAfter);

        const { pmDocAfter, decorations, metadataDiff } = await proseMirrorDiff(
          {
            representation: props.docAfter.representation,
            proseMirrorSchema: schema,
            docBefore: contentBefore,
            docAfter: contentAfter,
            transformImageSrc: resolveAssetSrc,
          }
        );

        const metadataPanelDiff =
          metadataDiff === null || metadataDiff.some(hasChanges)
            ? // Only the metadata panel needs the before version as ProseMirror, for the
              // values its diff doesn't carry and its YAML, so it's converted only when
              // the metadata changed or either version's front matter can't be read.
              {
                frontMatterBefore: getDocFrontMatter(
                  await convertToProseMirror({
                    schema,
                    document: props.docBefore,
                  })
                ),
                metadataDiff,
              }
            : null;

        return {
          metadataPanelDiff,
          doc: pmDocAfter,
          plugins: [
            assetsPlugin(resolveAssetSrc),
            openExternalLinkPlugin(openExternalLink),
            diffPlugin({
              decorations,
              proseMirrorDiff,
              convertFromProseMirror,
              transformImageSrc: resolveAssetSrc,
            }),
            notesPlugin(),
            searchPlugin(),
          ],
        };
      }

      const pmDoc = await convertToProseMirror({
        schema,
        document: props.doc,
      });

      return {
        metadataPanelDiff: null,
        doc: pmDoc,
        plugins: [
          assetsPlugin(resolveAssetSrc),
          openExternalLinkPlugin(openExternalLink),
          notesPlugin(),
          codeBlockHighlightPlugin,
          searchPlugin(),
        ],
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props]
  );

  const seed = useEditorSeed(createSeed);

  if (!seed) {
    return <LongTextSkeleton />;
  }

  return (
    <>
      {showMetadata && (
        <MetadataPanel
          frontMatter={getDocFrontMatter(seed.doc)}
          diff={seed.metadataPanelDiff}
        />
      )}
      <div className="flex flex-auto p-4">
        <ProseMirrorEditor seed={seed} isEditable={false} />
        <FindBar />
      </div>
    </>
  );
};
