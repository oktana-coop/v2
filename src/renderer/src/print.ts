// @ts-expect-error No types available in pagedjs
import { Previewer } from 'pagedjs';

import { getDefaultExportStylesheet } from '../../modules/domain/rich-text/adapters/paged-js-pdf-engine/common/default-stylesheet';

const container = document.getElementById('root')!;

window.setContent = async (html: string) => {
  const css = getDefaultExportStylesheet();
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const previewer = new Previewer();
  await previewer.preview(html, [], container);

  // Signal main process that pagination is complete
  window.dispatchEvent(new Event('pagedjs:rendered'));
};
