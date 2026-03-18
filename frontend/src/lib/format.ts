export const DEFAULT_CURRENCY_CODE = "TZS";

export function formatCurrency(value: number | null | undefined, currency = DEFAULT_CURRENCY_CODE) {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
    maximumFractionDigits: 2
  }).format(value ?? 0);
}

export function formatDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    options ?? {
      month: "short",
      day: "2-digit",
      year: "numeric"
    }
  ).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined) {
  return formatDate(value, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function sentenceCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
