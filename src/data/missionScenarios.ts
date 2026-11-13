import { NasaDonkiEvent, OutpostSiteId, OUTPOST_SITES } from './nasaDatasets';

export type DifficultyMode = 'cadet' | 'director';

export interface PowerAllocation {
  lifeSupport: number; // 0..4
  shielding: number; // 0..4
  greenhouse: number; // 0..4
  scienceComms: number; // 0..4
}

export interface TradeOffOption {
  id: string;
  label: string;
  gainSummary: string;
  costSummary: string;
  scienceFact: string;
  effects: {
    airWaterDelta: number;
    powerBankDelta: number;
    radiationMsvDelta: number;
    scienceFoodDelta: number;
    nextSolPowerPenalty?: number;
    nextSolPowerBonus?: number;
  };
}

export interface SolScenario {
  sol: number;
  title: string;
  weatherCondition: 'Calm' | 'Solar Flare' | 'Dust Storm' | 'Crater Shadow' | 'Equipment Stress';
  powerBudgetToday: number;
  incomingRadiationMsv: number;
  solarModifierText: string;
  briefing: string;
  nasaDataLink: string;
  options: [TradeOffOption, TradeOffOption, TradeOffOption];
}

export interface SolLogEntry {
  sol: number;
  scenarioTitle: string;
  chosenOptionLabel: string;
  allocation: PowerAllocation;
  airWaterAfter: number;
  powerBankAfter: number;
  cumulativeMsvAfter: number;
  scienceFoodAfter: number;
  takeaway: string;
}

export interface MissionMetrics {
  airWater: number; // 0..100%
  powerBank: number; // 0..100%
  cumulativeMsv: number; // fail if >= 35 mSv
  scienceFood: number; // 0..100%
}

export const MAX_SOLS = 8;
export const MAX_SAFE_MSV = 35;

export function getBasePowerBudget(difficulty: DifficultyMode): number {
  return difficulty === 'cadet' ? 11 : 9;
}

