// @ts-expect-error No types available in pagedjs
import { Previewer } from 'pagedjs';

import { getDefaultExportStylesheet } from './default-stylesheet';

export const paginateHtml = async (
  html: string,
  container: HTMLElement
): Promise<void> => {
  const css = getDefaultExportStylesheet();
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const previewer = new Previewer();
  await previewer.preview(html, [], container);
};
