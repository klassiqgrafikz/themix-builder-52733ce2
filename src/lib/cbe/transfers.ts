// Core Banking Engine — Transfer processor
// -------------------------------------------------------------
// Composes the primitive `processFinancialEvent` pipeline into higher-level
// transfer operations. Every transfer (own, internal, external) flows here.
// No caller may debit or credit two accounts directly — they MUST invoke
// `processOwnTransfer`, `processInternalTransfer`, or `processExternalTransfer`
// so that the ledger, notifications, audit, and event bus stay consistent.

import { randomUUID } from "crypto";
import { processFinancialEvent } from "./engine";
import { publishFinancialEvent } from "./event-bus";
import { CbeError } from "./errors";
import type { Actor, FinancialEventResult } from "./types";

export type TransferKind = "own" | "internal" | "external";

export type TransferRequest = {
  kind: TransferKind;
  bank_id: string;
  source_account_id: string;
  amount: number;
  currency?: string;
  description: string;
  narration?: string | null;
  reference?: string | null;
  transfer_date?: string | null;
  actor: Actor;
  // Own / internal:
  destination_account_id?: string;
  // Internal / external:
  beneficiary_id?: string | null;
  beneficiary?: {
    name: string;
    account_number: string;
    bank_name?: string | null;
    bank_code?: string | null;
  };
  // External simulation fee.
  fee?: number;
};

export type TransferResult = {
  transfer_id: string;
  kind: TransferKind;
  source: FinancialEventResult;
  destination: FinancialEventResult | null;
  fee: FinancialEventResult | null;
};

function baseMeta(transfer_id: string, kind: TransferKind, req: TransferRequest) {
  return {
    transfer_id,
    transfer_kind: kind,
    narration: req.narration ?? null,
    transfer_date: req.transfer_date ?? null,
    beneficiary_id: req.beneficiary_id ?? null,
    beneficiary: req.beneficiary ?? null,
  };
}

export async function processOwnTransfer(req: TransferRequest): Promise<TransferResult> {
  if (!req.destination_account_id) {
    throw new CbeError("VALIDATION_FAILED", "Destination account is required");
  }
  if (req.source_account_id === req.destination_account_id) {
    throw new CbeError("VALIDATION_FAILED", "Source and destination must differ");
  }
  const transfer_id = randomUUID();
  const meta = baseMeta(transfer_id, "own", req);
  const description =
    req.description || `Transfer between your accounts (${transfer_id.slice(0, 8)})`;

  const debit = await processFinancialEvent({
    event: "balance.deduct",
    bank_id: req.bank_id,
    account_id: req.source_account_id,
    amount: req.amount,
    currency: req.currency,
    description,
    category: "transfer_out",
    reference: req.reference ?? transfer_id,
    metadata: { ...meta, leg: "debit" },
    actor: req.actor,
  });
  const credit = await processFinancialEvent({
    event: "balance.add",
    bank_id: req.bank_id,
    account_id: req.destination_account_id,
    amount: req.amount,
    currency: req.currency,
    description,
    category: "transfer_in",
    reference: req.reference ?? transfer_id,
    metadata: { ...meta, leg: "credit" },
    actor: req.actor,
  });

  await publishFinancialEvent({
    bank_id: req.bank_id,
    customer_id: null,
    account_id: req.source_account_id,
    transaction_id: debit.transaction_id,
    ledger_entry_id: debit.ledger_entry_id,
    event_type: "transfer.own.completed",
    direction: null,
    amount: debit.amount,
    currency: debit.currency,
    correlation_id: transfer_id,
    payload: { source: debit, destination: credit, ...meta },
  });

  return { transfer_id, kind: "own", source: debit, destination: credit, fee: null };
}

export async function processInternalTransfer(req: TransferRequest): Promise<TransferResult> {
  if (!req.destination_account_id) {
    throw new CbeError("VALIDATION_FAILED", "Destination account is required");
  }
  const transfer_id = randomUUID();
  const meta = baseMeta(transfer_id, "internal", req);
  const description =
    req.description ||
    `Internal transfer to ${req.beneficiary?.name ?? "beneficiary"} (${transfer_id.slice(0, 8)})`;

  const debit = await processFinancialEvent({
    event: "balance.deduct",
    bank_id: req.bank_id,
    account_id: req.source_account_id,
    amount: req.amount,
    currency: req.currency,
    description,
    category: "transfer_out",
    reference: req.reference ?? transfer_id,
    metadata: { ...meta, leg: "debit" },
    actor: req.actor,
  });
  const credit = await processFinancialEvent({
    event: "balance.add",
    bank_id: req.bank_id,
    account_id: req.destination_account_id,
    amount: req.amount,
    currency: req.currency,
    description,
    category: "transfer_in",
    reference: req.reference ?? transfer_id,
    metadata: { ...meta, leg: "credit" },
    actor: req.actor,
  });

  await publishFinancialEvent({
    bank_id: req.bank_id,
    customer_id: null,
    account_id: req.source_account_id,
    transaction_id: debit.transaction_id,
    ledger_entry_id: debit.ledger_entry_id,
    event_type: "transfer.internal.completed",
    direction: null,
    amount: debit.amount,
    currency: debit.currency,
    correlation_id: transfer_id,
    payload: { source: debit, destination: credit, ...meta },
  });

  return { transfer_id, kind: "internal", source: debit, destination: credit, fee: null };
}

export async function processExternalTransfer(req: TransferRequest): Promise<TransferResult> {
  if (!req.beneficiary) {
    throw new CbeError("VALIDATION_FAILED", "Beneficiary is required for external transfers");
  }
  const transfer_id = randomUUID();
  const meta = baseMeta(transfer_id, "external", req);
  const description =
    req.description ||
    `External transfer to ${req.beneficiary.name} at ${
      req.beneficiary.bank_name ?? "external bank"
    } (${transfer_id.slice(0, 8)})`;

  const debit = await processFinancialEvent({
    event: "balance.deduct",
    bank_id: req.bank_id,
    account_id: req.source_account_id,
    amount: req.amount,
    currency: req.currency,
    description,
    category: "transfer_out_external",
    reference: req.reference ?? transfer_id,
    metadata: { ...meta, leg: "debit", simulated: true },
    actor: req.actor,
  });

  let fee: FinancialEventResult | null = null;
  if ((req.fee ?? 0) > 0) {
    fee = await processFinancialEvent({
      event: "fee",
      bank_id: req.bank_id,
      account_id: req.source_account_id,
      amount: req.fee ?? 0,
      currency: req.currency,
      description: `External transfer fee (${transfer_id.slice(0, 8)})`,
      category: "transfer_fee",
      reference: req.reference ?? transfer_id,
      metadata: { ...meta, leg: "fee" },
      actor: req.actor,
    });
  }

  await publishFinancialEvent({
    bank_id: req.bank_id,
    customer_id: null,
    account_id: req.source_account_id,
    transaction_id: debit.transaction_id,
    ledger_entry_id: debit.ledger_entry_id,
    event_type: "transfer.external.completed",
    direction: "debit",
    amount: debit.amount,
    currency: debit.currency,
    correlation_id: transfer_id,
    payload: { ...meta, source: debit, fee, external_beneficiary: req.beneficiary },
  });

  return { transfer_id, kind: "external", source: debit, destination: null, fee };
}
