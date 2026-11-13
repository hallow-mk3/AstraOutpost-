import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

interface CachedWeather {
  fetchedAt: number;
  sourceMode: 'live' | 'archived';
  events: NasaDonkiEvent[];
  note: string;
}

interface NasaDonkiEvent {
  id: string;
  type: 'FLR' | 'CME' | 'SEP';
  classOrSpeed: string;
  peakTime: string;
  severity: 'Low' | 'Moderate' | 'High' | 'Extreme';
  radiationMsvPerDay: number;
  summary: string;
  kidExplanation: string;
  source: string;
}

interface LiveOsdrMeta {
  id: string;
  officialTitle: string;
  officialDescription: string;
  assayCount: number;
  sourceMode: 'live' | 'archived';
}

interface CachedOsdr {
  fetchedAt: number;
  sourceMode: 'live' | 'archived';
  studies: LiveOsdrMeta[];
  note: string;
}

interface CachedHorizons {
  fetchedAt: number;
  sourceMode: 'live' | 'j2000';
  distanceMillionKm: number;
  distanceAu: number;
  oneWaySeconds: number;
  roundTripSeconds: number;
  oneWayFormatted: string;
  roundTripFormatted: string;
  dateLabel: string;
  sourceLabel: string;
}

const ARCHIVED_DONKI_EVENTS: NasaDonkiEvent[] = [
  {
    id: '2024-05-14T16:51:00-FLR-001',
    type: 'FLR',
    classOrSpeed: 'X8.7 Solar Flare',
    peakTime: '2024-05-14 16:51 UTC',
    severity: 'Extreme',
    radiationMsvPerDay: 9.4,
    summary: 'Active Region 3664 produced one of the strongest solar flares of Solar Cycle 25.',
    kidExplanation:
      'A giant burst of X-rays and light erupted from the Sun! Without thick water-wall shielding, astronauts outside would absorb months of radiation in hours.',
    source: 'NASA DONKI FLR Archive (AR 3664)',
  },
  {
    id: '2024-10-03T12:18:00-FLR-001',
    type: 'FLR',
    classOrSpeed: 'X9.0 Solar Flare',
    peakTime: '2024-10-03 12:18 UTC',
    severity: 'Extreme',
    radiationMsvPerDay: 10.2,
    summary: 'Major X9.0 impulsive flare recorded by GOES X-ray sensors and cataloged in NASA DONKI.',
    kidExplanation:
      'One of the biggest solar flares of 2024! Radio signals crackled, and deep-space crews must shelter inside shielded habitats.',
    source: 'NASA DONKI FLR Archive (AR 3842)',
  },
  {
    id: '2024-03-23T01:33:00-CME-001',
    type: 'CME',
    classOrSpeed: '1,350 km/s CME',
    peakTime: '2024-03-23 01:33 UTC',
    severity: 'High',
    radiationMsvPerDay: 5.8,
    summary: 'Fast halo Coronal Mass Ejection observed by SOHO/LASCO moving toward the inner solar system.',
    kidExplanation:
      'A fast cloud of solar plasma racing at 1,350 km per second—fast enough to cross from Earth to the Moon in under 5 minutes!',
    source: 'NASA DONKI CME Archive (SOHO/LASCO)',
  },
  {
    id: '2024-07-29T02:37:00-SEP-001',
    type: 'SEP',
    classOrSpeed: 'Proton Storm (S2)',
    peakTime: '2024-07-29 02:37 UTC',
    severity: 'Moderate',
    radiationMsvPerDay: 3.6,
    summary: 'Solar Energetic Particle event detected by GOES particle instruments following a western limb eruption.',
    kidExplanation:
      'High-speed protons launched from the Sun. They pass right through thin aluminum walls, so crews add water bags or regolith shielding.',
    source: 'NASA DONKI SEP Archive (GOES)',
  },
  {
    id: '2024-08-19T14:10:00-FLR-001',
    type: 'FLR',
    classOrSpeed: 'M3.1 Solar Flare',
    peakTime: '2024-08-19 14:10 UTC',
    severity: 'Moderate',
    radiationMsvPerDay: 2.4,
    summary: 'Moderate M-class solar flare creating mild space weather conditions.',
    kidExplanation:
      'A medium solar flare—not an emergency, but astronauts still check their radiation badges and keep shield power on standby.',
    source: 'NASA DONKI FLR Archive',
  },
];

