import React, { useEffect, useMemo, useState } from 'react';
import { Radio, CheckCircle2, Clock } from 'lucide-react';
import { OutpostSiteId, OUTPOST_SITES } from '../data/nasaDatasets';
import { computeRealMarsComms } from '../utils/orbitalMath';
import { soundFx } from '../utils/soundFx';

import type { HorizonsTelemetryResponse } from '../App';

interface CommsDelayWidgetProps {
  site: OutpostSiteId;
  liveHorizons?: HorizonsTelemetryResponse | null;
}

export const CommsDelayWidget: React.FC<CommsDelayWidgetProps> = ({ site, liveHorizons }) => {
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const fallbackTelemetry = useMemo(() => computeRealMarsComms(), []);
  const marsTelemetry = liveHorizons ?? fallbackTelemetry;
  const isMoon = site === 'moon';
  const siteData = OUTPOST_SITES[site];

  const [statusMessage, setStatusMessage] = useState<string>('');
  const simDurationMs = isMoon ? 2600 : 6500;

  useEffect(() => {
    setSending(false);
    setProgress(0);
    setStatusMessage(
      isMoon
        ? 'Distance: 384,400 km. Round-trip radio signal takes 2.6 real seconds.'
        : `Today’s Real Distance (${marsTelemetry.dateLabel}): ${marsTelemetry.distanceMillionKm}M km (${marsTelemetry.distanceAu} AU) · Real round-trip: ${marsTelemetry.roundTripFormatted} (compressed to 6.5s demo).`
    );
  }, [site, isMoon, marsTelemetry]);

  useEffect(() => {
    if (!sending) return;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / simDurationMs) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(timer);
        setSending(false);
        soundFx.playTelemetryPing();
        setStatusMessage(
          isMoon
            ? 'Reply received in 2.6 seconds! Earth Mission Control can help your Lunar crew live.'
            : `Reply finally arrived (${marsTelemetry.roundTripFormatted} real light-time later)! During a sudden solar flare or leak, Martian astronauts must act on their own.`
        );
      }
    }, 60);

    return () => clearInterval(timer);
  }, [sending, simDurationMs, isMoon, marsTelemetry]);

  const handlePing = () => {
    if (sending) return;
    soundFx.playTick(680);
    setProgress(0);
    setSending(true);
    setStatusMessage(
      isMoon
        ? 'Radio wave traveling at 299,792 km/s to Earth and back...'
        : `Signal racing across ${marsTelemetry.distanceMillionKm} million km (${marsTelemetry.oneWayFormatted} each way)...`
    );
  };

  return (
    <div className="bg-white border border-[#DCE3EE] rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h4 className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
            Speed-of-Light Radio Delay Simulator
          </h4>
          <p className="text-xs text-[#475569] mt-0.5 font-mono">
            {siteData.locationLabel} ·{' '}
            {isMoon
              ? '2.6s round-trip'
              : `Today: ${marsTelemetry.roundTripFormatted} round-trip (${marsTelemetry.distanceMillionKm}M km)${liveHorizons?.sourceMode === 'live' ? ' · JPL DE441' : ''}`}
          </p>
        </div>

        <button
          type="button"
          onClick={handlePing}
          disabled={sending}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            sending
              ? 'bg-[#E2E8F0] text-[#64748B] cursor-not-allowed'
              : 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]'
          }`}
        >
          {sending ? 'Signal in Flight...' : 'Ping Earth Control'}
        </button>
      </div>

      <div className="flex items-center gap-3 mb-2.5">
        <span className="text-xs font-semibold text-[#0F172A] whitespace-nowrap">
          {isMoon ? 'Moon' : 'Mars'}
        </span>
        <div className="relative flex-1 h-3 bg-[#E2E8F0] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#2563EB] transition-transform duration-75 origin-left"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        </div>
        <span className="text-xs font-semibold text-[#0F172A] whitespace-nowrap">Earth</span>
      </div>

      <div className="flex items-start gap-2 text-xs text-[#334155]">
        {progress >= 100 ? (
          <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" aria-hidden="true" />
        ) : (
          <Clock className="w-4 h-4 text-[#64748B] shrink-0 mt-0.5" aria-hidden="true" />
        )}
        <p className="leading-relaxed">{statusMessage}</p>
      </div>
    </div>
  );
};
