import React, { useMemo } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Wind,
  Zap,
  ShieldAlert,
  Sprout,
} from 'lucide-react';
import {
  calculateProjectedDeltas,
  clamp,
  MAX_SAFE_MSV,
  MissionMetrics,
  PowerAllocation,
  SolScenario,
} from '../data/missionScenarios';
import { OutpostSiteId } from '../data/nasaDatasets';

interface ForecastPanelProps {
  site: OutpostSiteId;
  metrics: MissionMetrics;
  allocation: PowerAllocation;
  scenarios: SolScenario[];
  solIndex: number;
  currentScenario: SolScenario;
}

interface ProjectedSolStep {
  sol: number;
  title: string;
  weatherCondition: SolScenario['weatherCondition'];
  airWater: number;
  airDelta: number;
  powerBank: number;
  powerDelta: number;
  cumulativeMsv: number;
  msvAdded: number;
  scienceFood: number;
  scienceDelta: number;
  hasCriticalRisk: boolean;
}

function formatDelta(val: number, suffix = '%'): string {
  const sign = val > 0 ? '+' : '';
  return `${sign}${val}${suffix}`;
}

export const ForecastPanel: React.FC<ForecastPanelProps> = ({
  site,
  metrics,
  allocation,
  scenarios,
  solIndex,
  currentScenario,
}) => {
  const { steps, riskAlerts } = useMemo(() => {
    const upcoming = scenarios.slice(solIndex, solIndex + 3);
    let runningAir = metrics.airWater;
    let runningPower = metrics.powerBank;
    let runningMsv = metrics.cumulativeMsv;
    let runningScience = metrics.scienceFood;

    const computed: ProjectedSolStep[] = [];
    const alerts: string[] = [];

    upcoming.forEach((rawScenario, idx) => {
      const scenarioToUse = idx === 0 ? currentScenario : rawScenario;
      const deltas = calculateProjectedDeltas(site, allocation, scenarioToUse, runningAir);

      runningAir = clamp(runningAir + deltas.airWaterDelta, 0, 100);
      runningPower = clamp(runningPower + deltas.powerBankDelta, 0, 100);
      runningMsv = Number((runningMsv + deltas.radiationMsvAdded).toFixed(1));
      runningScience = clamp(runningScience + deltas.scienceFoodDelta, 0, 100);

      const airCritical = runningAir < 20;
      const powerCritical = runningPower < 20;
      const radCritical = runningMsv >= MAX_SAFE_MSV * 0.8;

      if (airCritical && !alerts.some((a) => a.includes('Air & Water'))) {
        alerts.push(`Air & Water drops below 20% on Sol ${scenarioToUse.sol}`);
      }
      if (powerCritical && !alerts.some((a) => a.includes('Power Bank'))) {
        alerts.push(`Power Bank drops below 20% on Sol ${scenarioToUse.sol}`);
      }
      if (runningMsv >= MAX_SAFE_MSV && !alerts.some((a) => a.includes('Radiation'))) {
        alerts.push(`Radiation exceeds ${MAX_SAFE_MSV} mSv limit on Sol ${scenarioToUse.sol}`);
      } else if (radCritical && !alerts.some((a) => a.includes('Radiation'))) {
        alerts.push(`Radiation margin falls under 20% on Sol ${scenarioToUse.sol}`);
      }

      computed.push({
        sol: scenarioToUse.sol,
        title: scenarioToUse.title,
        weatherCondition: scenarioToUse.weatherCondition,
        airWater: runningAir,
        airDelta: deltas.airWaterDelta,
        powerBank: runningPower,
        powerDelta: deltas.powerBankDelta,
        cumulativeMsv: runningMsv,
        msvAdded: deltas.radiationMsvAdded,
        scienceFood: runningScience,
        scienceDelta: deltas.scienceFoodDelta,
        hasCriticalRisk: airCritical || powerCritical || radCritical,
      });
    });

    return { steps: computed, riskAlerts: alerts };
  }, [site, metrics, allocation, scenarios, solIndex, currentScenario]);

  if (steps.length === 0) return null;

  const firstSol = steps[0].sol;
  const lastSol = steps[steps.length - 1].sol;
  const horizonLabel =
    steps.length === 1 ? `Sol ${firstSol}` : `Sol ${firstSol}–${lastSol}`;

  return (
    <div
      className="bg-white border border-[#DCE3EE] rounded-xl p-4 sm:p-5 space-y-3.5"
      aria-label="3-Sol resource forecast"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
            Forecast ({steps.length}-Sol Projection · {horizonLabel})
          </h3>
          <p className="text-xs text-[#475569] mt-0.5">
            Simulated resource trajectory using your current power settings before trade-off choices.
          </p>
        </div>

        <div
          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
            riskAlerts.length > 0 ? 'text-[#DC2626]' : 'text-[#059669]'
          }`}
        >
          {riskAlerts.length > 0 ? (
            <>
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{riskAlerts[0]}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>All systems stay above critical thresholds</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {steps.map((step, idx) => (
          <div
            key={step.sol}
            className={`rounded-lg border p-3.5 space-y-2.5 ${
              step.hasCriticalRisk
                ? 'bg-[#FEF2F2]/70 border-[#FCA5A5]'
                : idx === 0
                  ? 'bg-[#F8FAFC] border-[#BFDBFE]'
                  : 'bg-[#F8FAFC] border-[#E2E8F0]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-mono font-bold text-[#0F172A]">
                  Sol {step.sol} {idx === 0 ? '· Next' : ''}
                </p>
                <p className="text-xs text-[#475569] truncate" title={step.title}>
                  {step.title}
                </p>
              </div>
              <span
                className={`text-[11px] font-semibold shrink-0 ${
                  step.weatherCondition === 'Calm'
                    ? 'text-[#059669]'
                    : step.weatherCondition === 'Solar Flare'
                      ? 'text-[#DC2626]'
                      : 'text-[#D97706]'
                }`}
              >
                {step.weatherCondition}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs pt-1 border-t border-[#E2E8F0]">
              <div>
                <dt className="text-[11px] text-[#64748B] flex items-center gap-1">
                  <Wind className="w-3 h-3 text-[#0284C7]" aria-hidden="true" />
                  Air &amp; Water
                </dt>
                <dd
                  className={`font-mono font-bold mt-0.5 ${
                    step.airWater < 20 ? 'text-[#DC2626]' : 'text-[#0F172A]'
                  }`}
                >
                  {step.airWater}%{' '}
                  <span
                    className={`text-[11px] font-medium ${
                      step.airDelta >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'
                    }`}
                  >
                    ({formatDelta(step.airDelta)})
                  </span>
                </dd>
              </div>

              <div>
                <dt className="text-[11px] text-[#64748B] flex items-center gap-1">
                  <Zap className="w-3 h-3 text-[#D97706]" aria-hidden="true" />
                  Power Bank
                </dt>
                <dd
                  className={`font-mono font-bold mt-0.5 ${
                    step.powerBank < 20 ? 'text-[#DC2626]' : 'text-[#0F172A]'
                  }`}
                >
                  {step.powerBank}%{' '}
                  <span
                    className={`text-[11px] font-medium ${
                      step.powerDelta >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'
                    }`}
                  >
                    ({formatDelta(step.powerDelta)})
                  </span>
                </dd>
              </div>

              <div>
                <dt className="text-[11px] text-[#64748B] flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-[#DC2626]" aria-hidden="true" />
                  Radiation
                </dt>
                <dd
                  className={`font-mono font-bold mt-0.5 ${
                    step.cumulativeMsv >= MAX_SAFE_MSV * 0.8 ? 'text-[#DC2626]' : 'text-[#0F172A]'
                  }`}
                >
                  {step.cumulativeMsv.toFixed(1)} mSv{' '}
                  <span className="text-[11px] font-medium text-[#64748B]">
                    (+{step.msvAdded.toFixed(1)})
                  </span>
                </dd>
              </div>

              <div>
                <dt className="text-[11px] text-[#64748B] flex items-center gap-1">
                  <Sprout className="w-3 h-3 text-[#059669]" aria-hidden="true" />
                  Sci &amp; Food
                </dt>
                <dd className="font-mono font-bold text-[#0F172A] mt-0.5">
                  {step.scienceFood}%{' '}
                  <span className="text-[11px] font-medium text-[#059669]">
                    (+{step.scienceDelta}%)
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748B] font-mono pt-0.5">
        <span>
          Active Power Settings: Life Support {allocation.lifeSupport} · Shielding{' '}
          {allocation.shielding} · Crops {allocation.greenhouse} · Lab {allocation.scienceComms}
        </span>
        <span>Safe Radiation Limit: {MAX_SAFE_MSV} mSv</span>
      </div>
    </div>
  );
};
