import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { useContext } from 'react';
import { useParams } from 'react-router';

import { type ProjectId } from '../../../../../modules/domain/project';
import {
  type BinaryRichTextRepresentation,
  binaryRichTextRepresentations,
  getDefaultRichTextRepresentationExtension,
  getDocumentRichTextContent,
  richTextRepresentations,
  type TextRichTextRepresentation,
} from '../../../../../modules/domain/rich-text';
import { RepresentationTransformContext } from '../../../../../modules/domain/rich-text/react/representation-transform-context';
import {
  FilesystemAbortErrorTag,
  removeExtension,
  removePath,
} from '../../../../../modules/infrastructure/filesystem';
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
import { useCurrentRichTextDocumentId } from '../use-current-document-id';
import {
  emptyExportAssetMounts,
  useExportAssetMounts,
} from './use-export-asset-mounts';

export const useExport = () => {
  const { filesystem, projectStore } = useContext(
    InfrastructureAdaptersContext
  );
  const { adapter } = useContext(RepresentationTransformContext);
  const { activeTemplate } = useContext(ExportTemplatesContext);
  const { dispatchNotification } = useContext(NotificationsContext);
  const { projectId: projectIdParam } = useParams();
  const documentId = useCurrentRichTextDocumentId();
  const { currentArtifact } = useContext(ProjectContext);
  const suggestedExportName = currentArtifact
    ? removeExtension(removePath(currentArtifact.path))
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
      projectStore.findRichTextDocumentById({
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
      pipe(
        filesystem.createFileWithDialog({
          suggestedName: suggestedExportName ?? undefined,
          extensions: [
            getDefaultRichTextRepresentationExtension(representation),
          ],
          content,
        }),
        // Closing the dialog without saving isn't an error.
        Effect.catchTag(FilesystemAbortErrorTag, () => Effect.void)
      )
    );

  const exportToText =
    (representation: TextRichTextRepresentation) => async () => {
      await saveToFile(representation, await getExportText(representation));
    };

  const exportToBinary =
    (representation: BinaryRichTextRepresentation) => async () => {
      try {
        await saveToFile(
          representation,
          await getExportBinaryData(representation)
        );
      } catch (err) {
        console.error(err);
        dispatchNotification(
          createErrorNotification({
            title: 'Export Error',
            message:
              'An error happened when exporting the document. Please reach out to us for support.',
          })
        );
      }
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

  return {
    getExportText,
    getExportBinaryData,
    exportToText,
    exportToBinary,
    exportToPDF,
    copyTextToClipboard,
  };
};