export function calculateProjectedDeltas(
  site: OutpostSiteId,
  allocation: PowerAllocation,
  scenario: SolScenario,
  currentAirWater: number
): {
  airWaterDelta: number;
  powerBankDelta: number;
  radiationMsvAdded: number;
  radiationMsvBlocked: number;
  scienceFoodDelta: number;
  totalAllocated: number;
} {
  const totalAllocated =
    allocation.lifeSupport + allocation.shielding + allocation.greenhouse + allocation.scienceComms;

  const crewConsumption = -14;
  const recyclerOutput = allocation.lifeSupport * 6.5;
  const greenhouseOxygenBonus = currentAirWater >= 25 ? allocation.greenhouse * 2.5 : allocation.greenhouse * 1.0;
  const airWaterDelta = Math.round(crewConsumption + recyclerOutput + greenhouseOxygenBonus);

  const leftoverUnits = scenario.powerBudgetToday - totalAllocated;
  const weatherDrain =
    scenario.weatherCondition === 'Dust Storm' || scenario.weatherCondition === 'Crater Shadow' ? -8 : 0;
  const powerBankDelta = Math.round(leftoverUnits * 7 + weatherDrain);

  const blockFactor = Math.min(0.88, allocation.shielding * 0.22);
  const rawIncoming = scenario.incomingRadiationMsv;
  const radiationMsvAdded = Number((rawIncoming * (1 - blockFactor)).toFixed(1));
  const radiationMsvBlocked = Number((rawIncoming * blockFactor).toFixed(1));

  const waterMultiplier = currentAirWater >= 35 ? 1 : 0.5;
  const foodGain = allocation.greenhouse * 4.2 * waterMultiplier;
  const marsCommsPenalty = site === 'mars' && allocation.scienceComms === 1 ? 0.7 : 1;
  const scienceGain = allocation.scienceComms * 4.5 * marsCommsPenalty;
  const scienceFoodDelta = Math.round(foodGain + scienceGain);

  return {
    airWaterDelta,
    powerBankDelta,
    radiationMsvAdded,
    radiationMsvBlocked,
    scienceFoodDelta,
    totalAllocated,
  };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed + 17;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function buildMissionScenarios(
  site: OutpostSiteId,
  difficulty: DifficultyMode,
  donkiEvents: NasaDonkiEvent[],
  featuredStorm?: NasaDonkiEvent | null,
  missionSeed = 1
): SolScenario[] {
  const basePower = getBasePowerBudget(difficulty);
  const siteProfile = OUTPOST_SITES[site];
  const baseRad = siteProfile.baselineRadiationMsvPerDay;
  const isMoon = site === 'moon';

  const primaryStorm =
    featuredStorm ||
    donkiEvents.find((e) => e.severity === 'Extreme' || e.severity === 'High') ||
    donkiEvents[0];

  const secondaryStorm =
    donkiEvents.find((e) => e.id !== primaryStorm?.id && (e.severity === 'Moderate' || e.severity === 'High')) ||
    donkiEvents[1] ||
    primaryStorm;

  // Sol 1: Fixed Onboarding Scenario
  const sol1: SolScenario = {
    sol: 1,
    title: isMoon ? 'Landing Check & Regolith Dust Sweep' : 'Touchdown Calibration & Greenhouse Seeding',
    weatherCondition: 'Calm',
    powerBudgetToday: basePower,
    incomingRadiationMsv: Number((baseRad + 0.4).toFixed(1)),
    solarModifierText: isMoon
      ? 'Clear low-angle South Pole sunlight (100% solar tower output)'
      : 'Clear Jezero morning sky (Tau dust 0.42 · Normal solar output)',
    briefing: isMoon
      ? 'Welcome to Shackleton Rim! Sticky grey lunar dust coated your radiator fins during landing. Decide how to kick off Sol 1 without draining reserves.'
      : 'Welcome to Jezero Crater! Your hydroponic trays are ready to plant, and Earth is millions of km away. Balance your first Sol carefully.',
    nasaDataLink: isMoon
      ? 'Artemis Surface Ops · Lunar Dust Mitigation Study'
      : 'NASA OSDR OSD-120 (Spaceflight Plant Germination)',
    options: [
      {
        id: 's1-a',
        label: 'Run full dust-cleaning fans & pressurize airlocks',
        gainSummary: '+10% Air & Water',
        costSummary: '-10% Power Bank',
        scienceFact: 'Clean radiators keep life-support pumps from overheating, at an immediate battery cost.',
        effects: { airWaterDelta: 10, powerBankDelta: -10, radiationMsvDelta: 0, scienceFoodDelta: 2 },
      },
      {
        id: 's1-b',
        label: 'Plant double lettuce & dwarf-wheat trays immediately',
        gainSummary: '+12% Science & Food',
        costSummary: '-8% Air & Water',
        scienceFact: 'NASA OSDR OSD-120 shows young crops need steady water intake before they produce oxygen.',
        effects: { airWaterDelta: -8, powerBankDelta: -4, radiationMsvDelta: 0, scienceFoodDelta: 12 },
      },
      {
        id: 's1-c',
        label: 'Charge backup batteries & delay science sweep',
        gainSummary: '+12% Power Bank',
        costSummary: '+0.8 mSv exposure, 0 Science',
        scienceFact: 'Saving battery early gives a buffer for storms, while crew logs normal surface radiation.',
        effects: { airWaterDelta: -2, powerBankDelta: 12, radiationMsvDelta: 0.8, scienceFoodDelta: 0 },
      },
    ],
  };

  // Rich rotating middle pool (9 scenarios -> pick 6 each playthrough based on missionSeed!)
  const middlePool: Omit<SolScenario, 'sol'>[] = [
    {
      title: secondaryStorm
        ? `Space Weather Alert: ${secondaryStorm.classOrSpeed}`
        : 'Solar Energetic Particle Stream',
      weatherCondition: 'Solar Flare',
      powerBudgetToday: basePower - 1,
      incomingRadiationMsv: Number((baseRad + (secondaryStorm?.radiationMsvPerDay ?? 3.2)).toFixed(1)),
      solarModifierText: 'Solar alert active (-1 Power Unit diverted to magnetic warning sensors)',
      briefing: secondaryStorm
        ? `NASA DONKI logged "${secondaryStorm.classOrSpeed}" (${secondaryStorm.peakTime}). Energetic particles are reaching your outpost!`
        : 'A stream of solar protons is crossing your outpost sky. You need extra protection without starving life support.',
      nasaDataLink: secondaryStorm?.source || 'NASA DONKI Space Weather Database',
      options: [
        {
          id: 'mid-flare1-a',
          label: 'Pump drinking water into outer habitat radiation wall',
          gainSummary: '-2.2 mSv Radiation blocked',
          costSummary: '-10% Air & Water temporarily locked in walls',
          scienceFact: 'Water is rich in hydrogen atoms, making it one of NASA’s best shields against solar protons (OSDR OSD-352).',
          effects: { airWaterDelta: -10, powerBankDelta: -4, radiationMsvDelta: -2.2, scienceFoodDelta: 3 },
        },
        {
          id: 'mid-flare1-b',
          label: 'Overdrive magnetic shield coils using battery reserve',
          gainSummary: '-2.6 mSv Radiation blocked, +4% Science',
          costSummary: '-16% Power Bank',
          scienceFact: 'Active shielding saves your water supply, but drains stored battery power fast.',
          effects: { airWaterDelta: 0, powerBankDelta: -16, radiationMsvDelta: -2.6, scienceFoodDelta: 4 },
        },
        {
          id: 'mid-flare1-c',
          label: 'Keep crew working near thin greenhouse dome to harvest data',
          gainSummary: '+11% Science & Food, +6% Power saved',
          costSummary: '+2.4 mSv Radiation dose to crew',
          scienceFact: 'Transparent greenhouse domes let sunlight in—but offer almost zero radiation protection.',
          effects: { airWaterDelta: 2, powerBankDelta: 6, radiationMsvDelta: 2.4, scienceFoodDelta: 11 },
        },
      ],
    },
    {
      title: isMoon ? 'Long Crater Rim Shadow Crossing' : 'Regional Martian Dust Storm (Tau 1.8)',
      weatherCondition: isMoon ? 'Crater Shadow' : 'Dust Storm',
      powerBudgetToday: Math.max(5, basePower - 3),
      incomingRadiationMsv: Number((baseRad + 0.6).toFixed(1)),
      solarModifierText: isMoon
        ? 'Neighboring ridge casts shadow (-3 Power Units today!)'
        : 'Red dust dims Jezero sunlight (-3 Power Units today!)',
      briefing: isMoon
        ? 'A tall crater ridge blocks the Sun for most of this cycle. Your solar towers drop sharply while habitat heaters work overtime.'
        : 'Perseverance MEDA sensors warn of thick red dust overhead. Sunlight is cut by 35%—and Earth is too far away for real-time troubleshooting.',
      nasaDataLink: isMoon
        ? 'Lunar Reconnaissance Orbiter (LRO) Illumination Maps'
        : 'Mars Perseverance MEDA Dust Opacity Data',
      options: [
        {
          id: 'mid-dust-a',
          label: isMoon ? 'Put Greenhouse in low-light sleep mode' : 'Turn off Greenhouse grow-lights until dust clears',
          gainSummary: '+14% Power Bank saved',
          costSummary: '-6% Air & Water, -4% Science & Food',
          scienceFact: 'Turning off grow lights saves huge electricity, but plants stop producing fresh oxygen (OSDR OSD-466).',
          effects: { airWaterDelta: -6, powerBankDelta: 14, radiationMsvDelta: 0, scienceFoodDelta: -4 },
        },
        {
          id: 'mid-dust-b',
          label: isMoon ? 'Deploy portable battery sled across crater rim' : 'Drive rover outside to brush dust off solar panels',
          gainSummary: '+2 Power Units tomorrow, +8% Power Bank',
          costSummary: '+1.9 mSv Radiation & -5% Air from airlock cycling',
          scienceFact: 'Going outside clears panels for tomorrow, yet opening airlocks wastes air and exposes equipment crews.',
          effects: {
            airWaterDelta: -5,
            powerBankDelta: 8,
            radiationMsvDelta: 1.9,
            scienceFoodDelta: 4,
            nextSolPowerBonus: 2,
          },
        },
        {
          id: 'mid-dust-c',
          label: 'Lower habitat temperature 4°C & wear thermal suits indoors',
          gainSummary: '+10% Power Bank, +4% Air & Water kept',
          costSummary: '-5% Science efficiency (cold fingers slow lab work)',
          scienceFact: 'Thermal management is one of the largest energy costs on both the Moon and Mars.',
          effects: { airWaterDelta: 4, powerBankDelta: 10, radiationMsvDelta: 0, scienceFoodDelta: -5 },
        },
      ],
    },
    {
      title: 'Water Loop Biofilm Warning',
      weatherCondition: 'Equipment Stress',
      powerBudgetToday: basePower,
      incomingRadiationMsv: Number((baseRad + 0.5).toFixed(1)),
      solarModifierText: 'Nominal sunlight available',
      briefing:
        'Your water recycling pipes show early biofilm buildup—just like real astronauts monitor on the Space Station! Choose how to clean the loop.',
      nasaDataLink: 'NASA OSDR OSD-511 (Closed-Loop Water & Microbial Filtration)',
      options: [
        {
          id: 'mid-bio-a',
          label: 'Run high-heat UV sterilizer cycle across all tanks',
          gainSummary: '+14% Air & Water purity',
          costSummary: '-15% Power Bank',
          scienceFact: 'Heating and UV-cleaning water keeps astronauts healthy (OSDR OSD-511), at a steep energy cost.',
          effects: { airWaterDelta: 14, powerBankDelta: -15, radiationMsvDelta: 0, scienceFoodDelta: 3 },
        },
        {
          id: 'mid-bio-b',
          label: 'Swap spare filter cartridge & study biofilm sample in lab',
          gainSummary: '+10% Science & Food, +5% Air & Water',
          costSummary: '-6% Power Bank & -1 Power Unit tomorrow for repairs',
          scienceFact: 'Studying microbes teaches NASA how life adapts in space, though swapping hardware takes crew hours.',
          effects: {
            airWaterDelta: 5,
            powerBankDelta: -6,
            radiationMsvDelta: 0.4,
            scienceFoodDelta: 10,
            nextSolPowerPenalty: 1,
          },
        },
        {
          id: 'mid-bio-c',
          label: 'Ration drinking water for 1 Sol while filters coast',
          gainSummary: '+10% Power Bank saved',
          costSummary: '-12% Air & Water reserve',
          scienceFact: 'Rationing saves electricity today, but leaves less water for oxygen generation and crops tomorrow.',
          effects: { airWaterDelta: -12, powerBankDelta: 10, radiationMsvDelta: 0, scienceFoodDelta: 1 },
        },
      ],
    },
    {
      title: primaryStorm
        ? `Major Solar Storm: ${primaryStorm.classOrSpeed}`
        : 'Major X-Class Coronal Mass Ejection',
      weatherCondition: 'Solar Flare',
      powerBudgetToday: Math.max(5, basePower - 2),
      incomingRadiationMsv: Number((baseRad + (primaryStorm?.radiationMsvPerDay ?? 7.2)).toFixed(1)),
      solarModifierText: 'Major solar particle storm! Radio interference & -2 Power Units',
      briefing: primaryStorm
        ? `Emergency! NASA DONKI recorded "${primaryStorm.classOrSpeed}". High-energy particles are slamming into the ${isMoon ? 'lunar surface' : 'thin Martian atmosphere'}.`
        : 'A massive solar eruption is sweeping past your outpost! Every shielding decision matters today.',
      nasaDataLink: primaryStorm?.source || 'NASA DONKI Extreme Event Archive',
      options: [
        {
          id: 'mid-xflare-a',
          label: 'Full Storm Shelter: Seal inner core & max water shielding',
          gainSummary: '-5.2 mSv Radiation blocked',
          costSummary: '-14% Power Bank & -8% Air & Water (crowded air scrubbers)',
          scienceFact: 'Real Artemis crews stack water & food packs around a small central shelter during X-class flares.',
          effects: { airWaterDelta: -8, powerBankDelta: -14, radiationMsvDelta: -5.2, scienceFoodDelta: 0 },
        },
        {
          id: 'mid-xflare-b',
          label: 'Keep Greenhouse pumps running inside storm',
          gainSummary: '+9% Science & Food, +4% Air & Water from plants',
          costSummary: '+3.8 mSv extra Radiation dose, -10% Power Bank',
          scienceFact: 'Protecting crops preserves long-term food, but exposed crew members absorb higher radiation.',
          effects: { airWaterDelta: 4, powerBankDelta: -10, radiationMsvDelta: 3.8, scienceFoodDelta: 9 },
        },
        {
          id: 'mid-xflare-c',
          label: 'Broadcast live storm telemetry to Earth during peak flare',
          gainSummary: '+14% Science & Food discovery bonus',
          costSummary: '-16% Power Bank & +2.5 mSv exposure',
          scienceFact: 'High-gain deep-space radio bursts take massive power—especially across millions of km from Mars!',
          effects: { airWaterDelta: -3, powerBankDelta: -16, radiationMsvDelta: 2.5, scienceFoodDelta: 14 },
        },
      ],
    },
    {
      title: isMoon ? 'Ice Core Drilling in Dark Crater' : 'Ancient Riverbed Sample Run',
      weatherCondition: 'Calm',
      powerBudgetToday: basePower,
      incomingRadiationMsv: Number((baseRad + 0.5).toFixed(1)),
      solarModifierText: 'Skies clear · Full solar generation restored',
      briefing: isMoon
        ? 'Your radar spotted pure water ice just inside the shadowed crater rim! Extracting it could refill your tanks—or drain your batteries.'
        : 'Your rover spotted clay minerals that formed in ancient Martian water 3.5 billion years ago. How should the crew spend this Sol?',
      nasaDataLink: isMoon
        ? 'NASA VIPER & Artemis Ice Prospecting Concept'
        : 'Mars 2020 Perseverance Jezero Delta Science',
      options: [
        {
          id: 'mid-isru-a',
          label: isMoon ? 'Melt crater ice into habitat water tanks' : 'Bake clay soil to extract trapped Martian water',
          gainSummary: '+16% Air & Water',
          costSummary: '-14% Power Bank',
          scienceFact: 'In-Situ Resource Utilization (ISRU) means making water on-site instead of hauling it from Earth, but melting rock/ice is energy-hungry!',
          effects: { airWaterDelta: 16, powerBankDelta: -14, radiationMsvDelta: 0.7, scienceFoodDelta: 4 },
        },
        {
          id: 'mid-isru-b',
          label: 'Focus on Greenhouse pollination & crop harvest',
          gainSummary: '+12% Science & Food, +6% Air & Water',
          costSummary: '-6% Power Bank',
          scienceFact: 'Mature space crops return oxygen and calories simultaneously (NASA OSDR OSD-466).',
          effects: { airWaterDelta: 6, powerBankDelta: -6, radiationMsvDelta: 0, scienceFoodDelta: 12 },
        },
        {
          id: 'mid-isru-c',
          label: 'Inspect & recharge battery bank for upcoming hazards',
          gainSummary: '+16% Power Bank',
          costSummary: '-4% Air & Water, +0.4 mSv background',
          scienceFact: 'Checking battery cells prevents sudden voltage drops during dust storms or shadows.',
          effects: { airWaterDelta: -4, powerBankDelta: 16, radiationMsvDelta: 0.4, scienceFoodDelta: 2 },
        },
      ],
    },
    {
      title: isMoon ? 'Deep-Space Relay & Micrometeoroid Check' : 'Communication Blackout Test & Dust Gust',
      weatherCondition: isMoon ? 'Equipment Stress' : 'Dust Storm',
      powerBudgetToday: Math.max(6, basePower - 2),
      incomingRadiationMsv: Number((baseRad + 1.4).toFixed(1)),
      solarModifierText: isMoon
        ? 'Solar angle dipping low (-2 Power Units)'
        : 'Afternoon dust devil gust (-2 Power Units)',
      briefing: isMoon
        ? 'Small dust impacts nicked an outer power cable. Your crew can patch it now or push straight ahead on science.'
        : 'With a long speed-of-light communication lag to Earth, your radio dish slipped slightly off-target in a dust gust.',
      nasaDataLink: isMoon ? 'NASA Artemis Power Grid Engineering' : 'Deep Space Network (DSN) Mars Relay',
      options: [
        {
          id: 'mid-dish-a',
          label: 'Re-align radio dish & transmit full science archive',
          gainSummary: '+15% Science & Food',
          costSummary: '-12% Power Bank & +1.1 mSv exposure',
          scienceFact: 'High-rate Deep Space Network transmissions demand strong amplifier power.',
          effects: { airWaterDelta: -2, powerBankDelta: -12, radiationMsvDelta: 1.1, scienceFoodDelta: 15 },
        },
        {
          id: 'mid-dish-b',
          label: 'Seal minor airlock leaks & reinforce water wall',
          gainSummary: '+10% Air & Water, -1.4 mSv Radiation',
          costSummary: '-8% Power Bank & 0 Science today',
          scienceFact: 'Preventing slow air leaks saves huge amounts of oxygen over multi-week missions.',
          effects: { airWaterDelta: 10, powerBankDelta: -8, radiationMsvDelta: -1.4, scienceFoodDelta: 0 },
        },
        {
          id: 'mid-dish-c',
          label: 'Run autonomous diagnostics to save energy',
          gainSummary: '+11% Power Bank, +5% Science & Food',
          costSummary: '-7% Air & Water (delayed maintenance)',
          scienceFact: 'Autonomous rule scripts onboard spacecraft handle routine checks when Earth is many light-minutes away.',
          effects: { airWaterDelta: -7, powerBankDelta: 11, radiationMsvDelta: 0.5, scienceFoodDelta: 5 },
        },
      ],
    },
    {
      title: 'Greenhouse LED Spectrum & Crew Circadian Test',
      weatherCondition: 'Calm',
      powerBudgetToday: basePower,
      incomingRadiationMsv: Number((baseRad + 0.4).toFixed(1)),
      solarModifierText: 'Nominal solar arrays · Biology experiment ready',
      briefing:
        'Without Earth sunrises, astronauts and plants both rely on calibrated LEDs. Adjusting blue-white LEDs boosts crop vitamins—but uses extra power.',
      nasaDataLink: 'NASA OSDR OSD-120 & ISS Circadian Lighting Studies',
      options: [
        {
          id: 'mid-led-a',
          label: 'Run full-spectrum blue+red grow LEDs for peak harvest',
          gainSummary: '+14% Science & Food, +5% Air & Water',
          costSummary: '-13% Power Bank',
          scienceFact: 'Red and blue LEDs maximize photosynthesis (OSD-120) while refreshing cabin air.',
          effects: { airWaterDelta: 5, powerBankDelta: -13, radiationMsvDelta: 0, scienceFoodDelta: 14 },
        },
        {
          id: 'mid-led-b',
          label: 'Switch habitat to dim night-rest mode to preserve power',
          gainSummary: '+14% Power Bank',
          costSummary: '-5% Science & Food, -3% Air & Water',
          scienceFact: 'Dimming lights lets crew rest and batteries recharge, temporarily slowing crop growth.',
          effects: { airWaterDelta: -3, powerBankDelta: 14, radiationMsvDelta: 0, scienceFoodDelta: -5 },
        },
        {
          id: 'mid-led-c',
          label: 'Divert greenhouse cooling loop to boost CO₂ scrubbing',
          gainSummary: '+12% Air & Water',
          costSummary: '-6% Power Bank, 0 Science',
          scienceFact: 'CO₂ scrubbers and plant trays share thermal loops inside compact space habitats.',
          effects: { airWaterDelta: 12, powerBankDelta: -6, radiationMsvDelta: 0, scienceFoodDelta: 0 },
        },
      ],
    },
    {
      title: 'CO₂ Scrubber Overheat & Valve Bypass',
      weatherCondition: 'Equipment Stress',
      powerBudgetToday: Math.max(5, basePower - 1),
      incomingRadiationMsv: Number((baseRad + 0.8).toFixed(1)),
      solarModifierText: 'Coolant pump drawing 1 extra Power Unit',
      briefing:
        'Carbon dioxide levels ticked up in the sleep module after a scrubber valve stuck halfway. How should your crew fix it?',
      nasaDataLink: 'NASA ECLSS Cabin Air Monitoring Standards',
      options: [
        {
          id: 'mid-co2-a',
          label: 'Engage backup lithium-hydroxide canisters & flush air',
          gainSummary: '+13% Air & Water quality',
          costSummary: '-11% Power Bank & -1 Power Unit tomorrow',
          scienceFact: 'Backup chemical scrubbers clean air fast, just like Apollo 13 crews famously adapted!',
          effects: {
            airWaterDelta: 13,
            powerBankDelta: -11,
            radiationMsvDelta: 0,
            scienceFoodDelta: 2,
            nextSolPowerPenalty: 1,
          },
        },
        {
          id: 'mid-co2-b',
          label: 'Route cabin air directly through Greenhouse plant dome',
          gainSummary: '+8% Air & Water, +9% Science & Food',
          costSummary: '-9% Power Bank',
          scienceFact: 'Plants naturally consume CO₂—turning a repair into a live bioregenerative experiment (OSD-466).',
          effects: { airWaterDelta: 8, powerBankDelta: -9, radiationMsvDelta: 0.3, scienceFoodDelta: 9 },
        },
        {
          id: 'mid-co2-c',
          label: 'Reduce crew physical workouts today to cut CO₂ output',
          gainSummary: '+9% Power Bank saved',
          costSummary: '-6% Air & Water, -4% Science & Food',
          scienceFact: 'Resting crews exhale less CO₂, buying engineers time while delaying lab tasks.',
          effects: { airWaterDelta: -6, powerBankDelta: 9, radiationMsvDelta: 0, scienceFoodDelta: -4 },
        },
      ],
    },
  ];

  const shuffledMiddle = seededShuffle(middlePool, missionSeed).slice(0, 6);

  // Sol 8: Handover Finale
  const sol8: SolScenario = {
    sol: 8,
    title: 'Final Sol: Crew Relief & Science Handover',
    weatherCondition: 'Calm',
    powerBudgetToday: basePower,
    incomingRadiationMsv: Number((baseRad + 0.3).toFixed(1)),
    solarModifierText: 'Nominal solar window for mission handover',
    briefing:
      'Final Sol of your 8-Sol command! Prepare the outpost systems for the next astronaut team while locking in your remaining Science & Food goals.',
    nasaDataLink: 'NASA Artemis / Mars Campaign Handover Protocol',
    options: [
      {
        id: 's8-a',
        label: 'Full Science & Harvest Upload before handover',
        gainSummary: '+16% Science & Food',
        costSummary: '-12% Power Bank & -6% Air & Water',
        scienceFact: 'Transmitting raw lab samples and storing harvested crops completes mission objectives—at a final resource cost.',
        effects: { airWaterDelta: -6, powerBankDelta: -12, radiationMsvDelta: 0.5, scienceFoodDelta: 16 },
      },
      {
        id: 's8-b',
        label: 'Leave habitat topped off with full Air, Water & Power',
        gainSummary: '+12% Air & Water, +10% Power Bank',
        costSummary: '+2% Science only',
        scienceFact: 'Real NASA crews always leave safe life-support margins for the incoming crew.',
        effects: { airWaterDelta: 12, powerBankDelta: 10, radiationMsvDelta: 0, scienceFoodDelta: 2 },
      },
      {
        id: 's8-c',
        label: 'Shield & archive radiation dosimeter logs carefully',
        gainSummary: '-2.0 mSv protected, +9% Science & Food',
        costSummary: '-9% Power Bank',
        scienceFact: 'Dosimetry logs from every crew member help NASA plan safer future missions (OSDR OSD-352).',
        effects: { airWaterDelta: 0, powerBankDelta: -9, radiationMsvDelta: -2.0, scienceFoodDelta: 9 },
      },
    ],
  };

  const middleWithSols: SolScenario[] = shuffledMiddle.map((item, idx) => ({
    ...item,
    sol: idx + 2,
  }));

  return [sol1, ...middleWithSols, sol8];
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
