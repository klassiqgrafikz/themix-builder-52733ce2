export type FieldOption = { value: string; label: string };

export type FormFieldConfig = {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'email' | 'tel';
  placeholder?: string;
  options?: FieldOption[];
  group: string;
};

export type CountryFormConfig = {
  groups: { key: string; label: string }[];
  fields: FormFieldConfig[];
};

const GENDER_OPTIONS: FieldOption[] = [
  { value: "Female", label: "Female" },
  { value: "Male", label: "Male" },
  { value: "Non-binary", label: "Non-binary" },
  { value: "Prefer not to say", label: "Prefer not to say" },
];

const KIN_RELATIONS: FieldOption[] = [
  { value: "Spouse", label: "Spouse" },
  { value: "Parent", label: "Parent" },
  { value: "Sibling", label: "Sibling" },
  { value: "Child", label: "Child" },
  { value: "Guardian", label: "Guardian" },
  { value: "Friend", label: "Friend" },
  { value: "Other", label: "Other" },
];

const EMPLOYMENT: FieldOption[] = [
  { value: "Employed", label: "Employed" },
  { value: "Self-employed", label: "Self-employed" },
  { value: "Business owner", label: "Business owner" },
  { value: "Student", label: "Student" },
  { value: "Retired", label: "Retired" },
  { value: "Unemployed", label: "Unemployed" },
];

function idDocs(opts: FieldOption[]): FormFieldConfig {
  return { key: "id_document_type", label: "ID document type", type: "select", group: "id", options: opts };
}

function idDocNumber(): FormFieldConfig {
  return { key: "id_document_number", label: "ID document number", type: "text", group: "id", placeholder: "Enter your document number" };
}

const COUNTRY_ID_DOCS: Record<string, FieldOption[]> = {
  US: [
    { value: "SSN", label: "Social Security Number" },
    { value: "Driver's License", label: "Driver's License" },
    { value: "Passport", label: "Passport" },
    { value: "State ID", label: "State ID" },
  ],
  GB: [
    { value: "Passport", label: "Passport" },
    { value: "Driving Licence", label: "Driving Licence" },
    { value: "National Insurance", label: "National Insurance Number" },
  ],
  NG: [
    { value: "BVN", label: "Bank Verification Number (BVN)" },
    { value: "NIN", label: "National Identification Number (NIN)" },
    { value: "National ID", label: "National ID" },
    { value: "Passport", label: "International Passport" },
    { value: "Driver's License", label: "Driver's License" },
  ],
  AE: [
    { value: "Emirates ID", label: "Emirates ID" },
    { value: "Passport", label: "Passport" },
    { value: "Residence Visa", label: "Residence Visa" },
  ],
  IN: [
    { value: "Aadhaar", label: "Aadhaar Card" },
    { value: "PAN", label: "PAN Card" },
    { value: "Passport", label: "Passport" },
    { value: "Driver's License", label: "Driver's License" },
  ],
  CA: [
    { value: "SIN", label: "Social Insurance Number (SIN)" },
    { value: "Driver's License", label: "Driver's License" },
    { value: "Passport", label: "Passport" },
  ],
  AU: [
    { value: "Passport", label: "Passport" },
    { value: "Driving Licence", label: "Driving Licence" },
    { value: "Medicare", label: "Medicare Card" },
  ],
  DE: [
    { value: "Personalausweis", label: "Personalausweis" },
    { value: "Reisepass", label: "Reisepass" },
    { value: "Aufenthaltstitel", label: "Aufenthaltstitel" },
  ],
  FR: [
    { value: "CNI", label: "Carte Nationale d'Identité" },
    { value: "Passeport", label: "Passeport" },
    { value: "Titre de Séjour", label: "Titre de Séjour" },
  ],
  ES: [
    { value: "DNI", label: "DNI" },
    { value: "Pasaporte", label: "Pasaporte" },
    { value: "NIE", label: "NIE" },
  ],
  IT: [
    { value: "Carta d'Identità", label: "Carta d'Identità" },
    { value: "Passaporto", label: "Passaporto" },
    { value: "Permesso di Soggiorno", label: "Permesso di Soggiorno" },
  ],
  BR: [
    { value: "CPF", label: "CPF" },
    { value: "RG", label: "RG (Identity Card)" },
    { value: "Passport", label: "Passport" },
  ],
};

