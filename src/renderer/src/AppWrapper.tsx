import { RepresentationTransformProvider } from '../../modules/domain/rich-text/react/representation-transform-context';
import { WasmProvider } from '../../modules/infrastructure/wasm/react/wasm-context';
import {
  FunctionalityConfigProvider,
  ThemeProvider,
} from '../../modules/personalization/browser';
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
