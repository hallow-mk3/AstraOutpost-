import React, { useMemo, useState } from 'react';
import { SlidersHorizontal, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { clamp } from '../data/missionScenarios';
import { OUTPOST_SITES, OutpostSiteId } from '../data/nasaDatasets';

interface SimPoint {
  sol: number;
  airWater: number;
  powerBank: number;
  cumulativeMsv: number;
}

export const TradeOffLabView: React.FC = () => {
  const [site, setSite] = useState<OutpostSiteId>('mars');
  const [dustOrShadowPct, setDustOrShadowPct] = useState<number>(30);
  const [flareMsvPerDay, setFlareMsvPerDay] = useState<number>(3.5);
  const [shieldPower, setShieldPower] = useState<number>(2);
  const [greenhousePower, setGreenhousePower] = useState<number>(2);
  const [lifeSupportPower, setLifeSupportPower] = useState<number>(3);
  const [hoverSol, setHoverSol] = useState<number | null>(null);

  const totalPowerUsed = shieldPower + greenhousePower + lifeSupportPower;
  const maxAvailablePower = Math.max(4, Math.round(10 * (1 - dustOrShadowPct / 100)));

  const series: SimPoint[] = useMemo(() => {
    const baseRad = OUTPOST_SITES[site].baselineRadiationMsvPerDay;
    const points: SimPoint[] = [{ sol: 0, airWater: 80, powerBank: 75, cumulativeMsv: 0 }];

    let air = 80;
    let power = 75;
    let msv = 0;

    for (let s = 1; s <= 10; s++) {
      const airDelta = -14 + lifeSupportPower * 6.5 + greenhousePower * 2.4;
      air = clamp(Math.round(air + airDelta), 0, 100);

      const powerSurplus = maxAvailablePower - totalPowerUsed;
      power = clamp(Math.round(power + powerSurplus * 8), 0, 100);

      const block = Math.min(0.88, shieldPower * 0.22);
      const dailyMsv = (baseRad + flareMsvPerDay) * (1 - block);
      msv = Number((msv + dailyMsv).toFixed(1));

      points.push({
        sol: s,
        airWater: air,
        powerBank: power,
        cumulativeMsv: msv,
      });
    }
    return points;
  }, [site, maxAvailablePower, totalPowerUsed, lifeSupportPower, greenhousePower, shieldPower, flareMsvPerDay]);

  const diagnosis = useMemo(() => {
    const airZero = series.find((p) => p.airWater <= 0);
    const powerZero = series.find((p) => p.powerBank <= 0);
    const radOver = series.find((p) => p.cumulativeMsv >= 35);

    if (airZero) {
      return {
        safe: false,
        text: `Air & Water runs out on Sol ${airZero.sol}. Increase Life Support or Greenhouse power to keep recyclers and crops running.`,
      };
    }
    if (powerZero) {
      return {
        safe: false,
        text: `Battery Bank hits 0% on Sol ${powerZero.sol}. Your demand (${totalPowerUsed} units) exceeds solar supply (${maxAvailablePower} units).`,
      };
    }
    if (radOver) {
      return {
        safe: false,
        text: `Crew reaches the 35 mSv radiation limit on Sol ${radOver.sol}. Raise Radiation Shield power to block incoming flare particles.`,
      };
    }
    return {
      safe: true,
      text: `Outpost survives all 10 Sols safely! Final reserves: ${series[10].airWater}% Air/Water, ${series[10].powerBank}% Battery, and ${series[10].cumulativeMsv.toFixed(1)} mSv dose.`,
    };
  }, [series, totalPowerUsed, maxAvailablePower]);

  const finalPoint = series[series.length - 1];
  const activeHover = hoverSol !== null ? series[hoverSol] : finalPoint;

  const w = 640;
  const h = 240;
  const padL = 44;
  const padR = 20;
  const padT = 20;
  const padB = 34;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const toX = (sol: number) => padL + (sol / 10) * plotW;
  const toY = (pct: number) => padT + (1 - clamp(pct, 0, 100) / 100) * plotH;

  const airPath = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.sol).toFixed(1)} ${toY(p.airWater).toFixed(1)}`)
    .join(' ');
  const powerPath = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.sol).toFixed(1)} ${toY(p.powerBank).toFixed(1)}`)
    .join(' ');
  const radPath = series
    .map((p, i) => {
      const pctOfLimit = (p.cumulativeMsv / 35) * 100;
      return `${i === 0 ? 'M' : 'L'} ${toX(p.sol).toFixed(1)} ${toY(pctOfLimit).toFixed(1)}`;
    })
    .join(' ');

  const applyPreset = (preset: 'nominal' | 'dust' | 'flare' | 'starve') => {
    if (preset === 'nominal') {
      setSite('moon');
      setDustOrShadowPct(10);
      setFlareMsvPerDay(0.5);
      setLifeSupportPower(3);
      setShieldPower(2);
      setGreenhousePower(3);
    } else if (preset === 'dust') {
      setSite('mars');
      setDustOrShadowPct(50);
      setFlareMsvPerDay(1.5);
      setLifeSupportPower(2);
      setShieldPower(1);
      setGreenhousePower(2);
    } else if (preset === 'flare') {
      setSite('moon');
      setDustOrShadowPct(15);
      setFlareMsvPerDay(8.5);
      setLifeSupportPower(2);
      setShieldPower(4);
      setGreenhousePower(1);
    } else {
      setSite('mars');
      setDustOrShadowPct(20);
      setFlareMsvPerDay(2.0);
      setLifeSupportPower(1);
      setShieldPower(1);
      setGreenhousePower(0);
    }
  };

  const handleReset = () => {
    setSite('mars');
    setDustOrShadowPct(30);
    setFlareMsvPerDay(3.5);
    setShieldPower(2);
    setGreenhousePower(2);
    setLifeSupportPower(3);
  };

  return (
    <section className="space-y-6">
      <div className="bg-white border border-[#DCE3EE] rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#2563EB]">Interactive Engineering Sandbox</p>
            <h1 className="text-2xl font-bold text-[#0F172A] mt-0.5">
              Trade-Off Lab: How One Choice Ripples Across 10 Sols
            </h1>
            <p className="text-sm text-[#475569] mt-1 max-w-2xl leading-relaxed">
              Test extreme Martian dust storms, lunar crater shadows, and X-class solar flares.
              Try a preset scenario below or drag the sliders to discover where systems fail.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-lg border border-[#DCE3EE]">
              <button
                type="button"
                onClick={() => setSite('moon')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                  site === 'moon' ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#475569]'
                }`}
              >
                Moon
              </button>
              <button
                type="button"
                onClick={() => setSite('mars')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                  site === 'mars' ? 'bg-white text-[#0F172A] shadow-xs' : 'text-[#475569]'
                }`}
              >
                Mars
              </button>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-lg text-xs font-semibold text-[#0F172A] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Reset
            </button>
          </div>
        </div>

        {/* Interactive Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E2E8F0]">
          <span className="text-xs font-semibold text-[#64748B] mr-1">Test Real Scenario:</span>
          <button
            type="button"
            onClick={() => applyPreset('nominal')}
            className="px-3 py-1.5 text-xs font-semibold bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#DCE3EE] rounded-lg text-[#0F172A] cursor-pointer"
          >
            Artemis Nominal
          </button>
          <button
            type="button"
            onClick={() => applyPreset('dust')}
            className="px-3 py-1.5 text-xs font-semibold bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#DCE3EE] rounded-lg text-[#0F172A] cursor-pointer"
          >
            Mars Dust Storm (50% Loss)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('flare')}
            className="px-3 py-1.5 text-xs font-semibold bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#DCE3EE] rounded-lg text-[#0F172A] cursor-pointer"
          >
            X-Class Solar Flare
          </button>
          <button
            type="button"
            onClick={() => applyPreset('starve')}
            className="px-3 py-1.5 text-xs font-semibold bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#DCE3EE] rounded-lg text-[#0F172A] cursor-pointer"
          >
            Low Life-Support Failure
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-white border border-[#DCE3EE] rounded-xl p-5 space-y-5">
          <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
            Environment &amp; Power Controls
          </h2>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between font-semibold text-[#0F172A] mb-1">
                <label htmlFor="dust-slider">
                  {site === 'mars' ? 'Martian Dust Sunlight Loss' : 'Crater Shadow Sunlight Loss'}
                </label>
                <span className="font-mono text-[#D97706]">{dustOrShadowPct}%</span>
              </div>
              <input
                id="dust-slider"
                type="range"
                min={0}
                max={70}
                step={5}
                value={dustOrShadowPct}
                onChange={(e) => setDustOrShadowPct(Number(e.target.value))}
                className="w-full accent-[#2563EB] cursor-pointer"
              />
              <p className="text-[11px] text-[#64748B] mt-0.5">
                Available Solar Output: <strong className="font-mono">{maxAvailablePower} Power Units / Sol</strong>
              </p>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-[#0F172A] mb-1">
                <label htmlFor="flare-slider">Solar Storm Extra Radiation</label>
                <span className="font-mono text-[#DC2626]">{flareMsvPerDay.toFixed(1)} mSv/day</span>
              </div>
              <input
                id="flare-slider"
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={flareMsvPerDay}
                onChange={(e) => setFlareMsvPerDay(Number(e.target.value))}
                className="w-full accent-[#DC2626] cursor-pointer"
              />
            </div>

            <div className="pt-3 border-t border-[#E2E8F0] space-y-3">
              <div>
                <div className="flex justify-between font-semibold text-[#0F172A] mb-1">
                  <label htmlFor="life-slider">Life Support Power</label>
                  <span className="font-mono">{lifeSupportPower} Units</span>
                </div>
                <input
                  id="life-slider"
                  type="range"
                  min={0}
                  max={4}
                  step={1}
                  value={lifeSupportPower}
                  onChange={(e) => setLifeSupportPower(Number(e.target.value))}
                  className="w-full accent-[#0284C7] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-semibold text-[#0F172A] mb-1">
                  <label htmlFor="shield-slider">Radiation Shield Power</label>
                  <span className="font-mono">{shieldPower} Units</span>
                </div>
                <input
                  id="shield-slider"
                  type="range"
                  min={0}
                  max={4}
                  step={1}
                  value={shieldPower}
                  onChange={(e) => setShieldPower(Number(e.target.value))}
                  className="w-full accent-[#0F172A] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-semibold text-[#0F172A] mb-1">
                  <label htmlFor="green-slider">Greenhouse Power</label>
                  <span className="font-mono">{greenhousePower} Units</span>
                </div>
                <input
                  id="green-slider"
                  type="range"
                  min={0}
                  max={4}
                  step={1}
                  value={greenhousePower}
                  onChange={(e) => setGreenhousePower(Number(e.target.value))}
                  className="w-full accent-[#059669] cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div
            className={`p-3 rounded-lg text-xs border ${
              totalPowerUsed > maxAvailablePower
                ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                : 'bg-[#F8FAFC] border-[#DCE3EE] text-[#334155]'
            }`}
          >
            <p className="font-semibold">
              Power Demand: <span className="font-mono">{totalPowerUsed}</span> vs Solar Supply:{' '}
              <span className="font-mono">{maxAvailablePower}</span>
            </p>
            <p className="mt-1 leading-relaxed">
              {totalPowerUsed > maxAvailablePower
                ? 'Demand exceeds solar generation—your battery bank drains every Sol.'
                : 'Solar generation covers this demand, leaving surplus to charge batteries.'}
            </p>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-[#DCE3EE] rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">10-Sol Resource Projection</h2>
              <p className="text-xs text-[#64748B]">Hover across any Sol column to inspect exact numbers</p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
              <span className="inline-flex items-center gap-1.5 text-[#0284C7]">
                <span className="w-3 h-0.5 bg-[#0284C7] inline-block" /> Air &amp; Water (%)
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#D97706]">
                <span className="w-3 h-0.5 bg-[#D97706] inline-block" /> Power Bank (%)
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#DC2626]">
                <span className="w-3 h-0.5 bg-[#DC2626] inline-block border-b border-dashed" /> Radiation (% of 35 mSv limit)
              </span>
            </div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3">
            <svg
              viewBox={`0 0 ${w} ${h}`}
              className="w-full h-auto block cursor-crosshair"
              onMouseLeave={() => setHoverSol(null)}
            >
              {[0, 25, 50, 75, 100].map((val) => {
                const y = toY(val);
                return (
                  <g key={val}>
                    <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#E2E8F0" strokeWidth="1" />
                    <text
                      x={padL - 8}
                      y={y + 4}
                      textAnchor="end"
                      fill="#64748B"
                      fontSize="10"
                      fontFamily="JetBrains Mono"
                    >
                      {val}%
                    </text>
                  </g>
                );
              })}

              {series.map((p) => (
                <g key={p.sol}>
                  <text
                    x={toX(p.sol)}
                    y={h - 10}
                    textAnchor="middle"
                    fill="#64748B"
                    fontSize="10"
                    fontFamily="JetBrains Mono"
                  >
                    S{p.sol}
                  </text>
                  <rect
                    x={toX(p.sol) - plotW / 22}
                    y={padT}
                    width={plotW / 11}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHoverSol(p.sol)}
                  />
                </g>
              ))}

              <line
                x1={toX(activeHover.sol)}
                y1={padT}
                x2={toX(activeHover.sol)}
                y2={h - padB}
                stroke="#94A3B8"
                strokeDasharray="4 4"
                strokeWidth="1"
              />

              <path d={airPath} fill="none" stroke="#0284C7" strokeWidth="2.5" />
              <path d={powerPath} fill="none" stroke="#D97706" strokeWidth="2.5" />
              <path d={radPath} fill="none" stroke="#DC2626" strokeWidth="2.5" strokeDasharray="6 4" />

              <circle cx={toX(activeHover.sol)} cy={toY(activeHover.airWater)} r="4.5" fill="#0284C7" />
              <circle cx={toX(activeHover.sol)} cy={toY(activeHover.powerBank)} r="4.5" fill="#D97706" />
              <circle
                cx={toX(activeHover.sol)}
                cy={toY((activeHover.cumulativeMsv / 35) * 100)}
                r="4.5"
                fill="#DC2626"
              />
            </svg>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3.5">
            <div>
              <span className="text-[#64748B]">Inspecting</span>
              <p className="font-mono font-bold text-[#0F172A] mt-0.5">Sol {activeHover.sol}</p>
            </div>
            <div>
              <span className="text-[#64748B]">Air &amp; Water</span>
              <p className="font-mono font-bold text-[#0284C7] mt-0.5">{activeHover.airWater}%</p>
            </div>
            <div>
              <span className="text-[#64748B]">Power Bank</span>
              <p className="font-mono font-bold text-[#D97706] mt-0.5">{activeHover.powerBank}%</p>
            </div>
            <div>
              <span className="text-[#64748B]">Cumulative Dose</span>
              <p className="font-mono font-bold text-[#DC2626] mt-0.5">
                {activeHover.cumulativeMsv.toFixed(1)} / 35 mSv
              </p>
            </div>
          </div>

          {/* Live Engineering Diagnosis */}
          <div
            className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
              diagnosis.safe
                ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]'
                : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
            }`}
          >
            {diagnosis.safe ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <p className="leading-relaxed font-medium">{diagnosis.text}</p>
          </div>
        </div>
      </div>
    </section>
  );
};
