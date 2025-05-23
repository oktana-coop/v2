import { DataInteractive as HeadlessDataInteractive } from '@headlessui/react';
import React from 'react';
import { Link as ReactRouterLink, type LinkProps } from 'react-router';

export const Link = React.forwardRef(function Link(
  props: LinkProps & React.ComponentPropsWithoutRef<'a'>,
  ref: React.ForwardedRef<HTMLAnchorElement>
) {
  return (
    <HeadlessDataInteractive>
      <ReactRouterLink {...props} ref={ref} />
    </HeadlessDataInteractive>
  );
});
