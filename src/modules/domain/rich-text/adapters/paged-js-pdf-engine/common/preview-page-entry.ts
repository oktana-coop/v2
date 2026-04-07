import { paginateHtml } from '../common/paginate-html';

const createOffscreenContainer = (): HTMLElement => {
  const el = document.createElement('div');
  el.style.visibility = 'hidden';
  el.style.position = 'absolute';
  document.body.appendChild(el);
  return el;
};

const snapshotStyles = (): Element[] =>
  Array.from(document.head.querySelectorAll('style'));

const swapContent = ({
  container,
  offscreen,
  staleStyles,
}: {
  container: HTMLElement;
  offscreen: HTMLElement;
  staleStyles: Element[];
}): void => {
  staleStyles.forEach((el) => el.remove());
  container.innerHTML = '';
  container.append(...offscreen.childNodes);
  offscreen.remove();
};

// Paged.js is destructive — it replaces the container's content and injects
// styles into <head>. To avoid a flash when re-rendering with new styles,
// we paginate into a hidden offscreen container while the old content stays
// visible, then swap everything in one go once the new output is ready.
export const initPreviewPage = (container: HTMLElement): void => {
  window.setContent = async ({ html, stylesheet }) => {
    const offscreen = createOffscreenContainer();
    const staleStyles = snapshotStyles();

    await paginateHtml({ html, stylesheet, container: offscreen, document });

    swapContent({ container, offscreen, staleStyles });
  };
};
