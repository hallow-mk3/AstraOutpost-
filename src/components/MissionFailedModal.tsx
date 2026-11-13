import React, { useEffect } from 'react';
import {
  XCircle,
  RotateCcw,
  Undo2,
  X,
  Wind,
  Zap,
  ShieldAlert,
  Sprout,
  Calendar,
} from 'lucide-react';
import { MAX_SAFE_MSV, MAX_SOLS, MissionMetrics, TradeOffOption } from '../data/missionScenarios';
import { OutpostSiteProfile } from '../data/nasaDatasets';
import { explainRadiationInRealLife } from '../utils/orbitalMath';

interface MissionFailedModalProps {
  isOpen: boolean;
  siteProfile: OutpostSiteProfile;
  solReached: number;
  solsCompleted: number;
  metrics: MissionMetrics;
  failureReason: string;
  lastOption?: TradeOffOption;
  canRewind: boolean;
  onRestartSession: () => void;
  onRewindOneSol: () => void;
  onCloseToDebrief: () => void;
}

export const MissionFailedModal: React.FC<MissionFailedModalProps> = ({
  isOpen,
  siteProfile,
  solReached,
  solsCompleted,
  metrics,
  failureReason,
  lastOption,
  canRewind,
  onRestartSession,
  onRewindOneSol,
  onCloseToDebrief,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseToDebrief();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onCloseToDebrief]);

  if (!isOpen) return null;

  const radMarginPct = Math.max(
    0,
    Math.round((1 - metrics.cumulativeMsv / MAX_SAFE_MSV) * 100)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/65 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-failed-title"
    >
      <div className="bg-white border border-[#FCA5A5] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
        <div className="bg-[#FEF2F2] border-b border-[#FECACA] px-6 py-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <XCircle className="w-6 h-6 text-[#DC2626] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-xs font-mono font-semibold text-[#DC2626] uppercase tracking-wide">
                Mission Failed · {siteProfile.name}
              </p>
              <h2
                id="mission-failed-title"
                className="text-xl font-bold text-[#0F172A] mt-0.5"
              >
                Outpost Critical Failure on Sol {solReached}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseToDebrief}
            aria-label="Close modal and view full debrief"
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="p-3.5 bg-[#FFF5F5] border border-[#FECACA] rounded-xl text-sm text-[#7F1D1D] leading-relaxed">
            <p className="font-semibold text-[#991B1B]">What Happened:</p>
            <p className="mt-1">{failureReason}</p>
            {lastOption && (
              <p className="text-xs text-[#7F1D1D]/90 mt-2">
                Final decision: <span className="font-semibold">“{lastOption.label}”</span> ·{' '}
                {lastOption.scienceFact}
              </p>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold text-[#475569] uppercase tracking-wide mb-2.5">
              Mission Summary Statistics
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#2563EB]" aria-hidden="true" />
                  Sols Survived
                </p>
                <p className="text-lg font-bold font-mono text-[#0F172A] mt-0.5">
                  {Math.max(0, solsCompleted - 1)} / {MAX_SOLS}
                </p>
              </div>

              <div
                className={`p-3 border rounded-lg ${
                  metrics.airWater <= 0
                    ? 'bg-[#FEF2F2] border-[#FCA5A5]'
                    : 'bg-[#F8FAFC] border-[#E2E8F0]'
                }`}
              >
                <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                  <Wind className="w-3 h-3 text-[#0284C7]" aria-hidden="true" />
                  Air &amp; Water
                </p>
                <p
                  className={`text-lg font-bold font-mono mt-0.5 ${
                    metrics.airWater <= 0 ? 'text-[#DC2626]' : 'text-[#0F172A]'
                  }`}
                >
                  {metrics.airWater}%
                </p>
              </div>

              <div
                className={`p-3 border rounded-lg ${
                  metrics.powerBank <= 0
                    ? 'bg-[#FEF2F2] border-[#FCA5A5]'
                    : 'bg-[#F8FAFC] border-[#E2E8F0]'
                }`}
              >
                <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                  <Zap className="w-3 h-3 text-[#D97706]" aria-hidden="true" />
                  Power Bank
                </p>
                <p
                  className={`text-lg font-bold font-mono mt-0.5 ${
                    metrics.powerBank <= 0 ? 'text-[#DC2626]' : 'text-[#0F172A]'
                  }`}
                >
                  {metrics.powerBank}%
                </p>
              </div>

              <div
                className={`p-3 border rounded-lg col-span-2 sm:col-span-2 ${
                  metrics.cumulativeMsv >= MAX_SAFE_MSV
                    ? 'bg-[#FEF2F2] border-[#FCA5A5]'
                    : 'bg-[#F8FAFC] border-[#E2E8F0]'
                }`}
              >
                <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-[#DC2626]" aria-hidden="true" />
                  Radiation Exposure ({radMarginPct}% margin left)
                </p>
                <p
                  className={`text-lg font-bold font-mono mt-0.5 ${
                    metrics.cumulativeMsv >= MAX_SAFE_MSV ? 'text-[#DC2626]' : 'text-[#0F172A]'
                  }`}
                >
                  {metrics.cumulativeMsv.toFixed(1)} / {MAX_SAFE_MSV} mSv
                </p>
                <p className="text-[11px] text-[#475569] mt-0.5">
                  {explainRadiationInRealLife(metrics.cumulativeMsv)}
                </p>
              </div>

              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg col-span-2 sm:col-span-1">
                <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                  <Sprout className="w-3 h-3 text-[#059669]" aria-hidden="true" />
                  Science &amp; Food
                </p>
                <p className="text-lg font-bold font-mono text-[#0F172A] mt-0.5">
                  {metrics.scienceFood}%
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onCloseToDebrief}
              className="px-4 py-2.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              View Full Logbook
            </button>
            {canRewind && (
              <button
                type="button"
                onClick={onRewindOneSol}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
                Rewind 1 Sol
              </button>
            )}
            <button
              type="button"
              onClick={onRestartSession}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Restart Mission
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
