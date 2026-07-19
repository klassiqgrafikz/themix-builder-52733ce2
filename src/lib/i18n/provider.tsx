// Runtime i18n provider for the customer portal.
//
// Reads the tenant's language/currency/timezone from the WebsiteManifest and
// exposes small, focused hooks:
//   - useT()               → translate a key with interpolation
//   - useLocale()          → { code, currency, timezone, dir }
//   - useFormatCurrency()  → format a number in the tenant's currency+locale
//   - useFormatDate()      → format a date/timestamp in the tenant's timezone
//
// Translations are lazily loaded from JSON dictionaries under ./translations/.
// Any missing key falls back to the English base dictionary.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BASE_DICTIONARY, type Dictionary, type TranslationKey } from "./keys";
import { DEFAULT_LOCALE, findLocale } from "./locales";

const RTL_LOCALES = new Set(["ar", "he", "fa", "ur"]);

// Vite glob import: all translation JSON files bundled together (small; ~10KB each).
const RAW_DICTS = import.meta.glob<{ default: Dictionary }>(
  "./translations/*.json",
  { eager: true },
);
const DICTS: Record<string, Dictionary> = {};
for (const path in RAW_DICTS) {
  const match = path.match(/\/translations\/(.+)\.json$/);
  if (match) DICTS[match[1]] = RAW_DICTS[path].default;
}

export type LocaleContext = {
  code: string;
  currency: string;
  timezone: string;
  dir: "ltr" | "rtl";
};

type I18nContextValue = {
  locale: LocaleContext;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

function pickDict(code: string): Dictionary {
  if (code === "en" || code === DEFAULT_LOCALE) return {};
  if (DICTS[code]) return DICTS[code];
  // Fallback for language-only tags (e.g. "zh" → "zh-CN")
  const base = code.split("-")[0];
  const candidate = Object.keys(DICTS).find((k) => k.split("-")[0] === base);
  return candidate ? DICTS[candidate] : {};
}

export function I18nProvider({
  language,
  currency,
  timezone,
  children,
}: {
  language: string | null | undefined;
  currency: string | null | undefined;
  timezone: string | null | undefined;
  children: ReactNode;
}) {
  const code = findLocale(language ?? DEFAULT_LOCALE).code;
  const dict = useMemo(() => pickDict(code), [code]);
  const dir: "ltr" | "rtl" = RTL_LOCALES.has(code.split("-")[0]) ? "rtl" : "ltr";
  const locale: LocaleContext = useMemo(
    () => ({
      code,
      currency: (currency ?? "USD").toUpperCase(),
      timezone: timezone ?? "UTC",
      dir,
    }),
    [code, currency, timezone, dir],
  );

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const raw = dict[key] ?? BASE_DICTIONARY[key] ?? key;
      return interpolate(raw, vars);
    },
    [dict],
  );

  // Set <html lang> / dir on the client so screen readers and CSS pick it up.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = code;
    document.documentElement.dir = dir;
  }, [code, dir]);

  const value = useMemo<I18nContextValue>(() => ({ locale, t }), [locale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback — allows components to render outside a portal shell
    // (e.g. previews) using English + USD + UTC.
    return {
      locale: { code: "en", currency: "USD", timezone: "UTC", dir: "ltr" },
      t: (key, vars) => interpolate(BASE_DICTIONARY[key] ?? key, vars),
    };
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}

export function useLocale(): LocaleContext {
  return useI18n().locale;
}

export function useFormatCurrency() {
  const { code, currency } = useI18n().locale;
  return useCallback(
    (value: number | null | undefined, opts?: { currency?: string }) => {
      const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
      const cur = (opts?.currency ?? currency).toUpperCase();
      try {
        return new Intl.NumberFormat(code, { style: "currency", currency: cur }).format(n);
      } catch {
        return `${cur} ${n.toFixed(2)}`;
      }
    },
    [code, currency],
  );
}

export function useFormatDate() {
  const { code, timezone } = useI18n().locale;
  return useCallback(
    (
      value: Date | string | number | null | undefined,
      opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
    ) => {
      if (value == null) return "";
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      try {
        return new Intl.DateTimeFormat(code, { timeZone: timezone, ...opts }).format(d);
      } catch {
        return d.toISOString();
      }
    },
    [code, timezone],
  );
}

/** Non-hook helper for imperative code (toasts, PDFs). Falls back to en-US/USD. */
export function formatCurrencyFor(
  value: number,
  locale: { code?: string; currency?: string } = {},
): string {
  const code = locale.code ?? "en";
  const currency = (locale.currency ?? "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(code, { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}
