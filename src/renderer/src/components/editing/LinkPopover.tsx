import { useFloating } from '@floating-ui/react';
import clsx from 'clsx';
import { type RefObject, useEffect } from 'react';

import { LinkAttrs } from '../../../../modules/rich-text';
import { Button } from '../actions/Button';
import { Heading4 } from '../typography/headings/Heading4';
import { link as linkClasses } from './marks';

type LinkPopoverProps = {
  isOpen: boolean;
  linkData: { ref: Element; linkAttrs: LinkAttrs } | null;
  onEditLink: () => void;
  onRemoveLink: () => void;
};

export const LinkPopover = ({
  isOpen,
  linkData,
  onEditLink,
  onRemoveLink,
}: LinkPopoverProps) => {
  const { x, strategy, refs, update } = useFloating<HTMLDivElement>({
    strategy: 'absolute',
  });

  useEffect(() => {
    if (linkData) {
      refs.setReference(linkData.ref); // Set reference programmatically
      update(); // Update the position
    }
  }, [linkData, refs, update]);

  if (!isOpen || !linkData) return null;

  return (
    <div
      ref={refs.floating as RefObject<HTMLDivElement>}
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
        top: linkData.ref.getBoundingClientRect().bottom + 8,
        left: x ?? 0,
      }}
    >
      <div>
        <Heading4 className="text-left">{linkData.linkAttrs.title}</Heading4>
        <div className="flex">
          <a className={linkClasses} href={linkData.linkAttrs.href}>
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
    </div>
  );
};
