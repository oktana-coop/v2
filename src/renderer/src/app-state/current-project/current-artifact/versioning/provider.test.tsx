import { act, render, waitFor } from '@testing-library/react';
import * as Effect from 'effect/Effect';
import { useContext } from 'react';
import { type Location, MemoryRouter, useLocation } from 'react-router';

import {
  artifactKinds,
  type ArtifactMetaData,
  type GetDocumentHistoryResponse,
  parseProjectId,
  parseProjectRelPath,
  type ProjectStore,
  RepositoryError,
  type StoredLiveDocument,
  urlEncodeProjectId,
} from '../../../../../../modules/domain/project';
import { NotificationsContext } from '../../../../../../modules/infrastructure/notifications/browser';
import {
  createGitBlobRef,
  parseCommitId,
  type UncommitedChange,
  UNCOMMITTED_CHANGE_ID,
  urlEncodeArtifactId,
  urlEncodeChangeId,
} from '../../../../../../modules/infrastructure/version-control';
import {
  promiseWithResolvers,
  useFakeTimersInTest,
} from '../../../../../../utils/test-utils';
import { CurrentDocumentContext } from '../../../current-document/context';
import { type CurrentDocumentContextType } from '../../../current-document/types';
import { ProjectContext } from '../../context';
import { type ProjectContextType } from '../../types';
import { CurrentArtifactVersioningContext } from './context';
import { CurrentArtifactVersioningProvider } from './provider';
import { type CurrentArtifactVersioningContextType } from './types';

const projectId = parseProjectId('/tmp/v2-test-project');

const documentArtifact = (path: string): ArtifactMetaData => ({
  id: createGitBlobRef({ ref: 'main', path }),
  path: parseProjectRelPath(path),
  kind: artifactKinds.RICH_TEXT_DOCUMENT,
});

const notes = documentArtifact('notes.md');
const ideas = documentArtifact('ideas.md');

const firstCommit = {
  id: parseCommitId('1111111111111111111111111111111111111111'),
  message: 'First draft',
  time: new Date('2026-10-01T10:00:00Z'),
};

const restoreCommit = {
  id: parseCommitId('2222222222222222222222222222222222222222'),
  message: 'Restore "First draft"',
  time: new Date('2026-10-02T10:00:00Z'),
};

const uncommittedChange: UncommitedChange = { id: UNCOMMITTED_CHANGE_ID };

const committedHistory: GetDocumentHistoryResponse = {
  history: [firstCommit],
  current: { schemaVersion: 1, representation: 'MARKDOWN', content: 'Hello' },
  latestChange: firstCommit,
  lastCommit: firstCommit,
  hasUncommittedChanges: false,
};

const modifiedHistory: GetDocumentHistoryResponse = {
  ...committedHistory,
  history: [uncommittedChange, firstCommit],
  latestChange: uncommittedChange,
  hasUncommittedChanges: true,
};

const restoredHistory: GetDocumentHistoryResponse = {
  ...committedHistory,
  history: [restoreCommit, firstCommit],
  latestChange: restoreCommit,
  lastCommit: restoreCommit,
};

const getDocumentHistory = vi.fn<ProjectStore['getDocumentHistory']>(() =>
  Effect.succeed(committedHistory)
);
const isContentSameAtChanges = vi.fn<ProjectStore['isContentSameAtChanges']>(
  () => Effect.succeed(false)
);
const discarded = vi.fn<() => void>();
const discardUncommittedChanges = vi.fn<
  ProjectStore['discardUncommittedChanges']
>(() => Effect.sync(discarded));
const committed = vi.fn<() => void>();
const commitDocumentChanges = vi.fn<ProjectStore['commitDocumentChanges']>(() =>
  Effect.sync(() => {
    committed();
    return { commitId: restoreCommit.id, skippedAssetPaths: [] };
  })
);
const restored = vi.fn<() => void>();
const restoreDocumentChanges = vi.fn<ProjectStore['restoreDocumentChanges']>(
  () =>
    Effect.sync(() => {
      restored();
      return { commitId: restoreCommit.id, skippedAssetPaths: [] };
    })
);

