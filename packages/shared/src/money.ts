/**
 * Money is stored as integer minor units + ISO 4217 currency code.
 * Display always goes through Intl.NumberFormat — no locale assumptions in
 * domain logic.
 */

const digitsCache = new Map<string, number>();

/** Number of minor-unit digits for a currency (NGN → 2, JPY → 0, ...). */
export function currencyDigits(currency: string): number {
  const key = currency.toUpperCase();
  const cached = digitsCache.get(key);
  if (cached !== undefined) return cached;
  let digits = 2;
  try {
    digits = new Intl.NumberFormat("en", { style: "currency", currency: key }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  } catch {
    digits = 2;
  }
  digitsCache.set(key, digits);
  return digits;
}

export function toMinorUnits(amount: number, currency: string): number {
  return Math.round(amount * 10 ** currencyDigits(currency));
}

export function fromMinorUnits(minor: number, currency: string): number {
  return minor / 10 ** currencyDigits(currency);
}

export interface FormatMoneyOptions {
  locale?: string;
  /** Drop fraction digits when the amount is whole (₦45,000 instead of ₦45,000.00). */
  compactWhole?: boolean;
}

export function formatMoney(
  minor: number | null | undefined,
  currency: string,
  { locale = "en-NG", compactWhole = true }: FormatMoneyOptions = {},
): string {
  if (minor === null || minor === undefined || Number.isNaN(minor)) return "Price not set";
  const digits = currencyDigits(currency);
  const amount = minor / 10 ** digits;
  const whole = Number.isInteger(amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: compactWhole && whole ? 0 : digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(digits)}`;
  }
}

export function formatPriceRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string,
  opts?: FormatMoneyOptions,
): string {
  if (min == null && max == null) return "Price on request";
  if (min != null && max != null && max !== min) return `${formatMoney(min, currency, opts)} – ${formatMoney(max, currency, opts)}`;
  return formatMoney((min ?? max)!, currency, opts);
}

/** Compact formatting for dashboards (₦1.2M). */
export function formatMoneyCompact(minor: number, currency: string, locale = "en-NG"): string {
  const amount = fromMinorUnits(minor, currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return formatMoney(minor, currency, { locale });
  }
}

export const SUPPORTED_CURRENCIES = ["NGN", "GHS", "KES", "ZAR", "USD", "GBP", "EUR", "CAD"] as const;
