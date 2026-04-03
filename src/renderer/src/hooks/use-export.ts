import * as Effect from 'effect/Effect';
import { useContext } from 'react';

import {
  type BinaryRichTextRepresentation,
  binaryRichTextRepresentations,
  richTextRepresentationExtensions,
  type TextRichTextRepresentation,
} from '../../../modules/domain/rich-text';
import { removeExtension } from '../../../modules/infrastructure/filesystem';
import {
  CurrentDocumentContext,
  InfrastructureAdaptersContext,
} from '../app-state';
import { useCurrentDocumentName } from './use-current-document-name';

export const useExport = () => {
  const currentDocumentName = useCurrentDocumentName();
  const { getExportText, getExportBinaryData } = useContext(
    CurrentDocumentContext
  );
  const { filesystem } = useContext(InfrastructureAdaptersContext);

  const exportToText =
    (representation: TextRichTextRepresentation) => async () => {
      const exportText = await getExportText(representation);

      await Effect.runPromise(
        filesystem.createNewFile({
          suggestedName: currentDocumentName
            ? removeExtension(currentDocumentName)
            : undefined,
          extensions: [richTextRepresentationExtensions[representation]],
          content: exportText,
        })
      );
    };

  const exportToBinary =
    (representation: BinaryRichTextRepresentation) => async () => {
      const exportData = await getExportBinaryData(representation);

      await Effect.runPromise(
        filesystem.createNewFile({
          suggestedName: currentDocumentName
            ? removeExtension(currentDocumentName)
            : undefined,
          extensions: [richTextRepresentationExtensions[representation]],
          content: exportData,
        })
      );
    };

  const exportToPDF = exportToBinary(binaryRichTextRepresentations.PDF);

  return {
    exportToText,
    exportToBinary,
    exportToPDF,
  };
};