const projectStore = {
  getDocumentHistory,
  isContentSameAtChanges,
  discardUncommittedChanges,
  commitDocumentChanges,
  restoreDocumentChanges,
} as unknown as ProjectStore;

const dispatchNotification = vi.fn();

const flush = vi.fn<() => void>();
const refresh = vi.fn<() => void>();
const dropPendingLocalEdits = vi.fn<() => void>();

const liveDocument = {
  documentId: notes.id,
  flush: Effect.sync(flush),
  refresh: Effect.sync(refresh),
  dropPendingLocalEdits: Effect.sync(dropPendingLocalEdits),
} as unknown as StoredLiveDocument;

const unsavableLiveDocument = {
  ...liveDocument,
  flush: Effect.fail(new RepositoryError('the store refused the write')),
} as unknown as StoredLiveDocument;

// Stands in for the store's announcements of content changes.
const createContentChangeEvents = () => {
  const listeners = new Set<() => void>();

  const subscribe = vi.fn<
    ProjectContextType['subscribeToProjectContentChangeEvents']
  >(({ onEvent }) => {
    listeners.add(onEvent);
    return () => {
      listeners.delete(onEvent);
    };
  });

  return {
    subscribe,
    announce: () => listeners.forEach((listener) => listener()),
    listenerCount: () => listeners.size,
  };
};

let contentChangeEvents = createContentChangeEvents();

const artifactUrl = (artifact: ArtifactMetaData) =>
  `/projects/${urlEncodeProjectId(projectId)}/artifacts/${urlEncodeArtifactId(artifact.id)}`;

// What the provider exposes and where the app is, as of the latest render.
const renderVersioning = ({
  currentArtifact,
  url,
  openDocument = liveDocument,
}: {
  currentArtifact: ArtifactMetaData;
  url: string;
  openDocument?: StoredLiveDocument | null;
}) => {
  const exposed: {
    current: CurrentArtifactVersioningContextType | null;
    location: Location | null;
  } = { current: null, location: null };

  const Consumer = () => {
    exposed.current = useContext(CurrentArtifactVersioningContext);
    exposed.location = useLocation();
    return null;
  };

  const tree = (artifact: ArtifactMetaData) => (
    <MemoryRouter initialEntries={[url]}>
      <NotificationsContext.Provider
        value={{
          notifications: {},
          dispatchNotification,
          dismissNotification: () => {},
        }}
      >
        <ProjectContext.Provider
          value={
            {
              projectId,
              projectStore,
              currentArtifact: artifact,
              subscribeToProjectContentChangeEvents:
                contentChangeEvents.subscribe,
            } as unknown as ProjectContextType
          }
        >
          <CurrentDocumentContext.Provider
            value={
              {
                liveDocument: openDocument,
              } as unknown as CurrentDocumentContextType
            }
          >
            <CurrentArtifactVersioningProvider>
              <Consumer />
            </CurrentArtifactVersioningProvider>
          </CurrentDocumentContext.Provider>
        </ProjectContext.Provider>
      </NotificationsContext.Provider>
    </MemoryRouter>
  );

  const { rerender } = render(tree(currentArtifact));

  return {
    exposed,
    selectArtifact: (artifact: ArtifactMetaData) => rerender(tree(artifact)),
  };
};

const renderLoadedVersioning = async (
  args: Parameters<typeof renderVersioning>[0]
) => {
  const rendered = renderVersioning(args);

  await waitFor(() =>
    expect(rendered.exposed.current?.versionedDocumentHistory).toHaveLength(1)
  );

  return rendered;
};

beforeEach(() => {
  vi.clearAllMocks();
  contentChangeEvents = createContentChangeEvents();
});

