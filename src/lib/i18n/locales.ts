// Supported UI languages for the Bank Builder. English is always default.
// The `code` is a BCP-47 tag suitable for Intl APIs.
export type LocaleOption = {
  code: string;
  label: string; // English name shown in dropdown
  native: string; // Native name (for searchability)
};

export const LOCALES: LocaleOption[] = [
  { code: "en", label: "English", native: "English" },
  { code: "fr", label: "French", native: "Français" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "pt", label: "Portuguese", native: "Português" },
  { code: "it", label: "Italian", native: "Italiano" },
  { code: "nl", label: "Dutch", native: "Nederlands" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "zh-CN", label: "Chinese (Simplified)", native: "简体中文" },
  { code: "zh-TW", label: "Chinese (Traditional)", native: "繁體中文" },
  { code: "th", label: "Thai", native: "ไทย" },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt" },
  { code: "id", label: "Indonesian", native: "Bahasa Indonesia" },
  { code: "ms", label: "Malay", native: "Bahasa Melayu" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "tr", label: "Turkish", native: "Türkçe" },
  { code: "ru", label: "Russian", native: "Русский" },
  { code: "uk", label: "Ukrainian", native: "Українська" },
  { code: "pl", label: "Polish", native: "Polski" },
  { code: "ro", label: "Romanian", native: "Română" },
  { code: "cs", label: "Czech", native: "Čeština" },
  { code: "hu", label: "Hungarian", native: "Magyar" },
  { code: "sv", label: "Swedish", native: "Svenska" },
  { code: "no", label: "Norwegian", native: "Norsk" },
  { code: "da", label: "Danish", native: "Dansk" },
  { code: "fi", label: "Finnish", native: "Suomi" },
  { code: "el", label: "Greek", native: "Ελληνικά" },
  { code: "ar", label: "Arabic", native: "العربية" },
  { code: "he", label: "Hebrew", native: "עברית" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "ur", label: "Urdu", native: "اردو" },
  { code: "fa", label: "Persian", native: "فارسی" },
  { code: "sw", label: "Swahili", native: "Kiswahili" },
  { code: "zu", label: "Zulu", native: "isiZulu" },
  { code: "yo", label: "Yoruba", native: "Yorùbá" },
  { code: "ig", label: "Igbo", native: "Igbo" },
  { code: "ha", label: "Hausa", native: "Hausa" },
  { code: "af", label: "Afrikaans", native: "Afrikaans" },
  { code: "tl", label: "Filipino", native: "Filipino" },
];

export const DEFAULT_LOCALE = "en";

export function findLocale(code: string | null | undefined): LocaleOption {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}
