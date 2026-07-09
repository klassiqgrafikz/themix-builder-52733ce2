// Country-specific banking identifier generators + display helpers.
// The Core Banking Engine keeps using the universal `id` + `account_number`
// fields — these helpers only produce (and describe) additional country
// identifiers so customer UIs can present realistic banking numbers.

export type CountryAccountFields = {
  account_number: string;
  iban?: string;
  swift_bic?: string;
  routing_number?: string;
  sort_code?: string;
  bsb?: string;
  transit_number?: string;
  institution_number?: string;
};

const rand = (len: number, alphabet = "0123456789") =>
  Array.from({ length: len }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");

function iban(country: string, bankPrefix: string, len: number): string {
  const bban = (bankPrefix + rand(len)).slice(0, len);
  return `${country}${rand(2)}${bban}`;
}

/** Generate a realistic identifier bundle for the given ISO country code. */
export function generateCountryAccountFields(countryCode: string): CountryAccountFields {
  const c = (countryCode ?? "").toUpperCase();
  switch (c) {
    case "NG":
      return { account_number: rand(10) };
    case "US":
      return { account_number: rand(10), routing_number: rand(9) };
    case "GB":
    case "UK":
      return {
        account_number: rand(8),
        sort_code: `${rand(2)}-${rand(2)}-${rand(2)}`,
      };
    case "AU":
      return { account_number: rand(9), bsb: `${rand(3)}-${rand(3)}` };
    case "CA":
      return {
        account_number: rand(7),
        institution_number: rand(3),
        transit_number: rand(5),
      };
    case "DE":
      return { account_number: rand(10), iban: iban("DE", "10010010", 18), swift_bic: "PBNKDEFF" };
    case "FR":
      return { account_number: rand(11), iban: iban("FR", "20041010", 21), swift_bic: "PSSTFRPP" };
    case "ES":
      return { account_number: rand(10), iban: iban("ES", "21000418", 20), swift_bic: "CAIXESBB" };
    case "IT":
      return { account_number: rand(12), iban: iban("IT", "X0300203280", 22), swift_bic: "BCITITMM" };
    default:
      return { account_number: rand(10) };
  }
}

/** Which identifier fields make sense for a given country's UI. */
export function countryFieldsToDisplay(countryCode: string): (keyof CountryAccountFields)[] {
  const c = (countryCode ?? "").toUpperCase();
  switch (c) {
    case "US":
      return ["account_number", "routing_number"];
    case "GB":
    case "UK":
      return ["account_number", "sort_code"];
    case "AU":
      return ["account_number", "bsb"];
    case "CA":
      return ["account_number", "institution_number", "transit_number"];
    case "DE":
    case "FR":
    case "ES":
    case "IT":
      return ["iban", "swift_bic", "account_number"];
    case "NG":
    default:
      return ["account_number"];
  }
}

export const COUNTRY_FIELD_LABEL: Record<keyof CountryAccountFields, string> = {
  account_number: "Account number",
  iban: "IBAN",
  swift_bic: "SWIFT / BIC",
  routing_number: "Routing number",
  sort_code: "Sort code",
  bsb: "BSB",
  transit_number: "Transit number",
  institution_number: "Institution number",
};
