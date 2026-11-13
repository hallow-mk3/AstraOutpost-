import React from 'react';
import {
  Award,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Sprout,
  Compass,
  Rocket,
  Star,
} from 'lucide-react';
import { MAX_SAFE_MSV, MAX_SOLS, MissionMetrics, SolLogEntry } from '../data/missionScenarios';
import { OutpostSiteId } from '../data/nasaDatasets';

export interface AchievementBadgeDef {
  id: string;
  name: string;
  requirement: string;
  tierLabel: string;
  iconKey: 'guardian' | 'moon' | 'mars' | 'harvest' | 'director';
}

export const MISSION_ACHIEVEMENT_BADGES: AchievementBadgeDef[] = [
  {
    id: 'stability-50',
    name: '50%+ Stability Guardian',
    requirement: 'Complete all 8 Sols keeping Air & Water, Power, and Radiation Margin above 50% on every Sol.',
    tierLabel: 'Core Stability',
    iconKey: 'guardian',
  },
  {
    id: 'lunar-stability-50',
    name: 'Lunar Stability Commander',
    requirement: 'Complete an 8-Sol Shackleton Rim (Moon) mission with >50% stability across all Sols.',
    tierLabel: 'Artemis Site',
    iconKey: 'moon',
  },
  {
    id: 'mars-stability-50',
    name: 'Martian Stability Commander',
    requirement: 'Complete an 8-Sol Jezero Crater (Mars) mission with >50% stability despite radio lag.',
    tierLabel: 'Mars Site',
    iconKey: 'mars',
  },
  {
    id: 'harvest-stability-50',
    name: 'Closed-Loop Harvest Ace',
    requirement: 'Finish 8 Sols with >50% resource stability AND 75%+ Science & Food progress.',
    tierLabel: 'Science + Survival',
    iconKey: 'harvest',
  },
  {
    id: 'director-stability-50',
    name: 'Flight Director Precision',
    requirement: 'Complete 8 Sols on Flight Director (9 Power/Sol) while holding >50% stability.',
    tierLabel: 'Hard Mode',
    iconKey: 'director',
  },
];

export interface StabilityAuditResult {
  maintainedAbove50: boolean;
  minAirWater: number;
  minPowerBank: number;
  maxRadiationMsv: number;
  minRadMarginPct: number;
  breachReason: string | null;
}

export function evaluateStabilityAbove50(
  logs: SolLogEntry[],
  currentMetrics: MissionMetrics
): StabilityAuditResult {
  const halfSafeMsv = MAX_SAFE_MSV * 0.5; // 17.5 mSv -> >50% margin means < 17.5 mSv
  if (logs.length === 0) {
    const radMargin = Math.max(0, Math.round((1 - currentMetrics.cumulativeMsv / MAX_SAFE_MSV) * 100));
    return {
      maintainedAbove50:
        currentMetrics.airWater > 50 &&
        currentMetrics.powerBank > 50 &&
        currentMetrics.cumulativeMsv < halfSafeMsv,
      minAirWater: currentMetrics.airWater,
      minPowerBank: currentMetrics.powerBank,
      maxRadiationMsv: currentMetrics.cumulativeMsv,
      minRadMarginPct: radMargin,
      breachReason: null,
    };
  }

  let minAir = currentMetrics.airWater;
  let minPower = currentMetrics.powerBank;
  let maxMsv = currentMetrics.cumulativeMsv;
  let breachReason: string | null = null;

  for (const entry of logs) {
    if (entry.airWaterAfter < minAir) minAir = entry.airWaterAfter;
    if (entry.powerBankAfter < minPower) minPower = entry.powerBankAfter;
    if (entry.cumulativeMsvAfter > maxMsv) maxMsv = entry.cumulativeMsvAfter;

    if (!breachReason) {
      if (entry.airWaterAfter <= 50) {
        breachReason = `Air & Water dipped to ${entry.airWaterAfter}% on Sol ${entry.sol} (needs >50%)`;
      } else if (entry.powerBankAfter <= 50) {
        breachReason = `Power Bank dipped to ${entry.powerBankAfter}% on Sol ${entry.sol} (needs >50%)`;
      } else if (entry.cumulativeMsvAfter >= halfSafeMsv) {
        const margin = Math.max(0, Math.round((1 - entry.cumulativeMsvAfter / MAX_SAFE_MSV) * 100));
        breachReason = `Radiation margin dipped to ${margin}% (${entry.cumulativeMsvAfter.toFixed(1)} mSv) on Sol ${entry.sol}`;
      }
    }
  }

  const minRadMarginPct = Math.max(0, Math.round((1 - maxMsv / MAX_SAFE_MSV) * 100));
  return {
    maintainedAbove50: breachReason === null && minAir > 50 && minPower > 50 && maxMsv < halfSafeMsv,
    minAirWater: minAir,
    minPowerBank: minPower,
    maxRadiationMsv: maxMsv,
    minRadMarginPct,
    breachReason,
  };
}

