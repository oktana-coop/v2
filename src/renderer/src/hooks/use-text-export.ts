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

export const useTextExport = () => {
  const currentDocumentName = useCurrentDocumentName();
  const { getExportText } = useContext(CurrentDocumentContext);
  const { filesystem } = useContext(InfrastructureAdaptersContext);

  const exportTo = (representation: RichTextRepresentation) => async () => {
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

  return {
    exportTo,
  };
};
