import { composeStories } from '@storybook/react';
import { render, screen } from '@testing-library/react';
import * as NavSidebarStories from './NavSidebar.stories';

const { Default } = composeStories(NavSidebarStories);

describe('NavSidebar', () => {
  it('renders the nav sidebar successfully', () => {
    render(<Default />);

    expect(screen.getByTestId('nav-sidebar')).toBeInTheDocument();
  });
});