const REGION_ID_DOCS: Record<string, FieldOption[]> = {
  "North America": [
    { value: "Passport", label: "Passport" },
    { value: "Driver's License", label: "Driver's License" },
    { value: "National ID", label: "National ID" },
  ],
  Europe: [
    { value: "National ID", label: "National ID Card" },
    { value: "Passport", label: "Passport" },
    { value: "Residence Permit", label: "Residence Permit" },
  ],
  "Middle East": [
    { value: "National ID", label: "National ID" },
    { value: "Passport", label: "Passport" },
    { value: "Residence Permit", label: "Residence Permit" },
  ],
  Africa: [
    { value: "National ID", label: "National ID" },
    { value: "Passport", label: "Passport" },
    { value: "Driver's License", label: "Driver's License" },
  ],
  Asia: [
    { value: "National ID", label: "National ID" },
    { value: "Passport", label: "Passport" },
  ],
  "South America": [
    { value: "National ID", label: "National ID" },
    { value: "Passport", label: "Passport" },
    { value: "Driver's License", label: "Driver's License" },
  ],
  Oceania: [
    { value: "Passport", label: "Passport" },
    { value: "Driver's License", label: "Driver's License" },
  ],
  "Central America": [
    { value: "National ID", label: "National ID" },
    { value: "Passport", label: "Passport" },
  ],
  Caribbean: [
    { value: "Passport", label: "Passport" },
    { value: "National ID", label: "National ID" },
  ],
};

function pickIdDocs(country: string, region: string): FieldOption[] {
  return COUNTRY_ID_DOCS[country] ?? REGION_ID_DOCS[region] ?? [
    { value: "Passport", label: "Passport" },
    { value: "National ID", label: "National ID" },
  ];
}

// -------- Region config builders --------

function personal(): FormFieldConfig[] {
  return [
    { key: "first_name", label: "First name", type: "text", group: "personal", placeholder: "Enter your first name" },
    { key: "last_name", label: "Last name", type: "text", group: "personal", placeholder: "Enter your last name" },
    { key: "date_of_birth", label: "Date of birth", type: "date", group: "personal" },
    { key: "email", label: "Email address", type: "email", group: "personal", placeholder: "you@example.com" },
    { key: "phone", label: "Phone number", type: "tel", group: "personal", placeholder: "Phone number" },
  ];
}

function standardId(country: string, region: string): FormFieldConfig[] {
  return [
    idDocs(pickIdDocs(country, region)),
    idDocNumber(),
  ];
}

function address(): FormFieldConfig[] {
  return [
    { key: "address", label: "Residential address", type: "text", group: "address", placeholder: "Street address" },
    { key: "city", label: "City", type: "text", group: "address", placeholder: "City" },
    { key: "state", label: "State / Province", type: "text", group: "address", placeholder: "State or province" },
    { key: "postal_code", label: "Postal / ZIP code", type: "text", group: "address", placeholder: "Postal or ZIP code" },
    { key: "country", label: "Country of residence", type: "text", group: "address", placeholder: "Country" },
  ];
}

function employment(): FormFieldConfig[] {
  return [
    { key: "employment_status", label: "Employment status", type: "select", group: "employment", options: EMPLOYMENT },
    { key: "employer_name", label: "Employer / Company", type: "text", group: "employment", placeholder: "Company name" },
    { key: "job_title", label: "Job title", type: "text", group: "employment", placeholder: "Your job title" },
    { key: "annual_income", label: "Annual income", type: "text", group: "employment", placeholder: "Annual income" },
  ];
}

