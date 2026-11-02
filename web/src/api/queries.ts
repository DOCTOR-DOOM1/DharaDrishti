import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from './client';
import type { Feature } from 'geojson';

export function useCities() {
  return useQuery({
    queryKey: ['cities'],
    queryFn: () => api.getCities('live'),
    staleTime: 1000 * 60 * 10,
  });
}

export function useCitySummary(slug: string) {
  return useQuery({
    queryKey: ['citySummary', slug],
    queryFn: () => api.getCitySummary(slug),
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 5,
  });
}

export function useLayers(slug: string) {
  return useQuery({
    queryKey: ['layers', slug],
    queryFn: () => api.getLayers(slug),
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 5,
  });
}

export function useHotspots(slug: string) {
  return useQuery({
    queryKey: ['hotspots', slug],
    queryFn: () => api.getHotspots(slug),
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 5,
  });
}

export function useTimeSeries(city: string, lon: number | null, lat: number | null) {
  return useQuery({
    queryKey: ['timeseries', city, lon, lat],
    queryFn: () => api.getTimeSeries(city, lon!, lat!),
    enabled: Boolean(city && lon !== null && lat !== null),
    retry: (failureCount, error: any) => {
      // Do not retry 404 (no reliable measurement)
      if (error?.status === 404) return false;
      return failureCount < 2;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useAreaStatsMutation() {
  return useMutation({
    mutationFn: ({ city, polygon }: { city: string; polygon: Feature }) =>
      api.getAreaStats(city, polygon),
  });
}

export function useSnapshots(slug: string) {
  return useQuery({
    queryKey: ['snapshots', slug],
    queryFn: () => api.getSnapshots(slug),
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 10,
  });
}

export function useCreateReportMutation() {
  return useMutation({
    mutationFn: (city: string) => api.createReport(city),
  });
}

export function useReportStatus(id: string | null) {
  return useQuery({
    queryKey: ['reportStatus', id],
    queryFn: () => api.getReportStatus(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'done' || status === 'failed') return false;
      return 1500;
    },
  });
}

