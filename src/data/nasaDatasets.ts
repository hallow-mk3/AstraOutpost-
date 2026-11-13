import { OUTPOST_MEDIA } from '../assets/media';

export type OutpostSiteId = 'moon' | 'mars';

export interface NasaDonkiEvent {
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

export interface DonkiFeedResponse {
  fetchedAt: number;
  sourceMode: 'live' | 'archived';
  events: NasaDonkiEvent[];
  note: string;
}

export interface OutpostSiteProfile {
  id: OutpostSiteId;
  name: string;
  locationLabel: string;
  program: string;
  imagePath: string;
  imageAlt: string;
  summary: string;
  dayLength: string;
  temperatureRange: string;
  atmosphere: string;
  gravity: string;
  baselineRadiationMsvPerDay: number;
  roundTripCommsSec: number;
  commsDisplay: string;
  commsScienceFact: string;
  solarProfile: string;
  waterSource: string;
  biggestHazard: string;
  dataAttribution: string;
}

export interface OsdrStudy {
  id: string;
  title: string;
  organismOrFocus: string;
  finding: string;
  kidTakeaway: string;
  gameRuleLink: string;
  sourceUrl: string;
  assayCount?: number;
  liveVerified?: boolean;
}

export interface LiveOsdrResponse {
  fetchedAt: number;
  sourceMode: 'live' | 'archived';
  studies: Array<{
    id: string;
    officialTitle: string;
    officialDescription: string;
    assayCount: number;
    sourceMode: 'live' | 'archived';
  }>;
  note: string;
}

export interface GlossaryTerm {
  term: string;
  plainDefinition: string;
  whyItMatters: string;
  realNasaExample: string;
}

export const OUTPOST_SITES: Record<OutpostSiteId, OutpostSiteProfile> = {
  moon: {
    id: 'moon',
    name: 'Shackleton Rim Outpost',
    locationLabel: 'Lunar South Pole · Moon',
    program: 'NASA Artemis Surface Mission Profile',
    imagePath: OUTPOST_MEDIA.moonOutpostImg,
    imageAlt:
      'Illustrated NASA Artemis lunar outpost on the sunlit rim of Shackleton Crater with vertical solar arrays and Earth in the sky',
    summary:
      'Perched on the bright crater rim where sunlight skims sideways for weeks, right next to permanently shadowed craters holding ancient water ice.',
    dayLength: '29.5 Earth days (14 days sun, 14 days night)',
    temperatureRange: '-130°C to -50°C at rim (-230°C in crater)',
    atmosphere: 'Virtually none (exosphere vacuum)',
    gravity: '1.62 m/s² (1/6th of Earth)',
    baselineRadiationMsvPerDay: 1.37,
    roundTripCommsSec: 2.6,
    commsDisplay: '2.6 seconds round-trip',
    commsScienceFact:
      'At 384,400 km away, radio waves traveling at the speed of light take 1.3 seconds each way—so Earth Mission Control can talk with you almost live.',
    solarProfile: 'High-angle vertical towers catch low horizon sun (up to 86% sunlight at rim peaks)',
    waterSource: 'Water ice trapped inside permanently dark crater floors',
    biggestHazard: 'Zero atmosphere to block solar flares or micrometeoroids, plus razor-sharp lunar dust',
    dataAttribution: 'NASA Artemis III Science Definition Team & Lunar Reconnaissance Orbiter (LRO) Diviner data',
  },
  mars: {
    id: 'mars',
    name: 'Jezero Crater Outpost',
    locationLabel: 'Jezero Crater · Mars',
    program: 'Mars Surface Mission Profile',
    imagePath: OUTPOST_MEDIA.marsOutpostImg,
    imageAlt:
      'Illustrated Martian outpost in Jezero Crater featuring a glowing hydroponic greenhouse dome, solar panels, radio dish, and rover',
    summary:
      'Built inside an ancient river delta on Mars. Thin carbon-dioxide air helps slow dust, but regional dust storms can dim sunlight for days.',
    dayLength: '24 hr 39 min (1 Martian Sol)',
    temperatureRange: '-85°C night to -15°C afternoon',
    atmosphere: 'Thin CO₂ (about 1% of Earth air pressure)',
    gravity: '3.72 m/s² (3/8ths of Earth)',
    baselineRadiationMsvPerDay: 0.67,
    roundTripCommsSec: 750,
    commsDisplay: '12 to 24 minutes round-trip',
    commsScienceFact:
      'At ~225 million km away, light takes 12.5 minutes just to reach Earth. If a storm hits, you cannot wait 25 minutes for Earth to tell you what to do!',
    solarProfile: '43% as bright as Earth orbit; Martian dust storms (high tau opacity) cut solar power sharply',
    waterSource: 'Subsurface ice and water-bearing clay minerals in Jezero soil',
    biggestHazard: 'Global/regional dust storms starving solar panels and long communication delays during emergencies',
    dataAttribution: 'NASA Mars Perseverance Rover (MEDA weather station) & Curiosity Rover (RAD radiation detector)',
  },
};

export const OSDR_STUDIES: OsdrStudy[] = [
  {
    id: 'OSD-120',
    title: 'Genetic Dissection of the Arabidopsis Spaceflight Transcriptome',
    organismOrFocus: 'Arabidopsis thaliana (mustard family plants · ISS)',
    finding:
      'ISS experiments show spaceflight plants reprogram root and leaf genes to adapt to microgravity and habitat lighting.',
    kidTakeaway:
      'Space crops are living life-support machines: give your greenhouse power and water, and plants make fresh food AND extra oxygen!',
    gameRuleLink: 'Powering the Greenhouse adds both Science/Food Progress and bonus Oxygen each Sol.',
    sourceUrl: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-120',
  },
  {
    id: 'OSD-992',
    title: 'Space Radiation Induces Distinct Senescent Phenotypes',
    organismOrFocus: 'Homo sapiens cells & space radiation biology',
    finding:
      'Single-cell RNA research demonstrates that space radiation triggers distinct cellular aging and stress responses beyond Earth’s magnetic field.',
    kidTakeaway:
      'Thick water walls and shelter protocols block harmful space radiation, but pumping and heating that shield costs electrical power.',
    gameRuleLink: 'Allocating Power to Radiation Shielding reduces incoming mSv dose from solar events.',
    sourceUrl: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-992',
  },
  {
    id: 'OSD-627',
    title: 'Biofilm Formation & Growth on Habitat Materials in Microgravity',
    organismOrFocus: 'Pseudomonas aeruginosa · Habitat water & surface biofilms',
    finding:
      'Microorganisms form resilient biofilms on spacecraft materials in microgravity, requiring continuous filtration and loop maintenance.',
    kidTakeaway:
      'Astronauts recycle almost every drop of water, but recyclers need steady electricity so filters stay clean and biofilm-free.',
    gameRuleLink: 'Skipping Life Support power saves electricity today but drops Air & Water reserves rapidly tomorrow.',
    sourceUrl: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-627',
  },
  {
    id: 'OSD-766',
    title: 'Tomato Crop Growth & Lighting Regimes in ISS Veggie (VEG-05)',
    organismOrFocus: 'Solanum lycopersicum (ISS Veggie 101-day crop study)',
    finding:
      'The 101-day ISS VEG-05 study measured how different LED lighting regimes shape tomato yield and healthy plant microbiomes.',
    kidTakeaway:
      'If you starve the greenhouse of LED power during an emergency, your crops pause growing—meaning less food and oxygen later.',
    gameRuleLink: 'Letting Air & Water fall too low reduces greenhouse crop output and Science/Food score.',
    sourceUrl: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-766',
  },
];

export const FALLBACK_DONKI_EVENTS: NasaDonkiEvent[] = [
  {
    id: '2024-05-14T16:51:00-FLR-001',
    type: 'FLR',
    classOrSpeed: 'X8.7 Solar Flare',
    peakTime: '2024-05-14 16:51 UTC',
    severity: 'Extreme',
    radiationMsvPerDay: 9.4,
    summary: 'Active Region 3664 produced one of the strongest solar flares of Solar Cycle 25.',
    kidExplanation:
      'A giant burst of X-rays erupted from the Sun! Crews must boost shielding or shelter inside.',
    source: 'NASA DONKI FLR Archive (AR 3664)',
  },
  {
    id: '2024-03-23T01:33:00-CME-001',
    type: 'CME',
    classOrSpeed: '1,350 km/s CME',
    peakTime: '2024-03-23 01:33 UTC',
    severity: 'High',
    radiationMsvPerDay: 5.8,
    summary: 'Fast halo Coronal Mass Ejection observed by SOHO/LASCO moving outward at 1,350 km/s.',
    kidExplanation:
      'A super-fast cloud of solar particles racing through space toward the Moon and Mars.',
    source: 'NASA DONKI CME Archive (SOHO/LASCO)',
  },
  {
    id: '2024-07-29T02:37:00-SEP-001',
    type: 'SEP',
    classOrSpeed: 'Proton Storm (S2)',
    peakTime: '2024-07-29 02:37 UTC',
    severity: 'Moderate',
    radiationMsvPerDay: 3.6,
    summary: 'Solar Energetic Particle event detected by GOES particle sensors.',
    kidExplanation:
      'High-speed protons can pass through thin walls, so water-wall shielding helps protect the crew.',
    source: 'NASA DONKI SEP Archive (GOES)',
  },
  {
    id: '2024-08-19T14:10:00-FLR-001',
    type: 'FLR',
    classOrSpeed: 'M3.1 Solar Flare',
    peakTime: '2024-08-19 14:10 UTC',
    severity: 'Moderate',
    radiationMsvPerDay: 2.4,
    summary: 'Moderate M-class solar flare recorded in NASA DONKI catalog.',
    kidExplanation:
      'A medium solar flare—keep shield power ready and watch your radiation meter.',
    source: 'NASA DONKI FLR Archive',
  },
];

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    term: 'Sol',
    plainDefinition: 'One full day-and-night cycle on Mars (24 hours and 39 minutes).',
    whyItMatters:
      'Mission planners schedule solar power, plant lighting, and sleep around each Sol instead of Earth days.',
    realNasaExample: 'NASA Perseverance and Curiosity rovers count every mission day as Sol 1, Sol 2, Sol 3, and beyond.',
  },
  {
    term: 'Millisievert (mSv)',
    plainDefinition: 'A unit that measures how much space radiation a human body absorbs.',
    whyItMatters:
      'On Earth, our atmosphere and magnetic field shield us to about 3 mSv per whole year. In deep space, a single big solar flare can deliver more than that in one day!',
    realNasaExample: 'Curiosity RAD measured ~0.67 mSv/day on Mars; lunar crews can see ~1.37 mSv/day or much higher during solar storms.',
  },
  {
    term: 'Coronal Mass Ejection (CME)',
    plainDefinition: 'A giant cloud of charged solar gas launched out from the Sun at millions of kilometers per hour.',
    whyItMatters:
      'When a CME hits the Moon or Mars, radiation spikes and radio signals can get noisy—forcing astronauts to spend power on shielding.',
    realNasaExample: 'NASA tracks every CME in the DONKI database using the SOHO and STEREO space telescopes.',
  },
  {
    term: 'Closed-Loop Life Support',
    plainDefinition: 'Machines and plants that recycle the same air and water over and over again.',
    whyItMatters:
      'Launching water and oxygen rockets from Earth costs huge money and fuel, so an outpost must clean and reuse nearly every drop.',
    realNasaExample: 'The International Space Station recycles about 98% of its water (NASA ECLSS & OSDR research).',
  },
  {
    term: 'Speed-of-Light Radio Delay',
    plainDefinition: 'The waiting time for radio messages traveling across space at 300,000 km per second.',
    whyItMatters:
      'Light is fast, but Mars is so far away that a question to Earth and an answer back can take 25 minutes! Crews must make emergency decisions independently.',
    realNasaExample: 'Mars rover drivers send a whole Sol of instructions once per day because live joystick driving is impossible.',
  },
  {
    term: 'Dust Optical Depth (Tau)',
    plainDefinition: 'A number scientists use to measure how dusty and dim the Martian sky is.',
    whyItMatters:
      'Higher dust blocks sunlight from hitting solar panels, shrinking your daily power budget right when heaters need energy most.',
    realNasaExample: 'NASA Perseverance MEDA sensors measure sky dust daily; high tau events helped end the solar-powered Opportunity rover mission in 2018.',
  },
];

