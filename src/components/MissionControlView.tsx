import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Wind,
  Zap,
  ShieldAlert,
  Sprout,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Minus,
  Plus,
  Volume2,
  VolumeX,
  RotateCcw,
  ArrowRight,
  Award,
  Rocket,
  HelpCircle,
  Info,
  Undo2,
  Download,
  Lightbulb,
} from 'lucide-react';
import {
  DonkiFeedResponse,
  NasaDonkiEvent,
  OUTPOST_SITES,
  OutpostSiteId,
} from '../data/nasaDatasets';
import {
  buildMissionScenarios,
  calculateProjectedDeltas,
  clamp,
  DifficultyMode,
  MAX_SAFE_MSV,
  MAX_SOLS,
  MissionMetrics,
  PowerAllocation,
  SolLogEntry,
  SolScenario,
  TradeOffOption,
} from '../data/missionScenarios';
import { computeRealMarsComms, explainRadiationInRealLife } from '../utils/orbitalMath';
import { OutpostHabitatStage } from './OutpostHabitatStage';
import { CommsDelayWidget } from './CommsDelayWidget';
import { MissionProgressPanel } from './MissionProgressPanel';
import { ResourceTrendChart } from './ResourceTrendChart';
import { MissionLog, MissionLogEvent } from './MissionLog';
import { ForecastPanel } from './ForecastPanel';
import {
  MissionAchievementsPanel,
  computeUnlockedStabilityBadges,
  evaluateStabilityAbove50,
} from './MissionAchievementsPanel';
import { MissionFailedModal } from './MissionFailedModal';
import { MissionSuccessModal } from './MissionSuccessModal';
import { OnboardingOverlay } from './OnboardingOverlay';
import { soundFx } from '../utils/soundFx';
import type { HorizonsTelemetryResponse } from '../App';

type GamePhase = 'TITLE_MENU' | 'PLAYING' | 'ROUND_SUMMARY' | 'VICTORY' | 'GAME_OVER';

interface CommanderRecord {
  missionsPlayed: number;
  missionsWon: number;
  bestScienceFood: number;
  badges: string[];
}

interface MissionSnapshot {
  solIndex: number;
  metrics: MissionMetrics;
  allocation: PowerAllocation;
  nextSolPowerAdjust: number;
  logs: SolLogEntry[];
  missionEvents: MissionLogEvent[];
}

const STORAGE_KEY = 'astraoutpost_record_v1';
const MISSION_STATE_STORAGE_KEY = 'astraoutpost_mission_state_v1';
const ONBOARDING_SEEN_KEY = 'astraoutpost_onboarding_seen_v1';

function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

interface RoundFeedbackState {
  sol: number;
  airDelta: number;
  powerDelta: number;
  msvAdded: number;
  msvBlocked: number;
  scienceDelta: number;
  option: TradeOffOption;
  failureReason: string | null;
}

interface PersistedMissionState {
  version: 1;
  phase: GamePhase;
  site: OutpostSiteId;
  difficulty: DifficultyMode;
  missionSeed: number;
  solIndex: number;
  metrics: MissionMetrics;
  allocation: PowerAllocation;
  selectedOptionId: string | null;
  nextSolPowerAdjust: number;
  logs: SolLogEntry[];
  missionEvents: MissionLogEvent[];
  rewindSnapshot: MissionSnapshot | null;
  lastRoundFeedback: RoundFeedbackState | null;
  newlyUnlockedBadgeIds: string[];
  activeStorm: NasaDonkiEvent | null;
  savedAt: number;
}

const DEFAULT_RECORD: CommanderRecord = {
  missionsPlayed: 0,
  missionsWon: 0,
  bestScienceFood: 0,
  badges: [],
};

function loadRecord(): CommanderRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RECORD;
    const parsed = JSON.parse(raw) as Partial<CommanderRecord>;
    return {
      missionsPlayed: Number(parsed.missionsPlayed || 0),
      missionsWon: Number(parsed.missionsWon || 0),
      bestScienceFood: Number(parsed.bestScienceFood || 0),
      badges: Array.isArray(parsed.badges) ? parsed.badges : [],
    };
  } catch {
    return DEFAULT_RECORD;
  }
}

