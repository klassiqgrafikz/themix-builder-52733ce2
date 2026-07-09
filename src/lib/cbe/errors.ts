// Core Banking Engine — error codes.
// Every rejection produced by the engine uses one of these codes so that
// UI layers, tests, and audit records can react to specific failure modes.

export const CBE_ERROR_CODES = [
  "TENANT_MISMATCH",
  "ACCOUNT_NOT_FOUND",
  "ACCOUNT_FROZEN",
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_CLOSED",
  "ACCOUNT_RESTRICTED",
  "INVALID_CURRENCY",
  "INVALID_AMOUNT",
  "INSUFFICIENT_AVAILABLE_BALANCE",
  "UNSUPPORTED_EVENT",
  "VALIDATION_FAILED",
] as const;
export type CbeErrorCode = (typeof CBE_ERROR_CODES)[number];

export class CbeError extends Error {
  code: CbeErrorCode;
  constructor(code: CbeErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "CbeError";
  }
}
