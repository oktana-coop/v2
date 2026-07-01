import * as Effect from 'effect/Effect';
import { useContext } from 'react';
import { useParams } from 'react-router';

import { type ProjectId } from '../../../../modules/domain/project';
import {
  type BinaryRichTextRepresentation,
  binaryRichTextRepresentations,
  getDocumentRichTextContent,
  richTextRepresentationExtensions,
  richTextRepresentations,
  type TextRichTextRepresentation,
} from '../../../../modules/domain/rich-text';
import { RepresentationTransformContext } from '../../../../modules/domain/rich-text/react/representation-transform-context';
import { removeExtension } from '../../../../modules/infrastructure/filesystem';
import {
  ExportTemplatesContext,
  exportTemplateToCss,
} from '../../../../modules/personalization/browser';
import { InfrastructureAdaptersContext } from '../../app-state';
import { useCurrentDocumentId } from '../use-current-document-id';
import { useCurrentDocumentName } from '../use-current-document-name';
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
  const { projectId: projectIdParam } = useParams();
  const documentId = useCurrentDocumentId();
  const currentDocumentName = useCurrentDocumentName();
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
        suggestedName: currentDocumentName
          ? removeExtension(currentDocumentName)
          : undefined,
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

  return {
    getExportText,
    getExportBinaryData,
    exportToText,
    exportToBinary,
    exportToPDF,
  };
};
