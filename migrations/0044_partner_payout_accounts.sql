CREATE TABLE partner_payout_accounts (
  partner_id TEXT PRIMARY KEY REFERENCES partners(id),
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
