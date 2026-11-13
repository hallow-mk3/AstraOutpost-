import { useCallback, useEffect, useState } from 'react';
import {
  DonkiFeedResponse,
  FALLBACK_DONKI_EVENTS,
  LiveOsdrResponse,
  NasaDonkiEvent,
} from './data/nasaDatasets';
import { MarsCommsTelemetry } from './utils/orbitalMath';
import { MissionControlView } from './components/MissionControlView';
import { TradeOffLabView } from './components/TradeOffLabView';
import { NasaScienceView } from './components/NasaScienceView';
import { FieldGuideView } from './components/FieldGuideView';

type AppTab = 'mission' | 'lab' | 'science' | 'guide';

const DEFAULT_DONKI_FEED: DonkiFeedResponse = {
  fetchedAt: Date.now(),
  sourceMode: 'archived',
  events: FALLBACK_DONKI_EVENTS,
  note: 'Loaded verified archived NASA DONKI space weather records (2024 Solar Cycle 25 catalog).',
};

export interface HorizonsTelemetryResponse extends MarsCommsTelemetry {
  sourceMode: 'live' | 'j2000';
  sourceLabel: string;
}

const ACTIVE_STORM_STORAGE_KEY = 'astraoutpost_active_storm_v1';

function loadSavedStorm(): NasaDonkiEvent | null {
  try {
    const raw = localStorage.getItem(ACTIVE_STORM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NasaDonkiEvent>;
    if (!parsed || !parsed.id || !parsed.classOrSpeed) return null;
    return parsed as NasaDonkiEvent;
  } catch {
    return null;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('mission');
  const [donkiFeed, setDonkiFeed] = useState<DonkiFeedResponse>(DEFAULT_DONKI_FEED);
  const [liveOsdr, setLiveOsdr] = useState<LiveOsdrResponse | null>(null);
  const [liveHorizons, setLiveHorizons] = useState<HorizonsTelemetryResponse | null>(null);
  const [loadingDonki, setLoadingDonki] = useState<boolean>(false);
  const [featuredStorm, setFeaturedStorm] = useState<NasaDonkiEvent | null>(() => loadSavedStorm());
  const [resetSignal, setResetSignal] = useState<number>(0);
  const [stormLaunchSignal, setStormLaunchSignal] = useState<number>(0);

  useEffect(() => {
    try {
      if (featuredStorm) {
        localStorage.setItem(ACTIVE_STORM_STORAGE_KEY, JSON.stringify(featuredStorm));
      } else {
        localStorage.removeItem(ACTIVE_STORM_STORAGE_KEY);
      }
    } catch {
      // Ignore storage quota issues
    }
  }, [featuredStorm]);

  const fetchDonkiFeed = useCallback(async () => {
    setLoadingDonki(true);
    try {
      const res = await fetch('/api/nasa/donki');
      if (!res.ok) throw new Error('DONKI request failed');
      const data = (await res.json()) as DonkiFeedResponse;
      if (data && Array.isArray(data.events) && data.events.length > 0) {
        setDonkiFeed(data);
      }
    } catch {
      // Keep verified archived NASA DONKI dataset cleanly without breaking UI
    } finally {
      setLoadingDonki(false);
    }
  }, []);

  const fetchLiveScienceApis = useCallback(async () => {
    try {
      const [osdrRes, horizonsRes] = await Promise.all([
        fetch('/api/nasa/osdr'),
        fetch('/api/nasa/horizons'),
      ]);
      if (osdrRes.ok) {
        const osdrJson = (await osdrRes.json()) as LiveOsdrResponse;
        setLiveOsdr(osdrJson);
      }
      if (horizonsRes.ok) {
        const horizonsJson = (await horizonsRes.json()) as HorizonsTelemetryResponse;
        setLiveHorizons(horizonsJson);
      }
    } catch {
      // Fallback values remain active automatically
    }
  }, []);

  useEffect(() => {
    fetchDonkiFeed();
    fetchLiveScienceApis();
  }, [fetchDonkiFeed, fetchLiveScienceApis]);

  const handleNewMission = () => {
    setFeaturedStorm(null);
    setActiveTab('mission');
    setResetSignal((n) => n + 1);
  };

  const handleSelectStormForMission = (storm: NasaDonkiEvent) => {
    setFeaturedStorm(storm);
    setActiveTab('mission');
    setStormLaunchSignal((n) => n + 1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8FB] text-[#0F172A]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="bg-white border-b border-[#DCE3EE]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('mission')}
            className="font-display text-lg font-bold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0 cursor-pointer"
          >
            AstraOutpost
          </button>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {(
              [
                { id: 'mission', label: 'Mission Control' },
                { id: 'lab', label: 'Trade-Off Lab' },
                { id: 'science', label: 'NASA Data' },
                { id: 'guide', label: 'Field Guide' },
              ] as const
            ).map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                    isActive
                      ? 'text-[#0F172A] border-[#2563EB] font-semibold'
                      : 'text-[#475569] border-transparent hover:text-[#0F172A]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleNewMission}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] hover:bg-[#1E293B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              New Mission
            </button>
          </div>
        </div>

        <nav
          aria-label="Mobile navigation"
          className="md:hidden flex items-center gap-4 px-4 pb-3 overflow-x-auto text-xs font-medium border-t border-[#F1F5F9] pt-2"
        >
          {(
            [
              { id: 'mission', label: 'Mission Control' },
              { id: 'lab', label: 'Trade-Off Lab' },
              { id: 'science', label: 'NASA Data' },
              { id: 'guide', label: 'Field Guide' },
            ] as const
          ).map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap shrink-0 pb-1 border-b-2 cursor-pointer ${
                  isActive
                    ? 'text-[#0F172A] border-[#2563EB] font-semibold'
                    : 'text-[#475569] border-transparent'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-6 md:py-8">
        {activeTab === 'mission' && (
          <MissionControlView
            donkiFeed={donkiFeed}
            liveHorizons={liveHorizons}
            featuredStorm={featuredStorm}
            onClearFeaturedStorm={() => setFeaturedStorm(null)}
            externalResetSignal={resetSignal}
            stormLaunchSignal={stormLaunchSignal}
          />
        )}
        {activeTab === 'lab' && <TradeOffLabView />}
        {activeTab === 'science' && (
          <NasaScienceView
            donkiFeed={donkiFeed}
            liveOsdr={liveOsdr}
            liveHorizons={liveHorizons}
            loadingDonki={loadingDonki}
            onRefreshDonki={() => {
              fetchDonkiFeed();
              fetchLiveScienceApis();
            }}
            onSelectStormForMission={handleSelectStormForMission}
          />
        )}
        {activeTab === 'guide' && <FieldGuideView />}
      </main>

      <footer className="border-t border-[#DCE3EE] bg-white mt-12">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-[#64748B]">
          <p>
            AstraOutpost Junior Astronaut Mission Trainer · Built for the 2026 NASA Space Apps
            Challenge
          </p>
          <p>
            Science grounded in NASA DONKI, NASA OSDR, Artemis South Pole &amp; Mars
            Perseverance/Curiosity datasets
          </p>
        </div>
      </footer>
    </div>
  );
}
