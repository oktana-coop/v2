// @ts-expect-error No types available in pagedjs
import { Previewer } from 'pagedjs';

export const paginateHtml = async ({
  html,
  stylesheet,
  container,
  document: doc,
}: {
  html: string;
  stylesheet?: string;
  container: HTMLElement;
  document: Document;
}): Promise<void> => {
  if (stylesheet) {
    const style = doc.createElement('style');
    style.textContent = stylesheet;
    doc.head.appendChild(style);
  }

  const previewer = new Previewer();
  await previewer.preview(html, undefined, container);
};
