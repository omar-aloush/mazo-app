import { isSupported, getDistractionByHour } from '@/modules/mazo-focus-guard';
import { getTopUsageApps } from '@/services/deviceApps';

/**
 * Mazō's behavior model — the DS/AI edge. Mines real per-hour app-open data and
 * detects the user's "danger zone" (the window they lose most). Honest v1: a
 * statistical pipeline (24-bin histogram → 2-hour peak detection), not a neural
 * net. Returns null when there isn't enough signal yet.
 */
export interface BehaviorInsight {
  hourly: number[];        // length 24, opens per hour-of-day
  dangerStart: number;     // hour 0-23 (inclusive)
  dangerEnd: number;       // hour (exclusive)
  topApp: string;
  topPackages: string[];
  dailyAvgMinutes: number;
  totalOpens: number;
}

const MIN_OPENS = 6;

export function analyzeBehavior(days = 14): BehaviorInsight | null {
  if (!isSupported) return null;
  const top = getTopUsageApps(days, 5);
  if (!top.length) return null;

  const topPackages = top.map((a) => a.packageName);
  const hourly = getDistractionByHour(days, topPackages);
  if (hourly.length !== 24) return null;

  const totalOpens = hourly.reduce((s, n) => s + n, 0);
  if (totalOpens < MIN_OPENS) return null;

  // Peak detection: the 2-hour contiguous window with the most opens.
  let bestStart = 0;
  let bestSum = -1;
  for (let h = 0; h < 24; h++) {
    const sum = hourly[h] + hourly[(h + 1) % 24];
    if (sum > bestSum) {
      bestSum = sum;
      bestStart = h;
    }
  }

  const dailyAvgMinutes = Math.round(top.reduce((s, a) => s + a.totalMs, 0) / days / 60000);

  return {
    hourly,
    dangerStart: bestStart,
    dangerEnd: bestStart + 2,
    topApp: top[0].label,
    topPackages,
    dailyAvgMinutes,
    totalOpens,
  };
}

export function formatHour(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  const period = hh < 12 ? 'AM' : 'PM';
  const display = hh % 12 || 12;
  return `${display} ${period}`;
}
