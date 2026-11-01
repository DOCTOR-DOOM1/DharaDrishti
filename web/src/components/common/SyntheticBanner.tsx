import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface SyntheticBannerProps {
  isSynthetic: boolean;
}

export const SyntheticBanner: React.FC<SyntheticBannerProps> = ({ isSynthetic }) => {
  if (!isSynthetic) return null;

  return (
    <div
      role="alert"
      className="bg-amber-600 text-white font-semibold text-xs tracking-wide px-4 py-1.5 flex items-center justify-center gap-2 shadow-sm border-b border-amber-700 z-50 select-none uppercase"
    >
      <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
      <span>SYNTHETIC TEST DATA, not a measurement</span>
    </div>
  );
};

