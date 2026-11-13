export interface MarsCommsTelemetry {
  distanceMillionKm: number;
  distanceAu: number;
  oneWaySeconds: number;
  roundTripSeconds: number;
  oneWayFormatted: string;
  roundTripFormatted: string;
  dateLabel: string;
}

const DEG_TO_RAD = Math.PI / 180;
const AU_IN_KM = 149597870.7;
const SPEED_OF_LIGHT_KM_S = 299792.458;

function solveKepler(meanAnomalyRad: number, eccentricity: number): number {
  let E = meanAnomalyRad;
  for (let i = 0; i < 6; i++) {
    E = E - (E - eccentricity * Math.sin(E) - meanAnomalyRad) / (1 - eccentricity * Math.cos(E));
  }
  return E;
}

function planetHeliocentricXY(
  dDays: number,
  a: number,
  e: number,
  M0Deg: number,
  nDegPerDay: number,
  wBarDeg: number
): { x: number; y: number } {
  const M = ((M0Deg + nDegPerDay * dDays) % 360) * DEG_TO_RAD;
  const E = solveKepler(M, e);
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  const lon = v + wBarDeg * DEG_TO_RAD;
  return {
    x: r * Math.cos(lon),
    y: r * Math.sin(lon),
  };
}

function formatMinSec(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = Math.round(totalSec % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

/**
 * Computes real Earth-to-Mars distance and speed-of-light radio delay
 * for a given date using J2000 Keplerian orbital elements.
 */
export function computeRealMarsComms(date: Date = new Date()): MarsCommsTelemetry {
  const j2000Ms = Date.UTC(2000, 0, 1, 12, 0, 0);
  const dDays = (date.getTime() - j2000Ms) / 86400000;

  // Earth orbital elements (J2000)
  const earth = planetHeliocentricXY(dDays, 1.00000011, 0.01671022, 357.52911, 0.98560028, 102.93735);

  // Mars orbital elements (J2000)
  const mars = planetHeliocentricXY(dDays, 1.52366231, 0.09341233, 19.373, 0.52402068, 336.04084);

  const dx = mars.x - earth.x;
  const dy = mars.y - earth.y;
  const distanceAu = Math.sqrt(dx * dx + dy * dy);
  const distanceKm = distanceAu * AU_IN_KM;
  const oneWaySeconds = distanceKm / SPEED_OF_LIGHT_KM_S;
  const roundTripSeconds = oneWaySeconds * 2;

  return {
    distanceMillionKm: Number((distanceKm / 1_000_000).toFixed(1)),
    distanceAu: Number(distanceAu.toFixed(2)),
    oneWaySeconds: Math.round(oneWaySeconds),
    roundTripSeconds: Math.round(roundTripSeconds),
    oneWayFormatted: formatMinSec(oneWaySeconds),
    roundTripFormatted: formatMinSec(roundTripSeconds),
    dateLabel: date.toISOString().split('T')[0],
  };
}

/**
 * Translates radiation dose in mSv into concrete, kid-friendly real-world equivalents.
 */
export function explainRadiationInRealLife(msv: number): string {
  // Average natural background radiation on Earth's surface is ~3.0 mSv per year (~0.25 mSv/month)
  const earthMonths = Math.max(1, Math.round((msv / 3.0) * 12));
  const chestXrays = Math.max(1, Math.round(msv / 0.1));
  if (earthMonths >= 12) {
    const years = (msv / 3.0).toFixed(1);
    return `About ${years} years of normal Earth background radiation (or ~${chestXrays} chest X-rays).`;
  }
  return `About ${earthMonths} month${earthMonths > 1 ? 's' : ''} of normal Earth background radiation (or ~${chestXrays} chest X-rays).`;
}
