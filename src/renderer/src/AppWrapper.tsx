import { RepresentationTransformProvider } from '../../modules/domain/rich-text/react/representation-transform-context';
import { WasmProvider } from '../../modules/infrastructure/wasm/react/wasm-context';
import { FunctionalityConfigProvider } from '../../modules/personalization/functionality-config';
import { ThemeProvider } from '../../modules/personalization/theme';
import App from './App.tsx';
import { InfrastructureAdaptersProvider } from './app-state';

export const AppWrapper = () => {
  return (
    <InfrastructureAdaptersProvider>
      <WasmProvider>
        <RepresentationTransformProvider>
          <ThemeProvider>
            <FunctionalityConfigProvider>
              <App />
            </FunctionalityConfigProvider>
          </ThemeProvider>
        </RepresentationTransformProvider>
      </WasmProvider>
    </InfrastructureAdaptersProvider>
  );
};
