export interface CountFormat {
  /** Fixed decimal places (default 0). */
  decimals?: number;
  /** Prepended verbatim, e.g. "$". */
  prefix?: string;
  /** Appended verbatim, e.g. "%" or "+". */
  suffix?: string;
  /** Thousands grouping via toLocaleString (default true). */
  useGrouping?: boolean;
  /** BCP-47 locale for grouping/decimal marks; omit for the runtime default. */
  locale?: string;
}

/**
 * Format a (possibly mid-tween, fractional) number for display: fixed
 * decimals, locale-aware thousands grouping, and prefix/suffix. Pure — the
 * single source of truth for how a CountUp renders, so the tween component
 * and its tests agree.
 */
export function formatCount(value: number, opts: CountFormat = {}): string {
  const {
    decimals = 0,
    prefix = "",
    suffix = "",
    useGrouping = true,
    locale,
  } = opts;
  const body = value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping,
  });
  return `${prefix}${body}${suffix}`;
}
