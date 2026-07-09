// Financial Event Bus
// -------------------------------------------------------------
// Every completed Core Banking Engine operation publishes an event.
// Downstream subscribers (notifications, analytics, dashboards, and future
// modules like Loans / Cards / Bill Payments) MUST subscribe to this bus
// instead of implementing their own financial workflows.
//
// Events are persisted to `bank_financial_events` for durability and can be
// dispatched to in-process subscribers registered at boot time.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Direction, FinancialEventType } from "./types";

export type FinancialEvent = {
  bank_id: string;
  customer_id: string | null;
  account_id: string | null;
  transaction_id: string | null;
  ledger_entry_id: string | null;
  event_type: FinancialEventType | string;
  direction: Direction | null;
  amount: number | null;
  currency: string | null;
  correlation_id: string | null;
  payload: Record<string, unknown>;
};

export type FinancialSubscriber = (event: FinancialEvent) => Promise<void> | void;

const subscribers: FinancialSubscriber[] = [];

/** Register an in-process subscriber. Failures are swallowed and logged. */
export function subscribeFinancialEvents(handler: FinancialSubscriber): () => void {
  subscribers.push(handler);
  return () => {
    const idx = subscribers.indexOf(handler);
    if (idx >= 0) subscribers.splice(idx, 1);
  };
}

/** Persist and dispatch a completed financial event. */
export async function publishFinancialEvent(event: FinancialEvent): Promise<void> {
  try {
    await supabaseAdmin.from("bank_financial_events").insert({
      bank_id: event.bank_id,
      customer_id: event.customer_id,
      account_id: event.account_id,
      transaction_id: event.transaction_id,
      ledger_entry_id: event.ledger_entry_id,
      event_type: event.event_type,
      direction: event.direction,
      amount: event.amount,
      currency: event.currency,
      correlation_id: event.correlation_id,
      payload: event.payload as never,
    });
  } catch (err) {
    console.error("[cbe.event-bus] persist failed", err);
  }
  for (const sub of subscribers) {
    try {
      await sub(event);
    } catch (err) {
      console.error("[cbe.event-bus] subscriber failed", err);
    }
  }
}
