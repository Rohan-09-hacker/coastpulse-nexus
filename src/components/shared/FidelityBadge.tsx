import React from 'react';
import { MetricFidelity } from '../../core/types.ts';

interface FidelityBadgeProps {
  fidelity: MetricFidelity;
  isSimulated?: boolean;
}

export const FidelityBadge: React.FC<FidelityBadgeProps> = ({ fidelity, isSimulated }) => {
  if (isSimulated || fidelity === 'simulated') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold bg-amber-50/90 text-amber-800 border border-amber-200 rounded-lg whitespace-nowrap shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        SIMULATED / DEMO
      </span>
    );
  }

  if (fidelity === 'actual') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50/90 text-emerald-700 border border-emerald-200 rounded-lg whitespace-nowrap shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        ACTUAL (LIVE API)
      </span>
    );
  }

  if (fidelity === 'estimated') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold bg-[#EEF4FC] text-[#3978F6] border border-[#3978F6]/25 rounded-lg whitespace-nowrap shrink-0">
        ESTIMATED
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 rounded-lg whitespace-nowrap shrink-0">
      METRIC UNAVAILABLE (NULL)
    </span>
  );
};
