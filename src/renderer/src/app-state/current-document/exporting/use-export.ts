import * as Effect from 'effect/Effect';
import { useContext } from 'react';
import { useParams } from 'react-router';

import {
  getArtifactName,
  type ProjectId,
} from '../../../../../modules/domain/project';
import {
  type BinaryRichTextRepresentation,
  binaryRichTextRepresentations,
  getDocumentRichTextContent,
  prosemirror,
  richTextRepresentationExtensions,
  richTextRepresentations,
  type TextRichTextRepresentation,
} from '../../../../../modules/domain/rich-text';
import { ProseMirrorContext } from '../../../../../modules/domain/rich-text/react/prosemirror-context';
import { RepresentationTransformContext } from '../../../../../modules/domain/rich-text/react/representation-transform-context';
import {
  createErrorNotification,
  createSuccessNotification,
  NotificationsContext,
} from '../../../../../modules/infrastructure/notifications/browser';
import {
  ExportTemplatesContext,
  exportTemplateToCss,
} from '../../../../../modules/personalization/browser';
import { ProjectContext } from '../../current-project/context';
import { InfrastructureAdaptersContext } from '../../infrastructure-adapters/context';
import { useCurrentDocumentId } from '../use-current-document-id';
import {
  emptyExportAssetMounts,
  useExportAssetMounts,
} from './use-export-asset-mounts';

const { docFromSelection } = prosemirror;

export const useExport = () => {
  const { filesystem, projectStore } = useContext(
    InfrastructureAdaptersContext
  );
  const { adapter } = useContext(RepresentationTransformContext);
  const { view, convertFromProseMirror } = useContext(ProseMirrorContext);
  const { activeTemplate } = useContext(ExportTemplatesContext);
  const { dispatchNotification } = useContext(NotificationsContext);
  const { projectId: projectIdParam } = useParams();
  const documentId = useCurrentDocumentId();
  const { currentArtifact } = useContext(ProjectContext);
  const currentDocumentName = currentArtifact
    ? getArtifactName(currentArtifact.path)
    : null;
  const getExportAssetMounts = useExportAssetMounts();

  // Fetches the latest version of the document with the guards the export needs;
  // returns the (now non-null) adapter alongside it.
  const loadDocument = async () => {
    if (!documentId) {
      throw new Error('Document ID not set when trying to export');
    }

    if (!projectStore || !projectIdParam) {
      throw new Error(
        'Versioned document store not ready yet or mismatched project.'
      );
    }

    if (!adapter) {
      throw new Error(
        'No representation transform adapter found when trying to export'
      );
    }

    const { artifact: document } = await Effect.runPromise(
      projectStore.findDocumentById({
        projectId: projectIdParam as ProjectId,
        documentId,
      })
    );

    return { document, adapter };
  };

  const getExportText = async (
    representation: TextRichTextRepresentation
  ): Promise<string> => {
    const { document, adapter } = await loadDocument();

    // Only HTML embeds referenced assets (as data URIs); other text
    // representations keep their relative asset paths untouched.
    const exportAssetMounts =
      representation === richTextRepresentations.HTML
        ? await getExportAssetMounts()
        : emptyExportAssetMounts;

    return adapter.transformToText({
      from: document.representation,
      to: representation,
      input: getDocumentRichTextContent(document),
      assetFiles: exportAssetMounts.assetFiles,
      resourcePath: exportAssetMounts.resourcePath,
    });
  };

  const getExportBinaryData = async (
    representation: BinaryRichTextRepresentation
  ): Promise<Uint8Array> => {
    const { document, adapter } = await loadDocument();
    const exportAssetMounts = await getExportAssetMounts();

    return adapter.transformToBinary({
      from: document.representation,
      to: representation,
      input: getDocumentRichTextContent(document),
      stylesheet: exportTemplateToCss(activeTemplate),
      assetFiles: exportAssetMounts.assetFiles,
      resourcePath: exportAssetMounts.resourcePath,
    });
  };

  const saveToFile = (
    representation: TextRichTextRepresentation | BinaryRichTextRepresentation,
    content: string | Uint8Array
  ) =>
    Effect.runPromise(
      filesystem.createNewFile({
        suggestedName: currentDocumentName ?? undefined,
        extensions: [richTextRepresentationExtensions[representation]],
        content,
      })
    );

  const exportToText =
    (representation: TextRichTextRepresentation) => async () => {
      await saveToFile(representation, await getExportText(representation));
    };

  const exportToBinary =
    (representation: BinaryRichTextRepresentation) => async () => {
      await saveToFile(
        representation,
        await getExportBinaryData(representation)
      );
    };

  const exportToPDF = exportToBinary(binaryRichTextRepresentations.PDF);

  const copyTextToClipboard =
    (representation: TextRichTextRepresentation) => async () => {
      try {
        const text = await getExportText(representation);
        await navigator.clipboard.writeText(text);
        dispatchNotification(
          createSuccessNotification({
            title: 'Copied to Clipboard',
            message: 'The document content was copied to the clipboard.',
          })
        );
      } catch (err) {
        console.error(err);
        dispatchNotification(
          createErrorNotification({
            title: 'Copy to Clipboard Error',
            message:
              'An error happened when trying to copy the document to the clipboard. Please try again.',
          })
        );
      }
    };

  // Read at render time: the palette re-renders when it opens, and the
  // editor selection cannot change while it is open.
  const canCopySelection = Boolean(view && !view.state.selection.empty);

  const copySelectionToClipboard =
    (representation: TextRichTextRepresentation) => async () => {
      try {
        if (!view) {
          throw new Error(
            'No editor view available when trying to copy the selection'
          );
        }

        const selectionDoc = docFromSelection(view.state);

        if (!selectionDoc) {
          throw new Error('No selection to copy');
        }

        const text = await convertFromProseMirror({
          pmDoc: selectionDoc,
          to: representation,
        });

        await navigator.clipboard.writeText(text);
        dispatchNotification(
          createSuccessNotification({
            title: 'Copied to Clipboard',
            message: 'The selection was copied to the clipboard.',
          })
        );
      } catch (err) {
        console.error(err);
        dispatchNotification(
          createErrorNotification({
            title: 'Copy to Clipboard Error',
            message:
              'An error happened when trying to copy the selection to the clipboard. Please try again.',
          })
        );
      }
    };

  return {
    getExportText,
    getExportBinaryData,
    exportToText,
    exportToBinary,
    exportToPDF,
    copyTextToClipboard,
    copySelectionToClipboard,
    canCopySelection,
  };
};
