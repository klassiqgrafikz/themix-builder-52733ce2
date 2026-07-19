// Canonical translation keys used across the customer portal.
// English strings live here and act as the fallback dictionary for every locale.
// Add new keys here first, then re-run the generator to backfill translations.

export const BASE_DICTIONARY = {
  // Nav
  "nav.dashboard": "Dashboard",
  "nav.accounts": "Accounts",
  "nav.transfer": "Transfer",
  "nav.beneficiaries": "Beneficiaries",
  "nav.transactions": "Transactions",
  "nav.cards": "Cards",
  "nav.statements": "Statements",
  "nav.support": "Support",
  "nav.security": "Security",
  "nav.profile": "Profile",
  "nav.notifications": "Notifications",

  // Shell
  "shell.online_banking": "Online Banking",
  "shell.logout": "Logout",
  "shell.logging_out": "Signing out…",
  "shell.signed_out": "Signed out",
  "shell.menu": "Menu",
  "shell.close": "Close",

  // Common actions
  "action.save": "Save",
  "action.cancel": "Cancel",
  "action.confirm": "Confirm",
  "action.continue": "Continue",
  "action.back": "Back",
  "action.next": "Next",
  "action.done": "Done",
  "action.retry": "Retry",
  "action.download": "Download",
  "action.share": "Share",
  "action.print": "Print",
  "action.copy": "Copy",
  "action.copied": "Copied",
  "action.reveal": "Reveal",
  "action.hide": "Hide",
  "action.freeze": "Freeze",
  "action.unfreeze": "Unfreeze",
  "action.replace": "Replace",
  "action.close": "Close",
  "action.search": "Search",
  "action.submit": "Submit",
  "action.send": "Send",
  "action.view_all": "View all",
  "action.view_details": "View details",

  // Status
  "status.active": "Active",
  "status.pending": "Pending",
  "status.completed": "Completed",
  "status.failed": "Failed",
  "status.frozen": "Frozen",
  "status.blocked": "Blocked",
  "status.processing": "Processing",

  // Dashboard
  "dashboard.welcome": "Welcome back",
  "dashboard.total_balance": "Total balance",
  "dashboard.available_balance": "Available balance",
  "dashboard.quick_actions": "Quick actions",
  "dashboard.recent_transactions": "Recent transactions",
  "dashboard.no_transactions": "No transactions yet",
  "dashboard.my_accounts": "My accounts",
  "dashboard.my_cards": "My cards",
  "dashboard.beneficiaries": "Beneficiaries",
  "dashboard.notifications": "Notifications",
  "dashboard.faq": "Frequently asked questions",

  // Transfer
  "transfer.title": "Make a transfer",
  "transfer.from_account": "From account",
  "transfer.to_account": "To account",
  "transfer.recipient": "Recipient",
  "transfer.amount": "Amount",
  "transfer.description": "Description",
  "transfer.reference": "Reference",
  "transfer.review": "Review transfer",
  "transfer.confirm": "Confirm transfer",
  "transfer.success": "Transfer successful",
  "transfer.receipt": "Receipt",
  "transfer.new_transfer": "New transfer",

  // Transactions
  "tx.title": "Transactions",
  "tx.history": "Transaction history",
  "tx.type": "Type",
  "tx.date": "Date",
  "tx.status": "Status",
  "tx.channel": "Channel",
  "tx.reference": "Reference",
  "tx.balance_before": "Balance before",
  "tx.balance_after": "Balance after",
  "tx.sender": "Sender",
  "tx.recipient": "Recipient",

  // Cards
  "cards.title": "Cards",
  "cards.add_card": "Add card",
  "cards.card_number": "Card number",
  "cards.expiry": "Expiry",
  "cards.cvv": "CVV",
  "cards.cardholder": "Cardholder",
  "cards.frozen_overlay": "Card frozen",

  // Statements
  "statements.title": "Statements",
  "statements.period": "Period",
  "statements.generate": "Generate statement",

  // Support
  "support.title": "Support",
  "support.new_ticket": "New request",
  "support.subject": "Subject",
  "support.message": "Message",
  "support.contact_us": "Contact us",

  // Profile
  "profile.title": "Profile",
  "profile.personal_info": "Personal information",
  "profile.contact_info": "Contact information",
  "profile.first_name": "First name",
  "profile.last_name": "Last name",
  "profile.email": "Email",
  "profile.phone": "Phone",

  // Security
  "security.title": "Security",
  "security.password": "Password",
  "security.change_password": "Change password",
  "security.two_factor": "Two-factor authentication",
  "security.sessions": "Active sessions",

  // Validation
  "validation.required": "This field is required",
  "validation.invalid_email": "Please enter a valid email address",
  "validation.min_length": "Too short",
  "validation.max_length": "Too long",
  "validation.numbers_only": "Numbers only",
  "validation.amount_positive": "Amount must be greater than zero",

  // Notifications / toasts
  "toast.saved": "Saved",
  "toast.error": "Something went wrong",
  "toast.copied": "Copied to clipboard",

  // Module gate
  "gate.title": "Module Not Enabled",
  "gate.description": "{name} is not available for {bank}. If you believe this is a mistake, please contact your bank's support team.",
  "gate.back_to_dashboard": "Back to Dashboard",
} as const;

export type TranslationKey = keyof typeof BASE_DICTIONARY;
export type Dictionary = Partial<Record<TranslationKey, string>>;
