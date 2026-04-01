import { composeStories } from '@storybook/react';
import { render, screen } from '@testing-library/react';

import { projectTypes } from '../../../../modules/domain/project';
import { type ProjectId } from '../../../../modules/domain/project/models';
import * as NavBarStories from './NavBar.stories';

const { SingleDocumentProject, MultiDocumentProject } =
  composeStories(NavBarStories);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NavBar', () => {
  describe('single-document project', () => {
    const projectId = '/path/to/project' as ProjectId;

    beforeEach(() => {
      window.config = {
        projectType: projectTypes.SINGLE_DOCUMENT_PROJECT,
      } as typeof window.config;
    });

    it('renders the nav bar', () => {
      render(<SingleDocumentProject />);

      expect(screen.getByTestId('nav-bar')).toBeInTheDocument();
    });

    it('renders the logo linking to projects', () => {
      render(<SingleDocumentProject />);

      const logoLink = screen
        .getByTestId('nav-bar')
        .querySelector('a[href="/projects"]');
      expect(logoLink).toBeInTheDocument();
      expect(logoLink?.querySelector('svg')).toBeInTheDocument();
    });

    it('renders Edit and Options but not History', () => {
      render(<SingleDocumentProject />);

      const links = screen.getByTestId('nav-bar').querySelectorAll('a[href]');
      const hrefs = Array.from(links).map((link) => link.getAttribute('href'));

      // Logo + Edit + Options = 3 links
      expect(links).toHaveLength(3);
      expect(hrefs).toContain(
        `/projects/${encodeURIComponent(projectId)}/documents`
      );
      expect(hrefs).toContain('/settings');
    });
  });

  describe('multi-document project', () => {
    const projectId = '/path/to/project' as ProjectId;

    beforeEach(() => {
      window.config = {
        projectType: projectTypes.MULTI_DOCUMENT_PROJECT,
      } as typeof window.config;
    });

    it('renders the nav bar', () => {
      render(<MultiDocumentProject />);

      expect(screen.getByTestId('nav-bar')).toBeInTheDocument();
    });

    it('renders the logo linking to projects', () => {
      render(<MultiDocumentProject />);

      const logoLink = screen
        .getByTestId('nav-bar')
        .querySelector('a[href="/projects"]');
      expect(logoLink).toBeInTheDocument();
      expect(logoLink?.querySelector('svg')).toBeInTheDocument();
    });

    it('renders Edit, History, and Options linking to project-specific routes', () => {
      render(<MultiDocumentProject />);

      const links = screen.getByTestId('nav-bar').querySelectorAll('a[href]');
      const hrefs = Array.from(links).map((link) => link.getAttribute('href'));

      // Logo + Edit + History + Options = 4 links
      expect(links).toHaveLength(4);
      expect(hrefs).toContain(
        `/projects/${encodeURIComponent(projectId)}/documents`
      );
      expect(hrefs).toContain(
        `/projects/${encodeURIComponent(projectId)}/history`
      );
      expect(hrefs).toContain('/settings');
    });
  });
});
