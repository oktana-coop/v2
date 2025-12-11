import { AuthProvider } from '../../modules/auth/browser';
import { RepresentationTransformProvider } from '../../modules/domain/rich-text/react/representation-transform-context';
import { NotificationsProvider } from '../../modules/infrastructure/notifications/browser';
import { WasmProvider } from '../../modules/infrastructure/wasm/react/wasm-context';
import {
  FunctionalityConfigProvider,
  ThemeProvider,
} from '../../modules/personalization/browser';
import App from './App.tsx';
import {
  CommandPaletteStateProvider,
  InfrastructureAdaptersProvider,
} from './app-state';

export const AppWrapper = () => {
  return (
    <InfrastructureAdaptersProvider>
      <WasmProvider>
        <RepresentationTransformProvider>
          <AuthProvider>
            <ThemeProvider>
              <FunctionalityConfigProvider>
                <NotificationsProvider>
                  <CommandPaletteStateProvider>
                    <App />
                  </CommandPaletteStateProvider>
                </NotificationsProvider>
              </FunctionalityConfigProvider>
            </ThemeProvider>
          </AuthProvider>
        </RepresentationTransformProvider>
      </WasmProvider>
    </InfrastructureAdaptersProvider>
  );
};
