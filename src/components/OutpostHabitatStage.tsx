import React, { useState } from 'react';
import { Shield, Wind, Sprout, Radio, Sun, AlertTriangle, Minus, Plus } from 'lucide-react';
import { OutpostSiteId } from '../data/nasaDatasets';
import { PowerAllocation, SolScenario } from '../data/missionScenarios';

interface OutpostHabitatStageProps {
  site: OutpostSiteId;
  allocation: PowerAllocation;
  scenario: SolScenario;
  airWater: number;
  powerBank: number;
  cumulativeMsv: number;
  remainingPower: number;
  onAdjustPower?: (key: keyof PowerAllocation, delta: number) => void;
}

type SubsystemKey = keyof PowerAllocation;

const SUBSYSTEM_INFO: Record<
  SubsystemKey,
  { title: string; role: string; tradeoff: string; nasaLink: string }
> = {
  lifeSupport: {
    title: 'Life Support Core (Air & Water Recycler)',
    role: 'Scrubs exhaled carbon dioxide out of cabin air and cleans 98% of crew water for reuse.',
    tradeoff: 'Saving power here tonight leaves less oxygen and clean water for tomorrow.',
    nasaLink: 'Grounded in NASA OSDR OSD-511 closed-loop water filtration research.',
  },
  shielding: {
    title: 'Water-Wall & Magnetic Radiation Shield',
    role: 'Surrounds crew quarters with hydrogen-rich water walls and deflector coils during solar storms.',
    tradeoff: 'Maxing shielding blocks up to 88% of flare radiation, but leaves less power for crops and science.',
    nasaLink: 'Grounded in NASA DONKI flare alerts & OSDR OSD-352 radiation studies.',
  },
  greenhouse: {
    title: 'Hydroponic Greenhouse Dome',
    role: 'Uses LED grow-lights and nutrient water to grow fresh lettuce and dwarf wheat while releasing oxygen.',
    tradeoff: 'Requires steady water and light; dimming lights saves battery today but pauses food and O₂ output.',
    nasaLink: 'Grounded in NASA OSDR OSD-120 & OSD-466 plant spaceflight studies.',
  },
  scienceComms: {
    title: 'Science Lab & Deep-Space Radio Dish',
    role: 'Analyzes ice/rock samples and beams mission telemetry back to Earth across the Deep Space Network.',
    tradeoff: 'High-rate transmissions burn power quickly and face real speed-of-light delays on Mars.',
    nasaLink: 'Grounded in NASA Artemis & Mars 2020 Deep Space Network operations.',
  },
};

