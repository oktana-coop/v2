// @vitest-environment node
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { onTestFinished } from 'vitest';

import { watchPerDirectory } from './per-directory-watch';

// Watches run against a real directory: what is under test is how the
// operating system reports changes, which a fake cannot tell.
describe('watchPerDirectory', () => {
  const tempDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'per-directory-watch-'));
    onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
    return dir;
  };

  // Starts a watch closed with the test, and collects what it reports.
  const watched = (path: string) => {
    const events: Array<string | null> = [];
    const onError = vi.fn();
    const close = watchPerDirectory({
      path,
      onEvent: (filename) => events.push(filename),
      onError,
    });
    onTestFinished(close);

    // Waits for the reports caused by `change`, so that the next step starts
    // from a quiet watch.
    const expectReported = async (filename: string, change: () => void) => {
      events.length = 0;
      change();
      await vi.waitFor(() => expect(events).toContain(filename));
    };

    return { events, onError, close, expectReported };
  };

  // How git and editors that save atomically put a new version in place.
  const replace = (path: string, content: string) => {
    writeFileSync(`${path}.tmp`, content);
    renameSync(`${path}.tmp`, path);
  };

  it('reports a changed file', async () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'hello.md'), 'Hello');
    const { expectReported } = watched(dir);

    await expectReported('hello.md', () =>
      appendFileSync(join(dir, 'hello.md'), ' again')
    );
  });

  // Node's recursive watch on Linux stops reporting a file after this.
  it('keeps reporting a file after it is replaced', async () => {
    const dir = tempDir();
    const file = join(dir, 'hello.md');
    writeFileSync(file, 'Hello');
    const { expectReported } = watched(dir);

    await expectReported('hello.md', () => replace(file, 'Hello on a branch'));
    await expectReported('hello.md', () => replace(file, 'Hello'));
    await expectReported('hello.md', () => appendFileSync(file, ' edited'));
  });

  it('reports a file in a nested directory, relative to the watched one', async () => {
    const dir = tempDir();
    mkdirSync(join(dir, 'notes', 'drafts'), { recursive: true });
    writeFileSync(join(dir, 'notes', 'drafts', 'idea.md'), 'An idea');
    const { expectReported } = watched(dir);

    await expectReported(join('notes', 'drafts', 'idea.md'), () =>
      appendFileSync(join(dir, 'notes', 'drafts', 'idea.md'), ' more')
    );
  });

  it('reports files in a directory created after the watch started', async () => {
    const dir = tempDir();
    const { expectReported } = watched(dir);

    await expectReported('notes', () => mkdirSync(join(dir, 'notes')));
    await expectReported(join('notes', 'idea.md'), () =>
      writeFileSync(join(dir, 'notes', 'idea.md'), 'An idea')
    );
  });

  it('reports files in a directory removed and created again', async () => {
    const dir = tempDir();
    mkdirSync(join(dir, 'notes'));
    const { expectReported, onError } = watched(dir);

    await expectReported('notes', () =>
      rmSync(join(dir, 'notes'), { recursive: true })
    );
    await expectReported('notes', () => mkdirSync(join(dir, 'notes')));
    await expectReported(join('notes', 'idea.md'), () =>
      writeFileSync(join(dir, 'notes', 'idea.md'), 'An idea')
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports nothing once closed', async () => {
    const dir = tempDir();
    mkdirSync(join(dir, 'notes'));
    const { events, close } = watched(dir);

    close();
    writeFileSync(join(dir, 'hello.md'), 'Hello');
    writeFileSync(join(dir, 'notes', 'idea.md'), 'An idea');
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(events).toEqual([]);
  });

  it('throws for a directory that cannot be watched', () => {
    const dir = tempDir();

    expect(() =>
      watchPerDirectory({
        path: join(dir, 'missing'),
        onEvent: vi.fn(),
        onError: vi.fn(),
      })
    ).toThrow();
  });
});
