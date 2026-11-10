-- Project renamed from JEV Flow to OpenJidoka: connection secrets now use the OPENJIDOKA_SECRET_ prefix.
ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_secret_env_check;

UPDATE connections
SET secret_env = regexp_replace(secret_env, '^JEVFLOW_SECRET_', 'OPENJIDOKA_SECRET_'),
    updated_at = now()
WHERE secret_env LIKE 'JEVFLOW\_SECRET\_%';

ALTER TABLE connections ADD CONSTRAINT connections_secret_env_check
  CHECK (secret_env IS NULL OR secret_env ~ '^OPENJIDOKA_SECRET_[A-Z0-9_]+$');
