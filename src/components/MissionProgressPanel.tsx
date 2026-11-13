import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Flag, TrendingUp } from 'lucide-react';
import { MAX_SAFE_MSV, MAX_SOLS, MissionMetrics, SolLogEntry, SolScenario } from '../data/missionScenarios';
import { ResourceTrendChart } from './ResourceTrendChart';

interface MissionProgressPanelProps {
  currentSol: number;
  scenarios: SolScenario[];
  logs: SolLogEntry[];
  metrics: MissionMetrics;
  isEndState?: boolean;
  showChart?: boolean;
}

export const MissionProgressPanel: React.FC<MissionProgressPanelProps> = ({
  currentSol,
  scenarios,
  logs,
  metrics,
  isEndState = false,
  showChart = true,
}) => {
  const [inspectedSol, setInspectedSol] = useState<number | null>(null);

  const currentSafetyPct = Math.max(
    0,
    Math.round((1 - metrics.cumulativeMsv / MAX_SAFE_MSV) * 100)
  );
  const stabilityIndex = Math.round(
    (metrics.airWater + metrics.powerBank + currentSafetyPct) / 3
  );
  const scienceGoalPct = Math.min(100, Math.round((metrics.scienceFood / 75) * 100));

  const stabilityStatus =
    stabilityIndex >= 65
      ? { label: 'Strong Stability', tone: 'text-[#059669]', Icon: CheckCircle2 }
      : stabilityIndex >= 40
        ? { label: 'Watch Reserves', tone: 'text-[#D97706]', Icon: AlertTriangle }
        : { label: 'Fragile Margins', tone: 'text-[#DC2626]', Icon: XCircle };

  const inspectedLog = logs.find((l) => l.sol === inspectedSol) || null;

  return (
    <div className="bg-white border border-[#DCE3EE] rounded-xl p-4 sm:p-5 space-y-4">
      {/* Header Row: Mission Path + Stability Readout */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
            8-Sol Mission Progress &amp; Cumulative Stability
          </h3>
          <p className="text-xs text-[#475569] mt-0.5">
            Tap any completed Sol below to inspect your choice ({logs.length}/{MAX_SOLS} Sols completed)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div>
            <span className="text-[#64748B]">Stability Avg: </span>
            <span className="font-mono font-bold text-[#0F172A]">{stabilityIndex}%</span>
            <span className={`ml-1.5 inline-flex items-center gap-1 font-semibold ${stabilityStatus.tone}`}>
              <stabilityStatus.Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {stabilityStatus.label}
            </span>
          </div>
          <div>
            <span className="text-[#64748B]">Goal Progress: </span>
            <span className="font-mono font-bold text-[#059669]">{scienceGoalPct}%</span>
          </div>
        </div>
      </div>

      {/* 8-Sol Milestone Stepper */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {Array.from({ length: MAX_SOLS }).map((_, idx) => {
          const solNum = idx + 1;
          const completed = logs.find((l) => l.sol === solNum);
          const isCurrent = !isEndState && solNum === currentSol;
          const scenario = scenarios[idx];
          const isInspected = inspectedSol === solNum;

          return (
            <button
              key={solNum}
              type="button"
              disabled={!completed}
              onClick={() => setInspectedSol(isInspected ? null : solNum)}
              className={`p-2 rounded-lg border text-left transition-colors ${
                completed
                  ? isInspected
                    ? 'bg-[#EFF6FF] border-[#2563EB] cursor-pointer'
                    : 'bg-[#F8FAFC] border-[#CBD5E1] hover:border-[#2563EB] cursor-pointer'
                  : isCurrent
                    ? 'bg-[#EFF6FF] border-[#2563EB] cursor-default'
                    : 'bg-white border-[#E2E8F0] opacity-70 cursor-default'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[11px] font-bold text-[#0F172A]">
                  Sol {solNum}
                </span>
                {completed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] shrink-0" aria-hidden="true" />
                ) : solNum === MAX_SOLS ? (
                  <Flag className="w-3.5 h-3.5 text-[#64748B] shrink-0" aria-hidden="true" />
                ) : null}
              </div>
              <p className="text-[10px] text-[#475569] mt-0.5 truncate">
                {completed
                  ? `Sci ${completed.scienceFoodAfter}%`
                  : isCurrent
                    ? scenario?.weatherCondition || 'Active'
                    : solNum === MAX_SOLS
                      ? 'Handover'
                      : 'Upcoming'}
              </p>
            </button>
          );
        })}
      </div>

      {/* Inspected Completed Sol Callout */}
      {inspectedLog && (
        <div className="p-3 bg-[#F8FAFC] border border-[#DCE3EE] rounded-lg text-xs flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-[#0F172A]">
              Sol {inspectedLog.sol} · {inspectedLog.scenarioTitle}:
            </span>{' '}
            <span className="text-[#334155]">{inspectedLog.chosenOptionLabel}</span>
          </div>
          <span className="font-mono text-[11px] text-[#475569]">
            Air {inspectedLog.airWaterAfter}% · Pwr {inspectedLog.powerBankAfter}% ·{' '}
            {inspectedLog.cumulativeMsvAfter.toFixed(1)} mSv · Sci {inspectedLog.scienceFoodAfter}%
          </span>
        </div>
      )}

      {showChart && (
        <ResourceTrendChart
          logs={logs}
          metrics={metrics}
          currentSol={currentSol}
          isEndState={isEndState}
        />
      )}
    </div>
  );
};
