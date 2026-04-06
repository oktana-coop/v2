export * from './index';
// TODO: Move remaining browser-specific exports here
export {
  createPagedJsElectronRendererAdapter,
  initPrintPage,
} from './adapters/paged-js-pdf-engine/electron-renderer';
export { createPagedJsBrowserAdapter } from './adapters/paged-js-pdf-engine/browser';
