import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, XCircle } from 'lucide-react';

export type MissionLogLevel = 'critical' | 'warning' | 'milestone' | 'decision';

export interface MissionLogEvent {
  id: string;
  sol: number;
  level: MissionLogLevel;
  title: string;
  detail: string;
  metricsSummary: string;
}

interface MissionLogProps {
  events: MissionLogEvent[];
}

const LEVEL_META: Record<
  MissionLogLevel,
  { label: string; textClass: string; bgClass: string; borderClass: string; Icon: React.ElementType }
> = {
  critical: {
    label: 'Critical',
    textClass: 'text-[#DC2626]',
    bgClass: 'bg-[#FEF2F2]',
    borderClass: 'border-[#FECACA]',
    Icon: XCircle,
  },
  warning: {
    label: 'Warning',
    textClass: 'text-[#B45309]',
    bgClass: 'bg-[#FFFBEB]',
    borderClass: 'border-[#FDE68A]',
    Icon: AlertTriangle,
  },
  milestone: {
    label: 'Milestone',
    textClass: 'text-[#059669]',
    bgClass: 'bg-[#ECFDF5]',
    borderClass: 'border-[#A7F3D0]',
    Icon: CheckCircle2,
  },
  decision: {
    label: 'Decision',
    textClass: 'text-[#1D4ED8]',
    bgClass: 'bg-[#F8FAFC]',
    borderClass: 'border-[#E2E8F0]',
    Icon: ClipboardList,
  },
};

export const MissionLog: React.FC<MissionLogProps> = ({ events }) => {
  const [filter, setFilter] = useState<'all' | 'alerts'>('all');

  const alertCount = useMemo(
    () => events.filter((e) => e.level === 'critical' || e.level === 'warning').length,
    [events]
  );

  const visibleEvents = useMemo(() => {
    const list =
      filter === 'alerts'
        ? events.filter((e) => e.level === 'critical' || e.level === 'warning')
        : events;
    return [...list].reverse();
  }, [events, filter]);

  return (
    <div className="bg-white border border-[#DCE3EE] rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#0F172A]">Mission Log</h3>
          <p className="text-xs text-[#64748B]">
            Scrollable record of decisions and resource threshold alerts ({events.length} entries ·{' '}
            {alertCount} alert{alertCount === 1 ? '' : 's'})
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-lg border border-[#DCE3EE]">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
              filter === 'all' ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#475569]'
            }`}
          >
            All Events ({events.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('alerts')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
              filter === 'alerts' ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#475569]'
            }`}
          >
            Alerts ({alertCount})
          </button>
        </div>
      </div>

      <div
        className="space-y-2 max-h-64 overflow-y-auto pr-1"
        role="log"
        aria-live="polite"
        aria-label="Mission event and threshold alert log"
      >
        {visibleEvents.length === 0 ? (
          <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs text-[#64748B] text-center">
            No threshold alerts recorded yet. Resource levels remain in safe margins.
          </div>
        ) : (
          visibleEvents.map((ev) => {
            const meta = LEVEL_META[ev.level];
            const Icon = meta.Icon;
            return (
              <div
                key={ev.id}
                className={`p-3 rounded-lg border text-xs ${meta.bgClass} ${meta.borderClass}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-semibold text-[#0F172A]">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${meta.textClass}`} aria-hidden="true" />
                    <span className={meta.textClass}>{meta.label}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">Sol {ev.sol}</span>
                    <span aria-hidden="true">·</span>
                    <span>{ev.title}</span>
                  </div>
                  <span className="font-mono text-[11px] text-[#475569]">{ev.metricsSummary}</span>
                </div>
                <p className="text-[#334155] mt-1 leading-relaxed">{ev.detail}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