describe('CurrentArtifactVersioningProvider', () => {
  it('loads the history of the document that opens', async () => {
    const { exposed } = await renderLoadedVersioning({
      currentArtifact: notes,
      url: artifactUrl(notes),
    });

    expect(getDocumentHistory).toHaveBeenCalledWith({
      projectId,
      documentId: notes.id,
    });
    expect(exposed.current?.versionedDocumentId).toBe(notes.id);
    expect(exposed.current?.loadingHistory).toBe(false);
    expect(exposed.current?.canCommit).toBe(false);
  });

  it('can commit when the uncommitted content differs from the last commit', async () => {
    getDocumentHistory.mockReturnValueOnce(Effect.succeed(modifiedHistory));

    const { exposed } = renderVersioning({
      currentArtifact: notes,
      url: artifactUrl(notes),
    });

    await waitFor(() => expect(exposed.current?.canCommit).toBe(true));

    expect(isContentSameAtChanges).toHaveBeenCalledWith({
      projectId,
      documentId: notes.id,
      change1: UNCOMMITTED_CHANGE_ID,
      change2: firstCommit.id,
    });
  });

  it('cannot commit when the uncommitted content equals the last commit', async () => {
    getDocumentHistory.mockReturnValueOnce(Effect.succeed(modifiedHistory));
    isContentSameAtChanges.mockReturnValueOnce(Effect.succeed(true));

    const { exposed } = renderVersioning({
      currentArtifact: notes,
      url: artifactUrl(notes),
    });

    await waitFor(() =>
      expect(exposed.current?.versionedDocumentHistory).toHaveLength(2)
    );
    await waitFor(() => expect(isContentSameAtChanges).toHaveBeenCalled());

    expect(exposed.current?.canCommit).toBe(false);
  });

  it('reloads the history after the store announces a content change', async () => {
    const { exposed } = await renderLoadedVersioning({
      currentArtifact: notes,
      url: artifactUrl(notes),
    });
    useFakeTimersInTest();
    getDocumentHistory.mockReturnValueOnce(Effect.succeed(modifiedHistory));

    act(() => contentChangeEvents.announce());
    await act(() => vi.advanceTimersByTimeAsync(500));

    expect(exposed.current?.versionedDocumentHistory).toHaveLength(2);
    expect(contentChangeEvents.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ emitOnStart: false })
    );
    expect(getDocumentHistory).toHaveBeenCalledTimes(2);
  });

  it('reloads once for changes announced in quick succession', async () => {
    await renderLoadedVersioning({
      currentArtifact: notes,
      url: artifactUrl(notes),
    });
    useFakeTimersInTest();

    act(() => contentChangeEvents.announce());
    await act(() => vi.advanceTimersByTimeAsync(300));
    act(() => contentChangeEvents.announce());
    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(getDocumentHistory).toHaveBeenCalledOnce();

    await act(() => vi.advanceTimersByTimeAsync(200));

    expect(getDocumentHistory).toHaveBeenCalledTimes(2);
  });

  it('drops a pending reload for a document no longer selected', async () => {
    const { selectArtifact } = await renderLoadedVersioning({
      currentArtifact: notes,
      url: artifactUrl(notes),
    });
    useFakeTimersInTest();

    act(() => contentChangeEvents.announce());
    selectArtifact(ideas);
    await act(() => vi.advanceTimersByTimeAsync(500));

    expect(getDocumentHistory).toHaveBeenCalledTimes(2);
    expect(getDocumentHistory).toHaveBeenLastCalledWith({
      projectId,
      documentId: ideas.id,
    });
  });

  it('starts a reload only after the load in flight ends', async () => {
    const { exposed } = await renderLoadedVersioning({
      currentArtifact: notes,
      url: artifactUrl(notes),
    });
    const slowLoad = promiseWithResolvers<GetDocumentHistoryResponse>();
    getDocumentHistory
      .mockReturnValueOnce(Effect.promise(() => slowLoad.promise))
      .mockReturnValueOnce(Effect.succeed(restoredHistory));

    const firstReload = exposed.current!.reloadDocumentHistory();
    await waitFor(() => expect(getDocumentHistory).toHaveBeenCalledTimes(2));
    const secondReload = exposed.current!.reloadDocumentHistory();
    await act(async () => {});

    expect(getDocumentHistory).toHaveBeenCalledTimes(2);

    await act(async () => {
      slowLoad.resolve(modifiedHistory);
      await Promise.all([firstReload, secondReload]);
    });

    expect(getDocumentHistory).toHaveBeenCalledTimes(3);
    expect(exposed.current?.versionedDocumentHistory[0]?.id).toEqual(
      restoreCommit.id
    );
  });

  it('stops listening to the store for a document no longer selected', async () => {
    const { selectArtifact } = await renderLoadedVersioning({
      currentArtifact: notes,
      url: artifactUrl(notes),
    });

    selectArtifact(ideas);

    await waitFor(() =>
      expect(getDocumentHistory).toHaveBeenCalledWith({
        projectId,
        documentId: ideas.id,
      })
    );
    expect(contentChangeEvents.listenerCount()).toBe(1);
  });

  it('keeps a superseded load from overwriting the selected document', async () => {
    const notesHistory = promiseWithResolvers<GetDocumentHistoryResponse>();
    getDocumentHistory
      .mockReturnValueOnce(Effect.promise(() => notesHistory.promise))
      .mockReturnValueOnce(Effect.succeed(modifiedHistory));

    const { exposed, selectArtifact } = renderVersioning({
      currentArtifact: notes,
      url: artifactUrl(notes),
    });
    selectArtifact(ideas);

    await waitFor(() =>
      expect(exposed.current?.versionedDocumentHistory).toHaveLength(2)
    );
    await act(async () => notesHistory.resolve(committedHistory));

    expect(exposed.current?.versionedDocumentId).toBe(ideas.id);
    expect(exposed.current?.versionedDocumentHistory).toHaveLength(2);
  });

  it('has no versioned document outside the artifact routes', () => {
    const { exposed } = renderVersioning({
      currentArtifact: notes,
      url: `/projects/${urlEncodeProjectId(projectId)}/history`,
    });

    expect(exposed.current?.versionedDocumentId).toBeNull();
    expect(getDocumentHistory).not.toHaveBeenCalled();
    expect(contentChangeEvents.subscribe).not.toHaveBeenCalled();
  });

  it('has no versioned document when the artifact is a binary file', () => {
    const image: ArtifactMetaData = {
      ...documentArtifact('assets/image.png'),
      kind: artifactKinds.BINARY_FILE,
    };

    const { exposed } = renderVersioning({
      currentArtifact: image,
      url: artifactUrl(image),
    });

    expect(exposed.current?.versionedDocumentId).toBeNull();
    expect(getDocumentHistory).not.toHaveBeenCalled();
  });

  describe('committing the document', () => {
    it('saves pending typing, commits and reloads the history', async () => {
      const { exposed } = await renderLoadedVersioning({
        currentArtifact: notes,
        url: artifactUrl(notes),
      });

      const didCommit = await act(() =>
        exposed.current!.onCommitDocumentChanges('Second draft')
      );

      expect(didCommit).toBe(true);
      expect(commitDocumentChanges).toHaveBeenCalledWith({
        projectId,
        documentId: notes.id,
        message: 'Second draft',
      });
      expect(flush.mock.invocationCallOrder[0]).toBeLessThan(
        committed.mock.invocationCallOrder[0]
      );
      await waitFor(() => expect(getDocumentHistory).toHaveBeenCalledTimes(2));
    });

    it('tells which referenced images were left out of the commit', async () => {
      commitDocumentChanges.mockReturnValueOnce(
        Effect.succeed({
          commitId: restoreCommit.id,
          skippedAssetPaths: [parseProjectRelPath('assets/missing.png')],
        })
      );
      const { exposed } = await renderLoadedVersioning({
        currentArtifact: notes,
        url: artifactUrl(notes),
      });

      await act(() => exposed.current!.onCommitDocumentChanges('Second draft'));

      expect(dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Some images were not saved',
          message: expect.stringContaining('missing.png'),
        })
      );
    });

    it('commits nothing while the live document is still the previous one', async () => {
      const { exposed } = await renderLoadedVersioning({
        currentArtifact: notes,
        url: artifactUrl(notes),
        openDocument: {
          ...liveDocument,
          documentId: ideas.id,
        } as StoredLiveDocument,
      });

      const didCommit = await act(() =>
        exposed.current!.onCommitDocumentChanges('Second draft')
      );

      expect(flush).not.toHaveBeenCalled();
      expect(committed).not.toHaveBeenCalled();
      expect(didCommit).toBe(false);
    });

    it('commits nothing when pending typing cannot be saved', async () => {
      const { exposed } = await renderLoadedVersioning({
        currentArtifact: notes,
        url: artifactUrl(notes),
        openDocument: unsavableLiveDocument,
      });

      const didCommit = await act(() =>
        exposed.current!.onCommitDocumentChanges('Second draft')
      );

      expect(didCommit).toBe(false);
      expect(commitDocumentChanges).not.toHaveBeenCalled();
      expect(dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Commit Error' })
      );
    });
  });

  it('reloads the history on request', async () => {
    const { exposed } = await renderLoadedVersioning({
      currentArtifact: notes,
      url: artifactUrl(notes),
    });
    getDocumentHistory.mockReturnValueOnce(Effect.succeed(modifiedHistory));

    await act(() => exposed.current!.reloadDocumentHistory());

    expect(exposed.current?.versionedDocumentHistory).toHaveLength(2);
  });

  describe('restoring a commit', () => {
    it('saves pending typing, restores, re-reads the document and selects the restore', async () => {
      const { exposed } = await renderLoadedVersioning({
        currentArtifact: notes,
        url: artifactUrl(notes),
      });
      getDocumentHistory.mockReturnValueOnce(Effect.succeed(restoredHistory));

      await act(() =>
        exposed.current!.onRestoreCommit({
          message: restoreCommit.message,
          commit: firstCommit,
        })
      );

      expect(restoreDocumentChanges).toHaveBeenCalledWith({
        projectId,
        documentId: notes.id,
        commit: firstCommit,
        message: restoreCommit.message,
      });
      expect(flush.mock.invocationCallOrder[0]).toBeLessThan(
        restored.mock.invocationCallOrder[0]
      );
      expect(refresh.mock.invocationCallOrder[0]).toBeGreaterThan(
        restored.mock.invocationCallOrder[0]
      );
      expect(exposed.current?.versionedDocumentHistory).toHaveLength(2);
      expect(exposed.location?.pathname).toBe(
        `${artifactUrl(notes)}/changes/${urlEncodeChangeId(restoreCommit.id)}`
      );
    });

    it('restores nothing when pending typing cannot be saved', async () => {
      const { exposed } = await renderLoadedVersioning({
        currentArtifact: notes,
        url: artifactUrl(notes),
        openDocument: unsavableLiveDocument,
      });

      await act(() =>
        exposed.current!.onRestoreCommit({
          message: restoreCommit.message,
          commit: firstCommit,
        })
      );

      expect(restoreDocumentChanges).not.toHaveBeenCalled();
      expect(dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Restore Version Error' })
      );
    });
  });

  it('drops pending typing, discards the changes and re-reads the document', async () => {
    getDocumentHistory.mockReturnValueOnce(Effect.succeed(modifiedHistory));
    const { exposed } = renderVersioning({
      currentArtifact: notes,
      url: artifactUrl(notes),
    });
    await waitFor(() =>
      expect(exposed.current?.versionedDocumentHistory).toHaveLength(2)
    );

    await act(() => exposed.current!.onDiscardChanges());

    expect(discardUncommittedChanges).toHaveBeenCalledWith({
      projectId,
      documentId: notes.id,
    });
    expect(dropPendingLocalEdits.mock.invocationCallOrder[0]).toBeLessThan(
      discarded.mock.invocationCallOrder[0]
    );
    expect(refresh.mock.invocationCallOrder[0]).toBeGreaterThan(
      discarded.mock.invocationCallOrder[0]
    );
    expect(exposed.current?.versionedDocumentHistory).toHaveLength(1);
  });
});
