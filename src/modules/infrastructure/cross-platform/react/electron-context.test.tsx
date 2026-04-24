// Integration test: renders a minimal subset of the app (ElectronProvider +
// UpdateNotification) with a stubbed electronAPI to exercise the update flow
// end-to-end on the renderer side — startup check, IPC state updates, and the
// resulting notification rendering.

import { fireEvent, render, screen } from '@testing-library/react';
import { act, useContext } from 'react';

import { UpdateNotification } from '../../../../renderer/src/components/notifications/UpdateNotification';
import { type UpdateState } from '../update';
import { ElectronContext, ElectronProvider } from './electron-context';

vi.mock('../browser-env', () => ({
  isElectron: () => true,
}));

let updateStateCallback: ((state: UpdateState) => void) | null = null;
const mockCheckForUpdate = vi.fn();

const stubElectronAPI = ({ isLinux = false } = {}) => {
  window.electronAPI = {
    isMac: !isLinux,
    isWindows: false,
    isLinux,
    onReceiveProcessId: vi.fn(),
    checkForUpdate: mockCheckForUpdate,
    onUpdateStateChange: (cb: (state: UpdateState) => void) => {
      updateStateCallback = cb;
      return () => {
        updateStateCallback = null;
      };
    },
    downloadUpdate: vi.fn(),
    restartToInstallUpdate: vi.fn(),
  } as unknown as typeof window.electronAPI;
  window.config = {} as typeof window.config;
};

beforeEach(() => {
  vi.clearAllMocks();
  updateStateCallback = null;
  mockCheckForUpdate.mockResolvedValue(undefined);
  stubElectronAPI();
});

const TriggerManualCheck = () => {
  const { checkForUpdate } = useContext(ElectronContext);
  return (
    <button data-testid="trigger-manual-check" onClick={checkForUpdate}>
      Check
    </button>
  );
};

const renderApp = () =>
  render(
    <ElectronProvider>
      <TriggerManualCheck />
      <UpdateNotification />
    </ElectronProvider>
  );

const emitUpdateState = (state: UpdateState) => {
  act(() => {
    updateStateCallback?.(state);
  });
};

describe('ElectronProvider — startup update check', () => {
  it('checks for updates when the provider mounts', () => {
    render(
      <ElectronProvider>
        <div />
      </ElectronProvider>
    );

    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
  });

  it('does not check for updates on Linux', () => {
    stubElectronAPI({ isLinux: true });

    render(
      <ElectronProvider>
        <div />
      </ElectronProvider>
    );

    expect(mockCheckForUpdate).not.toHaveBeenCalled();
  });
});

describe('UpdateNotification — renders based on update state', () => {
  it('shows "Update Available" even when the check was silent', () => {
    renderApp();

    emitUpdateState({
      status: 'update-available',
      version: '1.0.0',
      newVersion: '1.0.1',
    });

    expect(screen.getByText('Update Available')).toBeInTheDocument();
  });

  it('suppresses "No Updates Available" when the check was silent', () => {
    renderApp();

    emitUpdateState({ status: 'update-not-available', version: '1.0.0' });

    expect(screen.queryByText('No Updates Available')).not.toBeInTheDocument();
  });

  it('suppresses "Update Error" when the check was silent', () => {
    renderApp();

    emitUpdateState({ status: 'update-error', message: 'boom' });

    expect(screen.queryByText('Update Error')).not.toBeInTheDocument();
  });

  it('shows "No Updates Available" after a user-initiated check', () => {
    renderApp();

    fireEvent.click(screen.getByTestId('trigger-manual-check'));
    emitUpdateState({ status: 'update-not-available', version: '1.0.0' });

    expect(screen.getByText('No Updates Available')).toBeInTheDocument();
  });

  it('shows "Update Error" after a user-initiated check', () => {
    renderApp();

    fireEvent.click(screen.getByTestId('trigger-manual-check'));
    emitUpdateState({ status: 'update-error', message: 'boom' });

    expect(screen.getByText('Update Error')).toBeInTheDocument();
  });

  it('shows download progress regardless of how the check started', () => {
    renderApp();

    emitUpdateState({ status: 'downloading-update', progress: 0.5 });

    expect(screen.getByText('Downloading Update...')).toBeInTheDocument();
  });
});
