import React, { useMemo, useState } from 'react';
import { RefreshCw, ArrowRight, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { OUTPOST_MEDIA } from '../assets/media';
import {
  DonkiFeedResponse,
  LiveOsdrResponse,
  NASA_TRACEABILITY_MATRIX,
  NasaDonkiEvent,
  OSDR_STUDIES,
  OUTPOST_SITES,
} from '../data/nasaDatasets';
import { computeRealMarsComms } from '../utils/orbitalMath';
import type { HorizonsTelemetryResponse } from '../App';

interface NasaScienceViewProps {
  donkiFeed: DonkiFeedResponse;
  liveOsdr: LiveOsdrResponse | null;
  liveHorizons: HorizonsTelemetryResponse | null;
  loadingDonki: boolean;
  onRefreshDonki: () => void;
  onSelectStormForMission: (storm: NasaDonkiEvent) => void;
}

export const NasaScienceView: React.FC<NasaScienceViewProps> = ({
  donkiFeed,
  liveOsdr,
  liveHorizons,
  loadingDonki,
  onRefreshDonki,
  onSelectStormForMission,
}) => {
  const [diagramFailed, setDiagramFailed] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'FLR' | 'CME' | 'SEP'>('ALL');
  const fallbackMarsTelemetry = useMemo(() => computeRealMarsComms(), []);
  const marsTelemetry = liveHorizons ?? fallbackMarsTelemetry;

  const mergedOsdrStudies = useMemo(() => {
    const liveMap = new Map(liveOsdr?.studies.map((s) => [s.id, s]) ?? []);
    return OSDR_STUDIES.map((study) => {
      const liveItem = liveMap.get(study.id);
      if (!liveItem) return study;
      return {
        ...study,
        title: liveItem.officialTitle || study.title,
        assayCount: liveItem.assayCount,
        liveVerified: liveItem.sourceMode === 'live',
      };
    });
  }, [liveOsdr]);

  const filteredEvents = useMemo(() => {
    if (typeFilter === 'ALL') return donkiFeed.events;
    return donkiFeed.events.filter((ev) => ev.type === typeFilter);
  }, [donkiFeed.events, typeFilter]);

  return (
    <section className="space-y-8">
      <div className="bg-white border border-[#DCE3EE] rounded-xl p-6 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-3">
            <p className="text-xs font-semibold text-[#2563EB]">
              Traceable Real NASA Open Science Datasets
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A]">
              Real NASA Data Behind Every Mission Decision
            </h1>
            <p className="text-sm text-[#334155] leading-relaxed max-w-2xl">
              AstraOutpost does not invent random video-game numbers. Our storm alerts, radiation
              doses, plant oxygen loops, and Mars radio lag come directly from NASA’s Space Weather
              Database (DONKI), Open Science Data Repository (OSDR), Artemis &amp; Mars surface
              missions, and today’s live planetary orbital distance ({marsTelemetry.distanceMillionKm}M km to Mars).
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                  donkiFeed.sourceMode === 'live' ? 'text-[#059669]' : 'text-[#D97706]'
                }`}
              >
                {donkiFeed.sourceMode === 'live' ? (
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                )}
                {donkiFeed.sourceMode === 'live'
                  ? 'Connected to Live Space Weather Feed'
                  : 'Verified Archived NASA DONKI Catalog'}
              </span>
              {liveOsdr?.sourceMode === 'live' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#059669]">
                  · Live NASA OSDR API
                </span>
              )}
              {liveHorizons?.sourceMode === 'live' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#059669]">
                  · Live NASA/JPL Horizons DE441
                </span>
              )}
              <span className="text-xs text-[#64748B]">· {donkiFeed.note}</span>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-xl overflow-hidden border border-[#DCE3EE] bg-[#0B1220]">
              {!diagramFailed ? (
                <img
                  src={OUTPOST_MEDIA.solarFlareImg}
                  alt="Scientific diagram of a solar flare wave hitting a shielded space outpost dome"
                  referrerPolicy="no-referrer"
                  onError={() => setDiagramFailed(true)}
                  className="w-full aspect-4/3 object-cover block"
                />
              ) : (
                <div className="w-full aspect-4/3 flex items-center justify-center bg-[#0F172A] text-white p-6 text-center">
                  <p className="text-sm font-semibold">Solar Flare &amp; Magnetic Shield Diagram</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 1. NASA DONKI Space Weather Events */}
      <div className="bg-white border border-[#DCE3EE] rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">
              NASA DONKI Space Weather Feed (Solar Flares, CMEs &amp; Protons)
            </h2>
            <p className="text-xs text-[#475569] mt-0.5">
              Filter space weather events or click Train With Storm to launch a mission facing that storm.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-lg border border-[#DCE3EE]">
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'FLR', label: 'Flares (FLR)' },
                  { id: 'CME', label: 'CMEs' },
                  { id: 'SEP', label: 'Protons (SEP)' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    typeFilter === tab.id ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#475569]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onRefreshDonki}
              disabled={loadingDonki}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loadingDonki ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {loadingDonki ? 'Checking NASA API...' : 'Refresh NASA DONKI'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#DCE3EE] text-[#64748B]">
                <th className="py-2.5 pr-4 font-semibold">Event &amp; Peak Time</th>
                <th className="py-2.5 pr-4 font-semibold">Type</th>
                <th className="py-2.5 pr-4 font-semibold">Severity</th>
                <th className="py-2.5 pr-4 font-semibold">Radiation Spike</th>
                <th className="py-2.5 pr-4 font-semibold">What It Means for Kids</th>
                <th className="py-2.5 font-semibold text-right">Mission Link</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#64748B]">
                    No {typeFilter} events in the current feed window. Switch to All to see other real NASA events.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => (
                  <tr key={ev.id} className="border-b border-[#F1F5F9] align-top">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-[#0F172A]">{ev.classOrSpeed}</p>
                      <p className="font-mono text-[11px] text-[#64748B] mt-0.5">{ev.peakTime}</p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">{ev.source}</p>
                    </td>
                    <td className="py-3 pr-4 font-mono font-semibold text-[#334155]">{ev.type}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`font-semibold ${
                          ev.severity === 'Extreme'
                            ? 'text-[#DC2626]'
                            : ev.severity === 'High'
                              ? 'text-[#D97706]'
                              : ev.severity === 'Moderate'
                                ? 'text-[#2563EB]'
                                : 'text-[#059669]'
                        }`}
                      >
                        {ev.severity}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono font-semibold text-[#0F172A]">
                      +{ev.radiationMsvPerDay.toFixed(1)} mSv/day
                    </td>
                    <td className="py-3 pr-4 text-[#334155] max-w-md leading-relaxed">
                      {ev.kidExplanation}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectStormForMission(ev)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[11px] font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Train With Storm
                        <ArrowRight className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. NASA OSDR Biological & Dosimetry Studies */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#0F172A]">
            NASA Open Science Data Repository (OSDR) Findings Used in Gameplay
          </h2>
          <p className="text-xs text-[#475569] mt-0.5">
            Real biology and dosimetry studies explaining why crops, water loops, and radiation
            shielding trade off against each other.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mergedOsdrStudies.map((study) => (
            <div
              key={study.id}
              className="bg-white border border-[#DCE3EE] rounded-xl p-5 flex flex-col justify-between gap-3"
            >
              <div>
                <p className="text-xs font-mono font-semibold text-[#2563EB]">
                  {study.id} · {study.organismOrFocus}
                  {study.liveVerified && study.assayCount ? ` · Live OSDR (${study.assayCount} assays)` : ''}
                </p>
                <h3 className="text-base font-bold text-[#0F172A] mt-1">{study.title}</h3>
                <p className="text-xs text-[#334155] mt-2 leading-relaxed">{study.finding}</p>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] space-y-2 text-xs">
                <p className="text-[#0F172A]">
                  <span className="font-semibold">Kid Summary:</span> {study.kidTakeaway}
                </p>
                <p className="text-[#475569]">
                  <span className="font-semibold text-[#059669]">In-Game Rule:</span> {study.gameRuleLink}
                </p>
                <a
                  href={study.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[#2563EB] hover:underline font-medium pt-1"
                >
                  Inspect {study.id} on NASA OSDR
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Artemis vs Mars Surface Data Comparison */}
      <div className="bg-white border border-[#DCE3EE] rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-[#0F172A]">
          Artemis Lunar South Pole vs. Mars Jezero Crater Telemetry
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#DCE3EE] text-[#64748B]">
                <th className="py-2 pr-4 font-semibold">Measurement</th>
                <th className="py-2 pr-4 font-semibold">{OUTPOST_SITES.moon.name}</th>
                <th className="py-2 font-semibold">{OUTPOST_SITES.mars.name}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              <tr>
                <td className="py-2.5 pr-4 font-semibold text-[#0F172A]">Day / Sol Length</td>
                <td className="py-2.5 pr-4 text-[#334155]">{OUTPOST_SITES.moon.dayLength}</td>
                <td className="py-2.5 text-[#334155]">{OUTPOST_SITES.mars.dayLength}</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-semibold text-[#0F172A]">Temperature Range</td>
                <td className="py-2.5 pr-4 font-mono text-[#334155]">{OUTPOST_SITES.moon.temperatureRange}</td>
                <td className="py-2.5 font-mono text-[#334155]">{OUTPOST_SITES.mars.temperatureRange}</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-semibold text-[#0F172A]">Natural Radiation</td>
                <td className="py-2.5 pr-4 font-mono text-[#334155]">
                  {OUTPOST_SITES.moon.baselineRadiationMsvPerDay} mSv / day
                </td>
                <td className="py-2.5 font-mono text-[#334155]">
                  {OUTPOST_SITES.mars.baselineRadiationMsvPerDay} mSv / day
                </td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-semibold text-[#0F172A]">Radio Delay to Earth</td>
                <td className="py-2.5 pr-4 font-mono text-[#334155]">{OUTPOST_SITES.moon.commsDisplay}</td>
                <td className="py-2.5 font-mono text-[#334155]">
                  {marsTelemetry.dateLabel}: {marsTelemetry.roundTripFormatted} round-trip
                  {liveHorizons?.sourceMode === 'live' ? ' (JPL Horizons DE441)' : ''}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 font-semibold text-[#0F172A]">NASA Data Source</td>
                <td className="py-2.5 pr-4 text-[#475569]">{OUTPOST_SITES.moon.dataAttribution}</td>
                <td className="py-2.5 text-[#475569]">{OUTPOST_SITES.mars.dataAttribution}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Judge & Educator Traceability Matrix */}
      <div className="bg-white border border-[#DCE3EE] rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[#0F172A]">
            Science &amp; Engineering Traceability Matrix (For Judges &amp; Educators)
          </h2>
          <p className="text-xs text-[#475569] mt-0.5">
            Exact mapping from each NASA dataset to AstraOutpost’s simulation rules and learning goals.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#DCE3EE] text-[#64748B]">
                <th className="py-2 pr-4 font-semibold">NASA Dataset</th>
                <th className="py-2 pr-4 font-semibold">ID / Endpoint</th>
                <th className="py-2 pr-4 font-semibold">Measured Quantity</th>
                <th className="py-2 pr-4 font-semibold">Exact Simulation Rule</th>
                <th className="py-2 font-semibold">Trade-Off Taught</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] align-top">
              {NASA_TRACEABILITY_MATRIX.map((row) => (
                <tr key={row.datasetName}>
                  <td className="py-3 pr-4 font-semibold text-[#0F172A]">{row.datasetName}</td>
                  <td className="py-3 pr-4 font-mono text-[#2563EB]">{row.officialIdOrEndpoint}</td>
                  <td className="py-3 pr-4 text-[#334155]">{row.realMeasurement}</td>
                  <td className="py-3 pr-4 text-[#0F172A]">{row.inGameRuleAndFormula}</td>
                  <td className="py-3 text-[#475569]">{row.educationalTakeaway}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