function loadMissionState(): PersistedMissionState | null {
  try {
    const raw = localStorage.getItem(MISSION_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedMissionState>;
    if (!parsed || parsed.version !== 1) return null;
    if (
      parsed.phase !== 'TITLE_MENU' &&
      parsed.phase !== 'PLAYING' &&
      parsed.phase !== 'ROUND_SUMMARY' &&
      parsed.phase !== 'VICTORY' &&
      parsed.phase !== 'GAME_OVER'
    ) {
      return null;
    }
    if (parsed.site !== 'moon' && parsed.site !== 'mars') return null;
    if (!parsed.metrics || !parsed.allocation) return null;
    return parsed as PersistedMissionState;
  } catch {
    return null;
  }
}

interface MissionControlViewProps {
  donkiFeed: DonkiFeedResponse;
  liveHorizons?: HorizonsTelemetryResponse | null;
  featuredStorm: NasaDonkiEvent | null;
  onClearFeaturedStorm: () => void;
  externalResetSignal: number;
  stormLaunchSignal: number;
}

const INITIAL_METRICS: MissionMetrics = {
  airWater: 78,
  powerBank: 72,
  cumulativeMsv: 0,
  scienceFood: 0,
};

const DEFAULT_ALLOCATION: PowerAllocation = {
  lifeSupport: 3,
  shielding: 2,
  greenhouse: 2,
  scienceComms: 2,
};

const INLINE_SCIENCE_TERMS: Array<{ key: string; label: string; answer: string }> = [
  {
    key: 'sol',
    label: 'What is a Sol?',
    answer:
      'One full Martian day-and-night cycle (24 hours, 39 minutes). On the Moon, astronauts count operational cycles too.',
  },
  {
    key: 'msv',
    label: 'What is mSv?',
    answer:
      'Millisievert (mSv) measures absorbed space radiation. On Earth we get ~3 mSv per whole year; a big solar flare can deliver more in one day!',
  },
  {
    key: 'tau',
    label: 'What is Dust Tau?',
    answer:
      'Tau measures how thick Martian sky dust is. Higher tau blocks sunlight from reaching your solar panels.',
  },
  {
    key: 'cme',
    label: 'What is a CME?',
    answer:
      'A Coronal Mass Ejection is a fast cloud of charged solar gas tracked by NASA DONKI that raises radiation risk.',
  },
];

function getMetricBadge(
  value: number,
  type: 'air' | 'power' | 'rad' | 'science'
): { label: string; toneClass: string; Icon: React.ElementType } {
  if (type === 'rad') {
    if (value >= 26) return { label: 'Critical', toneClass: 'text-[#DC2626]', Icon: XCircle };
    if (value >= 16) return { label: 'Elevated', toneClass: 'text-[#D97706]', Icon: AlertTriangle };
    return { label: 'Safe', toneClass: 'text-[#059669]', Icon: CheckCircle2 };
  }
  if (type === 'science') {
    if (value >= 75) return { label: 'Goal Met', toneClass: 'text-[#059669]', Icon: CheckCircle2 };
    if (value >= 40) return { label: 'On Track', toneClass: 'text-[#2563EB]', Icon: CheckCircle2 };
    return { label: 'Building', toneClass: 'text-[#475569]', Icon: Sprout };
  }
  if (value <= 24) return { label: 'Critical', toneClass: 'text-[#DC2626]', Icon: XCircle };
  if (value <= 44) return { label: 'Low', toneClass: 'text-[#D97706]', Icon: AlertTriangle };
  return { label: 'Nominal', toneClass: 'text-[#059669]', Icon: CheckCircle2 };
}

export const MissionControlView: React.FC<MissionControlViewProps> = ({
  donkiFeed,
  liveHorizons,
  featuredStorm,
  onClearFeaturedStorm,
  externalResetSignal,
  stormLaunchSignal,
}) => {
  const initialSaved = useMemo(() => loadMissionState(), []);

  const [phase, setPhase] = useState<GamePhase>(initialSaved?.phase ?? 'TITLE_MENU');
  const [site, setSite] = useState<OutpostSiteId>(initialSaved?.site ?? 'moon');
  const [difficulty, setDifficulty] = useState<DifficultyMode>(
    initialSaved?.difficulty ?? 'cadet'
  );
  const [missionSeed, setMissionSeed] = useState<number>(initialSaved?.missionSeed ?? 1);
  const [solIndex, setSolIndex] = useState<number>(initialSaved?.solIndex ?? 0);
  const [metrics, setMetrics] = useState<MissionMetrics>(
    initialSaved?.metrics ?? INITIAL_METRICS
  );
  const [allocation, setAllocation] = useState<PowerAllocation>(
    initialSaved?.allocation ?? DEFAULT_ALLOCATION
  );
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    initialSaved?.selectedOptionId ?? null
  );
  const [nextSolPowerAdjust, setNextSolPowerAdjust] = useState<number>(
    initialSaved?.nextSolPowerAdjust ?? 0
  );
  const [logs, setLogs] = useState<SolLogEntry[]>(initialSaved?.logs ?? []);
  const [missionEvents, setMissionEvents] = useState<MissionLogEvent[]>(
    initialSaved?.missionEvents ?? []
  );
  const [rewindSnapshot, setRewindSnapshot] = useState<MissionSnapshot | null>(
    initialSaved?.rewindSnapshot ?? null
  );
  const [lastRoundFeedback, setLastRoundFeedback] = useState<RoundFeedbackState | null>(
    initialSaved?.lastRoundFeedback ?? null
  );
  const [muted, setMuted] = useState(false);
  const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});
  const [activeTermKey, setActiveTermKey] = useState<string | null>(null);
  const [hoveredMeter, setHoveredMeter] = useState<'air' | 'power' | 'rad' | 'science' | null>(null);
  const [pinnedMeter, setPinnedMeter] = useState<'air' | 'power' | 'rad' | 'science' | null>(null);
  const [newlyUnlockedBadgeIds, setNewlyUnlockedBadgeIds] = useState<string[]>(
    initialSaved?.newlyUnlockedBadgeIds ?? []
  );
  const [showFailureModal, setShowFailureModal] = useState<boolean>(
    initialSaved?.phase === 'GAME_OVER'
  );
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(
    initialSaved?.phase === 'VICTORY'
  );
  const [showOnboarding, setShowOnboarding] = useState<boolean>(
    () => !hasSeenOnboarding() && initialSaved === null
  );
  const [activeToolTab, setActiveToolTab] = useState<'log' | 'progress' | 'comms' | 'badges'>(
    'log'
  );
  const [record, setRecord] = useState<CommanderRecord>(() => loadRecord());

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
    } catch {
      // Ignore storage quota issues
    }
  };

  const lastHandledResetRef = useRef<number>(externalResetSignal);
  const lastHandledStormRef = useRef<number>(0);

  const marsLiveComms = useMemo(() => computeRealMarsComms(), []);

  useEffect(() => {
    try {
      if (phase === 'TITLE_MENU') {
        localStorage.removeItem(MISSION_STATE_STORAGE_KEY);
        return;
      }
      const snapshot: PersistedMissionState = {
        version: 1,
        phase,
        site,
        difficulty,
        missionSeed,
        solIndex,
        metrics,
        allocation,
        selectedOptionId,
        nextSolPowerAdjust,
        logs,
        missionEvents,
        rewindSnapshot,
        lastRoundFeedback,
        newlyUnlockedBadgeIds,
        activeStorm: featuredStorm ?? initialSaved?.activeStorm ?? null,
        savedAt: Date.now(),
      };
      localStorage.setItem(MISSION_STATE_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore storage quota issues
    }
  }, [
    phase,
    site,
    difficulty,
    missionSeed,
    solIndex,
    metrics,
    allocation,
    selectedOptionId,
    nextSolPowerAdjust,
    logs,
    missionEvents,
    rewindSnapshot,
    lastRoundFeedback,
    newlyUnlockedBadgeIds,
    featuredStorm,
    initialSaved,
  ]);

  useEffect(() => {
    if (externalResetSignal > lastHandledResetRef.current) {
      lastHandledResetRef.current = externalResetSignal;
      setPhase('TITLE_MENU');
      setSolIndex(0);
      setMetrics(INITIAL_METRICS);
      setAllocation(DEFAULT_ALLOCATION);
      setSelectedOptionId(null);
      setNextSolPowerAdjust(0);
      setLogs([]);
      setMissionEvents([]);
      setRewindSnapshot(null);
      setLastRoundFeedback(null);
      setNewlyUnlockedBadgeIds([]);
      setShowFailureModal(false);
      setShowSuccessModal(false);
      try {
        localStorage.removeItem(MISSION_STATE_STORAGE_KEY);
      } catch {
        // Ignore storage quota issues
      }
    }
  }, [externalResetSignal]);

  useEffect(() => {
    if (stormLaunchSignal > lastHandledStormRef.current) {
      lastHandledStormRef.current = stormLaunchSignal;
      setMissionSeed((s) => s + 1);
      setPhase('PLAYING');
      setSolIndex(0);
      setMetrics(INITIAL_METRICS);
      setAllocation(
        difficulty === 'cadet'
          ? { lifeSupport: 3, shielding: 3, greenhouse: 2, scienceComms: 2 }
          : { lifeSupport: 2, shielding: 3, greenhouse: 2, scienceComms: 2 }
      );
      setSelectedOptionId(null);
      setNextSolPowerAdjust(0);
      setLogs([]);
      setMissionEvents([
        {
          id: `init-storm-${Date.now()}`,
          sol: 1,
          level: 'warning',
          title: 'NASA Space Weather Drill Active',
          detail: featuredStorm
            ? `Outpost initialized under NASA DONKI alert "${featuredStorm.classOrSpeed}". Keep Water-Wall shielding powered during storm Sols.`
            : 'Outpost initialized for space weather training. Monitor Air & Water, Battery, and Radiation thresholds.',
          metricsSummary: `Air ${INITIAL_METRICS.airWater}% · Pwr ${INITIAL_METRICS.powerBank}% · 0.0 mSv`,
        },
      ]);
      setRewindSnapshot(null);
      setLastRoundFeedback(null);
      setNewlyUnlockedBadgeIds([]);
      setShowFailureModal(false);
      setShowSuccessModal(false);
    }
  }, [stormLaunchSignal, difficulty, featuredStorm]);

  const effectiveActiveStorm = featuredStorm ?? initialSaved?.activeStorm ?? null;

  const scenarios = useMemo(
    () => buildMissionScenarios(site, difficulty, donkiFeed.events, effectiveActiveStorm, missionSeed),
    [site, difficulty, donkiFeed.events, effectiveActiveStorm, missionSeed]
  );

  const currentScenario: SolScenario = useMemo(() => {
    const raw = scenarios[solIndex] || scenarios[0];
    const adjustedBudget = clamp(raw.powerBudgetToday + nextSolPowerAdjust, 4, 14);
    return {
      ...raw,
      powerBudgetToday: adjustedBudget,
    };
  }, [scenarios, solIndex, nextSolPowerAdjust]);

  const projected = useMemo(
    () => calculateProjectedDeltas(site, allocation, currentScenario, metrics.airWater),
    [site, allocation, currentScenario, metrics.airWater]
  );

  const stabilityAudit = useMemo(
    () => evaluateStabilityAbove50(logs, metrics),
    [logs, metrics]
  );

  const selectedOption = useMemo(
    () => currentScenario.options.find((o) => o.id === selectedOptionId) || null,
    [currentScenario, selectedOptionId]
  );

  const toggleSound = () => {
    const next = !muted;
    soundFx.muted = next;
    setMuted(next);
  };

  const startMission = (chosenSite?: OutpostSiteId) => {
    const targetSite = chosenSite || site;
    if (chosenSite) setSite(chosenSite);
    soundFx.playSolCommit();
    setMissionSeed((s) => s + 1);
    setPhase('PLAYING');
    setSolIndex(0);
    setMetrics(INITIAL_METRICS);
    setAllocation(
      difficulty === 'cadet'
        ? { lifeSupport: 3, shielding: 2, greenhouse: 2, scienceComms: 2 }
        : { lifeSupport: 2, shielding: 2, greenhouse: 2, scienceComms: 2 }
    );
    setSelectedOptionId(null);
    setNextSolPowerAdjust(0);
    setLogs([]);
    setMissionEvents([
      {
        id: `init-${Date.now()}`,
        sol: 1,
        level: 'decision',
        title: `${OUTPOST_SITES[targetSite].name} Online`,
        detail:
          'Mission systems initialized. Keep Air & Water and Power Bank above 25%, stay under 35 mSv radiation, and reach 75%+ Science & Food.',
        metricsSummary: `Air ${INITIAL_METRICS.airWater}% · Pwr ${INITIAL_METRICS.powerBank}% · 0.0 mSv`,
      },
    ]);
    setRewindSnapshot(null);
    setLastRoundFeedback(null);
    setNewlyUnlockedBadgeIds([]);
    setShowFailureModal(false);
    setShowSuccessModal(false);
    dismissOnboarding();
  };

  const updatePower = (key: keyof PowerAllocation, delta: number) => {
    const nextVal = clamp(allocation[key] + delta, 0, 4);
    const nextTotal = projected.totalAllocated - allocation[key] + nextVal;
    if (nextTotal > currentScenario.powerBudgetToday) {
      soundFx.playAlert();
      return;
    }
    soundFx.playTick(440 + nextVal * 65);
    setAllocation((prev) => ({ ...prev, [key]: nextVal }));
  };

  const setPowerLevel = (key: keyof PowerAllocation, target: number) => {
    const nextVal = allocation[key] === target ? target - 1 : target;
    const clamped = clamp(nextVal, 0, 4);
    const nextTotal = projected.totalAllocated - allocation[key] + clamped;
    if (nextTotal > currentScenario.powerBudgetToday) {
      soundFx.playAlert();
      return;
    }
    soundFx.playTick(440 + clamped * 65);
    setAllocation((prev) => ({ ...prev, [key]: clamped }));
  };

  const applyPowerPreset = (preset: 'balanced' | 'storm' | 'harvest' | 'battery') => {
    const budget = currentScenario.powerBudgetToday;
    const weights: Record<typeof preset, PowerAllocation> = {
      balanced: { lifeSupport: 3, shielding: 2, greenhouse: 2, scienceComms: 2 },
      storm: { lifeSupport: 2, shielding: 4, greenhouse: 1, scienceComms: 1 },
      harvest: { lifeSupport: 2, shielding: 1, greenhouse: 4, scienceComms: 3 },
      battery: { lifeSupport: 2, shielding: 1, greenhouse: 1, scienceComms: 1 },
    };

    const next = { ...weights[preset] };
    let sum = next.lifeSupport + next.shielding + next.greenhouse + next.scienceComms;
    const trimOrder: Array<keyof PowerAllocation> = [
      'scienceComms',
      'greenhouse',
      'shielding',
      'lifeSupport',
    ];
    for (const k of trimOrder) {
      while (next[k] > 0 && sum > budget) {
        next[k] -= 1;
        sum -= 1;
      }
    }
    soundFx.playTick(560);
    setAllocation(next);
  };

  const saveOutcomeToRecord = (
    won: boolean,
    finalMetrics: MissionMetrics,
    missionSite: OutpostSiteId,
    updatedLogs: SolLogEntry[]
  ) => {
    const unlocked: string[] = [];
    if (finalMetrics.airWater >= 65) unlocked.push('Closed-Loop Engineer');
    if (finalMetrics.cumulativeMsv <= 18) unlocked.push('Solar Storm Shielder');
    if (finalMetrics.scienceFood >= 75) unlocked.push('Deep-Space Harvest Lead');
    if (missionSite === 'mars' && won) unlocked.push('Autonomous Mars Commander');

    const stabilityAchievementIds = computeUnlockedStabilityBadges({
      won,
      solsCompleted: updatedLogs.length,
      site: missionSite,
      difficulty,
      finalMetrics,
      logs: updatedLogs,
    });
    const allUnlocked = [...unlocked, ...stabilityAchievementIds];

    setRecord((prev) => {
      const freshAchievements = stabilityAchievementIds.filter(
        (id) => !prev.badges.includes(id)
      );
      setNewlyUnlockedBadgeIds(freshAchievements);

      const mergedBadges = Array.from(new Set([...prev.badges, ...allUnlocked]));
      const next: CommanderRecord = {
        missionsPlayed: prev.missionsPlayed + 1,
        missionsWon: prev.missionsWon + (won ? 1 : 0),
        bestScienceFood: Math.max(prev.bestScienceFood, finalMetrics.scienceFood),
        badges: mergedBadges,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota issues
      }
      return next;
    });
  };

  const handleRunSol = () => {
    if (!selectedOption) return;
    if (projected.totalAllocated > currentScenario.powerBudgetToday) return;

    // Save snapshot for non-punitive 1-Sol Rewind!
    setRewindSnapshot({
      solIndex,
      metrics: { ...metrics },
      allocation: { ...allocation },
      nextSolPowerAdjust,
      logs: [...logs],
      missionEvents: [...missionEvents],
    });

    const totalAirDelta = projected.airWaterDelta + selectedOption.effects.airWaterDelta;
    const totalPowerDelta = projected.powerBankDelta + selectedOption.effects.powerBankDelta;
    const rawMsvAdded = Math.max(
      0.2,
      Number((projected.radiationMsvAdded + selectedOption.effects.radiationMsvDelta).toFixed(1))
    );
    const totalMsvBlocked = Math.max(
      0,
      Number(
        (
          projected.radiationMsvBlocked +
          (selectedOption.effects.radiationMsvDelta < 0
            ? Math.abs(selectedOption.effects.radiationMsvDelta)
            : 0)
        ).toFixed(1)
      )
    );
    const totalScienceDelta = projected.scienceFoodDelta + selectedOption.effects.scienceFoodDelta;

    const nextAir = clamp(metrics.airWater + totalAirDelta, 0, 100);
    const nextPower = clamp(metrics.powerBank + totalPowerDelta, 0, 100);
    const nextMsv = Number((metrics.cumulativeMsv + rawMsvAdded).toFixed(1));
    const nextScience = clamp(metrics.scienceFood + totalScienceDelta, 0, 100);

    let failureReason: string | null = null;
    if (nextAir <= 0) {
      failureReason = 'Air & Water reserves dropped to 0%. Your life-support recyclers ran dry.';
    } else if (nextPower <= 0) {
      failureReason = 'Outpost Battery Bank reached 0%. Heaters and air pumps shut down.';
    } else if (nextMsv >= MAX_SAFE_MSV) {
      failureReason = `Crew radiation dose reached ${nextMsv.toFixed(1)} mSv (above the ${MAX_SAFE_MSV} mSv mission safety limit).`;
    }

    const takeaway = `Allocated ${allocation.lifeSupport}P Life · ${allocation.shielding}P Shield · ${allocation.greenhouse}P Crops · ${allocation.scienceComms}P Lab. Chose "${selectedOption.label}".`;

    const newLog: SolLogEntry = {
      sol: currentScenario.sol,
      scenarioTitle: currentScenario.title,
      chosenOptionLabel: selectedOption.label,
      allocation: { ...allocation },
      airWaterAfter: nextAir,
      powerBankAfter: nextPower,
      cumulativeMsvAfter: nextMsv,
      scienceFoodAfter: nextScience,
      takeaway,
    };

    const summaryStr = `Air ${nextAir}% · Pwr ${nextPower}% · ${nextMsv.toFixed(1)} mSv · Sci ${nextScience}%`;
    const solNum = currentScenario.sol;
    const generatedEvents: MissionLogEvent[] = [
      {
        id: `sol-${solNum}-decision-${Date.now()}`,
        sol: solNum,
        level: 'decision',
        title: currentScenario.title,
        detail: `Chose "${selectedOption.label}" with power split [Life ${allocation.lifeSupport}P · Shield ${allocation.shielding}P · Crops ${allocation.greenhouse}P · Lab ${allocation.scienceComms}P].`,
        metricsSummary: summaryStr,
      },
    ];

    // Threshold-crossing notifications with contextual engineering advice
    if (nextAir <= 24) {
      generatedEvents.push({
        id: `sol-${solNum}-air-crit-${Date.now()}`,
        sol: solNum,
        level: 'critical',
        title: `Air & Water Critical (${nextAir}%)`,
        detail: `Following "${selectedOption.label}", Air & Water dropped below the 25% critical threshold. Boost Life Support & Greenhouse power immediately to avoid tank depletion.`,
        metricsSummary: summaryStr,
      });
    } else if (nextAir <= 44 && metrics.airWater > 44) {
      generatedEvents.push({
        id: `sol-${solNum}-air-warn-${Date.now()}`,
        sol: solNum,
        level: 'warning',
        title: `Air & Water Low (${nextAir}%)`,
        detail: `Reserves dipped below 45% after Sol ${solNum}. Consider prioritizing Life Support recyclers on the next Sol.`,
        metricsSummary: summaryStr,
      });
    }

    if (nextPower <= 24) {
      generatedEvents.push({
        id: `sol-${solNum}-pwr-crit-${Date.now()}`,
        sol: solNum,
        level: 'critical',
        title: `Power Bank Critical (${nextPower}%)`,
        detail: `Battery reserves fell below 25% after "${selectedOption.label}". Leave 1–2 Power Units unspent or select the Save Battery preset to recharge.`,
        metricsSummary: summaryStr,
      });
    } else if (nextPower <= 44 && metrics.powerBank > 44) {
      generatedEvents.push({
        id: `sol-${solNum}-pwr-warn-${Date.now()}`,
        sol: solNum,
        level: 'warning',
        title: `Power Bank Low (${nextPower}%)`,
        detail: `Battery reserves dropped below 45% during Sol ${solNum}. Dust storms or crater shadows could drain remaining charge quickly.`,
        metricsSummary: summaryStr,
      });
    }

    if (nextMsv >= 26 && metrics.cumulativeMsv < 26) {
      generatedEvents.push({
        id: `sol-${solNum}-rad-crit-${Date.now()}`,
        sol: solNum,
        level: 'critical',
        title: `Radiation Dose Critical (${nextMsv.toFixed(1)} / ${MAX_SAFE_MSV} mSv)`,
        detail: `Cumulative exposure crossed 26 mSv (${explainRadiationInRealLife(nextMsv)}). Keep Water-Wall Shielding at 3–4P for the rest of the mission.`,
        metricsSummary: summaryStr,
      });
    } else if (nextMsv >= 16 && metrics.cumulativeMsv < 16) {
      generatedEvents.push({
        id: `sol-${solNum}-rad-warn-${Date.now()}`,
        sol: solNum,
        level: 'warning',
        title: `Radiation Dose Elevated (${nextMsv.toFixed(1)} mSv)`,
        detail: `Crew radiation passed 16 mSv. Increasing Shielding power blocks up to 88% of incoming solar flare particles.`,
        metricsSummary: summaryStr,
      });
    }

    if (nextScience >= 75 && metrics.scienceFood < 75) {
      generatedEvents.push({
        id: `sol-${solNum}-sci-goal-${Date.now()}`,
        sol: solNum,
        level: 'milestone',
        title: `75% Science & Food Target Reached (${nextScience}%)`,
        detail: `Your Greenhouse crops and Deep-Space Lab hit the primary mission research goal! Focus on crew survival margins through Sol ${MAX_SOLS}.`,
        metricsSummary: summaryStr,
      });
    }

    const nextMetrics: MissionMetrics = {
      airWater: nextAir,
      powerBank: nextPower,
      cumulativeMsv: nextMsv,
      scienceFood: nextScience,
    };

    const updatedLogs = [...logs, newLog];

    if (!failureReason && solIndex + 1 >= MAX_SOLS) {
      const earnedIds = computeUnlockedStabilityBadges({
        won: true,
        solsCompleted: updatedLogs.length,
        site,
        difficulty,
        finalMetrics: nextMetrics,
        logs: updatedLogs,
      });
      if (earnedIds.length > 0) {
        generatedEvents.push({
          id: `sol-${solNum}-achievement-${Date.now()}`,
          sol: solNum,
          level: 'milestone',
          title: 'Mission Achievement Unlocked: 50%+ Stability Guardian',
          detail:
            'Completed all 8 Sols while maintaining Air & Water, Power Bank, and Radiation Margin above 50%!',
          metricsSummary: summaryStr,
        });
      }
    }

    setMetrics(nextMetrics);
    setLogs(updatedLogs);
    setMissionEvents((prev) => [...prev, ...generatedEvents]);
    setNextSolPowerAdjust(
      (selectedOption.effects.nextSolPowerBonus || 0) -
        (selectedOption.effects.nextSolPowerPenalty || 0)
    );
    setLastRoundFeedback({
      sol: currentScenario.sol,
      airDelta: nextAir - metrics.airWater,
      powerDelta: nextPower - metrics.powerBank,
      msvAdded: rawMsvAdded,
      msvBlocked: totalMsvBlocked,
      scienceDelta: nextScience - metrics.scienceFood,
      option: selectedOption,
      failureReason,
    });

    if (failureReason) {
      soundFx.playAlert();
      saveOutcomeToRecord(false, nextMetrics, site, updatedLogs);
      setShowFailureModal(true);
      setPhase('GAME_OVER');
    } else if (solIndex + 1 >= MAX_SOLS) {
      soundFx.playSolCommit();
      saveOutcomeToRecord(true, nextMetrics, site, updatedLogs);
      setShowSuccessModal(true);
      setPhase('VICTORY');
    } else {
      soundFx.playSolCommit();
      setPhase('ROUND_SUMMARY');
    }
  };

  const handleRewindOneSol = () => {
    if (!rewindSnapshot) return;
    soundFx.playTick(480);
    setSolIndex(rewindSnapshot.solIndex);
    setMetrics(rewindSnapshot.metrics);
    setAllocation(rewindSnapshot.allocation);
    setNextSolPowerAdjust(rewindSnapshot.nextSolPowerAdjust);
    setLogs(rewindSnapshot.logs);
    setMissionEvents(rewindSnapshot.missionEvents);
    setSelectedOptionId(null);
    setLastRoundFeedback(null);
    setRewindSnapshot(null);
    setShowFailureModal(false);
    setShowSuccessModal(false);
    setPhase('PLAYING');
  };

  const handleNextSol = () => {
    soundFx.playTick(560);
    const nextIndex = solIndex + 1;
    setSolIndex(nextIndex);
    setSelectedOptionId(null);
    const rawNext = scenarios[nextIndex] || scenarios[0];
    const nextBudget = clamp(rawNext.powerBudgetToday + nextSolPowerAdjust, 4, 14);
    let currentSum =
      allocation.lifeSupport + allocation.shielding + allocation.greenhouse + allocation.scienceComms;
    if (currentSum > nextBudget) {
      const trimmed = { ...allocation };
      const order: Array<keyof PowerAllocation> = [
        'scienceComms',
        'greenhouse',
        'shielding',
        'lifeSupport',
      ];
      for (const k of order) {
        while (trimmed[k] > 0 && currentSum > nextBudget) {
          trimmed[k] -= 1;
          currentSum -= 1;
        }
      }
      setAllocation(trimmed);
    }
    setPhase('PLAYING');
  };

  const handleDownloadMissionReport = () => {
    const profile = OUTPOST_SITES[site];
    const lines = [
      'ASTRAOUTPOST — JUNIOR ASTRONAUT MISSION SCIENCE REPORT',
      '======================================================',
      `Outpost Site: ${profile.name} (${profile.locationLabel})`,
      `Difficulty: ${difficulty === 'cadet' ? 'Cadet Explorer (11 Power/Sol)' : 'Flight Director (9 Power/Sol)'}`,
      `Outcome: ${phase === 'VICTORY' ? 'MISSION SURVIVED (8 SOLS)' : `ENDED ON SOL ${currentScenario.sol}`}`,
      `NASA Space Weather Feed: ${donkiFeed.sourceMode.toUpperCase()} (${donkiFeed.note})`,
      '',
      'FINAL TELEMETRY',
      `  Air & Water: ${metrics.airWater}%`,
      `  Power Bank: ${metrics.powerBank}%`,
      `  Total Radiation Dose: ${metrics.cumulativeMsv.toFixed(1)} mSv (${explainRadiationInRealLife(metrics.cumulativeMsv)})`,
      `  Science & Food Goal: ${metrics.scienceFood}%`,
      '',
      'SOL-BY-SOL ENGINEERING LOGBOOK',
      ...logs.map(
        (l) =>
          `  Sol ${l.sol} | ${l.scenarioTitle} | Choice: "${l.chosenOptionLabel}" | Power [Life:${l.allocation.lifeSupport} Shield:${l.allocation.shielding} Crops:${l.allocation.greenhouse} Lab:${l.allocation.scienceComms}] -> Air ${l.airWaterAfter}%, Battery ${l.powerBankAfter}%, Rad ${l.cumulativeMsvAfter.toFixed(1)} mSv, Sci ${l.scienceFoodAfter}%`
      ),
      '',
      'NASA DATASETS REFERENCED',
      '  - NASA DONKI & GOES-18 (Space Weather FLR / CME / SEP)',
      '  - NASA OSDR (OSD-120, OSD-992, OSD-627, OSD-766)',
      `  - ${profile.dataAttribution}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `astraoutpost-${site}-mission-report.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const siteProfile = OUTPOST_SITES[site];

  // =========================================================================
  // 1. TITLE / BRIEFING MENU
  // =========================================================================
  if (phase === 'TITLE_MENU') {
    return (
      <section className="space-y-8">
        <OnboardingOverlay isOpen={showOnboarding} onDismiss={dismissOnboarding} />
        <div className="bg-white border border-[#DCE3EE] rounded-xl p-6 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <p className="text-xs font-semibold text-[#2563EB] tracking-wide">
                Ages 7–12 · Real NASA Open Science Data · 8-Sol Mission Simulation
              </p>
              <h1
                className="text-3xl md:text-4xl font-bold text-[#0F172A] leading-tight"
                style={{ textWrap: 'balance' }}
              >
                Command a Lunar or Martian Outpost Where Every Choice Has a Real Cost
              </h1>
              <p className="text-base text-[#334155] leading-relaxed max-w-2xl">
                Space engineers never get infinite energy or instant magic fixes. Split your daily
                solar power between Life Support, Radiation Shielding, Hydroponic Crops, and
                Deep-Space Science—while real NASA space weather storms test your plan.
              </p>

              {/* 3-Step Visual Loop Primer */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                <div className="p-3 bg-[#F8FAFC] border border-[#DCE3EE] rounded-lg">
                  <p className="font-semibold text-[#0F172A]">1. Budget Power</p>
                  <p className="text-[#475569] mt-0.5">
                    Too little to max everything—decide what matters today.
                  </p>
                </div>
                <div className="p-3 bg-[#F8FAFC] border border-[#DCE3EE] rounded-lg">
                  <p className="font-semibold text-[#0F172A]">2. Pick a Trade-Off</p>
                  <p className="text-[#475569] mt-0.5">
                    Every choice has a real gain AND an engineering cost.
                  </p>
                </div>
                <div className="p-3 bg-[#F8FAFC] border border-[#DCE3EE] rounded-lg">
                  <p className="font-semibold text-[#0F172A]">3. Learn &amp; Replay</p>
                  <p className="text-[#475569] mt-0.5">
                    Rewind any Sol to test new strategies without starting over.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <div className="inline-flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-lg border border-[#DCE3EE]">
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playTick(500);
                      setDifficulty('cadet');
                    }}
                    className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      difficulty === 'cadet'
                        ? 'bg-white text-[#0F172A] shadow-xs'
                        : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    Cadet Explorer (11 Power / Sol)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playTick(580);
                      setDifficulty('director');
                    }}
                    className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      difficulty === 'director'
                        ? 'bg-white text-[#0F172A] shadow-xs'
                        : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    Flight Director (9 Power / Sol)
                  </button>
                </div>

                {featuredStorm && (
                  <div className="flex items-center gap-2 text-xs text-[#B45309] font-medium">
                    <span>Active DONKI Storm: {featuredStorm.classOrSpeed}</span>
                    <button
                      type="button"
                      onClick={onClearFeaturedStorm}
                      className="underline text-[#475569] hover:text-[#0F172A] cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-1 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => startMission()}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Start {site === 'moon' ? 'Moon' : 'Mars'} Mission
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowOnboarding(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-3 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
                  How to Play
                </button>
                <span className="text-xs text-[#64748B]">
                  No account required ·{' '}
                  {donkiFeed.sourceMode === 'live'
                    ? 'Live NASA DONKI linked'
                    : 'Archived NASA DONKI dataset loaded'}
                </span>
              </div>

              {record.missionsPlayed > 0 && (
                <div className="pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#475569]">
                  <span className="font-semibold text-[#0F172A]">Commander Record:</span>
                  <span className="font-mono">
                    {record.missionsWon}/{record.missionsPlayed} Missions Survived
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">Best Science: {record.bestScienceFood}%</span>
                  <span aria-hidden="true">·</span>
                  <span>{record.badges.length} Badges Earned</span>
                </div>
              )}
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-xl overflow-hidden border border-[#DCE3EE] bg-[#0B1220]">
                {!imgFailed[siteProfile.id] ? (
                  <img
                    src={siteProfile.imagePath}
                    alt={siteProfile.imageAlt}
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed((p) => ({ ...p, [siteProfile.id]: true }))}
                    className="w-full aspect-video object-cover block"
                  />
                ) : (
                  <div className="w-full aspect-video flex items-center justify-center bg-[#0F172A] text-white p-6 text-center">
                    <div>
                      <p className="font-semibold text-base">{siteProfile.name}</p>
                      <p className="text-xs text-slate-300 mt-1">{siteProfile.locationLabel}</p>
                    </div>
                  </div>
                )}
                <div className="p-4 bg-[#0F172A] text-white">
                  <p className="text-xs text-[#93C5FD] font-medium">{siteProfile.program}</p>
                  <p className="text-sm font-semibold mt-0.5">{siteProfile.name}</p>
                  <p className="text-xs text-[#CBD5E1] mt-1 leading-relaxed">
                    {siteProfile.dataAttribution}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Site Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(['moon', 'mars'] as OutpostSiteId[]).map((id) => {
            const profile = OUTPOST_SITES[id];
            const isSelected = site === id;
            return (
              <div
                key={id}
                className={`bg-white rounded-xl border transition-colors overflow-hidden flex flex-col ${
                  isSelected ? 'border-[#2563EB] ring-2 ring-[#2563EB]/20' : 'border-[#DCE3EE]'
                }`}
              >
                <div className="relative bg-[#0B1220]">
                  {!imgFailed[`card-${id}`] ? (
                    <img
                      src={profile.imagePath}
                      alt={profile.imageAlt}
                      referrerPolicy="no-referrer"
                      onError={() => setImgFailed((p) => ({ ...p, [`card-${id}`]: true }))}
                      className="w-full aspect-video object-cover block"
                    />
                  ) : (
                    <div className="w-full aspect-video flex items-center justify-center bg-[#0F172A] text-white">
                      {profile.name}
                    </div>
                  )}
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-[#475569]">{profile.locationLabel}</p>
                    <h2 className="text-xl font-bold text-[#0F172A] mt-0.5">{profile.name}</h2>
                    <p className="text-sm text-[#334155] mt-2 leading-relaxed">{profile.summary}</p>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E2E8F0] text-xs">
                    <div>
                      <dt className="text-[#64748B]">Radio Delay to Earth</dt>
                      <dd className="font-mono font-semibold text-[#0F172A] mt-0.5">
                        {id === 'moon'
                          ? profile.commsDisplay
                          : `${marsLiveComms.roundTripFormatted} today`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#64748B]">Natural Radiation</dt>
                      <dd className="font-mono font-semibold text-[#0F172A] mt-0.5">
                        {profile.baselineRadiationMsvPerDay} mSv / day
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#64748B]">Temperature</dt>
                      <dd className="font-medium text-[#0F172A] mt-0.5">{profile.temperatureRange}</dd>
                    </div>
                    <div>
                      <dt className="text-[#64748B]">Main Challenge</dt>
                      <dd className="font-medium text-[#0F172A] mt-0.5">
                        {id === 'moon' ? 'Vacuum & Solar Storms' : 'Dust Storms & Radio Lag'}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playTick(540);
                        setSite(id);
                      }}
                      className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? 'bg-[#0F172A] text-white'
                          : 'bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0]'
                      }`}
                    >
                      {isSelected ? 'Selected Site' : `Select ${id === 'moon' ? 'Moon' : 'Mars'}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => startMission(id)}
                      className="py-2.5 px-4 rounded-lg text-xs font-semibold bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Launch Here
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <MissionAchievementsPanel unlockedBadgeIds={record.badges} />
      </section>
    );
  }

  // =========================================================================
  // 2. END STATE: VICTORY OR GAME OVER
  // =========================================================================
  if (phase === 'VICTORY' || phase === 'GAME_OVER') {
    const isWin = phase === 'VICTORY';
    const badges: Array<{ name: string; desc: string }> = [];
    if (metrics.airWater >= 65) {
      badges.push({
        name: 'Closed-Loop Engineer',
        desc: 'Finished with strong Air & Water reserves (65%+).',
      });
    }
    if (metrics.cumulativeMsv <= 18) {
      badges.push({
        name: 'Solar Storm Shielder',
        desc: 'Kept crew radiation exposure remarkably low (<= 18 mSv).',
      });
    }
    if (metrics.scienceFood >= 75) {
      badges.push({
        name: 'Deep-Space Harvest Lead',
        desc: 'Achieved 75%+ Science & Food progress across 8 Sols.',
      });
    }
    if (site === 'mars' && isWin) {
      badges.push({
        name: 'Autonomous Mars Commander',
        desc: 'Guided a Martian outpost despite speed-of-light radio delays.',
      });
    }

    return (
      <section className="space-y-6">
        <MissionFailedModal
          isOpen={!isWin && showFailureModal}
          siteProfile={siteProfile}
          solReached={currentScenario.sol}
          solsCompleted={logs.length}
          metrics={metrics}
          failureReason={
            lastRoundFeedback?.failureReason ||
            'One of your critical life-support resources reached zero.'
          }
          lastOption={lastRoundFeedback?.option}
          canRewind={Boolean(rewindSnapshot)}
          onRestartSession={() => startMission(site)}
          onRewindOneSol={handleRewindOneSol}
          onCloseToDebrief={() => setShowFailureModal(false)}
        />
        <MissionSuccessModal
          isOpen={isWin && showSuccessModal}
          siteProfile={siteProfile}
          metrics={metrics}
          maintainedAbove50={stabilityAudit.maintainedAbove50}
          newlyUnlockedBadgeIds={newlyUnlockedBadgeIds}
          onReturnToBase={() => {
            setShowSuccessModal(false);
            setPhase('TITLE_MENU');
          }}
          onNewMission={() => startMission(site)}
          onCloseToDebrief={() => setShowSuccessModal(false)}
        />
        <div className="bg-white border border-[#DCE3EE] rounded-xl p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-[#E2E8F0]">
            <div>
              <p className={`text-xs font-semibold ${isWin ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                {isWin ? 'Mission Complete · 8 Sols Survived' : `Mission Failed on Sol ${currentScenario.sol}`}
              </p>
              <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A] mt-1">
                {isWin
                  ? `You Successfully Commanded ${siteProfile.name}!`
                  : 'Outpost Emergency: Crew Evacuated to Safe Module'}
              </h1>
              <p className="text-sm text-[#334155] mt-2 max-w-2xl leading-relaxed">
                {isWin
                  ? metrics.scienceFood >= 75
                    ? 'Outstanding engineering! You kept your crew alive AND hit your Science & Food targets without running out of power or exceeding safe radiation.'
                    : 'Your crew survived all 8 Sols safely! Next time, try sending a little more power to the Greenhouse and Science Dish to push Science & Food past 75%.'
                  : lastRoundFeedback?.failureReason ||
                    'One of your critical life-support systems dropped below safe limits—showing how tightly space systems depend on each other.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {isWin && !showSuccessModal && (
                <button
                  type="button"
                  onClick={() => setShowSuccessModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#ECFDF5] hover:bg-[#D1FAE5] text-[#059669] border border-[#A7F3D0] text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  Efficiency Summary
                </button>
              )}
              {!isWin && !showFailureModal && (
                <button
                  type="button"
                  onClick={() => setShowFailureModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  Summary Modal
                </button>
              )}
              {!isWin && rewindSnapshot && (
                <button
                  type="button"
                  onClick={handleRewindOneSol}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Rewind 1 Sol &amp; Retry
                </button>
              )}
              <button
                type="button"
                onClick={() => startMission(site)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                {isWin ? 'Play New Seed' : 'Restart Mission'}
              </button>
              <button
                type="button"
                onClick={handleDownloadMissionReport}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                Save Report (.txt)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-b border-[#E2E8F0]">
            <div>
              <p className="text-xs text-[#64748B]">Final Air &amp; Water</p>
              <p className="text-2xl font-bold font-mono text-[#0F172A] mt-1">{metrics.airWater}%</p>
            </div>
            <div>
              <p className="text-xs text-[#64748B]">Final Power Bank</p>
              <p className="text-2xl font-bold font-mono text-[#0F172A] mt-1">{metrics.powerBank}%</p>
            </div>
            <div>
              <p className="text-xs text-[#64748B]">Total Radiation Dose</p>
              <p className="text-2xl font-bold font-mono text-[#0F172A] mt-1">
                {metrics.cumulativeMsv.toFixed(1)}{' '}
                <span className="text-xs font-normal text-[#64748B]">/ {MAX_SAFE_MSV} mSv</span>
              </p>
              <p className="text-[11px] text-[#475569] mt-0.5">
                {explainRadiationInRealLife(metrics.cumulativeMsv)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#64748B]">Science &amp; Food Goal</p>
              <p className="text-2xl font-bold font-mono text-[#0F172A] mt-1">{metrics.scienceFood}%</p>
            </div>
          </div>

          {badges.length > 0 && (
            <div className="py-6 border-b border-[#E2E8F0]">
              <h2 className="text-sm font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
                Explorer Commendations Earned
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {badges.map((b) => (
                  <div key={b.name} className="p-3.5 bg-[#F8FAFC] border border-[#DCE3EE] rounded-lg">
                    <p className="text-sm font-semibold text-[#0F172A]">{b.name}</p>
                    <p className="text-xs text-[#475569] mt-0.5">{b.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="py-6 border-b border-[#E2E8F0]">
            <MissionAchievementsPanel
              unlockedBadgeIds={record.badges}
              newlyUnlockedIds={newlyUnlockedBadgeIds}
              liveAudit={stabilityAudit}
            />
          </div>

          <div className="py-6 border-b border-[#E2E8F0]">
            <MissionProgressPanel
              currentSol={currentScenario.sol}
              scenarios={scenarios}
              logs={logs}
              metrics={metrics}
              isEndState={true}
            />
          </div>

          <div className="pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-semibold text-[#0F172A]">
                Mission Trade-Off Logbook ({logs.length} Sols recorded)
              </h2>
              <button
                type="button"
                onClick={() => startMission(site === 'moon' ? 'mars' : 'moon')}
                className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
              >
                Switch to {site === 'moon' ? 'Mars' : 'Moon'} Outpost →
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#DCE3EE] text-[#64748B]">
                    <th className="py-2 pr-4 font-semibold">Sol</th>
                    <th className="py-2 pr-4 font-semibold">Event &amp; Decision</th>
                    <th className="py-2 pr-4 font-semibold">Air &amp; Water</th>
                    <th className="py-2 pr-4 font-semibold">Power</th>
                    <th className="py-2 pr-4 font-semibold">Radiation</th>
                    <th className="py-2 font-semibold">Science &amp; Food</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((entry) => (
                    <tr key={entry.sol} className="border-b border-[#F1F5F9]">
                      <td className="py-2.5 pr-4 font-mono font-semibold text-[#0F172A]">
                        Sol {entry.sol}
                      </td>
                      <td className="py-2.5 pr-4 text-[#334155]">
                        <span className="font-semibold text-[#0F172A]">{entry.scenarioTitle}</span>
                        <span className="block text-[#475569] mt-0.5">{entry.chosenOptionLabel}</span>
                      </td>
                      <td className="py-2.5 pr-4 font-mono">{entry.airWaterAfter}%</td>
                      <td className="py-2.5 pr-4 font-mono">{entry.powerBankAfter}%</td>
                      <td className="py-2.5 pr-4 font-mono">{entry.cumulativeMsvAfter.toFixed(1)} mSv</td>
                      <td className="py-2.5 font-mono">{entry.scienceFoodAfter}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // =========================================================================
  // 3. ACTIVE MISSION & ROUND SUMMARY
  // =========================================================================
  const airBadge = getMetricBadge(metrics.airWater, 'air');
  const powerBadge = getMetricBadge(metrics.powerBank, 'power');
  const radBadge = getMetricBadge(metrics.cumulativeMsv, 'rad');
  const sciBadge = getMetricBadge(metrics.scienceFood, 'science');

  const overBudget = projected.totalAllocated > currentScenario.powerBudgetToday;
  const remainingPower = currentScenario.powerBudgetToday - projected.totalAllocated;
  const activeScienceTerm = INLINE_SCIENCE_TERMS.find((t) => t.key === activeTermKey) || null;

  const isAirUrgent = metrics.airWater < 20;
  const isPowerUrgent = metrics.powerBank < 20;
  const radSafetyMarginPct = Math.max(
    0,
    Math.round((1 - metrics.cumulativeMsv / MAX_SAFE_MSV) * 100)
  );
  const isRadUrgent = radSafetyMarginPct < 20;

  const activeMeterTooltip = pinnedMeter ?? hoveredMeter;
  const toggleMeterPin = (key: 'air' | 'power' | 'rad' | 'science') => {
    setPinnedMeter((prev) => (prev === key ? null : key));
  };

  const meterTooltips: Record<
    'air' | 'power' | 'rad' | 'science',
    { heading: string; envImpact: string; allocationImpact: string; netProjection: string }
  > = {
    air: {
      heading: 'Life Support · Air & Water Impact',
      envImpact: `${siteProfile.name} (${site === 'moon' ? 'vacuum exosphere' : 'thin 1% CO₂ air'}) loses -14% per Sol to crew breathing & water use. Active condition: ${currentScenario.weatherCondition}.`,
      allocationImpact: `Life Support (${allocation.lifeSupport} Power) recycles +${(allocation.lifeSupport * 6.5).toFixed(1)}%. Greenhouse (${allocation.greenhouse} Power) adds ${metrics.airWater >= 25 ? `+${(allocation.greenhouse * 2.5).toFixed(1)}% O₂` : 'reduced O₂ (needs 25%+ water)'}.`,
      netProjection: `Projected Sol ${currentScenario.sol} change: ${projected.airWaterDelta >= 0 ? '+' : ''}${projected.airWaterDelta}% (before choice).`,
    },
    power: {
      heading: 'Power Bank · Solar & Weather Impact',
      envImpact: `Today’s solar supply is ${currentScenario.powerBudgetToday} Power Units (${currentScenario.solarModifierText}).${currentScenario.weatherCondition === 'Dust Storm' || currentScenario.weatherCondition === 'Crater Shadow' ? ` ${currentScenario.weatherCondition} adds an extra -8% battery drain!` : ''}`,
      allocationImpact: `Allocated ${projected.totalAllocated} of ${currentScenario.powerBudgetToday} units across modules. Leftover units recharge the battery; overspending drains reserves.`,
      netProjection: `Projected Sol ${currentScenario.sol} change: ${projected.powerBankDelta >= 0 ? '+' : ''}${projected.powerBankDelta}% (before choice).`,
    },
    rad: {
      heading: 'Shielding · Space Weather Radiation',
      envImpact: `Incoming radiation today is ${currentScenario.incomingRadiationMsv.toFixed(1)} mSv/day (${siteProfile.baselineRadiationMsvPerDay} mSv site baseline under ${currentScenario.weatherCondition}: "${currentScenario.title}").`,
      allocationImpact: `Water-Wall Shielding (${allocation.shielding} Power) blocks ${Math.min(88, allocation.shielding * 22)}% of incoming radiation (${projected.radiationMsvBlocked.toFixed(1)} mSv blocked today).`,
      netProjection: `Projected Sol ${currentScenario.sol} dose: +${projected.radiationMsvAdded.toFixed(1)} mSv (${radSafetyMarginPct}% safety margin left).`,
    },
    science: {
      heading: 'Greenhouse & Lab · Environment Impact',
      envImpact: `${site === 'mars' && allocation.scienceComms === 1 ? 'Mars speed-of-light comms delay reduces 1-Power Lab output by 30%. ' : ''}Crops grow at ${metrics.airWater >= 35 ? 'full speed' : '50% speed (Air & Water under 35%)'} under ${currentScenario.weatherCondition}.`,
      allocationImpact: `Greenhouse (${allocation.greenhouse} Power) & Science Dish (${allocation.scienceComms} Power) drive harvest & research toward the 75% goal.`,
      netProjection: `Projected Sol ${currentScenario.sol} gain: +${projected.scienceFoodDelta}% (before choice).`,
    },
  };

  const advisorAdvice: {
    tag: string;
    tone: 'urgent' | 'warn' | 'tip';
    sentence: string;
  } = (() => {
    if (metrics.powerBank < 25 || projected.powerBankDelta <= -10) {
      return allocation.scienceComms >= 2 || remainingPower === 0
        ? {
            tag: 'Power Saver',
            tone: 'urgent',
            sentence:
              'Trimming 1 unit from Science or cabin heaters leaves spare power to recharge +7% battery.',
          }
        : {
            tag: 'Battery Recovery',
            tone: 'urgent',
            sentence:
              'Dimming extra grow lights and leaving 1–2 power units unspent restores up to +14% battery today.',
          };
    }

    if (currentScenario.incomingRadiationMsv >= 4 && allocation.shielding < 3) {
      return {
        tag: 'Storm Shielding',
        tone: 'urgent',
        sentence:
          'Routing 3 power units to Water-Wall Shielding blocks 66% of today’s solar flare without draining oxygen.',
      };
    }

    if (metrics.airWater < 35) {
      return metrics.airWater < 25
        ? {
            tag: 'Air & Water',
            tone: 'urgent',
            sentence:
              'Boosting Life Support to 3 units lifts Air & Water past 25% so greenhouse oxygen doubles.',
          }
        : {
            tag: 'Life Support',
            tone: 'warn',
            sentence:
              'Adding 1 unit to Life Support recycles +6.5% Air & Water and keeps crops above the 35% slowdown.',
          };
    }

    if (metrics.cumulativeMsv >= 22 && allocation.shielding < 3) {
      return {
        tag: 'Radiation Margin',
        tone: 'warn',
        sentence:
          'Shifting 1 unit into Water-Wall Shielding cuts incoming crew radiation by 22% every Sol.',
      };
    }

    if (
      (currentScenario.weatherCondition === 'Dust Storm' ||
        currentScenario.weatherCondition === 'Crater Shadow') &&
      metrics.powerBank < 70
    ) {
      return {
        tag: 'Weather Drain',
        tone: 'warn',
        sentence:
          'Dust and shadows drain -8% battery today—each unspent power unit offsets it by +7%.',
      };
    }

    if (site === 'mars' && allocation.scienceComms === 1) {
      return {
        tag: 'Comms Efficiency',
        tone: 'tip',
        sentence:
          'Bumping Science Lab from 1 to 2 units removes Mars’s 30% radio-delay penalty for faster research.',
      };
    }

    if (metrics.powerBank >= 90 && remainingPower >= 2) {
      return {
        tag: 'Power Synergy',
        tone: 'tip',
        sentence: `Your battery is nearly full—put those ${remainingPower} spare power units into Crops or Lab instead of capping out.`,
      };
    }

    if (currentScenario.incomingRadiationMsv <= 1.8 && allocation.shielding >= 3) {
      return {
        tag: 'Calm Sky Shift',
        tone: 'tip',
        sentence:
          'Radiation is calm today, so moving 1 Shielding unit to Greenhouse or Lab boosts food and science safely.',
      };
    }

    if (metrics.airWater >= 88 && projected.airWaterDelta > 4 && allocation.lifeSupport >= 3) {
      return {
        tag: 'Tank Balance',
        tone: 'tip',
        sentence:
          'Air & Water tanks are nearly full—lowering Life Support by 1 unit frees energy for Science & Food.',
      };
    }

    if (metrics.scienceFood < 55 && currentScenario.sol >= 5) {
      return {
        tag: 'Goal Sprint',
        tone: 'tip',
        sentence:
          'Pairing 3 Greenhouse units with 2+ Lab units pushes Science & Food quickly toward your 75% target.',
      };
    }

    return {
      tag: 'Closed-Loop Tip',
      tone: 'tip',
      sentence:
        'Running Greenhouse alongside Life Support gives +2.5% bonus oxygen per crop unit, feeding two systems at once.',
    };
  })();

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569]">
          <span className="font-semibold text-[#0F172A]">{siteProfile.name}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono font-semibold text-[#2563EB]">
            Sol {currentScenario.sol} of {MAX_SOLS}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {site === 'moon'
              ? siteProfile.commsDisplay
              : `Today: ${marsLiveComms.roundTripFormatted} Mars lag`}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {donkiFeed.sourceMode === 'live' ? 'Live NASA DONKI linked' : 'Archived NASA DONKI dataset'}
          </span>
          {featuredStorm && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#B45309]">
                Storm Scenario: {featuredStorm.classOrSpeed}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSound}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#DCE3EE] rounded-lg text-xs font-medium text-[#334155] hover:bg-[#F8FAFC] cursor-pointer whitespace-nowrap"
          >
            {muted ? (
              <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {muted ? 'Sound Off' : 'Sound On'}
          </button>
          <button
            type="button"
            onClick={() => setPhase('TITLE_MENU')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#DCE3EE] rounded-lg text-xs font-medium text-[#334155] hover:bg-[#F8FAFC] cursor-pointer whitespace-nowrap"
          >
            Switch Outpost
          </button>
        </div>
      </div>

      {/* Visual Sol Mission Progress Bar */}
      <div className="bg-white border border-[#DCE3EE] rounded-xl px-5 py-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2.5">
            <span className="text-sm font-bold text-[#0F172A]">
              Mission Day: <span className="font-mono text-[#2563EB]">Sol {currentScenario.sol}</span> of {MAX_SOLS}
            </span>
            <span className="text-xs text-[#64748B]">
              · {currentScenario.title}
            </span>
          </div>
          <div className="text-xs font-mono font-semibold text-[#334155]">
            {logs.length} / {MAX_SOLS} Cycles Simulated ({Math.round((logs.length / MAX_SOLS) * 100)}%)
          </div>
        </div>

        <div
          className="relative h-3 bg-[#E2E8F0] rounded-full overflow-hidden"
          role="progressbar"
          aria-label="Mission Sol cycle progress"
          aria-valuenow={logs.length}
          aria-valuemin={0}
          aria-valuemax={MAX_SOLS}
        >
          <div
            className="h-full bg-[#2563EB] transition-transform duration-200 origin-left"
            style={{ transform: `scaleX(${Math.max(0.03, logs.length / MAX_SOLS)})` }}
          />
        </div>

        <div className="grid grid-cols-8 gap-1.5 text-center">
          {Array.from({ length: MAX_SOLS }).map((_, idx) => {
            const solNum = idx + 1;
            const isDone = idx < logs.length;
            const isCurrent = solNum === currentScenario.sol && phase === 'PLAYING';
            return (
              <div
                key={solNum}
                className={`text-[11px] font-mono py-0.5 rounded ${
                  isDone
                    ? 'font-bold text-[#059669] bg-[#ECFDF5]'
                    : isCurrent
                      ? 'font-bold text-[#2563EB] bg-[#EFF6FF]'
                      : 'text-[#64748B]'
                }`}
              >
                Sol {solNum}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4-Metric Survival & Goal HUD + Side Mission Advisor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-8 xl:col-span-9 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          <div
            onMouseEnter={() => setHoveredMeter('air')}
            onMouseLeave={() => setHoveredMeter(null)}
            className={`relative rounded-xl p-4 border transition-colors ${
              isAirUrgent
                ? 'bg-[#FEF2F2] border-[#DC2626] ring-2 ring-[#DC2626]/30 animate-critical-card'
                : 'bg-white border-[#DCE3EE]'
            }`}
          >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#475569] flex items-center gap-1.5">
              <Wind
                className={`w-3.5 h-3.5 ${isAirUrgent ? 'text-[#DC2626]' : 'text-[#0284C7]'}`}
                aria-hidden="true"
              />
              Air &amp; Water
              <button
                type="button"
                aria-label="Explain how Life Support Air and Water is affected"
                aria-expanded={activeMeterTooltip === 'air'}
                aria-describedby={activeMeterTooltip === 'air' ? 'tooltip-air' : undefined}
                onFocus={() => setHoveredMeter('air')}
                onBlur={() => setHoveredMeter(null)}
                onClick={() => toggleMeterPin('air')}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setPinnedMeter(null);
                    setHoveredMeter(null);
                  }
                }}
                className="p-0.5 rounded text-[#64748B] hover:text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                isAirUrgent ? 'text-[#DC2626]' : airBadge.toneClass
              }`}
            >
              <airBadge.Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {isAirUrgent ? 'Below 20% Urgent' : airBadge.label}
            </span>
          </div>
          <p
            className={`text-2xl font-bold font-mono mt-1.5 ${
              isAirUrgent ? 'text-[#DC2626]' : 'text-[#0F172A]'
            }`}
          >
            {metrics.airWater}%
          </p>
          <div className="h-2 bg-[#E2E8F0] rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full transition-transform duration-200 origin-left ${
                isAirUrgent ? 'bg-[#DC2626] animate-critical-bar' : 'bg-[#0284C7]'
              }`}
              style={{ transform: `scaleX(${metrics.airWater / 100})` }}
            />
          </div>
          {activeMeterTooltip === 'air' && (
            <div
              id="tooltip-air"
              role="tooltip"
              className="absolute left-0 min-w-[240px] sm:min-w-0 sm:right-0 top-full mt-2 z-30 bg-[#0F172A] text-white rounded-xl p-3.5 shadow-lg border border-[#334155] text-xs space-y-1.5"
            >
              <p className="font-semibold text-[#93C5FD]">{meterTooltips.air.heading}</p>
              <p className="text-[#E2E8F0] leading-relaxed">{meterTooltips.air.envImpact}</p>
              <p className="text-[#CBD5E1] leading-relaxed">{meterTooltips.air.allocationImpact}</p>
              <p className="font-mono text-[11px] text-[#34D399] pt-0.5">
                {meterTooltips.air.netProjection}
              </p>
            </div>
          )}
        </div>

        <div
          onMouseEnter={() => setHoveredMeter('power')}
          onMouseLeave={() => setHoveredMeter(null)}
          className={`relative rounded-xl p-4 border transition-colors ${
            isPowerUrgent
              ? 'bg-[#FEF2F2] border-[#DC2626] ring-2 ring-[#DC2626]/30 animate-critical-card'
              : 'bg-white border-[#DCE3EE]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#475569] flex items-center gap-1.5">
              <Zap
                className={`w-3.5 h-3.5 ${isPowerUrgent ? 'text-[#DC2626]' : 'text-[#D97706]'}`}
                aria-hidden="true"
              />
              Power Bank
              <button
                type="button"
                aria-label="Explain how Power Bank is affected"
                aria-expanded={activeMeterTooltip === 'power'}
                aria-describedby={activeMeterTooltip === 'power' ? 'tooltip-power' : undefined}
                onFocus={() => setHoveredMeter('power')}
                onBlur={() => setHoveredMeter(null)}
                onClick={() => toggleMeterPin('power')}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setPinnedMeter(null);
                    setHoveredMeter(null);
                  }
                }}
                className="p-0.5 rounded text-[#64748B] hover:text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                isPowerUrgent ? 'text-[#DC2626]' : powerBadge.toneClass
              }`}
            >
              <powerBadge.Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {isPowerUrgent ? 'Below 20% Urgent' : powerBadge.label}
            </span>
          </div>
          <p
            className={`text-2xl font-bold font-mono mt-1.5 ${
              isPowerUrgent ? 'text-[#DC2626]' : 'text-[#0F172A]'
            }`}
          >
            {metrics.powerBank}%
          </p>
          <div className="h-2 bg-[#E2E8F0] rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full transition-transform duration-200 origin-left ${
                isPowerUrgent ? 'bg-[#DC2626] animate-critical-bar' : 'bg-[#D97706]'
              }`}
              style={{ transform: `scaleX(${metrics.powerBank / 100})` }}
            />
          </div>
          {activeMeterTooltip === 'power' && (
            <div
              id="tooltip-power"
              role="tooltip"
              className="absolute right-0 min-w-[240px] sm:min-w-0 sm:left-0 top-full mt-2 z-30 bg-[#0F172A] text-white rounded-xl p-3.5 shadow-lg border border-[#334155] text-xs space-y-1.5"
            >
              <p className="font-semibold text-[#FCD34D]">{meterTooltips.power.heading}</p>
              <p className="text-[#E2E8F0] leading-relaxed">{meterTooltips.power.envImpact}</p>
              <p className="text-[#CBD5E1] leading-relaxed">{meterTooltips.power.allocationImpact}</p>
              <p className="font-mono text-[11px] text-[#34D399] pt-0.5">
                {meterTooltips.power.netProjection}
              </p>
            </div>
          )}
        </div>

        <div
          onMouseEnter={() => setHoveredMeter('rad')}
          onMouseLeave={() => setHoveredMeter(null)}
          className={`relative rounded-xl p-4 border transition-colors ${
            isRadUrgent
              ? 'bg-[#FEF2F2] border-[#DC2626] ring-2 ring-[#DC2626]/30 animate-critical-card'
              : 'bg-white border-[#DCE3EE]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#475569] flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#DC2626]" aria-hidden="true" />
              Radiation Dose
              <button
                type="button"
                aria-label="Explain how Radiation Shielding is affected"
                aria-expanded={activeMeterTooltip === 'rad'}
                aria-describedby={activeMeterTooltip === 'rad' ? 'tooltip-rad' : undefined}
                onFocus={() => setHoveredMeter('rad')}
                onBlur={() => setHoveredMeter(null)}
                onClick={() => toggleMeterPin('rad')}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setPinnedMeter(null);
                    setHoveredMeter(null);
                  }
                }}
                className="p-0.5 rounded text-[#64748B] hover:text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </span>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${radBadge.toneClass}`}>
              <radBadge.Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {isRadUrgent ? 'Under 20% Margin' : radBadge.label}
            </span>
          </div>
          <p
            className={`text-2xl font-bold font-mono mt-1.5 ${
              isRadUrgent ? 'text-[#DC2626]' : 'text-[#0F172A]'
            }`}
          >
            {metrics.cumulativeMsv.toFixed(1)}{' '}
            <span className="text-xs font-normal text-[#64748B]">/ {MAX_SAFE_MSV} mSv</span>
          </p>
          <div className="h-2 bg-[#E2E8F0] rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full bg-[#DC2626] transition-transform duration-200 origin-left ${
                isRadUrgent ? 'animate-critical-bar' : ''
              }`}
              style={{ transform: `scaleX(${Math.min(1, metrics.cumulativeMsv / MAX_SAFE_MSV)})` }}
            />
          </div>
          {activeMeterTooltip === 'rad' && (
            <div
              id="tooltip-rad"
              role="tooltip"
              className="absolute left-0 min-w-[240px] sm:min-w-0 sm:right-0 top-full mt-2 z-30 bg-[#0F172A] text-white rounded-xl p-3.5 shadow-lg border border-[#334155] text-xs space-y-1.5"
            >
              <p className="font-semibold text-[#FCA5A5]">{meterTooltips.rad.heading}</p>
              <p className="text-[#E2E8F0] leading-relaxed">{meterTooltips.rad.envImpact}</p>
              <p className="text-[#CBD5E1] leading-relaxed">{meterTooltips.rad.allocationImpact}</p>
              <p className="font-mono text-[11px] text-[#34D399] pt-0.5">
                {meterTooltips.rad.netProjection}
              </p>
            </div>
          )}
        </div>

        <div
          onMouseEnter={() => setHoveredMeter('science')}
          onMouseLeave={() => setHoveredMeter(null)}
          className="relative bg-white border border-[#DCE3EE] rounded-xl p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#475569] flex items-center gap-1.5">
              <Sprout className="w-3.5 h-3.5 text-[#059669]" aria-hidden="true" />
              Science &amp; Food
              <button
                type="button"
                aria-label="Explain how Science and Food crops are affected"
                aria-expanded={activeMeterTooltip === 'science'}
                aria-describedby={activeMeterTooltip === 'science' ? 'tooltip-science' : undefined}
                onFocus={() => setHoveredMeter('science')}
                onBlur={() => setHoveredMeter(null)}
                onClick={() => toggleMeterPin('science')}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setPinnedMeter(null);
                    setHoveredMeter(null);
                  }
                }}
                className="p-0.5 rounded text-[#64748B] hover:text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </span>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${sciBadge.toneClass}`}>
              <sciBadge.Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {sciBadge.label}
            </span>
          </div>
          <p className="text-2xl font-bold font-mono text-[#0F172A] mt-1.5">{metrics.scienceFood}%</p>
          <div className="h-2 bg-[#E2E8F0] rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-[#059669] transition-transform duration-200 origin-left"
              style={{ transform: `scaleX(${metrics.scienceFood / 100})` }}
            />
          </div>
          {activeMeterTooltip === 'science' && (
            <div
              id="tooltip-science"
              role="tooltip"
              className="absolute right-0 min-w-[240px] sm:min-w-0 sm:left-0 top-full mt-2 z-30 bg-[#0F172A] text-white rounded-xl p-3.5 shadow-lg border border-[#334155] text-xs space-y-1.5"
            >
              <p className="font-semibold text-[#6EE7B7]">{meterTooltips.science.heading}</p>
              <p className="text-[#E2E8F0] leading-relaxed">{meterTooltips.science.envImpact}</p>
              <p className="text-[#CBD5E1] leading-relaxed">
                {meterTooltips.science.allocationImpact}
              </p>
              <p className="font-mono text-[11px] text-[#34D399] pt-0.5">
                {meterTooltips.science.netProjection}
              </p>
            </div>
          )}
          </div>
        </div>

        {/* Context-Aware Mission Advisor Box beside the resource meters */}
        <aside
          aria-label="Mission Advisor"
          className={`lg:col-span-4 xl:col-span-3 rounded-xl p-4 border flex flex-col justify-between gap-2 ${
            advisorAdvice.tone === 'urgent'
              ? 'bg-[#FEF2F2] border-[#FECACA]'
              : advisorAdvice.tone === 'warn'
                ? 'bg-[#FFFBEB] border-[#FDE68A]'
                : 'bg-[#EFF6FF] border-[#BFDBFE]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                advisorAdvice.tone === 'urgent'
                  ? 'text-[#B91C1C]'
                  : advisorAdvice.tone === 'warn'
                    ? 'text-[#B45309]'
                    : 'text-[#1D4ED8]'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Mission Advisor
            </span>
            <span
              className={`text-[11px] font-semibold ${
                advisorAdvice.tone === 'urgent'
                  ? 'text-[#DC2626]'
                  : advisorAdvice.tone === 'warn'
                    ? 'text-[#D97706]'
                    : 'text-[#2563EB]'
              }`}
            >
              {advisorAdvice.tag}
            </span>
          </div>
          <p className="text-xs text-[#0F172A] leading-relaxed font-medium">
            {advisorAdvice.sentence}
          </p>
        </aside>
      </div>

      {/* 3-Sol Resource Forecast Panel */}
      <ForecastPanel
        site={site}
        metrics={metrics}
        allocation={allocation}
        scenarios={scenarios}
        solIndex={solIndex}
        currentScenario={currentScenario}
      />

      {/* Main 2-Zone Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          <OutpostHabitatStage
            site={site}
            allocation={allocation}
            scenario={currentScenario}
            airWater={metrics.airWater}
            powerBank={metrics.powerBank}
            cumulativeMsv={metrics.cumulativeMsv}
            remainingPower={remainingPower}
            onAdjustPower={phase === 'PLAYING' ? updatePower : undefined}
          />

          <ResourceTrendChart
            logs={logs}
            metrics={metrics}
            currentSol={currentScenario.sol}
          />

          {/* Organized Outpost Tools Tabs to keep Mission Control clean & scannable */}
          <div className="space-y-3">
            <div
              role="tablist"
              aria-label="Outpost telemetry tools"
              className="flex flex-wrap items-center gap-1.5 p-1 bg-white border border-[#DCE3EE] rounded-xl"
            >
              {(
                [
                  { id: 'log', label: `Mission Log (${missionEvents.length})` },
                  { id: 'progress', label: 'Sol Stepper' },
                  { id: 'comms', label: 'Radio Delay' },
                  { id: 'badges', label: 'Achievements' },
                ] as const
              ).map((tab) => {
                const isActive = activeToolTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveToolTab(tab.id)}
                    className={`flex-1 min-w-[110px] px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#0F172A] text-white'
                        : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeToolTab === 'log' && <MissionLog events={missionEvents} />}
            {activeToolTab === 'progress' && (
              <MissionProgressPanel
                currentSol={currentScenario.sol}
                scenarios={scenarios}
                logs={logs}
                metrics={metrics}
                showChart={false}
              />
            )}
            {activeToolTab === 'comms' && (
              <CommsDelayWidget site={site} liveHorizons={liveHorizons} />
            )}
            {activeToolTab === 'badges' && (
              <MissionAchievementsPanel
                unlockedBadgeIds={record.badges}
                liveAudit={stabilityAudit}
                compact={false}
              />
            )}
          </div>
        </div>

        <div className="lg:col-span-5">
          {phase === 'ROUND_SUMMARY' && lastRoundFeedback ? (
            <div className="bg-white border border-[#DCE3EE] rounded-xl p-5 space-y-5">
              <div>
                <p className="text-xs font-semibold text-[#059669]">
                  Sol {lastRoundFeedback.sol} Complete
                </p>
                <h2 className="text-xl font-bold text-[#0F172A] mt-0.5">
                  Engineering Outcome Report
                </h2>
                <p className="text-xs text-[#475569] mt-1">
                  Decision made:{' '}
                  <strong className="text-[#0F172A]">{lastRoundFeedback.option.label}</strong>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3.5 text-xs">
                <div>
                  <span className="text-[#64748B]">Air &amp; Water Change</span>
                  <p
                    className={`text-base font-bold font-mono mt-0.5 ${
                      lastRoundFeedback.airDelta >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'
                    }`}
                  >
                    {lastRoundFeedback.airDelta >= 0 ? '+' : ''}
                    {lastRoundFeedback.airDelta}%
                  </p>
                </div>
                <div>
                  <span className="text-[#64748B]">Power Bank Change</span>
                  <p
                    className={`text-base font-bold font-mono mt-0.5 ${
                      lastRoundFeedback.powerDelta >= 0 ? 'text-[#059669]' : 'text-[#D97706]'
                    }`}
                  >
                    {lastRoundFeedback.powerDelta >= 0 ? '+' : ''}
                    {lastRoundFeedback.powerDelta}%
                  </p>
                </div>
                <div>
                  <span className="text-[#64748B]">Radiation Absorbed</span>
                  <p className="text-base font-bold font-mono text-[#0F172A] mt-0.5">
                    +{lastRoundFeedback.msvAdded.toFixed(1)} mSv
                  </p>
                  <p className="text-[11px] text-[#059669] font-medium">
                    Blocked {lastRoundFeedback.msvBlocked.toFixed(1)} mSv with shield
                  </p>
                </div>
                <div>
                  <span className="text-[#64748B]">Science &amp; Food Added</span>
                  <p className="text-base font-bold font-mono text-[#2563EB] mt-0.5">
                    +{lastRoundFeedback.scienceDelta}%
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-[#F8FAFC] border border-[#DCE3EE] rounded-lg text-xs text-[#334155] leading-relaxed">
                <p className="font-semibold text-[#0F172A] mb-0.5">Real-World Radiation Comparison</p>
                <p>
                  Today’s {lastRoundFeedback.msvAdded.toFixed(1)} mSv dose equals:{' '}
                  <strong className="text-[#0F172A]">
                    {explainRadiationInRealLife(lastRoundFeedback.msvAdded)}
                  </strong>
                </p>
              </div>

              <div className="p-3.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg text-xs text-[#1E3A8A] leading-relaxed">
                <p className="font-semibold mb-1">Why This Happened (NASA Science Note)</p>
                <p>{lastRoundFeedback.option.scienceFact}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                {rewindSnapshot && (
                  <button
                    type="button"
                    onClick={handleRewindOneSol}
                    className="py-3 px-4 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Rewind Sol {lastRoundFeedback.sol}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNextSol}
                  className="flex-1 py-3 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  Continue to Sol {currentScenario.sol + 1}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : (
            (() => {
              const recommendedPreset: {
                id: 'balanced' | 'storm' | 'harvest' | 'battery';
                label: string;
                tip: string;
              } =
                currentScenario.incomingRadiationMsv >= 4
                  ? {
                      id: 'storm',
                      label: 'Storm Shield',
                      tip: 'High solar radiation today! Use Storm Shield (3–4P) to block particles.',
                    }
                  : metrics.powerBank < 40
                    ? {
                        id: 'battery',
                        label: 'Save Battery',
                        tip: 'Battery is running low—leave unspent power units today to recharge!',
                      }
                    : metrics.airWater < 45
                      ? {
                          id: 'balanced',
                          label: 'Balanced',
                          tip: 'Air & Water is dipping—keep Life Support at 3+ units to recover.',
                        }
                      : {
                          id: 'harvest',
                          label: 'Crops & Lab',
                          tip: 'Conditions look steady—great Sol to push Science & Food toward 75%!',
                        };

              const combinedAir = clamp(
                metrics.airWater +
                  projected.airWaterDelta +
                  (selectedOption?.effects.airWaterDelta ?? 0),
                0,
                100
              );
              const combinedPower = clamp(
                metrics.powerBank +
                  projected.powerBankDelta +
                  (selectedOption?.effects.powerBankDelta ?? 0),
                0,
                100
              );
              const combinedMsvDelta = selectedOption
                ? Math.max(
                    0.2,
                    Number(
                      (
                        projected.radiationMsvAdded + selectedOption.effects.radiationMsvDelta
                      ).toFixed(1)
                    )
                  )
                : projected.radiationMsvAdded;
              const combinedMsv = Number((metrics.cumulativeMsv + combinedMsvDelta).toFixed(1));
              const combinedScience = clamp(
                metrics.scienceFood +
                  projected.scienceFoodDelta +
                  (selectedOption?.effects.scienceFoodDelta ?? 0),
                0,
                100
              );
              const previewDanger =
                combinedAir < 20 || combinedPower < 20 || combinedMsv >= MAX_SAFE_MSV;

              return (
                <div className="bg-white border border-[#DCE3EE] rounded-xl p-5 space-y-5">
                  {/* Clear 2-Step Checklist + Contextual Advisor Tip */}
                  <div className="p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold">
                      <span className="inline-flex items-center gap-1 text-[#059669]">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        Step 1: Power Split Ready
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 ${
                          selectedOption ? 'text-[#059669]' : 'text-[#2563EB]'
                        }`}
                      >
                        {selectedOption ? (
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        Step 2: {selectedOption ? 'Option Selected' : 'Pick a Sol Choice Below'}
                      </span>
                    </div>
                    <p className="text-xs text-[#1E3A8A] leading-relaxed">
                      <strong>Advisor Tip:</strong> {recommendedPreset.tip}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-base font-bold text-[#0F172A]">
                        1. Split Today’s Power Budget
                      </h2>
                      <span
                        className={`text-xs font-mono font-bold ${
                          overBudget ? 'text-[#DC2626]' : 'text-[#2563EB]'
                        }`}
                      >
                        {projected.totalAllocated} / {currentScenario.powerBudgetToday} Units
                      </span>
                    </div>
                    <p className="text-xs text-[#475569] mt-0.5">
                      {currentScenario.solarModifierText}
                      {remainingPower > 0
                        ? ` · ${remainingPower} unspent unit${remainingPower > 1 ? 's' : ''} recharge batteries.`
                        : ''}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-[#64748B] mr-0.5">
                        Quick Set:
                      </span>
                      {(
                        [
                          { id: 'balanced', label: 'Balanced' },
                          { id: 'storm', label: 'Storm Shield' },
                          { id: 'harvest', label: 'Crops & Lab' },
                          { id: 'battery', label: 'Save Battery' },
                        ] as const
                      ).map((p) => {
                        const isSuggested = p.id === recommendedPreset.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => applyPowerPreset(p.id)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                              isSuggested
                                ? 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]'
                                : 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155]'
                            }`}
                          >
                            {isSuggested ? `Suggested: ${p.label}` : p.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 space-y-2.5">
                      {(
                        [
                          {
                            key: 'lifeSupport',
                            label: 'Life Support (Air & Water)',
                            hint: 'Need ~2–3 units to break even',
                          },
                          {
                            key: 'shielding',
                            label: 'Radiation Shield Wall',
                            hint: `Blocks ${Math.min(88, allocation.shielding * 22)}% of ${currentScenario.incomingRadiationMsv} mSv`,
                          },
                          {
                            key: 'greenhouse',
                            label: 'Hydroponic Greenhouse',
                            hint: 'Grows food + makes bonus O₂',
                          },
                          {
                            key: 'scienceComms',
                            label: 'Science Lab & Radio',
                            hint: 'Uploads NASA research data',
                          },
                        ] as const
                      ).map((row) => (
                        <div
                          key={row.key}
                          className="flex items-center justify-between gap-2.5 p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#0F172A] truncate">
                              {row.label}
                            </p>
                            <p className="text-[11px] text-[#64748B] truncate">{row.hint}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              aria-label={`Decrease ${row.label} power`}
                              onClick={() => updatePower(row.key, -1)}
                              disabled={allocation[row.key] <= 0}
                              className="w-7 h-8 rounded-md border border-[#DCE3EE] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3 h-3 text-[#0F172A]" />
                            </button>
                            {[1, 2, 3, 4].map((lvl) => {
                              const filled = allocation[row.key] >= lvl;
                              const exceedsBudget =
                                !filled &&
                                projected.totalAllocated - allocation[row.key] + lvl >
                                  currentScenario.powerBudgetToday;
                              return (
                                <button
                                  key={lvl}
                                  type="button"
                                  aria-label={`Set ${row.label} to ${lvl} power`}
                                  onClick={() => setPowerLevel(row.key, lvl)}
                                  disabled={exceedsBudget}
                                  className={`w-6 h-8 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer disabled:opacity-35 ${
                                    filled
                                      ? 'bg-[#2563EB] text-white'
                                      : 'bg-white border border-[#DCE3EE] text-[#64748B] hover:bg-[#EFF6FF]'
                                  }`}
                                >
                                  {lvl}
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              aria-label={`Increase ${row.label} power`}
                              onClick={() => updatePower(row.key, 1)}
                              disabled={
                                allocation[row.key] >= 4 ||
                                projected.totalAllocated >= currentScenario.powerBudgetToday
                              }
                              className="w-7 h-8 rounded-md border border-[#DCE3EE] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3 h-3 text-[#0F172A]" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#E2E8F0]">
                    <p className="text-xs font-medium text-[#2563EB]">
                      2. Sol {currentScenario.sol} Dilemma · {currentScenario.nasaDataLink}
                    </p>
                    <h3 className="text-base font-bold text-[#0F172A] mt-0.5">
                      {currentScenario.title}
                    </h3>
                    <p className="text-xs text-[#334155] mt-1 leading-relaxed">
                      {currentScenario.briefing}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {INLINE_SCIENCE_TERMS.map((term) => {
                        const isOpen = activeTermKey === term.key;
                        return (
                          <button
                            key={term.key}
                            type="button"
                            onClick={() => setActiveTermKey(isOpen ? null : term.key)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                              isOpen
                                ? 'bg-[#2563EB] text-white'
                                : 'bg-[#F1F5F9] text-[#334155] hover:bg-[#E2E8F0]'
                            }`}
                          >
                            <HelpCircle className="w-3 h-3" aria-hidden="true" />
                            {term.label}
                          </button>
                        );
                      })}
                    </div>
                    {activeScienceTerm && (
                      <p className="mt-2 p-2.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg text-xs text-[#1E3A8A] leading-relaxed">
                        {activeScienceTerm.answer}
                      </p>
                    )}

                    <div className="mt-3 space-y-2.5">
                      {currentScenario.options.map((opt) => {
                        const active = selectedOptionId === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              soundFx.playTick(600);
                              setSelectedOptionId(opt.id);
                            }}
                            className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                              active
                                ? 'border-[#2563EB] bg-[#EFF6FF] ring-2 ring-[#2563EB]/20'
                                : 'border-[#DCE3EE] bg-white hover:bg-[#F8FAFC]'
                            }`}
                          >
                            <p className="text-xs font-semibold text-[#0F172A]">{opt.label}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                              <span className="font-semibold text-[#059669]">
                                Gain: {opt.gainSummary}
                              </span>
                              <span className="font-semibold text-[#B45309]">
                                Cost: {opt.costSummary}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Combined End-of-Sol Outcome Preview (Power + Selected Trade-Off) */}
                  <div
                    className={`rounded-lg p-3 border text-[11px] space-y-1.5 ${
                      previewDanger
                        ? 'bg-[#FEF2F2] border-[#FCA5A5]'
                        : 'bg-[#F8FAFC] border-[#DCE3EE]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#0F172A]">
                        {selectedOption
                          ? `After Sol ${currentScenario.sol} (Power + Choice Preview)`
                          : `Power Preview (Select an Option Above)`}
                      </span>
                      {previewDanger && (
                        <span className="font-semibold text-[#DC2626] inline-flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                          Risky Combo
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center pt-1">
                      <div>
                        <span className="text-[#64748B] block">Air/Water</span>
                        <span
                          className={`font-mono font-bold ${
                            combinedAir < 20
                              ? 'text-[#DC2626]'
                              : combinedAir >= metrics.airWater
                                ? 'text-[#059669]'
                                : 'text-[#D97706]'
                          }`}
                        >
                          {combinedAir}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[#64748B] block">Battery</span>
                        <span
                          className={`font-mono font-bold ${
                            combinedPower < 20
                              ? 'text-[#DC2626]'
                              : combinedPower >= metrics.powerBank
                                ? 'text-[#059669]'
                                : 'text-[#D97706]'
                          }`}
                        >
                          {combinedPower}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[#64748B] block">Rad Total</span>
                        <span
                          className={`font-mono font-bold ${
                            combinedMsv >= MAX_SAFE_MSV ? 'text-[#DC2626]' : 'text-[#0F172A]'
                          }`}
                        >
                          {combinedMsv.toFixed(1)} mSv
                        </span>
                      </div>
                      <div>
                        <span className="text-[#64748B] block">Sci/Food</span>
                        <span className="font-mono font-bold text-[#2563EB]">
                          {combinedScience}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRunSol}
                    disabled={!selectedOption || overBudget}
                    className="w-full py-3 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#CBD5E1] disabled:text-[#64748B] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    <Rocket className="w-4 h-4" aria-hidden="true" />
                    {selectedOption
                      ? `Run Sol ${currentScenario.sol} Plan`
                      : 'Pick One Choice Above to Run Sol'}
                  </button>
                </div>
              );
            })()
          )}
        </div>
      </div>
    </section>
  );
};