export function computeUnlockedStabilityBadges(params: {
  won: boolean;
  solsCompleted: number;
  site: OutpostSiteId;
  difficulty: 'cadet' | 'director';
  finalMetrics: MissionMetrics;
  logs: SolLogEntry[];
}): string[] {
  if (!params.won || params.solsCompleted < MAX_SOLS) return [];
  const audit = evaluateStabilityAbove50(params.logs, params.finalMetrics);
  if (!audit.maintainedAbove50) return [];

  const unlocked: string[] = ['stability-50'];
  if (params.site === 'moon') unlocked.push('lunar-stability-50');
  if (params.site === 'mars') unlocked.push('mars-stability-50');
  if (params.finalMetrics.scienceFood >= 75) unlocked.push('harvest-stability-50');
  if (params.difficulty === 'director') unlocked.push('director-stability-50');
  return unlocked;
}

function renderBadgeIcon(iconKey: AchievementBadgeDef['iconKey'], unlocked: boolean) {
  const cls = `w-4 h-4 ${unlocked ? 'text-[#059669]' : 'text-[#64748B]'}`;
  switch (iconKey) {
    case 'guardian':
      return <ShieldCheck className={cls} aria-hidden="true" />;
    case 'moon':
      return <Compass className={cls} aria-hidden="true" />;
    case 'mars':
      return <Rocket className={cls} aria-hidden="true" />;
    case 'harvest':
      return <Sprout className={cls} aria-hidden="true" />;
    case 'director':
      return <Award className={cls} aria-hidden="true" />;
  }
}

interface MissionAchievementsPanelProps {
  unlockedBadgeIds: string[];
  newlyUnlockedIds?: string[];
  liveAudit?: StabilityAuditResult | null;
  compact?: boolean;
}

export const MissionAchievementsPanel: React.FC<MissionAchievementsPanelProps> = ({
  unlockedBadgeIds,
  newlyUnlockedIds = [],
  liveAudit = null,
  compact = false,
}) => {
  const unlockedSet = new Set(unlockedBadgeIds);
  const newlySet = new Set(newlyUnlockedIds);
  const unlockedCount = MISSION_ACHIEVEMENT_BADGES.filter((b) => unlockedSet.has(b.id)).length;

  return (
    <div
      className="bg-white border border-[#DCE3EE] rounded-xl p-5 space-y-4"
      aria-label="Mission Achievement Badges"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
            <Award className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
            Mission Achievement Badges ({unlockedCount} / {MISSION_ACHIEVEMENT_BADGES.length} Unlocked)
          </h3>
          <p className="text-xs text-[#475569] mt-0.5">
            Complete an 8-Sol mission while maintaining Air &amp; Water, Power, and Radiation Margin above 50%.
          </p>
        </div>

        {liveAudit && (
          <div
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
              liveAudit.maintainedAbove50 ? 'text-[#059669]' : 'text-[#D97706]'
            }`}
          >
            {liveAudit.maintainedAbove50 ? (
              <>
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  50%+ Stability On Track (Min Air {liveAudit.minAirWater}% · Min Pwr {liveAudit.minPowerBank}% · Rad Margin {liveAudit.minRadMarginPct}%)
                </span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{liveAudit.breachReason}</span>
              </>
            )}
          </div>
        )}
      </div>

      <div
        className={`grid gap-3 ${
          compact
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {MISSION_ACHIEVEMENT_BADGES.map((badge) => {
          const isUnlocked = unlockedSet.has(badge.id);
          const isNew = newlySet.has(badge.id);
          return (
            <div
              key={badge.id}
              className={`rounded-lg border p-3.5 flex flex-col justify-between gap-2 transition-colors ${
                isUnlocked
                  ? 'bg-[#ECFDF5] border-[#6EE7B7]'
                  : 'bg-[#F8FAFC] border-[#E2E8F0]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {renderBadgeIcon(badge.iconKey, isUnlocked)}
                  <p
                    className={`text-xs font-bold ${
                      isUnlocked ? 'text-[#065F46]' : 'text-[#0F172A]'
                    }`}
                  >
                    {badge.name}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold shrink-0 ${
                    isUnlocked ? 'text-[#059669]' : 'text-[#64748B]'
                  }`}
                >
                  {isUnlocked ? (
                    <>
                      {isNew ? (
                        <Star className="w-3 h-3" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                      )}
                      {isNew ? 'New!' : 'Unlocked'}
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3" aria-hidden="true" />
                      Locked
                    </>
                  )}
                </span>
              </div>
              <p className="text-[11px] text-[#475569] leading-relaxed">{badge.requirement}</p>
              <p className="text-[10px] font-mono font-semibold text-[#64748B]">
                {badge.tierLabel}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
