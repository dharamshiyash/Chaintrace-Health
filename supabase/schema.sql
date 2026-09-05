-- User profiles (wallet-linked, not email auth)
CREATE TABLE profiles (
  address     TEXT PRIMARY KEY,         -- checksummed EOA
  role        TEXT NOT NULL,            -- 'manufacturer' | 'distributor' | 'pharmacy'
  org_name    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Batch metadata mirror (search index, QR URLs)
CREATE TABLE batches (
  batch_id        TEXT PRIMARY KEY,
  medicine_name   TEXT,
  manufacturer    TEXT REFERENCES profiles(address),
  status          TEXT,
  qr_url          TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Transaction performance log
CREATE TABLE tx_performance (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name   TEXT,
  tx_hash         TEXT,
  gas_used        BIGINT,
  confirmation_ms BIGINT,
  execution_ms    BIGINT,
  success         BOOLEAN,
  recorded_at     TIMESTAMPTZ DEFAULT now()
);