function nextOfKin(): FormFieldConfig[] {
  return [
    { key: "next_of_kin_name", label: "Next of kin full name", type: "text", group: "kin", placeholder: "Full name" },
    { key: "next_of_kin_relationship", label: "Relationship", type: "select", group: "kin", options: KIN_RELATIONS },
    { key: "next_of_kin_phone", label: "Next of kin phone", type: "tel", group: "kin", placeholder: "Phone number" },
    { key: "next_of_kin_email", label: "Next of kin email", type: "email", group: "kin", placeholder: "Email address" },
  ];
}

// -------- Region configs --------

const REGION_CONFIGS: Record<string, () => CountryFormConfig> = {
  "North America": () => ({
    groups: [
      { key: "personal", label: "Personal Information" },
      { key: "id", label: "Identification" },
      { key: "address", label: "Address" },
    ],
    fields: [
      ...personal(),
      { key: "gender", label: "Gender", type: "select", group: "personal", options: GENDER_OPTIONS },
      { key: "nationality", label: "Nationality", type: "text", group: "personal", placeholder: "Nationality" },
      ...standardId("", "North America"),
      ...address(),
    ],
  }),
  Europe: () => ({
    groups: [
      { key: "personal", label: "Personal Information" },
      { key: "id", label: "Identification" },
      { key: "address", label: "Address" },
    ],
    fields: [
      ...personal(),
      { key: "gender", label: "Gender", type: "select", group: "personal", options: GENDER_OPTIONS },
      { key: "nationality", label: "Nationality", type: "text", group: "personal", placeholder: "Nationality" },
      ...standardId("", "Europe"),
      ...address(),
    ],
  }),
  "Middle East": () => ({
    groups: [
      { key: "personal", label: "Personal Information" },
      { key: "id", label: "Identification" },
      { key: "address", label: "Address" },
    ],
    fields: [
      ...personal(),
      ...standardId("", "Middle East"),
      ...address(),
    ],
  }),
  Africa: () => ({
    groups: [
      { key: "personal", label: "Personal Information" },
      { key: "id", label: "Identification" },
      { key: "address", label: "Address" },
      { key: "kin", label: "Next of Kin" },
    ],
    fields: [
      ...personal(),
      { key: "gender", label: "Gender", type: "select", group: "personal", options: GENDER_OPTIONS },
      ...standardId("", "Africa"),
      ...address(),
      ...nextOfKin(),
    ],
  }),
  Asia: () => ({
    groups: [
      { key: "personal", label: "Personal Information" },
      { key: "id", label: "Identification" },
      { key: "address", label: "Address" },
    ],
    fields: [
      ...personal(),
      { key: "gender", label: "Gender", type: "select", group: "personal", options: GENDER_OPTIONS },
      ...standardId("", "Asia"),
      ...address(),
    ],
  }),
  "South America": () => ({
    groups: [
      { key: "personal", label: "Personal Information" },
      { key: "id", label: "Identification" },
      { key: "address", label: "Address" },
      { key: "employment", label: "Employment" },
    ],
    fields: [
      ...personal(),
      { key: "gender", label: "Gender", type: "select", group: "personal", options: GENDER_OPTIONS },
      { key: "nationality", label: "Nationality", type: "text", group: "personal", placeholder: "Nationality" },
      ...standardId("", "South America"),
      ...address(),
      ...employment(),
    ],
  }),
  Oceania: () => ({
    groups: [
      { key: "personal", label: "Personal Information" },
      { key: "id", label: "Identification" },
      { key: "address", label: "Address" },
    ],
    fields: [
      ...personal(),
      ...standardId("", "Oceania"),
      ...address(),
    ],
  }),
  "Central America": () => ({
    groups: [
      { key: "personal", label: "Personal Information" },
      { key: "id", label: "Identification" },
      { key: "address", label: "Address" },
    ],
    fields: [
      ...personal(),
      ...standardId("", "Central America"),
      ...address(),
    ],
  }),
  Caribbean: () => ({
    groups: [
      { key: "personal", label: "Personal Information" },
      { key: "id", label: "Identification" },
      { key: "address", label: "Address" },
    ],
    fields: [
      ...personal(),
      ...standardId("", "Caribbean"),
      ...address(),
    ],
  }),
};

