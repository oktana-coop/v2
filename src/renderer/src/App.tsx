import { AuthProvider } from '../../modules/auth/browser';
import { MergeConflictResolverProvider } from '../../modules/domain/rich-text/react/merge-conflict-resover-context';
import { RepresentationTransformProvider } from '../../modules/domain/rich-text/react/representation-transform-context';
import { NotificationsProvider } from '../../modules/infrastructure/notifications/browser';
import { WasmProvider } from '../../modules/infrastructure/wasm/react/wasm-context';
import {
  EditorAppearanceProvider,
  ExportTemplatesProvider,
  FunctionalityConfigProvider,
  ThemeProvider,
  UIAppearanceProvider,
} from '../../modules/personalization/browser';
import {
  CommandPaletteStateProvider,
  InfrastructureAdaptersProvider,
} from './app-state/index';
import { AppRouter } from './AppRouter';

export const App = () => (
  <InfrastructureAdaptersProvider>
    <WasmProvider>
      <ExportTemplatesProvider>
        <RepresentationTransformProvider>
          <MergeConflictResolverProvider>
            <AuthProvider>
              <ThemeProvider>
                <UIAppearanceProvider>
                  <EditorAppearanceProvider>
                    <FunctionalityConfigProvider>
                      <NotificationsProvider>
                        <CommandPaletteStateProvider>
                          <AppRouter />
                        </CommandPaletteStateProvider>
                      </NotificationsProvider>
                    </FunctionalityConfigProvider>
                  </EditorAppearanceProvider>
                </UIAppearanceProvider>
              </ThemeProvider>
            </AuthProvider>
          </MergeConflictResolverProvider>
        </RepresentationTransformProvider>
      </ExportTemplatesProvider>
    </WasmProvider>
  </InfrastructureAdaptersProvider>
);
