import { composeStories } from '@storybook/react';
import { render, screen } from '@testing-library/react';

import { type ProjectId } from '../../../../modules/domain/project/models';
import * as NavBarStories from './NavBar.stories';

const { Project } = composeStories(NavBarStories);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NavBar', () => {
  describe('project', () => {
    const projectId = '/path/to/project' as ProjectId;

    it('renders the nav bar', () => {
      render(<Project />);

      expect(screen.getByTestId('nav-bar')).toBeInTheDocument();
    });

    it('renders the logo linking to the edit view', () => {
      render(<Project />);

      const logoLink = screen
        .getByTestId('nav-bar')
        .querySelector(
          `a[href="/projects/${encodeURIComponent(projectId)}/artifacts"]`
        );
      expect(logoLink).toBeInTheDocument();
      expect(logoLink?.querySelector('svg')).toBeInTheDocument();
    });

    it('renders Edit, History, and Options linking to project-specific routes', () => {
      render(<Project />);

      const links = screen.getByTestId('nav-bar').querySelectorAll('a[href]');
      const hrefs = Array.from(links).map((link) => link.getAttribute('href'));

      // Logo + Edit + History + Options = 4 links
      expect(links).toHaveLength(4);
      expect(hrefs).toContain(
        `/projects/${encodeURIComponent(projectId)}/artifacts`
      );
      expect(hrefs).toContain(
        `/projects/${encodeURIComponent(projectId)}/history`
      );
      expect(hrefs).toContain('/settings');
    });
  });
});
