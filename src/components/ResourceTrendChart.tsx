import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { MAX_SAFE_MSV, MAX_SOLS, MissionMetrics, SolLogEntry } from '../data/missionScenarios';

interface ResourceTrendChartProps {
  logs: SolLogEntry[];
  metrics: MissionMetrics;
  currentSol: number;
  isEndState?: boolean;
}

interface TrendPoint {
  sol: number;
  label: string;
  airWater: number | null;
  powerBank: number | null;
  radSafety: number | null;
  scienceFood: number | null;
  msv: number | null;
  decision?: string;
}

type SeriesKey = 'airWater' | 'powerBank' | 'radSafety' | 'scienceFood';

const SERIES_CONFIG: Array<{
  key: SeriesKey;
  label: string;
  color: string;
  dashed?: boolean;
}> = [
  { key: 'airWater', label: 'Air & Water', color: '#0284C7' },
  { key: 'powerBank', label: 'Power Bank', color: '#D97706' },
  { key: 'radSafety', label: 'Shield Safety', color: '#6366F1', dashed: true },
  { key: 'scienceFood', label: 'Science & Food', color: '#059669' },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey?: string;
    name?: string;
    value?: number | null;
    color?: string;
    payload?: TrendPoint;
  }>;
  label?: string;
}

const CustomTrendTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  const hasRecordedData = payload.some((entry) => typeof entry.value === 'number');
  if (!hasRecordedData) {
    return (
      <div className="bg-[#0F172A] text-white rounded-lg px-3 py-2 text-xs shadow-lg border border-[#334155]">
        <p className="font-mono font-bold text-[#93C5FD]">{label}</p>
        <p className="text-[#CBD5E1] mt-0.5">Not reached yet — play this Sol to record data.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0F172A] text-white rounded-lg px-3 py-2.5 text-xs shadow-lg border border-[#334155] space-y-1.5 max-w-[240px]">
      <div className="flex items-center justify-between gap-2 border-b border-[#334155] pb-1">
        <span className="font-mono font-bold text-[#93C5FD]">{label}</span>
        {point?.msv !== null && point?.msv !== undefined && (
          <span className="font-mono text-[11px] text-[#CBD5E1]">{point.msv.toFixed(1)} mSv</span>
        )}
      </div>
      {point?.decision && (
        <p className="text-[11px] text-[#E2E8F0] leading-snug">{point.decision}</p>
      )}
      <div className="space-y-1 pt-0.5">
        {payload.map((entry) => {
          if (typeof entry.value !== 'number') return null;
          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-[#CBD5E1]">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}
              </span>
              <span className="font-mono font-bold text-white">{entry.value}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ResourceTrendChart: React.FC<ResourceTrendChartProps> = ({
  logs,
  metrics,
  currentSol,
  isEndState = false,
}) => {
  const [visibleSeries, setVisibleSeries] = useState<Record<SeriesKey, boolean>>({
    airWater: true,
    powerBank: true,
    radSafety: true,
    scienceFood: true,
  });

  const data: TrendPoint[] = useMemo(() => {
    const bySol = new Map<number, SolLogEntry>();
    for (const entry of logs) {
      bySol.set(entry.sol, entry);
    }

    const points: TrendPoint[] = [
      {
        sol: 0,
        label: 'Start',
        airWater: 78,
        powerBank: 72,
        radSafety: 100,
        scienceFood: 0,
        msv: 0,
        decision: 'Outpost systems initialized',
      },
    ];

    for (let sol = 1; sol <= MAX_SOLS; sol += 1) {
      const log = bySol.get(sol);
      if (log) {
        const radSafety = Math.max(
          0,
          Math.round((1 - log.cumulativeMsvAfter / MAX_SAFE_MSV) * 100)
        );
        points.push({
          sol,
          label: `S${sol}`,
          airWater: log.airWaterAfter,
          powerBank: log.powerBankAfter,
          radSafety,
          scienceFood: log.scienceFoodAfter,
          msv: log.cumulativeMsvAfter,
          decision: log.chosenOptionLabel,
        });
      } else {
        points.push({
          sol,
          label: `S${sol}`,
          airWater: null,
          powerBank: null,
          radSafety: null,
          scienceFood: null,
          msv: null,
        });
      }
    }

    return points;
  }, [logs]);

  const currentRadSafety = Math.max(
    0,
    Math.round((1 - metrics.cumulativeMsv / MAX_SAFE_MSV) * 100)
  );

  const latestValues: Record<SeriesKey, number> = {
    airWater: metrics.airWater,
    powerBank: metrics.powerBank,
    radSafety: currentRadSafety,
    scienceFood: metrics.scienceFood,
  };

  const toggleSeries = (key: SeriesKey) => {
    setVisibleSeries((prev) => {
      const activeCount = Object.values(prev).filter(Boolean).length;
      if (prev[key] && activeCount === 1) {
        return { airWater: true, powerBank: true, radSafety: true, scienceFood: true };
      }
      return { ...prev, [key]: !prev[key] };
    });
  };

  return (
    <div className="bg-white border border-[#DCE3EE] rounded-xl p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
            8-Sol Resource Trend
          </h3>
          <p className="text-xs text-[#475569] mt-0.5">
            {logs.length === 0
              ? 'Your baseline starts here. Complete Sol 1 to watch how your choices shape all 8 Sols.'
              : isEndState
                ? `Mission history across ${logs.length} of ${MAX_SOLS} Sols. Hover or tap points for Sol details.`
                : `Live trend through Sol ${logs.length} (currently planning Sol ${currentSol}). Keep lines above 20% danger!`}
          </p>
        </div>

        <span className="text-[11px] font-mono font-semibold text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] px-2.5 py-1 rounded-md">
          {logs.length}/{MAX_SOLS} Sols Plotted
        </span>
      </div>

      {/* Clickable Metric Filter Legend */}
      <div className="flex flex-wrap items-center gap-1.5">
        {SERIES_CONFIG.map((series) => {
          const active = visibleSeries[series.key];
          return (
            <button
              key={series.key}
              type="button"
              onClick={() => toggleSeries(series.key)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A]'
                  : 'bg-white border-[#E2E8F0] text-[#94A3B8] opacity-65'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: series.color }}
              />
              <span>{series.label}</span>
              <span className="font-mono text-[#475569]">{latestValues[series.key]}%</span>
            </button>
          );
        })}
      </div>

      <div className="h-[220px] w-full min-w-0 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg pt-3 pr-3 pb-1 pl-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 2 }}>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
              axisLine={{ stroke: '#CBD5E1' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 20, 50, 75, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTrendTooltip />} />
            <ReferenceLine
              y={75}
              stroke="#10B981"
              strokeDasharray="4 4"
              strokeWidth={1.2}
              label={{
                value: '75% Goal',
                position: 'insideTopRight',
                fill: '#059669',
                fontSize: 10,
                fontWeight: 600,
              }}
            />
            <ReferenceLine
              y={20}
              stroke="#EF4444"
              strokeDasharray="4 4"
              strokeWidth={1.2}
              label={{
                value: '20% Danger',
                position: 'insideBottomRight',
                fill: '#DC2626',
                fontSize: 10,
                fontWeight: 600,
              }}
            />
            {visibleSeries.airWater && (
              <Line
                type="monotone"
                dataKey="airWater"
                name="Air & Water"
                stroke="#0284C7"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#0284C7', strokeWidth: 0 }}
                activeDot={{ r: 5.5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            {visibleSeries.powerBank && (
              <Line
                type="monotone"
                dataKey="powerBank"
                name="Power Bank"
                stroke="#D97706"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#D97706', strokeWidth: 0 }}
                activeDot={{ r: 5.5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            {visibleSeries.radSafety && (
              <Line
                type="monotone"
                dataKey="radSafety"
                name="Shield Safety"
                stroke="#6366F1"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 3.5, fill: '#6366F1', strokeWidth: 0 }}
                activeDot={{ r: 5.5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            {visibleSeries.scienceFood && (
              <Line
                type="monotone"
                dataKey="scienceFood"
                name="Science & Food"
                stroke="#059669"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#059669', strokeWidth: 0 }}
                activeDot={{ r: 5.5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
