import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { TimeSeriesResponse } from '../../api/types';
import { AlertCircle, Activity, X } from 'lucide-react';

interface TimeSeriesChartProps {
  data: TimeSeriesResponse | null | undefined;
  isLoading: boolean;
  error: any;
  lon: number | null;
  lat: number | null;
  onClose?: () => void;
}

const TimeSeriesPlot: React.FC<{ data: TimeSeriesResponse }> = ({ data }) => {
  const { series, velocity, seasonal_amplitude_mm } = data;

  const chartOption = useMemo(() => {
    const dates = series.map((s) => s.date);
    const lowerBound = series.map((s) => [s.date, Math.round((s.value - s.sigma) * 10) / 10]);
    const bandSpan = series.map((s) => [s.date, Math.round(2 * s.sigma * 10) / 10]);
    const observed = series.map((s) => [s.date, s.value]);

    // Approximate seasonal model fit: linear trend + sinusoidal annual cycle
    const tStart = new Date(dates[0]).getTime();
    const seasonalFit = series.map((s) => {
      const tYears = (new Date(s.date).getTime() - tStart) / (1000 * 60 * 60 * 24 * 365.25);
      const trend = velocity.value * tYears;
      const season = seasonal_amplitude_mm * Math.sin(2 * Math.PI * tYears);
      return [s.date, Math.round((trend + season) * 10) / 10];
    });

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const date = params[0].axisValue;
          const obs = params.find((p: any) => p.seriesName === 'Displacement (LOS)');
          const unc = series.find((s) => s.date === date)?.sigma;
          return `
            <div style="font-size: 11px; font-family: monospace;">
              <b>${date}</b><br/>
              Displacement: <b>${obs ? obs.value[1] : '--'} mm</b><br/>
              Uncertainty (1σ): <b>±${unc ?? '--'} mm</b>
            </div>
          `;
        },
      },
      grid: {
        top: 25,
        left: 45,
        right: 20,
        bottom: 30,
      },
      xAxis: {
        type: 'time',
        axisLabel: { fontSize: 10, color: '#64748b' },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'mm',
        nameTextStyle: { fontSize: 10, color: '#64748b' },
        axisLabel: { fontSize: 10, color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: [
        // 1. Lower Bound base (transparent)
        {
          name: 'Lower Base',
          type: 'line',
          data: lowerBound,
          lineStyle: { opacity: 0 },
          stack: 'confidence-envelope',
          symbol: 'none',
        },
        // 2. Error Band (shaded interval ±1 sigma)
        {
          name: 'Uncertainty (±1σ)',
          type: 'line',
          data: bandSpan,
          lineStyle: { opacity: 0 },
          areaStyle: {
            color: 'rgba(59, 130, 246, 0.18)',
          },
          stack: 'confidence-envelope',
          symbol: 'none',
        },
        // 3. Seasonal Cycle Fit
        {
          name: 'Seasonal Fit',
          type: 'line',
          data: seasonalFit,
          smooth: true,
          lineStyle: {
            color: '#10b981',
            width: 1.5,
            type: 'dashed',
          },
          symbol: 'none',
        },
        // 4. Observed Displacement
        {
          name: 'Displacement (LOS)',
          type: 'line',
          data: observed,
          itemStyle: { color: '#2563eb' },
          lineStyle: { width: 2 },
          symbol: 'circle',
          symbolSize: 4,
        },
      ],
    };
  }, [series, velocity, seasonal_amplitude_mm]);

  return (
    <div className="h-52 w-full">
      <ReactECharts
        option={chartOption}
        style={{ height: '100%', width: '100%' }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
};

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  data,
  isLoading,
  error,
  lon,
  lat,
  onClose,
}) => {
  if (lon === null || lat === null) {
    return (
      <div className="p-6 text-center text-gray-400 text-xs italic">
        Click any point on the map to inspect displacement time series and uncertainty
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs text-gray-500 space-y-3">
        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
        <div>Querying time series at {lon.toFixed(4)}, {lat.toFixed(4)}...</div>
      </div>
    );
  }

  // Handle 404 or missing reliable measurement
  if (error || !data) {
    const is404 = error?.status === 404 || error?.data?.error === 'no_reliable_measurement';
    return (
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center space-y-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <AlertCircle className="w-4 h-4 text-gray-500" />
            <span>Point ({lon.toFixed(4)}, {lat.toFixed(4)})</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="p-4 bg-white rounded border border-gray-200 shadow-inner">
          <p className="text-sm font-semibold text-gray-800">
            {is404 ? 'No reliable measurement here' : 'Unable to load measurement'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Temporal coherence is below threshold (0.3) or pixel is outside the active SAR analysis mask.
          </p>
        </div>
      </div>
    );
  }

  const { velocity, pixel, seasonal_amplitude_mm, convention, provenance } = data;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3.5 space-y-3">
      {/* Header and key metrics */}
      <div className="flex items-start justify-between border-b border-gray-100 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">
              Displacement Time Series
            </h4>
          </div>
          <div className="text-[11px] text-gray-500 font-mono mt-0.5">
            LON: {pixel.lon.toFixed(4)}° | LAT: {pixel.lat.toFixed(4)}°
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 p-2 rounded border border-gray-100">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
            LOS Velocity
          </div>
          <div
            className={`text-xs font-bold font-mono mt-0.5 ${
              velocity.value < -10
                ? 'text-red-600'
                : velocity.value > 5
                ? 'text-emerald-600'
                : 'text-gray-900'
            }`}
          >
            {velocity.value > 0 ? `+${velocity.value}` : velocity.value} ± {velocity.sigma}{' '}
            <span className="text-[10px] font-normal">{velocity.unit}</span>
          </div>
        </div>

        <div className="bg-gray-50 p-2 rounded border border-gray-100">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
            Coherence
          </div>
          <div className="text-xs font-bold font-mono text-gray-800 mt-0.5">
            {pixel.coherence.toFixed(2)}
          </div>
        </div>

        <div className="bg-gray-50 p-2 rounded border border-gray-100">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
            Seasonal Amp
          </div>
          <div className="text-xs font-bold font-mono text-gray-800 mt-0.5">
            {seasonal_amplitude_mm.toFixed(1)} <span className="text-[10px] font-normal">mm</span>
          </div>
        </div>
      </div>

      {/* ECharts Plot */}
      <TimeSeriesPlot data={data} />

      {/* Legend & Convention text */}
      <div className="pt-2 border-t border-gray-100 space-y-1.5 text-[11px] text-gray-600">
        <div className="flex items-center justify-between text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-blue-600 inline-block" /> InSAR Observed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-blue-100 border border-blue-300 inline-block rounded-xs" />{' '}
            ±1σ Error Band
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-emerald-500 border-t border-dashed inline-block" />{' '}
            Seasonal Fit
          </span>
        </div>

        <div className="bg-blue-50/70 border border-blue-200/60 p-2 rounded text-[10px] text-blue-900 leading-snug">
          <span className="font-semibold">Convention:</span> {convention}
        </div>

        <div className="text-[10px] text-gray-400 font-mono flex justify-between">
          <span>Sensor: {provenance.sensor} (Track {provenance.track})</span>
          <span>Looks: {provenance.looks}</span>
        </div>
      </div>
    </div>
  );
};
