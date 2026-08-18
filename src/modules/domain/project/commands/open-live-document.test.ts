import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { describe, expect, it, vi } from 'vitest';

import {
  CURRENT_SCHEMA_VERSION,
  type LiveDocument,
  type LiveDocumentChange,
  PRIMARY_RICH_TEXT_REPRESENTATION,
  type ResolvedDocument,
  type RichTextDocument,
} from '../../../../modules/domain/rich-text';
import { type ArtifactId } from '../../../../modules/infrastructure/version-control';
import { NotFoundError } from '../errors';
import { type ProjectId } from '../models';
import { type ProjectStore } from '../ports';
import { openLiveDocument } from './open-live-document';

const markdown = (content: string): RichTextDocument => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  representation: PRIMARY_RICH_TEXT_REPRESENTATION,
  content,
});

const projectId = '/projects/one' as ProjectId;
const documentId = '/blob/main/note.md' as ArtifactId;

// A live document holding text, versioned by a counter. Contributions
// anchored at an older version merge rather than replace, as the real one
// does; that is what the disk relies on.
const createFakeLiveDocument = async (initialText: string) => {
  const content = await Effect.runPromise(
    SubscriptionRef.make<LiveDocumentChange>({
      doc: markdown(initialText),
      version: '0',
    })
  );
  let versions = 0;
  const contributions: Array<{ text: string; base?: string }> = [];

  const publish = (text: string) => {
    versions += 1;
    const version = String(versions);

    return pipe(
      SubscriptionRef.set(content, { doc: markdown(text), version }),
      Effect.as(version)
    );
  };

  const live: LiveDocument = {
    content,
    change: (doc, options) =>
      pipe(
        SubscriptionRef.get(content),
        Effect.flatMap((current) => {
          contributions.push({ text: doc.content, base: options?.base });

          // An anchored contribution keeps what it had not seen.
          const merged =
            options?.base !== undefined && options.base !== current.version
              ? `${current.doc.content} + ${doc.content}`
              : doc.content;

          return publish(merged);
        })
      ),
    attachTo: () => Effect.void,
    detach: Effect.void,
    close: Effect.void,
  };

  return { live, contributions, publish };
};

const open = async ({
  diskText = 'on disk',
  liveText = diskText,
}: { diskText?: string; liveText?: string } = {}) => {
  let onDisk = diskText;
  let documentGone = false;
  const written: string[] = [];
  const onPersistError = vi.fn();
  let watcher: (() => void) | undefined;

  const { live, contributions } = await createFakeLiveDocument(liveText);

  const findDocumentById: ProjectStore['findDocumentById'] = () =>
    Effect.suspend(() =>
      documentGone
        ? Effect.fail(new NotFoundError('the document is gone'))
        : Effect.succeed<ResolvedDocument>({
            id: documentId,
            artifact: markdown(onDisk),
          })
    );

  const opened = await Effect.runPromise(
    openLiveDocument({
      createLiveDocument: () => Effect.succeed(live),
      transformToText: vi.fn(async ({ input }: { input: string }) => input),
      findDocumentById,
      updateRichTextDocumentContent: ({ content }) =>
        Effect.sync(() => {
          written.push(content);
          onDisk = content;
        }),
      subscribeToProjectDirChanges: (listener) => {
        watcher = listener;
        return () => {
          watcher = undefined;
        };
      },
      onPersistError,
    })({ projectId, documentId })
  );

  return {
    live,
    opened,
    written,
    contributions,
    onPersistError,
    // An edit made by another hand, reported like the watcher would.
    editDisk: (text: string) => {
      onDisk = text;
      watcher?.();
    },
    loseDocument: () => {
      documentGone = true;
      watcher?.();
    },
    diskHolds: () => onDisk,
  };
};

