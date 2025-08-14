import * as Effect from 'effect/Effect';
import { useContext } from 'react';

import {
  RichTextRepresentation,
  richTextRepresentationExtensions,
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

  const exportToText = (representation: RichTextRepresentation) => async () => {
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
    (representation: RichTextRepresentation) => async () => {
      const exportText = await getExportBinaryData(representation);

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

  return {
    exportToText,
    exportToBinary,
  };
};