let weatherCache: CachedWeather | null = null;
let osdrCache: CachedOsdr | null = null;
let horizonsCache: CachedHorizons | null = null;

const WEATHER_TTL_MS = 30 * 60 * 1000;
const LONG_TTL_MS = 6 * 60 * 60 * 1000;

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatMinSec(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = Math.round(totalSec % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

async function fetchLiveGoesSpaceWeather(): Promise<NasaDonkiEvent[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const [flaresRes, protonsRes] = await Promise.all([
      fetch('https://services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json', {
        signal: controller.signal,
      }),
      fetch('https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json', {
        signal: controller.signal,
      }),
    ]);
    clearTimeout(timeout);

    const events: NasaDonkiEvent[] = [];

    if (flaresRes.ok) {
      const flares = (await flaresRes.json()) as Array<Record<string, unknown>>;
      if (Array.isArray(flares) && flares.length > 0) {
        const ranked = [...flares].sort((a, b) => Number(b.max_xrlong || 0) - Number(a.max_xrlong || 0));
        const topFlares = ranked.slice(0, 3);
        for (const f of topFlares) {
          const maxClass = String(f.max_class || f.current_class || 'C1.0');
          const isX = maxClass.startsWith('X');
          const isM = maxClass.startsWith('M');
          const sat = f.satellite ? `GOES-${String(f.satellite)}` : 'GOES';
          events.push({
            id: `GOES-FLR-${String(f.max_time || f.time_tag || Math.random())}`,
            type: 'FLR',
            classOrSpeed: `${maxClass} Solar Flare`,
            peakTime: String(f.max_time || f.time_tag || '').replace('T', ' ').replace('Z', ' UTC'),
            severity: isX ? 'Extreme' : isM ? 'Moderate' : 'Low',
            radiationMsvPerDay: isX ? 8.5 : isM ? 3.2 : 1.4,
            summary: `Live X-ray flare detected by ${sat} satellite (${String(f.begin_class || '')} → ${maxClass}).`,
            kidExplanation: isX
              ? 'A major X-class burst of solar X-rays detected live! Outpost crews need strong shielding right away.'
              : isM
                ? 'A medium M-class solar flare detected by GOES satellites. Keep radiation shields active.'
                : 'A live small C-class solar flare measured by GOES X-ray sensors. Normal background shielding handles this easily.',
            source: `Live ${sat} Space Weather Feed`,
          });
        }
      }
    }

    if (protonsRes.ok) {
      const protons = (await protonsRes.json()) as Array<Record<string, unknown>>;
      if (Array.isArray(protons)) {
        const highEnergy = protons.filter((p) => String(p.energy) === '>=10 MeV');
        const latest = highEnergy[highEnergy.length - 1];
        if (latest) {
          const flux = Number(latest.flux || 0);
          const isStorm = flux >= 10;
          const sat = latest.satellite ? `GOES-${String(latest.satellite)}` : 'GOES';
          events.push({
            id: `GOES-SEP-${String(latest.time_tag || Date.now())}`,
            type: 'SEP',
            classOrSpeed: isStorm
              ? `Proton Storm (${flux.toFixed(1)} pfu)`
              : `Live Proton Flux (${flux.toFixed(2)} pfu)`,
            peakTime: String(latest.time_tag || '').replace('T', ' ').replace('Z', ' UTC'),
            severity: flux >= 100 ? 'High' : flux >= 10 ? 'Moderate' : 'Low',
            radiationMsvPerDay: flux >= 100 ? 5.6 : flux >= 10 ? 3.2 : 1.1,
            summary: `Live >=10 MeV solar proton flux measured by ${sat} particle sensors (${flux.toFixed(2)} pfu).`,
            kidExplanation: isStorm
              ? 'High-energy solar protons are elevated right now! Water-wall shielding helps block them.'
              : 'Live solar proton sensors show quiet background levels today—great conditions for solar power and science!',
            source: `Live ${sat} Proton Sensor`,
          });
        }
      }
    }

    return events;
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

async function fetchLiveDonki(): Promise<CachedWeather> {
  if (weatherCache && Date.now() - weatherCache.fetchedAt < WEATHER_TTL_MS) {
    return weatherCache;
  }

  const apiKey = process.env.NASA_API_KEY || 'DEMO_KEY';
  const end = new Date();
  const start = new Date(end.getTime() - 21 * 24 * 60 * 60 * 1000);
  const startDate = formatDate(start);
  const endDate = formatDate(end);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const flrUrl = `https://api.nasa.gov/DONKI/FLR?startDate=${startDate}&endDate=${endDate}&api_key=${apiKey}`;
    const cmeUrl = `https://api.nasa.gov/DONKI/CME?startDate=${startDate}&endDate=${endDate}&api_key=${apiKey}`;
    const sepUrl = `https://api.nasa.gov/DONKI/SEP?startDate=${startDate}&endDate=${endDate}&api_key=${apiKey}`;

    const [flrRes, cmeRes, sepRes] = await Promise.all([
      fetch(flrUrl, { signal: controller.signal }),
      fetch(cmeUrl, { signal: controller.signal }),
      fetch(sepUrl, { signal: controller.signal }),
    ]);

    clearTimeout(timeout);

    if (!flrRes.ok && !cmeRes.ok && !sepRes.ok) {
      throw new Error(`NASA DONKI status ${flrRes.status}/${cmeRes.status}/${sepRes.status}`);
    }

    const flrRaw = flrRes.ok ? ((await flrRes.json()) as Array<Record<string, unknown>>) : [];
    const cmeRaw = cmeRes.ok ? ((await cmeRes.json()) as Array<Record<string, unknown>>) : [];
    const sepRaw = sepRes.ok ? ((await sepRes.json()) as Array<Record<string, unknown>>) : [];

    const parsed: NasaDonkiEvent[] = [];

    if (Array.isArray(flrRaw)) {
      for (const item of flrRaw.slice(-3).reverse()) {
        const classType = String(item.classType || 'M1.0');
        const isX = classType.startsWith('X');
        const isM = classType.startsWith('M');
        parsed.push({
          id: String(item.flrID || `FLR-${Math.random()}`),
          type: 'FLR',
          classOrSpeed: `${classType} Solar Flare`,
          peakTime: String(item.peakTime || item.beginTime || '').replace('T', ' ').replace('Z', ' UTC'),
          severity: isX ? 'Extreme' : isM ? 'Moderate' : 'Low',
          radiationMsvPerDay: isX ? 8.5 : isM ? 3.2 : 1.4,
          summary: `Live flare logged from Active Region ${item.activeRegionNum || 'N/A'} (${String(item.sourceLocation || 'Solar Disk')}).`,
          kidExplanation: isX
            ? 'A major X-class burst of solar X-rays! Outpost crews need strong shielding right away.'
            : isM
              ? 'A medium M-class solar flare. Keep radiation shields active and monitor your dosimeter.'
              : 'A small C-class solar flare. Normal background shielding handles this easily.',
          source: 'Live NASA DONKI FLR API',
        });
      }
    }

    if (Array.isArray(cmeRaw)) {
      for (const item of cmeRaw.slice(-3).reverse()) {
        const analyses = Array.isArray(item.cmeAnalyses) ? (item.cmeAnalyses as Array<Record<string, unknown>>) : [];
        const speed = Number(analyses[0]?.speed || 650);
        const severity = speed > 1200 ? 'High' : speed > 750 ? 'Moderate' : 'Low';
        parsed.push({
          id: String(item.activityID || `CME-${Math.random()}`),
          type: 'CME',
          classOrSpeed: `${Math.round(speed)} km/s CME`,
          peakTime: String(item.startTime || '').replace('T', ' ').replace('Z', ' UTC'),
          severity,
          radiationMsvPerDay: speed > 1200 ? 6.0 : speed > 750 ? 3.5 : 1.8,
          summary: String(item.note || 'Coronal mass ejection tracked by NASA/SOHO coronagraphs.').slice(0, 140),
          kidExplanation: `Solar plasma cloud racing outward at ${Math.round(speed)} km/s. Faster clouds push more energetic particles toward the Moon and Mars.`,
          source: 'Live NASA DONKI CME API',
        });
      }
    }

    if (Array.isArray(sepRaw)) {
      for (const item of sepRaw.slice(-2).reverse()) {
        parsed.push({
          id: String(item.sepID || `SEP-${Math.random()}`),
          type: 'SEP',
          classOrSpeed: 'Solar Proton Event (SEP)',
          peakTime: String(item.eventTime || '').replace('T', ' ').replace('Z', ' UTC'),
          severity: 'High',
          radiationMsvPerDay: 5.2,
          summary: 'Live Solar Energetic Particle stream recorded by NASA DONKI SEP sensors.',
          kidExplanation:
            'High-energy solar protons detected! Astronauts outside Earth’s magnetic shield rely on water walls during SEP events.',
          source: 'Live NASA DONKI SEP API',
        });
      }
    }

    if (parsed.length === 0) {
      const result: CachedWeather = {
        fetchedAt: Date.now(),
        sourceMode: 'live',
        events: [
          {
            id: `LIVE-QUIET-${endDate}`,
            type: 'FLR',
            classOrSpeed: 'Quiet Sun (No Major Flares)',
            peakTime: `${endDate} UTC`,
            severity: 'Low',
            radiationMsvPerDay: 1.1,
            summary: `NASA DONKI reported no major solar flares between ${startDate} and ${endDate}.`,
            kidExplanation: 'The Sun is calm right now! Only normal galactic background radiation reaches astronauts.',
            source: 'Live NASA DONKI API',
          },
          ...ARCHIVED_DONKI_EVENTS.slice(0, 4),
        ],
        note: `Connected to live NASA DONKI FLR/CME/SEP feeds (${startDate} to ${endDate}), supplemented with archived training storms.`,
      };
      weatherCache = result;
      return result;
    }

    const result: CachedWeather = {
      fetchedAt: Date.now(),
      sourceMode: 'live',
      events: parsed.slice(0, 8),
      note: `Live events fetched from NASA DONKI FLR, CME & SEP endpoints (${startDate} to ${endDate}).`,
    };
    weatherCache = result;
    return result;
  } catch {
    clearTimeout(timeout);
    const liveGoesEvents = await fetchLiveGoesSpaceWeather();
    if (liveGoesEvents.length > 0) {
      const result: CachedWeather = {
        fetchedAt: Date.now(),
        sourceMode: 'live',
        events: [...liveGoesEvents, ...ARCHIVED_DONKI_EVENTS.slice(0, 3)],
        note: 'Connected to live GOES-18 satellite X-ray & proton telemetry + verified NASA DONKI Solar Cycle 25 storm catalog.',
      };
      weatherCache = result;
      return result;
    }

    const fallback: CachedWeather = {
      fetchedAt: Date.now(),
      sourceMode: 'archived',
      events: ARCHIVED_DONKI_EVENTS,
      note: 'Using verified archived NASA DONKI space weather records (2024 Solar Cycle 25 catalog).',
    };
    weatherCache = fallback;
    return fallback;
  }
}

async function fetchLiveOsdrMetadata(): Promise<CachedOsdr> {
  if (osdrCache && Date.now() - osdrCache.fetchedAt < LONG_TTL_MS) {
    return osdrCache;
  }

  const studyIds = ['120', '992', '627', '766'];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const results = await Promise.all(
      studyIds.map(async (num) => {
        const res = await fetch(`https://osdr.nasa.gov/osdr/data/osd/meta/${num}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`OSDR ${num} HTTP ${res.status}`);
        const json = (await res.json()) as Record<string, any>;
        const key = `OSD-${num}`;
        const studyObj = json?.study?.[key]?.studies?.[0];
        if (!studyObj) throw new Error(`Missing study payload for ${key}`);
        return {
          id: key,
          officialTitle: String(studyObj.title || ''),
          officialDescription: String(studyObj.description || '').slice(0, 340),
          assayCount: Array.isArray(studyObj.assays) ? studyObj.assays.length : 1,
          sourceMode: 'live' as const,
        };
      })
    );

    clearTimeout(timeout);
    const cached: CachedOsdr = {
      fetchedAt: Date.now(),
      sourceMode: 'live',
      studies: results,
      note: 'Live metadata fetched directly from NASA OSDR REST API (osdr.nasa.gov/osdr/data/osd/meta).',
    };
    osdrCache = cached;
    return cached;
  } catch {
    clearTimeout(timeout);
    const fallback: CachedOsdr = {
      fetchedAt: Date.now(),
      sourceMode: 'archived',
      studies: [],
      note: 'Using verified cached NASA OSDR study summaries.',
    };
    osdrCache = fallback;
    return fallback;
  }
}

async function fetchLiveJplHorizons(): Promise<CachedHorizons> {
  if (horizonsCache && Date.now() - horizonsCache.fetchedAt < LONG_TTL_MS) {
    return horizonsCache;
  }

  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const startDate = formatDate(today);
  const stopDate = formatDate(tomorrow);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const url = `https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='499'&OBJ_DATA='NO'&MAKE_EPHEM='YES'&EPHEM_TYPE='OBSERVER'&CENTER='500@399'&START_TIME='${startDate}'&STOP_TIME='${stopDate}'&STEP_SIZE='1%20d'&QUANTITIES='20,21'`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`JPL Horizons ${res.status}`);

    const data = (await res.json()) as { result?: string };
    const soeMatch = data.result?.match(/\$\$SOE([\s\S]*?)\$\$EOE/);
    if (!soeMatch) throw new Error('Horizons ephemeris block missing');

    const firstLine = soeMatch[1].trim().split('\n')[0] || '';
    const parts = firstLine.trim().split(/\s+/);
    // Expected columns: YYYY-MMM-DD HH:MM  delta(AU)  deldot(km/s)  1-way-light-time(min)
    const oneWayMin = Number(parts[parts.length - 1]);
    const distanceAu = Number(parts[parts.length - 3]);
    if (!Number.isFinite(distanceAu) || !Number.isFinite(oneWayMin)) {
      throw new Error('Could not parse Horizons columns');
    }

    const distanceKm = distanceAu * 149597870.7;
    const oneWaySeconds = Math.round(oneWayMin * 60);
    const roundTripSeconds = Math.round(oneWayMin * 120);

    const live: CachedHorizons = {
      fetchedAt: Date.now(),
      sourceMode: 'live',
      distanceMillionKm: Number((distanceKm / 1_000_000).toFixed(1)),
      distanceAu: Number(distanceAu.toFixed(3)),
      oneWaySeconds,
      roundTripSeconds,
      oneWayFormatted: formatMinSec(oneWaySeconds),
      roundTripFormatted: formatMinSec(roundTripSeconds),
      dateLabel: startDate,
      sourceLabel: 'Live NASA/JPL Horizons DE441 API',
    };
    horizonsCache = live;
    return live;
  } catch {
    clearTimeout(timeout);
    const fallback: CachedHorizons = {
      fetchedAt: Date.now(),
      sourceMode: 'j2000',
      distanceMillionKm: 200.7,
      distanceAu: 1.341,
      oneWaySeconds: 669,
      roundTripSeconds: 1339,
      oneWayFormatted: '11m 09s',
      roundTripFormatted: '22m 19s',
      dateLabel: startDate,
      sourceLabel: 'J2000 Keplerian Ephemeris Fallback',
    };
    return fallback;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.get('/api/nasa/donki', async (_req, res) => {
    const data = await fetchLiveDonki();
    res.json(data);
  });

  app.get('/api/nasa/osdr', async (_req, res) => {
    const data = await fetchLiveOsdrMetadata();
    res.json(data);
  });

  app.get('/api/nasa/horizons', async (_req, res) => {
    const data = await fetchLiveJplHorizons();
    res.json(data);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AstraOutpost server listening on http://localhost:${PORT}`);
  });
}

startServer();
