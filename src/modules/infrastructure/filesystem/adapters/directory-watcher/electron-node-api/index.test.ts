import { EventEmitter } from 'node:events';
import { type FSWatcher } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFakeTimersInTest } from '../../../../../../utils/test-utils';
import { createAdapter, isIgnored } from './index';

// The adapter reads `watch` through the default export, so both point here.
const { watch } = vi.hoisted(() => ({ watch: vi.fn() }));

vi.mock('node:fs', () => ({ watch, default: { watch } }));

// These cover Node's recursive watch. Linux watches each directory instead,
// which is covered in its own module.
vi.mock('../../../../cross-platform/node', () => ({ isLinux: () => false }));

const ignoredTopLevelEntries = ['.git'];

const path = '/projects/one';

const close = vi.fn();

// The operating-system watch: an emitter like Node's FSWatcher.
const watcher = Object.assign(new EventEmitter(), { close });

const reportEvent = (filename: string | null) =>
  watcher.emit('change', 'change', filename);

const failWatch = () =>
  watcher.emit('error', new Error('the directory is gone'));

beforeEach(() => {
  vi.clearAllMocks();
  watcher.removeAllListeners();
  watch.mockImplementation(
    (
      _path: string,
      _options: object,
      listener: (event: string, filename: string | null) => void
    ) => {
      watcher.on('change', listener);
      return watcher as unknown as FSWatcher;
    }
  );
});

describe('directory-watcher/electron-node-api', () => {
  describe('isIgnored', () => {
    it('drops a listed entry', () => {
      expect(
        isIgnored({ filename: '.git/index', ignoredTopLevelEntries })
      ).toBe(true);
    });

    it('drops anything nested under a listed entry', () => {
      expect(
        isIgnored({ filename: '.git/refs/heads/main', ignoredTopLevelEntries })
      ).toBe(true);
    });

    it('drops the listed entry itself', () => {
      expect(isIgnored({ filename: '.git', ignoredTopLevelEntries })).toBe(
        true
      );
    });

    it('drops a listed entry reported with Windows separators', () => {
      expect(
        isIgnored({
          filename: '.git\\refs\\heads\\main',
          ignoredTopLevelEntries,
        })
      ).toBe(true);
    });

    // Everything below would leave a listener stale if it were dropped, so the
    // filter has to stay narrower than "looks hidden".
    it('keeps a document', () => {
      expect(isIgnored({ filename: 'hello.md', ignoredTopLevelEntries })).toBe(
        false
      );
    });

    it('keeps a document under an unrelated hidden directory', () => {
      expect(
        isIgnored({ filename: '.drafts/hello.md', ignoredTopLevelEntries })
      ).toBe(false);
    });

    it('matches whole segments, not prefixes', () => {
      expect(
        isIgnored({ filename: '.gitignore', ignoredTopLevelEntries })
      ).toBe(false);
    });

    it('matches only at the top level', () => {
      expect(
        isIgnored({ filename: 'vendor/.git/index', ignoredTopLevelEntries })
      ).toBe(false);
    });

    it('keeps the watched directory, which events sometimes name', () => {
      expect(
        isIgnored({ filename: 'my-project', ignoredTopLevelEntries })
      ).toBe(false);
    });

    it('keeps an unnamed change, so it is not missed', () => {
      expect(isIgnored({ filename: null, ignoredTopLevelEntries })).toBe(false);
    });

    it('keeps everything when nothing is listed', () => {
      expect(
        isIgnored({ filename: '.git/index', ignoredTopLevelEntries: [] })
      ).toBe(false);
    });
  });

  describe('watchDirectory', () => {
    it('shares one watch among the listeners of a directory', async () => {
      useFakeTimersInTest();
      const directoryWatcher = createAdapter();
      const first = vi.fn();
      const second = vi.fn();

      directoryWatcher.watchDirectory({ path, onChange: first });
      directoryWatcher.watchDirectory({ path, onChange: second });
      reportEvent('hello.md');
      await vi.runAllTimersAsync();

      expect(watch).toHaveBeenCalledOnce();
      expect(first).toHaveBeenCalledOnce();
      expect(second).toHaveBeenCalledOnce();
    });

    it('keeps the other listeners watching when one stops', async () => {
      useFakeTimersInTest();
      const directoryWatcher = createAdapter();
      const stopping = vi.fn();
      const staying = vi.fn();

      const stop = directoryWatcher.watchDirectory({
        path,
        onChange: stopping,
      });
      directoryWatcher.watchDirectory({ path, onChange: staying });
      stop();
      reportEvent('hello.md');
      await vi.runAllTimersAsync();

      expect(stopping).not.toHaveBeenCalled();
      expect(staying).toHaveBeenCalledOnce();
      expect(close).not.toHaveBeenCalled();
    });

    it('closes the watch once the last listener stops', () => {
      const directoryWatcher = createAdapter();

      const stopFirst = directoryWatcher.watchDirectory({
        path,
        onChange: vi.fn(),
      });
      const stopSecond = directoryWatcher.watchDirectory({
        path,
        onChange: vi.fn(),
      });
      stopFirst();
      stopSecond();

      expect(close).toHaveBeenCalledOnce();
    });

    it('watches again after the previous watch closed', () => {
      const directoryWatcher = createAdapter();

      const stop = directoryWatcher.watchDirectory({ path, onChange: vi.fn() });
      stop();
      directoryWatcher.watchDirectory({ path, onChange: vi.fn() });

      expect(watch).toHaveBeenCalledTimes(2);
    });

    it("applies each listener's own ignored entries", async () => {
      useFakeTimersInTest();
      const directoryWatcher = createAdapter();
      const onChangeIgnoringGit = vi.fn();
      const onChangeIgnoringNothing = vi.fn();

      directoryWatcher.watchDirectory({
        path,
        onChange: onChangeIgnoringGit,
        ignoredTopLevelEntries: ['.git'],
      });
      directoryWatcher.watchDirectory({
        path,
        onChange: onChangeIgnoringNothing,
      });
      reportEvent('.git/index');
      await vi.runAllTimersAsync();

      expect(onChangeIgnoringGit).not.toHaveBeenCalled();
      expect(onChangeIgnoringNothing).toHaveBeenCalledOnce();
    });

    it('signals once per burst of events', async () => {
      useFakeTimersInTest();
      const directoryWatcher = createAdapter();
      const onChange = vi.fn();

      directoryWatcher.watchDirectory({ path, onChange });
      reportEvent('hello.md');
      reportEvent('hello.md');
      reportEvent('world.md');
      await vi.runAllTimersAsync();

      expect(onChange).toHaveBeenCalledOnce();
    });

    it('stops signalling every listener when the watch fails', async () => {
      useFakeTimersInTest();
      const directoryWatcher = createAdapter();
      const onChange = vi.fn();

      const stop = directoryWatcher.watchDirectory({ path, onChange });
      reportEvent('hello.md');
      failWatch();
      await vi.runAllTimersAsync();
      stop();

      expect(onChange).not.toHaveBeenCalled();
      expect(close).toHaveBeenCalledOnce();
    });

    it('yields no signals for a directory that cannot be watched', () => {
      watch.mockImplementationOnce(() => {
        throw new Error('cannot watch');
      });
      const directoryWatcher = createAdapter();

      const stop = directoryWatcher.watchDirectory({ path, onChange: vi.fn() });

      expect(stop).not.toThrow();
    });
  });
});
