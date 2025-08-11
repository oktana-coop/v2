import { Plugin } from 'prosemirror-state';

import { getLinkAttrsFromDomElement } from '../../models/link';

export const openExternalLinkPlugin = (
  openExternalLink: (url: string) => void
) =>
  new Plugin({
    props: {
      handleDOMEvents: {
        // handleDOMEvents.click gets the raw MouseEvent before ProseMirror’s internal handlers.
        // This means preventDefault() actually stops the browser’s navigation in Electron.
        // This is why we use it instead of handleClick.
        click: (_, ev) => {
          const linkAttrs = getLinkAttrsFromDomElement(
            ev.target as HTMLElement
          );

          if (linkAttrs.href) {
            ev.preventDefault();
            ev.stopPropagation();
            openExternalLink(linkAttrs.href);
            return true;
          }

          return false;
        },
      },
    },
  });
