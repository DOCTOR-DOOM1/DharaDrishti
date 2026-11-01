import { useEffect, useState } from 'react';
import type { MountedViewModule } from '../api/types';

interface ViewExport {
  default: MountedViewModule;
}

export function useViewDiscovery() {
  const [views, setViews] = useState<MountedViewModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadViews() {
      try {
        // Look for any views-*/*/index.tsx modules relative to src
        const modules = import.meta.glob<ViewExport>('/src/views-*/*/index.tsx', {
          eager: true,
        });

        const loaded: MountedViewModule[] = [];
        for (const path in modules) {
          const mod = modules[path];
          if (mod && mod.default && mod.default.id && typeof mod.default.Component === 'function') {
            loaded.push(mod.default);
          }
        }
        setViews(loaded);
      } catch (err) {
        console.warn('Failed to discover views:', err);
      } finally {
        setLoading(false);
      }
    }

    loadViews();
  }, []);

  return { views, loading };
}

