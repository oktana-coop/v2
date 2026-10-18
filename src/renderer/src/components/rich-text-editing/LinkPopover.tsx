import {
  autoPlacement,
  hide,
  inline,
  offset,
  useFloating,
} from '@floating-ui/react';
import clsx from 'clsx';
import { MouseEventHandler, useCallback, useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';

import {
  getLinkAttrsFromDomElement,
  LinkAttrs,
} from '../../../../modules/domain/rich-text';
import { ElectronContext } from '../../../../modules/infrastructure/cross-platform/browser';
import { Button } from '../actions/Button';
import { IconButton } from '../actions/IconButton';
import { CloseIcon } from '../icons';
import { Heading4 } from '../typography/headings/Heading4';
import { link as linkClasses } from './marks';

type LinkPopoverProps = {
  isOpen: boolean;
  linkData: { ref: Element; linkAttrs: LinkAttrs } | null;
  onEditLink: () => void;
  onRemoveLink: () => void;
  onClose: () => void;
};

export const LinkPopover = ({
  isOpen,
  linkData,
  onEditLink,
  onRemoveLink,
  onClose,
}: LinkPopoverProps) => {
  const { openExternalLink } = useContext(ElectronContext);
  const { x, y, strategy, refs, update } = useFloating<HTMLDivElement>({
    strategy: 'absolute',
    middleware: [offset(8), autoPlacement(), hide(), inline()],
  });

  const handleLinkClick: MouseEventHandler<HTMLAnchorElement> = useCallback(
    (ev) => {
      const linkAttrs = getLinkAttrsFromDomElement(ev.target as HTMLElement);

      if (linkAttrs.href) {
        ev.preventDefault();
        openExternalLink(linkAttrs.href);
      }
    },
    [openExternalLink]
  );

  useEffect(() => {
    if (linkData) {
      refs.setReference(linkData.ref); // Set reference programmatically
      update(); // Update the position
    }
  }, [linkData, refs, update]);

  const containerElement = document.getElementById('popover-container');

  if (!isOpen || !linkData || !containerElement) return null;

  // Using a portal to render the popover above its container in the z axis.
  return createPortal(
    <div
      ref={refs.setFloating}
      className={clsx(
        // Base styles
        'isolate w-max min-w-80 p-3',
        // Invisible border that is only visible in `forced-colors` mode for accessibility purposes
        'outline outline-1 outline-transparent focus:outline-none',
        // Handle scrolling when the popover won't fit in viewport
        'overflow-y-auto',
        // Popover background
        'bg-white/75 backdrop-blur-xl dark:bg-zinc-800/75',
        // Shadows
        'shadow-lg ring-1 ring-zinc-950/10 dark:ring-inset dark:ring-white/10',
        // Transitions
        'transition data-[closed]:data-[leave]:opacity-0 data-[leave]:duration-100 data-[leave]:ease-in'
      )}
      style={{
        position: strategy,
        top: y ?? 0,
        left: x ?? 0,
      }}
    >
      <div>
        <div className="flex">
          <Heading4 className="flex-auto text-left">
            {linkData.linkAttrs.title}
          </Heading4>
          <IconButton icon={<CloseIcon size={16} />} onClick={onClose} />
        </div>
        <div className="flex">
          <a
            className={linkClasses}
            href={linkData.linkAttrs.href}
            onClick={handleLinkClick}
          >
            {linkData.linkAttrs.href}
          </a>
        </div>
      </div>
      <div className="mt-3 flex flex-col-reverse items-center justify-end gap-3 *:w-full sm:flex-row sm:*:w-auto">
        <Button onClick={onEditLink} variant="plain">
          Edit
        </Button>
        <Button onClick={onRemoveLink} color="red">
          Remove
        </Button>
      </div>
    </div>,
    containerElement
  );
};
