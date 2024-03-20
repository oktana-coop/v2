import { composeStories } from '@storybook/react';
import { render, screen } from '@testing-library/react';
import * as NavSidebarStories from './NavBar.stories';

const { Default } = composeStories(NavSidebarStories);

describe('NavBar', () => {
  it('renders the nav bar successfully', () => {
    render(<Default />);

    // TODO: Add more tests (e.g. check for the logo, check for the nav items, routing changes, etc.)
    expect(screen.getByTestId('nav-bar')).toBeInTheDocument();
  });
});
