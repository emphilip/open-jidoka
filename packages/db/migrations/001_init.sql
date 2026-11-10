CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE workflow_definitions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  draft_xml    text NOT NULL,
  archived     boolean NOT NULL DEFAULT false,
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workflow_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id  uuid NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  version        integer NOT NULL,
  bpmn_xml       text NOT NULL,
  ir             jsonb NOT NULL,
  published_by   text NOT NULL,
  published_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (definition_id, version)
);

CREATE TABLE workflow_runs (
  id             uuid PRIMARY KEY,
  definition_id  uuid NOT NULL REFERENCES workflow_definitions(id),
  version_id     uuid NOT NULL REFERENCES workflow_versions(id),
  status         text NOT NULL CHECK (status IN ('pending','running','completed','failed','cancelled','terminated')),
  input          jsonb NOT NULL DEFAULT '{}'::jsonb,
  output         jsonb,
  error          text,
  triggered_by   text NOT NULL,
  started_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz
);
CREATE INDEX workflow_runs_definition_idx ON workflow_runs (definition_id, started_at DESC);
CREATE INDEX workflow_runs_status_idx ON workflow_runs (status, started_at DESC);

CREATE TABLE step_executions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  node_id       text NOT NULL,
  node_name     text,
  task_type     text,
  attempt       integer NOT NULL DEFAULT 1,
  status        text NOT NULL CHECK (status IN ('completed','failed','validation_failed','waiting')),
  input         jsonb,
  output        jsonb,
  reasoning     text,
  validation    jsonb,
  error         text,
  started_at    timestamptz NOT NULL,
  completed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX step_executions_run_idx ON step_executions (run_id, started_at);

CREATE TABLE user_tasks (
  id               uuid PRIMARY KEY,
  run_id           uuid NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  node_id          text NOT NULL,
  name             text NOT NULL,
  kind             text NOT NULL CHECK (kind IN ('user','review')),
  assignee         text,
  candidate_groups text[] NOT NULL DEFAULT '{}',
  instructions     text,
  form             jsonb NOT NULL DEFAULT '[]'::jsonb,
  context          jsonb,
  status           text NOT NULL CHECK (status IN ('open','completed','cancelled')),
  result           jsonb,
  completed_by     text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz
);
CREATE INDEX user_tasks_open_idx ON user_tasks (status, created_at DESC);

CREATE TABLE connections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE CHECK (name ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  type        text NOT NULL,
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_env  text CHECK (secret_env IS NULL OR secret_env ~ '^JEVFLOW_SECRET_[A-Z0-9_]+$'),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id           bigserial PRIMARY KEY,
  actor        text NOT NULL,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    text,
  details      jsonb,
  at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_at_idx ON audit_log (at DESC);
