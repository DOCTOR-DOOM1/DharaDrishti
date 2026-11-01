import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

export async function enableMocking() {
  if (import.meta.env.DEV || import.meta.env.VITE_USE_MOCK === 'true') {
    return worker.start({
      // MSW 3.x renamed onUnhandledRequest → onUnhandledFrame.
      // 'bypass' passes ALL unmatched requests (including every tile, style,
      // and CDN fetch) straight through to the network untouched.
      onUnhandledFrame: 'bypass',
    });
  }
}
