// @ts-expect-error No types available in pagedjs
import { Previewer } from 'pagedjs';

import { getDefaultExportStylesheet } from './default-stylesheet';

export const paginateHtml = async ({
  html,
  container,
  document: doc,
}: {
  html: string;
  container: HTMLElement;
  document: Document;
}): Promise<void> => {
  const css = getDefaultExportStylesheet();
  const style = doc.createElement('style');
  style.textContent = css;
  doc.head.appendChild(style);

  const previewer = new Previewer();
  await previewer.preview(html, [], container);
};