function defaultConfig(): CountryFormConfig {
  return {
    groups: [
      { key: "personal", label: "Personal Information" },
      { key: "id", label: "Identification" },
      { key: "address", label: "Address" },
      { key: "employment", label: "Employment" },
      { key: "kin", label: "Next of Kin" },
    ],
    fields: [
      ...personal(),
      { key: "gender", label: "Gender", type: "select", group: "personal", options: GENDER_OPTIONS },
      { key: "nationality", label: "Nationality", type: "text", group: "personal", placeholder: "Nationality" },
      { key: "id_document_type", label: "ID document type", type: "select", group: "id", options: REGION_ID_DOCS["North America"] ?? [] },
      { key: "id_document_number", label: "ID document number", type: "text", group: "id", placeholder: "Enter your document number" },
      { key: "id_document_country", label: "ID issuing country", type: "text", group: "id", placeholder: "Country" },
      ...address(),
      ...employment(),
      ...nextOfKin(),
    ],
  };
}

function applyCountryOverrides(country: string, config: CountryFormConfig): CountryFormConfig {
  const docs = COUNTRY_ID_DOCS[country];
  if (!docs) return config;
  return {
    ...config,
    fields: config.fields.map((f) =>
      f.key === "id_document_type" ? { ...f, options: docs } : f,
    ),
  };
}

const COUNTRY_REGION: Record<string, string> = {
  US: "North America", CA: "North America", MX: "North America",
  GB: "Europe", UK: "Europe", DE: "Europe", FR: "Europe", ES: "Europe", IT: "Europe",
  NL: "Europe", BE: "Europe", CH: "Europe", AT: "Europe", SE: "Europe", NO: "Europe",
  DK: "Europe", FI: "Europe", IE: "Europe", PT: "Europe", PL: "Europe", CZ: "Europe",
  HU: "Europe", RO: "Europe", GR: "Europe", TR: "Europe", RU: "Europe",
  AE: "Middle East", SA: "Middle East", QA: "Middle East", KW: "Middle East",
  OM: "Middle East", BH: "Middle East", JO: "Middle East", EG: "Middle East",
  NG: "Africa", ZA: "Africa", KE: "Africa", GH: "Africa", MA: "Africa",
  TN: "Africa", DZ: "Africa", SN: "Africa", UG: "Africa", TZ: "Africa",
  IN: "Asia", SG: "Asia", HK: "Asia", CN: "Asia", JP: "Asia", KR: "Asia",
  MY: "Asia", TH: "Asia", VN: "Asia", PH: "Asia", PK: "Asia", BD: "Asia",
  LK: "Asia", ID: "Asia",
  AU: "Oceania", NZ: "Oceania",
  BR: "South America", AR: "South America", CO: "South America", CL: "South America",
  PE: "South America", UY: "South America", VE: "South America",
  CR: "Central America", PA: "Central America", GT: "Central America",
  SV: "Central America", HN: "Central America", NI: "Central America",
  DO: "Caribbean", PR: "Caribbean", JM: "Caribbean", TT: "Caribbean",
  BS: "Caribbean", BB: "Caribbean",
};

export function getCountryFormConfig(countryCode?: string | null): CountryFormConfig {
  const c = (countryCode ?? "").toUpperCase();
  const region = COUNTRY_REGION[c];
  const builder = REGION_CONFIGS[region ?? ""];
  const base = builder ? builder() : defaultConfig();
  return applyCountryOverrides(c, base);
}
