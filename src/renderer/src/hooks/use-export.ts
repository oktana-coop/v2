import * as Effect from 'effect/Effect';
import html2pdf from 'html2pdf.js';
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

  const exportToPDF = async () => {
    const originalElement = document.getElementById('editor');
    if (!originalElement) {
      throw new Error('Editor element not found for PDF export');
    }

    // Clone the element to work with it in memory
    const clonedElement = originalElement.cloneNode(true) as HTMLElement;

    // Give the cloned element a unique ID to scope styles
    clonedElement.id = 'pdf-export-clone';

    // Add styles scoped only to the cloned element
    const style = document.createElement('style');
    style.textContent = `
      #pdf-export-clone ul, #pdf-export-clone ol {
        list-style-position: outside;
        margin-left: 0;
      }
      #pdf-export-clone li {
        display: list-item;
        line-height: 2;
      }
      #pdf-export-clone ul {
        list-style-type: disc;
      }
      #pdf-export-clone ol {
        list-style-type: decimal;
      }
      #pdf-export-clone :is(h1, h2, h3, h4, h5, h6) {
        font-weight: bold;
        margin-bottom: 16px;
        color: #000000 !important;
        opacity: 1 !important;
      }
      #pdf-export-clone h1 {
        font-size: 2.5rem;
        line-height: 2.5rem;
      }
      #pdf-export-clone h2 {
        font-size: 1.5rem;
        line-height: 2rem;
      }
      #pdf-export-clone h3 {
        font-size: 1.25rem;
        line-height: 1.75rem;
      }
      #pdf-export-clone h4 {
        font-size: 1rem;
        line-height: 1.5rem;
      }
      #pdf-export-clone pre {
        background-color: #f5f5f5;
        border: 1px solid #e0e0e0;
      }
      #pdf-export-clone code {
        background-color: #f5f5f5;
      }
      #pdf-export-clone blockquote {
        border-left: 4px solid #e5e5e5;
        padding-left: 16px;
        margin-bottom: 16px;
      }
    `;

    clonedElement.insertBefore(style, clonedElement.firstChild);

    // HACK: Certain elements (like lists and code blocks) are rendered with a wrong
    // alignment, text shows lower than expected. The line below seems to fix it.
    // https://github.com/eKoopmans/html2pdf.js/issues/624#issuecomment-1570024244
    clonedElement.insertAdjacentHTML(
      'beforeend',
      '<style>img { display: inline }</style>'
    );

    const options = {
      margin: 0.5,
      image: { type: 'jpeg' as const, quality: 1 },
      html2canvas: {
        scale: 1,
        useCORS: true,
        letterRendering: true,
      },
      jsPDF: {
        unit: 'in',
        format: 'letter',
        orientation: 'portrait' as const,
      },
    };

    // Generate PDF as blob using the cloned element
    const pdfBlob = await html2pdf()
      .set(options)
      .from(clonedElement)
      .output('blob');

    // Convert blob to Uint8Array for filesystem
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const suggestedName = currentDocumentName
      ? removeExtension(currentDocumentName)
      : 'document';

    await Effect.runPromise(
      filesystem.createNewFile({
        suggestedName,
        extensions: [
          richTextRepresentationExtensions[binaryRichTextRepresentations.PDF],
        ],
        content: uint8Array,
      })
    );
  };

  return {
    exportToText,
    exportToBinary,
    exportToPDF,
  };
};
