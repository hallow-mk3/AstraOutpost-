import React, { useEffect, useMemo } from 'react';
import {
  Trophy,
  RotateCcw,
  Home,
  X,
  Wind,
  Zap,
  ShieldCheck,
  Sprout,
  Award,
} from 'lucide-react';
import { MAX_SAFE_MSV, MAX_SOLS, MissionMetrics } from '../data/missionScenarios';
import { OutpostSiteProfile } from '../data/nasaDatasets';
import { MISSION_ACHIEVEMENT_BADGES } from './MissionAchievementsPanel';

interface MissionSuccessModalProps {
  isOpen: boolean;
  siteProfile: OutpostSiteProfile;
  metrics: MissionMetrics;
  maintainedAbove50: boolean;
  newlyUnlockedBadgeIds: string[];
  onReturnToBase: () => void;
  onNewMission: () => void;
  onCloseToDebrief: () => void;
}

export function calculateResourceEfficiencyScore(
  metrics: MissionMetrics,
  maintainedAbove50: boolean
): { score: number; grade: 'S' | 'A' | 'B' | 'C'; radMarginPct: number } {
  const radMarginPct = Math.max(
    0,
    Math.round((1 - metrics.cumulativeMsv / MAX_SAFE_MSV) * 100)
  );
  const raw =
    metrics.airWater * 0.25 +
    metrics.powerBank * 0.2 +
    radMarginPct * 0.25 +
    metrics.scienceFood * 0.3 +
    (maintainedAbove50 ? 5 : 0);
  const score = Math.min(100, Math.max(0, Math.round(raw)));
  const grade = score >= 88 ? 'S' : score >= 75 ? 'A' : score >= 60 ? 'B' : 'C';
  return { score, grade, radMarginPct };
}

export const MissionSuccessModal: React.FC<MissionSuccessModalProps> = ({
  isOpen,
  siteProfile,
  metrics,
  maintainedAbove50,
  newlyUnlockedBadgeIds,
  onReturnToBase,
  onNewMission,
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

  const efficiency = useMemo(
    () => calculateResourceEfficiencyScore(metrics, maintainedAbove50),
    [metrics, maintainedAbove50]
  );

  const newlyUnlockedBadges = useMemo(
    () =>
      MISSION_ACHIEVEMENT_BADGES.filter((b) => newlyUnlockedBadgeIds.includes(b.id)),
    [newlyUnlockedBadgeIds]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/65 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-success-title"
    >
      <div className="bg-white border border-[#6EE7B7] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
        <div className="bg-[#ECFDF5] border-b border-[#A7F3D0] px-6 py-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#059669] text-white flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-mono font-semibold text-[#059669] uppercase tracking-wide">
                Mission Success · {MAX_SOLS} / {MAX_SOLS} Sols Survived
              </p>
              <h2
                id="mission-success-title"
                className="text-xl font-bold text-[#0F172A] mt-0.5"
              >
                {siteProfile.name} Thrived Under Your Command!
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseToDebrief}
            aria-label="Close modal and view full mission logbook"
            className="p-1.5 rounded-lg text-[#065F46] hover:bg-[#D1FAE5] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Resource Efficiency Score Banner */}
          <div className="p-4 bg-[#F8FAFC] border border-[#DCE3EE] rounded-xl flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#475569] uppercase tracking-wide">
                Final Resource Efficiency Score
              </p>
              <p className="text-3xl font-bold font-mono text-[#0F172A] mt-1">
                {efficiency.score}{' '}
                <span className="text-sm font-normal text-[#64748B]">/ 100</span>
              </p>
              <p className="text-xs text-[#475569] mt-1">
                {maintainedAbove50
                  ? 'Includes +5 Stability Bonus for keeping all resources above 50%.'
                  : 'Balanced across Air & Water, Power, Radiation Margin, and Science & Food.'}
              </p>
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-center shrink-0">
              <p className="text-[10px] font-semibold text-[#2563EB] uppercase tracking-wide">
                Rank
              </p>
              <p className="text-2xl font-bold font-mono text-[#1D4ED8]">{efficiency.grade}</p>
            </div>
          </div>

          {/* 4 Final Telemetry Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
              <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                <Wind className="w-3 h-3 text-[#0284C7]" aria-hidden="true" />
                Air &amp; Water
              </p>
              <p className="text-base font-bold font-mono text-[#0F172A] mt-0.5">
                {metrics.airWater}%
              </p>
            </div>
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
              <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                <Zap className="w-3 h-3 text-[#D97706]" aria-hidden="true" />
                Power Bank
              </p>
              <p className="text-base font-bold font-mono text-[#0F172A] mt-0.5">
                {metrics.powerBank}%
              </p>
            </div>
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
              <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#059669]" aria-hidden="true" />
                Rad Margin
              </p>
              <p className="text-base font-bold font-mono text-[#0F172A] mt-0.5">
                {efficiency.radMarginPct}%
              </p>
            </div>
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
              <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                <Sprout className="w-3 h-3 text-[#059669]" aria-hidden="true" />
                Sci &amp; Food
              </p>
              <p className="text-base font-bold font-mono text-[#0F172A] mt-0.5">
                {metrics.scienceFood}%
              </p>
            </div>
          </div>

          {newlyUnlockedBadges.length > 0 && (
            <div className="p-3.5 bg-[#ECFDF5] border border-[#6EE7B7] rounded-xl space-y-1.5">
              <p className="text-xs font-bold text-[#065F46] flex items-center gap-1.5">
                <Award className="w-4 h-4 text-[#059669]" aria-hidden="true" />
                New Mission Achievement{newlyUnlockedBadges.length > 1 ? 's' : ''} Unlocked!
              </p>
              <p className="text-xs text-[#047857]">
                {newlyUnlockedBadges.map((b) => b.name).join(' · ')}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onCloseToDebrief}
              className="px-3.5 py-2.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              View Logbook
            </button>
            <button
              type="button"
              onClick={onReturnToBase}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Home className="w-3.5 h-3.5" aria-hidden="true" />
              Return to Base
            </button>
            <button
              type="button"
              onClick={onNewMission}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              New Mission
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
