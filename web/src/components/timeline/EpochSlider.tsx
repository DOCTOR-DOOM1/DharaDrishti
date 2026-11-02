import React, { useState, useEffect, useRef } from 'react';
import type { SnapshotItem } from '../../api/types';
import { Play, Pause, ChevronLeft, ChevronRight, RotateCcw, Calendar } from 'lucide-react';

interface EpochSliderProps {
  snapshots: SnapshotItem[];
  selectedEpoch: string | null;
  onSelectEpoch: (epoch: string | null) => void;
  isLoading?: boolean;
}

export const EpochSlider: React.FC<EpochSliderProps> = ({
  snapshots,
  selectedEpoch,
  onSelectEpoch,
  isLoading = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimerRef = useRef<number | null>(null);

  const activeIndex = selectedEpoch
    ? snapshots.findIndex((s) => s.epoch === selectedEpoch)
    : -1;

  // Auto-play interval
  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current !== null) {
        window.clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
      return;
    }

    playTimerRef.current = window.setInterval(() => {
      if (snapshots.length === 0) return;
      const nextIdx = (activeIndex + 1) % snapshots.length;
      onSelectEpoch(snapshots[nextIdx].epoch);
    }, 1400);

    return () => {
      if (playTimerRef.current !== null) {
        window.clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [isPlaying, activeIndex, snapshots, onSelectEpoch]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (snapshots.length === 0) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIdx = Math.min(snapshots.length - 1, activeIndex + 1);
      onSelectEpoch(snapshots[nextIdx].epoch);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIdx = Math.max(0, activeIndex - 1);
      onSelectEpoch(snapshots[prevIdx].epoch);
    } else if (e.key === ' ') {
      e.preventDefault();
      setIsPlaying((p) => !p);
    }
  };

  if (isLoading || snapshots.length === 0) {
    return null;
  }

  const currentDisplayDate =
    activeIndex >= 0 ? snapshots[activeIndex].epoch : 'Overall Rate (2020-2023)';

  return (
    <div
      role="region"
      aria-label="Epoch timeline slider"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="bg-white/95 backdrop-blur-md border border-gray-200/90 shadow-xl rounded-xl px-4 py-2.5 flex flex-col gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all select-none min-w-[320px] max-w-md"
    >
      {/* Top Header: Label, Current Date, Reset */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-gray-700 font-semibold">
          <Calendar className="w-3.5 h-3.5 text-blue-600" />
          <span>Epoch:</span>
          <span className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 font-bold">
            {currentDisplayDate}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {activeIndex >= 0 && (
            <span className="text-[10px] text-gray-400 font-mono">
              {activeIndex + 1}/{snapshots.length}
            </span>
          )}
          {selectedEpoch && (
            <button
              onClick={() => {
                setIsPlaying(false);
                onSelectEpoch(null);
              }}
              className="text-[10px] flex items-center gap-1 text-gray-500 hover:text-blue-600 px-1.5 py-0.5 rounded hover:bg-gray-100 transition"
              title="Reset to multi-year velocity rate"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Full Span</span>
            </button>
          )}
        </div>
      </div>

      {/* Middle Row: Play/Pause, Slider, Step buttons */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`p-1.5 rounded-lg flex items-center justify-center transition shadow-2xs ${
            isPlaying
              ? 'bg-amber-600 text-white hover:bg-amber-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          title={isPlaying ? 'Pause timeline (Space)' : 'Play animation (Space)'}
          aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={() => {
            setIsPlaying(false);
            const prev = Math.max(0, (activeIndex >= 0 ? activeIndex : snapshots.length) - 1);
            onSelectEpoch(snapshots[prev].epoch);
          }}
          disabled={activeIndex === 0}
          className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:pointer-events-none transition"
          title="Previous epoch (Left Arrow)"
          aria-label="Previous epoch"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Range Slider */}
        <input
          type="range"
          min={0}
          max={snapshots.length - 1}
          value={activeIndex >= 0 ? activeIndex : snapshots.length - 1}
          onChange={(e) => {
            setIsPlaying(false);
            const idx = parseInt(e.target.value, 10);
            onSelectEpoch(snapshots[idx].epoch);
          }}
          className="flex-1 accent-blue-600 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
          aria-label="Timeline scrubber"
        />

        <button
          onClick={() => {
            setIsPlaying(false);
            const next = Math.min(snapshots.length - 1, activeIndex + 1);
            onSelectEpoch(snapshots[next].epoch);
          }}
          disabled={activeIndex === snapshots.length - 1}
          className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:pointer-events-none transition"
          title="Next epoch (Right Arrow)"
          aria-label="Next epoch"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tick Labels */}
      <div className="flex justify-between text-[9px] text-gray-400 font-mono px-0.5">
        <span>{snapshots[0]?.epoch.slice(0, 7)}</span>
        <span>{snapshots[Math.floor(snapshots.length / 2)]?.epoch.slice(0, 7)}</span>
        <span>{snapshots[snapshots.length - 1]?.epoch.slice(0, 7)}</span>
      </div>
    </div>
  );
};

