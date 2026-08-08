import { type Schema } from 'prosemirror-model';
import { useCallback, useContext } from 'react';

import { type ProjectRelPath } from '../../../../../../modules/domain/project';
import {
  getDocumentRichTextContent,
  prosemirror,
  type RichTextDocument,
} from '../../../../../../modules/domain/rich-text';
import { ProseMirrorContext } from '../../../../../../modules/domain/rich-text/react/prosemirror-context';
import { ElectronContext } from '../../../../../../modules/infrastructure/cross-platform/browser';
import { useAssetSrcResolver } from '../../../../app-state';
import { FindBar } from '../../../../components/editing/FindBar';
import {
  type EditorSeed,
  ProseMirrorEditor,
} from '../../../../components/editing/ProseMirrorEditor';
import { useEditorSeed } from '../../../../components/editing/use-editor-seed';
import { LongTextSkeleton } from '../../../../components/progress/skeletons/LongText';

const {
  assetsPlugin,
  diffPlugin,
  notesPlugin,
  openExternalLinkPlugin,
  codeBlockHighlightPlugin,
  searchPlugin,
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

type ReadOnlyDocumentViewProps = DiffViewProps | SingleDocViewProps;

export const ReadOnlyDocumentView = (props: ReadOnlyDocumentViewProps) => {
  const { diffAdapterReady, representationTransformAdapterReady } =
    useContext(ProseMirrorContext);

  // TODO: Handle adapter readiness with a promise
  const adapterReady = isDiffViewProps(props)
    ? diffAdapterReady
    : representationTransformAdapterReady;

  if (!adapterReady) {
    return <LongTextSkeleton />;
  }

  return <ReadOnlyDocumentContent {...props} />;
};

const ReadOnlyDocumentContent = (props: ReadOnlyDocumentViewProps) => {
  const { openExternalLink } = useContext(ElectronContext);
  const resolveAssetSrc = useAssetSrcResolver({ docPath: props.documentPath });
  const { proseMirrorDiff, convertToProseMirror, convertFromProseMirror } =
    useContext(ProseMirrorContext);

  const createSeed = useCallback(
    async (schema: Schema): Promise<EditorSeed> => {
      if (isDiffViewProps(props)) {
        const contentBefore = getDocumentRichTextContent(props.docBefore);
        const contentAfter = getDocumentRichTextContent(props.docAfter);

        const { pmDocAfter, decorations } = await proseMirrorDiff({
          representation: props.docAfter.representation,
          proseMirrorSchema: schema,
          docBefore: contentBefore,
          docAfter: contentAfter,
          transformImageSrc: resolveAssetSrc,
        });

        return {
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
    <div className="flex flex-auto p-4">
      <ProseMirrorEditor seed={seed} isEditable={false} />
      <FindBar />
    </div>
  );
};
