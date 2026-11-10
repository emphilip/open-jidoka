# platform-access Specification

## Purpose
Controls access to the API, attributes actions for audit, and lets external systems trigger workflows.

## Requirements

### Requirement: Authentication
Every `/api` endpoint except `/api/health` SHALL require `Authorization: Bearer <ADMIN_API_TOKEN>`, compared in constant time. The API SHALL refuse to start when the token is missing or shorter than 16 characters.

#### Scenario: Missing token
- **WHEN** a request to `/api/workflows` has no bearer token
- **THEN** it is rejected with HTTP 401

### Requirement: Actor attribution
The optional `X-OpenJidoka-Actor` header SHALL name the actor recorded for an action (default `admin`, max 200 characters). It is attribution, not proof of identity.

#### Scenario: Actor recorded
- **WHEN** a workflow is published with `X-OpenJidoka-Actor: alice@example.com`
- **THEN** the version and audit entry record that actor

### Requirement: Audit log
Every mutating action (workflow create, update, archive, publish; run start, cancel; task completion; connection create, update, delete) SHALL be written to an append-only audit log with actor, action, entity type and id, details and time, readable newest first.

#### Scenario: Task completion audited
- **WHEN** a task is completed
- **THEN** an audit entry `task.complete` with the run id and approval flag is recorded

### Requirement: Triggers
`POST /api/triggers/:key` SHALL start the latest published version of the workflow with that key, using the JSON body as input, and record the trigger as `trigger:<actor>`.

#### Scenario: Unknown key
- **WHEN** a trigger is called for a key that does not exist
- **THEN** it is rejected with HTTP 404

### Requirement: Error responses
Invalid input SHALL return HTTP 400 with the validation issues; missing resources 404; conflicts 409; publish validation failures 422; Temporal unavailability 503; unexpected errors 500 without internal details.

#### Scenario: Temporal down
- **WHEN** a run is started while Temporal is unreachable
- **THEN** the API returns 503 and the run is recorded as failed
