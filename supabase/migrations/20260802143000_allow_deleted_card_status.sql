-- Allow soft-deleted cards (status 'deleted') used by the customer delete-card action.
ALTER TABLE public.bank_cards DROP CONSTRAINT IF EXISTS bank_cards_status_check;
ALTER TABLE public.bank_cards ADD CONSTRAINT bank_cards_status_check
  CHECK (status IN ('active','frozen','blocked','replaced','expired','deleted'));
