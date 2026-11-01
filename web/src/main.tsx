import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';
import { enableMocking } from './mocks/browser';

// ── MapLibre worker fix for Vite ──────────────────────────────────────────────
// Vite cannot inline the web-worker that MapLibre GL JS spawns (it's loaded
// from a separate chunk). Without pointing maplibre-gl at the correct URL,
// the Map constructor throws "Worker failed to load".
//
// setWorkerUrl is a named export (maplibre-gl v6 has no default export).
// The worker file ships as an ES module (.mjs), so we import it with ?url.
// This import must run before ANY Map instance is created.
import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
setWorkerUrl(maplibreWorkerUrl);
// ─────────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

async function bootstrap() {
  await enableMocking();

  const container = document.getElementById('root');
  if (!container) throw new Error('Root element not found');

  createRoot(container).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>
  );
}

bootstrap();
