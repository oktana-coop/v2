import type { ReactNode } from 'react';

export type Heading1Props = { children: ReactNode };

// TODO: Add proper styles
export const Heading1 = ({ children }: Heading1Props) => <h1>{children}</h1>;
