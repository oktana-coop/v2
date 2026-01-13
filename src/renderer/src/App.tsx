import { AuthProvider } from '../../modules/auth/browser';
import { MergeConflictResolverProvider } from '../../modules/domain/rich-text/react/merge-conflict-resover-context';
import { RepresentationTransformProvider } from '../../modules/domain/rich-text/react/representation-transform-context';
import { NotificationsProvider } from '../../modules/infrastructure/notifications/browser';
import { WasmProvider } from '../../modules/infrastructure/wasm/react/wasm-context';
import {
  FunctionalityConfigProvider,
  ThemeProvider,
} from '../../modules/personalization/browser';
import {
  CommandPaletteStateProvider,
  InfrastructureAdaptersProvider,
} from './app-state/index';
import { AppRouter } from './AppRouter';

export const App = () => (
  <InfrastructureAdaptersProvider>
    <WasmProvider>
      <RepresentationTransformProvider>
        <MergeConflictResolverProvider>
          <AuthProvider>
            <ThemeProvider>
              <FunctionalityConfigProvider>
                <NotificationsProvider>
                  <CommandPaletteStateProvider>
                    <AppRouter />
                  </CommandPaletteStateProvider>
                </NotificationsProvider>
              </FunctionalityConfigProvider>
            </ThemeProvider>
          </AuthProvider>
        </MergeConflictResolverProvider>
      </RepresentationTransformProvider>
    </WasmProvider>
  </InfrastructureAdaptersProvider>
);
