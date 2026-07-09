// Customer Banking Platform — shared types (client + server safe).

export type CustomerAccount = {
  id: string;
  customer_id: string;
  bank_id: string;
  account_number: string;
  account_name: string;
  currency: string;
  account_type: string;
  status: string;
  current_balance: number;
  available_balance: number;
  created_at: string;
  updated_at: string;
  iban: string | null;
  swift_bic: string | null;
  routing_number: string | null;
  sort_code: string | null;
  bsb: string | null;
  transit_number: string | null;
  institution_number: string | null;
};

export type CustomerProfile = {
  id: string;
  bank_id: string;
  customer_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  country: string | null;
  nationality: string | null;
  email_verified: boolean;
  status: string;
  profile_picture_url: string | null;
  notification_prefs: Record<string, string | number | boolean | null>;
  created_at: string;
  updated_at: string;
};

export type CustomerSession = {
  customer: CustomerProfile;
  accounts: CustomerAccount[];
};

export type LoginEvent = {
  id: string;
  event: string;
  ip: string | null;
  user_agent: string | null;
  at: string;
};
