// Shared "currently selected bank" state for the legacy Admin shell.
// The Admin portal is now a navigation shell that hands off every
// operational tool to the corresponding GBOC page. The selected bank
// is persisted in localStorage so it survives navigations.
import { useEffect, useState } from "react";

const KEY = "themix.admin.selected_bank";
const EVT = "themix:admin-selected-bank";

export function getSelectedBankId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setSelectedBankId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {
    /* ignore */
  }
}

export function useSelectedBankId(): [string | null, (id: string | null) => void] {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    setId(getSelectedBankId());
    const onChange = () => setId(getSelectedBankId());
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return [id, setSelectedBankId];
}

// Map an Admin section slug to a GBOC destination. Returns null when
// the section has no operational GBOC counterpart yet (e.g. Simulation).
export type GbocTarget =
  | { to: "/gboc/operations"; search: { bank: string } }
  | { to: "/gboc/customers"; search?: undefined }
  | { to: "/gboc/transactions"; search?: undefined }
  | { to: "/gboc/notifications"; search?: undefined }
  | { to: "/gboc/communications"; search?: undefined }
  | { to: "/gboc/audit"; search?: undefined };

export function adminSectionToGboc(section: string, bankId: string): GbocTarget | null {
  switch (section) {
    case "balance-adder":
    case "balance-deductor":
    case "freeze":
    case "restrictions":
    case "clear-balance":
      return { to: "/gboc/operations", search: { bank: bankId } };
    case "customers":
      return { to: "/gboc/customers" };
    case "transactions":
      return { to: "/gboc/transactions" };
    case "notifications":
      return { to: "/gboc/notifications" };
    case "chat":
      return { to: "/gboc/communications" };
    case "audit":
      return { to: "/gboc/audit" };
    case "simulation":
    default:
      return null;
  }
}