export interface TraceabilityRow {
  datasetName: string;
  officialIdOrEndpoint: string;
  realMeasurement: string;
  inGameRuleAndFormula: string;
  educationalTakeaway: string;
}

export const NASA_TRACEABILITY_MATRIX: TraceabilityRow[] = [
  {
    datasetName: 'NASA DONKI & GOES-18 Space Weather',
    officialIdOrEndpoint: '/DONKI/FLR, /CME, /SEP + GOES-18 Live',
    realMeasurement: 'Solar flare class (C/M/X), CME speed (km/s), & >=10 MeV proton flux',
    inGameRuleAndFormula: 'Incoming radiation spikes +2.4 to +10.2 mSv/day; Water-Wall shield blocks 22% per Power Unit (max 88%).',
    educationalTakeaway: 'Solar storms force crews to divert power from food/science into shielding right away.',
  },
  {
    datasetName: 'NASA OSDR Space Biology',
    officialIdOrEndpoint: 'OSD-120, OSD-766 (Live OSDR API)',
    realMeasurement: 'Arabidopsis spaceflight transcriptome & ISS VEG-05 tomato LED lighting yield',
    inGameRuleAndFormula: 'Each Greenhouse Power Unit adds +4.2% Science/Food and +2.5% bonus Air & Water when water reserves >= 25%.',
    educationalTakeaway: 'Crops are living life-support hardware—starving them of power hurts both food and oxygen later.',
  },
  {
    datasetName: 'NASA OSDR Radiation & Biofilm',
    officialIdOrEndpoint: 'OSD-992, OSD-627 (Live OSDR API)',
    realMeasurement: 'Space radiation cellular senescence & microgravity habitat biofilm growth',
    inGameRuleAndFormula: 'Life Support uses -14% baseline Air/Water per Sol and recovers +6.5% per Power Unit.',
    educationalTakeaway: 'Closed-loop recycling requires continuous electricity; skipping maintenance saves power today but drains tanks tomorrow.',
  },
  {
    datasetName: 'Artemis & Mars Surface Telemetry',
    officialIdOrEndpoint: 'LRO Diviner, Curiosity RAD, Perseverance MEDA',
    realMeasurement: 'Moon 1.37 mSv/day & 14-day shadows; Mars 0.67 mSv/day & dust tau opacity',
    inGameRuleAndFormula: 'Site-specific baseline mSv/day plus -3 Power Unit drops during Crater Shadows or Martian Dust Storms.',
    educationalTakeaway: 'Moon and Mars outposts require very different power and shielding strategies.',
  },
  {
    datasetName: 'NASA/JPL Horizons Ephemeris',
    officialIdOrEndpoint: 'ssd.jpl.nasa.gov/api/horizons.api (DE441)',
    realMeasurement: 'Live Earth–Mars distance in AU/km for today’s date ÷ speed of light',
    inGameRuleAndFormula: 'Computes live Earth–Mars round-trip radio lag (8–40 minutes) vs. 2.6 seconds on the Moon.',
    educationalTakeaway: 'Finite speed of light prevents real-time Earth troubleshooting during Martian emergencies.',
  },
];

export const CLASSROOM_PROMPTS = [
  {
    title: '1. No Choice Is Free',
    question:
      'When a solar flare hit your outpost, which system did you turn down to power the radiation shield—and what happened on the next Sol?',
    concept: 'Opportunity Cost & Coupled Engineering Systems',
  },
  {
    title: '2. Moon vs. Mars Radio Lag',
    question:
      'Why can Lunar astronauts ask Earth Mission Control for advice almost instantly (2.6 seconds), while Martian astronauts have to act on their own?',
    concept: 'Finite Speed of Light & Crew Autonomy',
  },
  {
    title: '3. Plants as Machines',
    question:
      'Based on NASA OSDR plant research, how does powering the Hydroponic Greenhouse help both your Food goal and your Air & Water meter?',
    concept: 'Closed-Loop Bioregenerative Life Support',
  },
  {
    title: '4. Real Data vs. Guessing',
    question:
      'How would a real NASA Mission Planner use DONKI solar flare alerts and Mars dust measurements before scheduling a spacewalk outside the habitat?',
    concept: 'Data-Driven Risk Management',
  },
];
