import { render, screen, waitFor } from '@testing-library/react';
import * as Effect from 'effect/Effect';
import { MemoryRouter } from 'react-router';

import {
  lineEndings,
  plainTextToRawPlainText,
  toPlainText,
} from '../../../../../../modules/domain/plain-text';
import {
  type ArtifactKind,
  artifactKinds,
  DeletedDocumentError,
  parseProjectId,
  parseProjectRelPath,
  type ProjectStore,
  TextDecodingError,
} from '../../../../../../modules/domain/project';
import {
  type CommitId,
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
const earlierChangeId = parseCommitId(
  '2222222222222222222222222222222222222222'
);

const rawText = (text: string) =>
  plainTextToRawPlainText({
    text: toPlainText(text),
    format: { lineEnding: lineEndings.LF, byteOrderMark: false },
  });

// Never resolves, so the view stays on the loading state.
const getRichTextDocumentAtChange = vi.fn<
  ProjectStore['getRichTextDocumentAtChange']
>(() => Effect.never);
const getPlainTextDocumentAtChange = vi.fn<
  ProjectStore['getPlainTextDocumentAtChange']
>(() => Effect.succeed(rawText('name: v2\n')));
const isContentSameAtChanges = vi.fn<ProjectStore['isContentSameAtChanges']>(
  () => Effect.succeed(false)
);

const projectStore = {
  getRichTextDocumentAtChange,
  getPlainTextDocumentAtChange,
  isContentSameAtChanges,
} as unknown as ProjectStore;

const renderView = ({
  path,
  kind,
  diffCommitId = null,
}: {
  path: string;
  kind: ArtifactKind;
  diffCommitId?: CommitId | null;
}) => {
  const documentPath = parseProjectRelPath(path);
  const documentId = createGitBlobRef({ ref: 'main', path });

  const { container } = render(
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
            showDiff={diffCommitId !== null}
            onSetShowDiff={() => {}}
            diffCommitId={diffCommitId}
            onDiffCommitSelect={() => {}}
            canShowDiff={diffCommitId !== null}
            diffSelectorCommits={[]}
            title="First draft"
          />
        </ProjectContext.Provider>
      </InfrastructureAdaptersContext.Provider>
    </MemoryRouter>
  );

  return {
    documentId,
    // The text the read-only editor shows, line by line.
    shownText: () =>
      Array.from(container.querySelectorAll('.cm-content .cm-line')).map(
        (line) => line.textContent
      ),
    diffMarkers: () => container.querySelectorAll('.cm-changedLine'),
  };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('HistoricalDocumentView', () => {
  it('loads a rich-text document at the selected change', () => {
    const { documentId } = renderView({
      path: 'notes.md',
      kind: artifactKinds.RICH_TEXT_DOCUMENT,
    });

    expect(getRichTextDocumentAtChange).toHaveBeenCalledWith({
      projectId,
      documentId,
      changeId,
    });
    expect(screen.queryByText('Preview not available')).toBeNull();
  });

  it('shows another kind of file as unsupported, without loading it', () => {
    renderView({ path: 'image.png', kind: artifactKinds.BINARY_FILE });

    expect(screen.getByText('Preview not available')).toBeTruthy();
    expect(getRichTextDocumentAtChange).not.toHaveBeenCalled();
    expect(getPlainTextDocumentAtChange).not.toHaveBeenCalled();
  });

  describe('a plain-text document', () => {
    it('shows the text at the selected change, read-only', async () => {
      const { documentId, shownText } = renderView({
        path: 'config.yaml',
        kind: artifactKinds.PLAIN_TEXT_DOCUMENT,
      });

      await waitFor(() => expect(shownText()).toEqual(['name: v2', '']));
      expect(getPlainTextDocumentAtChange).toHaveBeenCalledWith({
        projectId,
        documentId,
        changeId,
      });
      expect(getRichTextDocumentAtChange).not.toHaveBeenCalled();
      expect(
        document.querySelector('.cm-content')?.getAttribute('contenteditable')
      ).toBe('false');
    });

    it('shows what changed compared with an earlier version', async () => {
      getPlainTextDocumentAtChange.mockImplementation(({ changeId: at }) =>
        Effect.succeed(
          rawText(at === earlierChangeId ? 'name: v1\n' : 'name: v2\n')
        )
      );

      const { shownText, diffMarkers } = renderView({
        path: 'config.yaml',
        kind: artifactKinds.PLAIN_TEXT_DOCUMENT,
        diffCommitId: earlierChangeId,
      });

      await waitFor(() => expect(diffMarkers().length).toBeGreaterThan(0));
      expect(shownText()).toContain('name: v2');
    });

    it('shows no changes when the earlier version holds the same text', async () => {
      isContentSameAtChanges.mockReturnValueOnce(Effect.succeed(true));

      const { shownText, diffMarkers } = renderView({
        path: 'config.yaml',
        kind: artifactKinds.PLAIN_TEXT_DOCUMENT,
        diffCommitId: earlierChangeId,
      });

      await waitFor(() => expect(shownText()).toEqual(['name: v2', '']));
      expect(diffMarkers()).toHaveLength(0);
      expect(getPlainTextDocumentAtChange).toHaveBeenCalledTimes(1);
    });

    it('shows the version without changes when the earlier one is not text', async () => {
      getPlainTextDocumentAtChange.mockImplementation(({ changeId: at }) =>
        at === earlierChangeId
          ? Effect.fail(new TextDecodingError('Not text'))
          : Effect.succeed(rawText('name: v2\n'))
      );

      const { shownText, diffMarkers } = renderView({
        path: 'config.yaml',
        kind: artifactKinds.PLAIN_TEXT_DOCUMENT,
        diffCommitId: earlierChangeId,
      });

      await waitFor(() => expect(shownText()).toEqual(['name: v2', '']));
      expect(diffMarkers()).toHaveLength(0);
    });

    it("shows that a version it can't read failed to load", async () => {
      getPlainTextDocumentAtChange.mockReturnValueOnce(
        Effect.fail(new TextDecodingError('Not text'))
      );

      renderView({
        path: 'config.yaml',
        kind: artifactKinds.PLAIN_TEXT_DOCUMENT,
      });

      await waitFor(() =>
        expect(screen.getByText('Unable to load document content')).toBeTruthy()
      );
    });

    it('shows the last known text of a document deleted in that change', async () => {
      getPlainTextDocumentAtChange.mockReturnValueOnce(
        Effect.fail(
          new DeletedDocumentError('Deleted', {
            parentCommitId: earlierChangeId,
          })
        )
      );

      const { documentId, shownText } = renderView({
        path: 'config.yaml',
        kind: artifactKinds.PLAIN_TEXT_DOCUMENT,
      });

      await waitFor(() => expect(shownText()).toEqual(['name: v2', '']));
      expect(getPlainTextDocumentAtChange).toHaveBeenLastCalledWith({
        projectId,
        documentId,
        changeId: earlierChangeId,
      });
    });
  });
});
