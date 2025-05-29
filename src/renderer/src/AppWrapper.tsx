import { InfrastructureAdaptersProvider } from '../../modules/editor-state';
import { FunctionalityConfigProvider } from '../../modules/personalization/functionality-config';
import { ThemeProvider } from '../../modules/personalization/theme';
import { WasmProvider } from '../../modules/wasm/react/wasm-context';
import App from './App.tsx';

export const AppWrapper = () => {
  return (
    <InfrastructureAdaptersProvider>
      <WasmProvider>
        <ThemeProvider>
          <FunctionalityConfigProvider>
            <App />
          </FunctionalityConfigProvider>
        </ThemeProvider>
      </WasmProvider>
    </InfrastructureAdaptersProvider>
  );
};
