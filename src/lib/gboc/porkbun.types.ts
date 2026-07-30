export type PorkbunRegistrant = {
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  phone: string;
  emailAddress: string;
};

export type PorkbunDomainCheck = {
  domain: string;
  tld: string;
  available: boolean;
  price: number;        // in pennies (USD cents)
  costDisplay: string;  // e.g. "$9.73"
};

export type PorkbunDomainCreateResult = {
  domain: string;
  orderId: number;
  cost: number;
  balance: number;
};

export type PorkbunPricing = {
  [tld: string]: {
    registration: string;
    renewal: string;
    transfer: string;
  };
};