describe('openLiveDocument', () => {
  it('opens on what the store holds and writes nothing', async () => {
    const { written } = await open({ diskText: 'hello' });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(written).toEqual([]);
  });

  it('writes what the document holds once the timer passes', async () => {
    const { opened, written } = await open({ diskText: 'hello' });

    await Effect.runPromise(opened.change(markdown('hello world')));

    await vi.waitFor(() => expect(written).toContain('hello world'));
  });

  it('coalesces a burst into one write of the last content', async () => {
    const { opened, written } = await open({ diskText: 'hello' });

    for (const text of ['a', 'ab', 'abc']) {
      await Effect.runPromise(opened.change(markdown(text)));
    }
    await Effect.runPromise(opened.flush);

    expect(written).toEqual(['abc']);
  });

  it('flushes without waiting for the timer, and is idempotent', async () => {
    const { opened, written } = await open({ diskText: 'hello' });

    await Effect.runPromise(opened.change(markdown('hello world')));
    await Effect.runPromise(opened.flush);
    await Effect.runPromise(opened.flush);

    expect(written).toEqual(['hello world']);
  });

  it('drops an armed write on cancelPendingPersist', async () => {
    const { opened, written } = await open({ diskText: 'hello' });

    await Effect.runPromise(opened.change(markdown('restored old state')));
    await Effect.runPromise(opened.cancelPendingPersist);
    await Effect.runPromise(opened.flush);

    expect(written).toEqual([]);
  });

  it('writes what is pending when it closes', async () => {
    const { opened, written } = await open({ diskText: 'hello' });

    await Effect.runPromise(opened.change(markdown('hello world')));
    await Effect.runPromise(opened.close);

    expect(written).toContain('hello world');
  });

  it('carries content the document opened with to the file', async () => {
    // Joining a share opens the document on content the file does not have.
    const { written } = await open({
      diskText: 'what the file has',
      liveText: 'what the share has',
    });

    await vi.waitFor(() => expect(written).toContain('what the share has'));
  });

  it('picks up a change made outside the app', async () => {
    const { opened, editDisk } = await open({ diskText: 'hello' });

    editDisk('changed outside');

    await vi.waitFor(async () => {
      const current = await Effect.runPromise(
        SubscriptionRef.get(opened.content)
      );
      expect(current.doc.content).toContain('changed outside');
    });
  });

  it('ignores the echo of its own write', async () => {
    const { opened, editDisk, contributions } = await open({
      diskText: 'hello',
    });

    await Effect.runPromise(opened.change(markdown('hello world')));
    await Effect.runPromise(opened.flush);
    const contributedBefore = contributions.length;

    // The watcher reports the write this document just made.
    editDisk('hello world');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(contributions).toHaveLength(contributedBefore);
  });

  it('keeps typing that arrives while its own write echoes back', async () => {
    const { opened, editDisk } = await open({ diskText: 'hello' });

    await Effect.runPromise(opened.change(markdown('hello world')));
    await Effect.runPromise(opened.flush);
    // Typed after the write, before the watcher reported it.
    await Effect.runPromise(opened.change(markdown('hello world!')));

    editDisk('hello world');
    await new Promise((resolve) => setTimeout(resolve, 20));

    const current = await Effect.runPromise(
      SubscriptionRef.get(opened.content)
    );
    expect(current.doc.content).toBe('hello world!');
  });

  it('anchors an outside change at the version the file derives from', async () => {
    const { opened, editDisk, contributions } = await open({
      diskText: 'hello',
    });

    await Effect.runPromise(opened.change(markdown('hello typed')));
    await Effect.runPromise(opened.flush);
    const versionOnDisk = await Effect.runPromise(
      SubscriptionRef.get(opened.content)
    ).then((current) => current.version);

    editDisk('hello from elsewhere');
    await vi.waitFor(() =>
      expect(contributions[contributions.length - 1]?.text).toBe(
        'hello from elsewhere'
      )
    );

    expect(contributions[contributions.length - 1]?.base).toBe(versionOnDisk);
  });

  it('keeps working, silently, when the document is gone', async () => {
    const { opened, loseDocument, onPersistError, contributions } = await open({
      diskText: 'hello',
    });

    await Effect.runPromise(opened.change(markdown('hello typed')));
    const contributedBefore = contributions.length;
    loseDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(contributions).toHaveLength(contributedBefore);
    expect(onPersistError).not.toHaveBeenCalled();
  });

  it('stops following the file once closed', async () => {
    const { opened, editDisk, contributions } = await open({
      diskText: 'hello',
    });

    await Effect.runPromise(opened.close);
    const contributedBefore = contributions.length;

    editDisk('after closing');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(contributions).toHaveLength(contributedBefore);
  });
});
