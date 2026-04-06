import { PAGEDJS_RENDERED_EVENT } from '../common/constants';
import { paginateHtml } from '../common/paginate-html';

export const initPrintPage = (container: HTMLElement): void => {
  window.setContent = async (html: string) => {
    await paginateHtml({ html, container, document });
    window.dispatchEvent(new Event(PAGEDJS_RENDERED_EVENT));
  };
};
