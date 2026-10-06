import { render, screen } from '@testing-library/react';
import * as Effect from 'effect/Effect';
import { MemoryRouter } from 'react-router';

import {
  type ArtifactKind,
  artifactKinds,
  parseProjectId,
  parseProjectRelPath,
  type ProjectStore,
} from '../../../../../../modules/domain/project';
import {
  createGitBlobRef,
  parseCommitId,
} from '../../../../../../modules/infrastructure/version-control';
import {
  InfrastructureAdaptersContext,
  type InfrastructureAdaptersContextType,
  ProjectContext,
  type ProjectContextType,
} from '../../../../app-state';
import { HistoricalDocumentView } from './HistoricalDocumentView';

const projectId = parseProjectId('/tmp/v2-test-project');
const changeId = parseCommitId('1111111111111111111111111111111111111111');

// Never resolves, so the view stays on the loading state.
const getDocumentAtChange = vi.fn<ProjectStore['getDocumentAtChange']>(
  () => Effect.never
);

const projectStore = { getDocumentAtChange } as unknown as ProjectStore;

const renderView = ({ path, kind }: { path: string; kind: ArtifactKind }) => {
  const documentPath = parseProjectRelPath(path);
  const documentId = createGitBlobRef({ ref: 'main', path });

  render(
    <MemoryRouter>
      <InfrastructureAdaptersContext.Provider
        value={{ projectStore } as unknown as InfrastructureAdaptersContextType}
      >
        <ProjectContext.Provider
          value={{ projectId } as unknown as ProjectContextType}
        >
          <HistoricalDocumentView
            documentId={documentId}
            documentPath={documentPath}
            kind={kind}
            resolvingArtifact={false}
            changeId={changeId}
            showDiff={false}
            onSetShowDiff={() => {}}
            diffCommitId={null}
            onDiffCommitSelect={() => {}}
            canShowDiff={false}
            diffSelectorCommits={[]}
            title="First draft"
          />
        </ProjectContext.Provider>
      </InfrastructureAdaptersContext.Provider>
    </MemoryRouter>
  );

  return { documentId };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HistoricalDocumentView', () => {
  it('loads a rich-text document at the selected change', () => {
    const { documentId } = renderView({
      path: 'notes.md',
      kind: artifactKinds.RICH_TEXT_DOCUMENT,
    });

    expect(getDocumentAtChange).toHaveBeenCalledWith({
      projectId,
      documentId,
      changeId,
    });
    expect(screen.queryByText('Preview not available')).toBeNull();
  });

  it('shows another kind of file as unsupported, without loading it', () => {
    renderView({ path: 'image.png', kind: artifactKinds.ASSET });

    expect(screen.getByText('Preview not available')).toBeTruthy();
    expect(getDocumentAtChange).not.toHaveBeenCalled();
  });
});
