import { InfrastructureAdaptersProvider } from '../../modules/app-state';
import { WasmProvider } from '../../modules/infrastructure/wasm/react/wasm-context';
import { FunctionalityConfigProvider } from '../../modules/personalization/functionality-config';
import { ThemeProvider } from '../../modules/personalization/theme';
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