export const OutpostHabitatStage: React.FC<OutpostHabitatStageProps> = ({
  site,
  allocation,
  scenario,
  airWater,
  powerBank,
  cumulativeMsv,
  remainingPower,
  onAdjustPower,
}) => {
  const [selectedModule, setSelectedModule] = useState<SubsystemKey>('shielding');

  const isMoon = site === 'moon';
  const isFlare = scenario.weatherCondition === 'Solar Flare';
  const isDust = scenario.weatherCondition === 'Dust Storm';
  const isShadow = scenario.weatherCondition === 'Crater Shadow';

  const shieldOpacity = 0.2 + allocation.shielding * 0.19;
  const shieldStrokeWidth = 1.5 + allocation.shielding * 1.4;
  const cropScale = 0.55 + allocation.greenhouse * 0.14;
  const airBubbleCount = allocation.lifeSupport;
  const dishActive = allocation.scienceComms > 0;

  const skyGradientId = isMoon ? 'moonSkyGrad' : 'marsSkyGrad';
  const groundColor = isMoon ? '#475569' : '#9A3412';
  const groundHighlight = isMoon ? '#64748B' : '#C2410C';

  const activeInfo = SUBSYSTEM_INFO[selectedModule];

  return (
    <div className="bg-white border border-[#DCE3EE] rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#DCE3EE] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[#0F172A]">Outpost Cutaway Stage</h3>
          <p className="text-xs text-[#475569]">
            Click any module inside the habitat to inspect or tune its power level
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-[#334155]">
          {isFlare ? (
            <span className="inline-flex items-center gap-1.5 text-[#B45309] font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
              Solar Flare Active ({scenario.incomingRadiationMsv} mSv/day)
            </span>
          ) : isDust ? (
            <span className="inline-flex items-center gap-1.5 text-[#B45309] font-semibold">
              <Sun className="w-3.5 h-3.5" aria-hidden="true" />
              Dust Storm Dimming Solar Panels
            </span>
          ) : isShadow ? (
            <span className="inline-flex items-center gap-1.5 text-[#1D4ED8] font-semibold">
              <Sun className="w-3.5 h-3.5" aria-hidden="true" />
              Crater Ridge Shadow (-3 Power)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[#047857] font-semibold">
              <Sun className="w-3.5 h-3.5" aria-hidden="true" />
              Clear Space Weather ({scenario.incomingRadiationMsv} mSv/day)
            </span>
          )}
        </div>
      </div>

      {/* Interactive SVG Habitat Cutaway */}
      <div className="relative bg-[#0B1220] select-none">
        <svg
          viewBox="0 0 800 350"
          className="w-full h-auto block"
          role="img"
          aria-label={`Interactive cutaway diagram of the ${isMoon ? 'Lunar' : 'Martian'} outpost showing Life Support, Radiation Shield, Greenhouse, and Radio Dish`}
        >
          <defs>
            <linearGradient id="moonSkyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#050814" />
              <stop offset="100%" stopColor="#131D36" />
            </linearGradient>
            <linearGradient id="marsSkyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isDust ? '#451A03' : '#2C1810'} />
              <stop offset="65%" stopColor="#7C2D12" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
            <linearGradient id="flareWave" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
            </linearGradient>
          </defs>

          <rect x="0" y="0" width="800" height="260" fill={`url(#${skyGradientId})`} />

          {isMoon ? (
            <g>
              <circle cx="90" cy="48" r="1.4" fill="#E2E8F0" opacity="0.8" />
              <circle cx="185" cy="30" r="1" fill="#E2E8F0" opacity="0.6" />
              <circle cx="310" cy="65" r="1.3" fill="#E2E8F0" opacity="0.7" />
              <circle cx="490" cy="38" r="1.1" fill="#E2E8F0" opacity="0.8" />
              <circle cx="670" cy="54" r="1.4" fill="#E2E8F0" opacity="0.65" />
              <circle cx="745" cy="90" r="1" fill="#E2E8F0" opacity="0.7" />
              <circle cx="115" cy="72" r="20" fill="#1D4ED8" />
              <path d="M105 64 Q115 58 124 68 Q119 78 109 75 Z" fill="#10B981" opacity="0.9" />
              <circle cx="115" cy="72" r="20" fill="none" stroke="#93C5FD" strokeWidth="1" opacity="0.6" />
            </g>
          ) : (
            <g>
              <circle cx="120" cy="68" r={isDust ? 11 : 14} fill="#FEF3C7" opacity={isDust ? 0.45 : 0.85} />
              <circle cx="120" cy="68" r="26" fill="#FDE68A" opacity={isDust ? 0.1 : 0.2} />
            </g>
          )}

          {isFlare && (
            <g>
              <path d="M0 0 L420 120 L380 180 L0 60 Z" fill="url(#flareWave)" />
              <line x1="25" y1="15" x2="290" y2="120" stroke="#FBBF24" strokeWidth="2" strokeDasharray="8 6">
                <animate attributeName="stroke-dashoffset" from="28" to="0" dur="1.4s" repeatCount="indefinite" />
              </line>
              <line x1="65" y1="5" x2="360" y2="115" stroke="#F87171" strokeWidth="2" strokeDasharray="6 6">
                <animate attributeName="stroke-dashoffset" from="24" to="0" dur="1.1s" repeatCount="indefinite" />
              </line>
              <text x="24" y="34" fill="#FDE68A" fontSize="12" fontWeight="600" fontFamily="Plus Jakarta Sans">
                SOLAR FLARE PARTICLES
              </text>
            </g>
          )}

          {isDust && (
            <g opacity="0.35">
              <rect x="0" y="90" width="800" height="170" fill="#D97706" />
              <line x1="40" y1="140" x2="260" y2="140" stroke="#FDE68A" strokeWidth="2" strokeDasharray="12 10" />
              <line x1="350" y1="115" x2="620" y2="115" stroke="#FDE68A" strokeWidth="2" strokeDasharray="16 12" />
            </g>
          )}

          {isShadow && <polygon points="0,120 800,190 800,260 0,260" fill="#020617" opacity="0.55" />}

          <path d="M0 245 Q130 225 260 242 T520 238 T800 246 L800 350 L0 350 Z" fill={groundColor} />
          <path d="M0 262 Q200 250 410 264 T800 258 L800 350 L0 350 Z" fill={groundHighlight} opacity="0.4" />

          {/* Protective Radiation Shield Arc */}
          <path
            d="M175 258 A 225 165 0 0 1 625 258"
            fill="none"
            stroke={allocation.shielding > 0 ? '#38BDF8' : '#64748B'}
            strokeWidth={shieldStrokeWidth}
            strokeDasharray={allocation.shielding >= 3 ? 'none' : '8 6'}
            opacity={shieldOpacity}
          />
          {allocation.shielding >= 2 && (
            <path d="M190 258 A 210 150 0 0 1 610 258" fill="#38BDF8" opacity={0.04 + allocation.shielding * 0.025} />
          )}

          {/* Solar Array Tower */}
          <g>
            <rect x="76" y="175" width="8" height="82" fill="#94A3B8" />
            <rect
              x="36"
              y="148"
              width="88"
              height="44"
              rx="4"
              fill={isShadow || isDust ? '#1E293B' : '#1D4ED8'}
              stroke="#60A5FA"
              strokeWidth="2"
            />
            <line x1="36" y1="170" x2="124" y2="170" stroke="#93C5FD" strokeWidth="1" />
            <line x1="65" y1="148" x2="65" y2="192" stroke="#93C5FD" strokeWidth="1" />
            <line x1="95" y1="148" x2="95" y2="192" stroke="#93C5FD" strokeWidth="1" />
            <text x="80" y="276" textAnchor="middle" fill="#E2E8F0" fontSize="11" fontWeight="600">
              BATTERY ({powerBank}%)
            </text>
          </g>

          <rect x="290" y="208" width="220" height="32" fill="#CBD5E1" stroke="#475569" strokeWidth="2" />

          {/* MODULE 1: LIFE SUPPORT CORE */}
          <g onClick={() => setSelectedModule('lifeSupport')} className="cursor-pointer">
            <path
              d="M195 256 L195 182 A 65 65 0 0 1 325 182 L325 256 Z"
              fill="#F8FAFC"
              stroke={selectedModule === 'lifeSupport' ? '#2563EB' : '#475569'}
              strokeWidth={selectedModule === 'lifeSupport' ? '3.5' : '2'}
            />
            <rect x="215" y="185" width="90" height="58" rx="6" fill="#0F172A" />
            {Array.from({ length: Math.max(1, airBubbleCount) }).map((_, i) => (
              <circle
                key={i}
                cx={232 + i * 18}
                cy={224 - (i % 2) * 12}
                r={allocation.lifeSupport === 0 ? 3 : 5.5}
                fill={airWater < 35 ? '#F59E0B' : '#38BDF8'}
                opacity={allocation.lifeSupport === 0 ? 0.35 : 0.95}
              >
                {allocation.lifeSupport > 0 && (
                  <animate
                    attributeName="cy"
                    values={`${228 - (i % 2) * 8};${208 - (i % 2) * 8};${228 - (i % 2) * 8}`}
                    dur={`${2.2 + i * 0.4}s`}
                    repeatCount="indefinite"
                  />
                )}
              </circle>
            ))}
            <text x="260" y="202" textAnchor="middle" fill="#E2E8F0" fontSize="11" fontFamily="JetBrains Mono">
              O₂ · {airWater}%
            </text>
            {/* Crew member in Life Support when not sheltering */}
            {!(isFlare || allocation.shielding >= 3) && (
              <g transform="translate(225, 224)">
                <circle cx="8" cy="6" r="4.5" fill="#F8FAFC" stroke="#38BDF8" strokeWidth="1.2" />
                <rect x="4" y="11" width="8" height="9" rx="2" fill="#E2E8F0" />
              </g>
            )}
            <text x="260" y="280" textAnchor="middle" fill="#F8FAFC" fontSize="11.5" fontWeight="700">
              Life Support ({allocation.lifeSupport}P)
            </text>
          </g>

          {/* MODULE 2: RADIATION SHIELD WALL */}
          <g onClick={() => setSelectedModule('shielding')} className="cursor-pointer">
            <rect
              x="348"
              y="175"
              width="104"
              height="81"
              rx="8"
              fill="#E2E8F0"
              stroke={selectedModule === 'shielding' ? '#2563EB' : '#475569'}
              strokeWidth={selectedModule === 'shielding' ? '3.5' : '2'}
            />
            <rect
              x="356"
              y="183"
              width="88"
              height="65"
              rx="4"
              fill="#0F172A"
              stroke="#0EA5E9"
              strokeWidth={1 + allocation.shielding * 1.5}
            />
            <text x="400" y="205" textAnchor="middle" fill="#7DD3FC" fontSize="10.5" fontFamily="JetBrains Mono">
              WATER WALL
            </text>
            <text x="400" y="222" textAnchor="middle" fill="#F8FAFC" fontSize="11.5" fontWeight="700" fontFamily="JetBrains Mono">
              {cumulativeMsv.toFixed(1)} mSv
            </text>
            {/* Both astronauts shelter inside Water Wall during storms or high shield power */}
            {(isFlare || allocation.shielding >= 3) && (
              <g>
                <g transform="translate(376, 226)">
                  <circle cx="8" cy="5" r="4" fill="#F8FAFC" stroke="#38BDF8" strokeWidth="1.2" />
                  <rect x="4" y="10" width="8" height="8" rx="2" fill="#38BDF8" />
                </g>
                <g transform="translate(406, 226)">
                  <circle cx="8" cy="5" r="4" fill="#F8FAFC" stroke="#38BDF8" strokeWidth="1.2" />
                  <rect x="4" y="10" width="8" height="8" rx="2" fill="#38BDF8" />
                </g>
              </g>
            )}
            <text x="400" y="280" textAnchor="middle" fill="#F8FAFC" fontSize="11.5" fontWeight="700">
              Shielding ({allocation.shielding}P)
            </text>
          </g>

          {/* MODULE 3: HYDROPONIC GREENHOUSE */}
          <g onClick={() => setSelectedModule('greenhouse')} className="cursor-pointer">
            <path
              d="M475 256 L475 186 A 65 65 0 0 1 605 186 L605 256 Z"
              fill={allocation.greenhouse > 0 ? '#ECFDF5' : '#1E293B'}
              fillOpacity={allocation.greenhouse > 0 ? 0.92 : 0.9}
              stroke={selectedModule === 'greenhouse' ? '#2563EB' : '#475569'}
              strokeWidth={selectedModule === 'greenhouse' ? '3.5' : '2'}
            />
            <rect
              x="505"
              y="162"
              width="70"
              height="6"
              rx="3"
              fill={allocation.greenhouse > 0 ? '#FDE047' : '#475569'}
            />
            <g transform={`translate(540, 244) scale(${cropScale}) translate(-540, -244)`}>
              <rect x="492" y="232" width="96" height="12" rx="3" fill="#475569" />
              <circle cx="512" cy="222" r="12" fill={allocation.greenhouse > 0 ? '#10B981' : '#64748B'} />
              <circle cx="540" cy="218" r="14" fill={allocation.greenhouse > 0 ? '#059669' : '#64748B'} />
              <circle cx="568" cy="222" r="12" fill={allocation.greenhouse > 0 ? '#10B981' : '#64748B'} />
            </g>
            {/* Crew botanist in Greenhouse when powered & safe */}
            {!(isFlare || allocation.shielding >= 3) && allocation.greenhouse > 0 && (
              <g transform="translate(572, 224)">
                <circle cx="8" cy="6" r="4.5" fill="#0F172A" stroke="#059669" strokeWidth="1.2" />
                <rect x="4" y="11" width="8" height="9" rx="2" fill="#059669" />
              </g>
            )}
            <text x="540" y="280" textAnchor="middle" fill="#F8FAFC" fontSize="11.5" fontWeight="700">
              Greenhouse ({allocation.greenhouse}P)
            </text>
          </g>

          {/* MODULE 4: DEEP-SPACE RADIO DISH */}
          <g onClick={() => setSelectedModule('scienceComms')} className="cursor-pointer">
            <rect
              x="662"
              y="196"
              width="52"
              height="60"
              rx="6"
              fill="#F1F5F9"
              stroke={selectedModule === 'scienceComms' ? '#2563EB' : '#475569'}
              strokeWidth={selectedModule === 'scienceComms' ? '3.5' : '2'}
            />
            <path d="M670 170 Q702 152 722 184 Z" fill="#E2E8F0" stroke="#475569" strokeWidth="2" />
            <line x1="692" y1="168" x2="710" y2="148" stroke="#64748B" strokeWidth="2" />
            {dishActive && (
              <g>
                <path d="M722 138 A 14 14 0 0 1 734 152" fill="none" stroke="#38BDF8" strokeWidth="2">
                  <animate attributeName="opacity" values="0.2;1;0.2" dur="1.6s" repeatCount="indefinite" />
                </path>
                <path d="M730 128 A 22 22 0 0 1 746 150" fill="none" stroke="#38BDF8" strokeWidth="2">
                  <animate attributeName="opacity" values="0.1;0.9;0.1" dur="1.6s" begin="0.4s" repeatCount="indefinite" />
                </path>
              </g>
            )}
            <text x="692" y="280" textAnchor="middle" fill="#F8FAFC" fontSize="11.5" fontWeight="700">
              Science &amp; Dish ({allocation.scienceComms}P)
            </text>
          </g>
        </svg>
      </div>

      {/* Interactive Module Inspector & Direct Tune Strip */}
      <div className="p-4 bg-[#F8FAFC] border-t border-[#DCE3EE]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'lifeSupport', label: 'Life Support', icon: Wind },
                { id: 'shielding', label: 'Radiation Shield', icon: Shield },
                { id: 'greenhouse', label: 'Greenhouse', icon: Sprout },
                { id: 'scienceComms', label: 'Science & Radio', icon: Radio },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = selectedModule === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedModule(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#0F172A] text-white'
                      : 'bg-white text-[#334155] border border-[#DCE3EE] hover:bg-[#EFF6FF]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {onAdjustPower && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-[#475569]">Module Power:</span>
              <button
                type="button"
                aria-label={`Decrease ${activeInfo.title} power`}
                onClick={() => onAdjustPower(selectedModule, -1)}
                disabled={allocation[selectedModule] <= 0}
                className="w-8 h-8 rounded-md border border-[#DCE3EE] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5 text-[#0F172A]" />
              </button>
              <span className="w-8 text-center font-mono text-xs font-bold text-[#0F172A]">
                {allocation[selectedModule]}P
              </span>
              <button
                type="button"
                aria-label={`Increase ${activeInfo.title} power`}
                onClick={() => onAdjustPower(selectedModule, 1)}
                disabled={allocation[selectedModule] >= 4 || remainingPower <= 0}
                className="w-8 h-8 rounded-md border border-[#DCE3EE] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 flex items-center justify-center cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#0F172A]" />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <p className="font-semibold text-[#0F172A] mb-0.5">{activeInfo.title}</p>
            <p className="text-[#475569] leading-relaxed">{activeInfo.role}</p>
          </div>
          <div>
            <p className="font-semibold text-[#B45309] mb-0.5">Engineering Trade-Off</p>
            <p className="text-[#475569] leading-relaxed">{activeInfo.tradeoff}</p>
          </div>
          <div>
            <p className="font-semibold text-[#1D4ED8] mb-0.5">Real NASA Science</p>
            <p className="text-[#475569] leading-relaxed">{activeInfo.nasaLink}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
