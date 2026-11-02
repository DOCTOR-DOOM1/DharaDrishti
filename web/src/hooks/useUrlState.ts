import { useState, useEffect, useCallback } from 'react';

export interface UrlState {
  city: string;
  layers: string[];
  epoch: string | null;
  selectedId: string | null;
  coords: [number, number] | null;
}

export function useUrlState(defaultCity: string = 'delhi-ncr', defaultLayers: string[] = ['velocity']) {
  const parseUrl = useCallback((): UrlState => {
    const params = new URLSearchParams(window.location.search);
    const city = params.get('city') || defaultCity;
    const layersParam = params.get('layers');
    const layers = layersParam ? layersParam.split(',').filter(Boolean) : defaultLayers;
    const epoch = params.get('epoch');
    const selectedId = params.get('feature');
    const lon = params.get('lon');
    const lat = params.get('lat');
    const coords: [number, number] | null =
      lon && lat ? [parseFloat(lon), parseFloat(lat)] : null;

    return { city, layers, epoch, selectedId, coords };
  }, [defaultCity, defaultLayers]);

  const [state, setState] = useState<UrlState>(parseUrl);

  const updateUrl = useCallback((newState: Partial<UrlState>) => {
    setState((prev) => {
      const merged = { ...prev, ...newState };
      const params = new URLSearchParams();

      if (merged.city) params.set('city', merged.city);
      if (merged.layers.length > 0) params.set('layers', merged.layers.join(','));
      if (merged.epoch) params.set('epoch', merged.epoch);
      if (merged.selectedId) params.set('feature', merged.selectedId);
      if (merged.coords) {
        params.set('lon', merged.coords[0].toFixed(4));
        params.set('lat', merged.coords[1].toFixed(4));
      }

      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, '', newUrl);
      return merged;
    });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setState(parseUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [parseUrl]);

  return { urlState: state, updateUrl };
}

