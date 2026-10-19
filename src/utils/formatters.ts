/**
 * Compact Statistics & Metrics Formatter
 * Replaces raw or missing numbers with compact notation ("400M", "2.5M", "850K", "1.6B")
 * and returns "N/A" when verified data is unavailable. Never invents figures.
 */

export function formatCompactNumber(
  value: number | string | null | undefined,
  allowZero: boolean = false
): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toUpperCase() === 'N/A' || trimmed.toLowerCase() === 'unavailable') {
      return 'N/A';
    }

    // If it already contains a compact number from YT Music e.g. "683M monthly audience", "7.47M subscribers", "1.6B plays"
    const compactMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*([KMBTkmbt])\b/);
    if (compactMatch) {
      return `${compactMatch[1]}${compactMatch[2].toUpperCase()}`;
    }

    // If it's a comma-formatted integer string like "4,085,220,425 views"
    const rawDigits = trimmed.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
    if (rawDigits) {
      const parsed = parseFloat(rawDigits[1]);
      if (!isNaN(parsed)) {
        return formatCompactNumber(parsed, allowZero);
      }
    }

    return 'N/A';
  }

  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value) || value < 0) {
      return 'N/A';
    }
    if (value === 0) {
      return allowZero ? '0' : 'N/A';
    }
    if (value >= 1_000_000_000) {
      const v = value / 1_000_000_000;
      return `${v >= 100 ? Math.round(v) : Number(v.toFixed(1))}B`;
    }
    if (value >= 1_000_000) {
      const v = value / 1_000_000;
      return `${v >= 100 ? Math.round(v) : Number(v.toFixed(1))}M`;
    }
    if (value >= 1_000) {
      const v = value / 1_000;
      return `${v >= 100 ? Math.round(v) : Number(v.toFixed(1))}K`;
    }
    return String(Math.round(value));
  }

  return 'N/A';
}

/**
 * Parse a compact string ("683M", "7.47M", "4,085,220,425 views") into a numeric count or 0
 */
export function parseCompactStat(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  if (!value || typeof value !== 'string') {
    return 0;
  }
  const trimmed = value.trim();
  const compactMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*([KMBkmbt])\b/);
  if (compactMatch) {
    const num = parseFloat(compactMatch[1]);
    const unit = compactMatch[2].toUpperCase();
    if (unit === 'B') return Math.round(num * 1_000_000_000);
    if (unit === 'M') return Math.round(num * 1_000_000);
    if (unit === 'K') return Math.round(num * 1_000);
  }
  const digits = trimmed.replace(/,/g, '').match(/(\d+)/);
  if (digits) {
    return parseInt(digits[1], 10) || 0;
  }
  return 0;
}
