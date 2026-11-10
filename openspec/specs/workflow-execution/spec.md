# workflow-execution Specification

## Purpose
Runs published workflow versions durably, so runs survive worker and server restarts and follow BPMN token semantics.

## Requirements

### Requirement: Starting runs
A run SHALL be started from a published version with a JSON object input, defaulting to the latest version. Each run SHALL have a unique id that is also its durable workflow id, and SHALL record who triggered it.

#### Scenario: No published version
- **WHEN** a run is requested for a workflow that has never been published
- **THEN** the request is rejected with HTTP 409

### Requirement: Version pinning
A run SHALL execute the version it started with, even if newer versions are published while it is in flight.

#### Scenario: Publish during a run
- **WHEN** version 2 is published while a version 1 run waits on a user task
- **THEN** the run continues and completes on version 1's graph

### Requirement: Durability
Run progress SHALL survive restarts of workers and the API. Waiting states (user tasks, timers) SHALL have no time limit unless the model defines one.

#### Scenario: Worker restart while waiting
- **WHEN** the worker restarts while a run waits on a user task and the task is then completed
- **THEN** the run resumes and completes

### Requirement: Run data and expressions
Expressions SHALL be JSONata evaluated against `input`, `vars`, `nodes` and `run` (`id`, `workflow`). In task config, a string starting with `=` SHALL be replaced by its expression value and `{{ expr }}` placeholders SHALL be interpolated. Each task result SHALL be stored under `nodes.<elementId>` and, when a result variable is set, under `vars.<resultVariable>`. A completed run's output SHALL be its final `vars`.

#### Scenario: Template interpolation
- **WHEN** a config string is `"Invoice {{ vars.invoice.number }}"` and `vars.invoice.number` is `INV-1`
- **THEN** the task receives `"Invoice INV-1"`

### Requirement: Routing
An exclusive gateway SHALL follow the first outgoing flow whose condition is true, then the default flow, and SHALL fail the run when neither exists. A parallel gateway SHALL follow all outgoing flows and SHALL wait for all incoming flows before continuing. Other elements SHALL follow every outgoing flow whose condition is absent or true. Loops SHALL be allowed.

#### Scenario: Parallel join never satisfied
- **WHEN** fewer tokens reach a parallel join than it has incoming flows and no other tokens remain
- **THEN** the run fails with an error naming the gateway instead of completing

### Requirement: Timers
Intermediate timer events SHALL pause the token for their duration without holding resources.

#### Scenario: Two-day wait
- **WHEN** a token reaches a `P2D` timer
- **THEN** it continues two days later

### Requirement: Failure handling
Errors that retrying cannot fix (invalid configuration, missing secrets, 4xx responses, expression runtime errors, validation failure) SHALL fail the run immediately with a message. Transient errors (network failures, 408, 429, 5xx, malformed model JSON) SHALL be retried per the task's retry policy (defaults: 5 attempts, 2s initial interval, backoff 2, 5 minute maximum interval). A run SHALL fail after 5,000 element executions.

#### Scenario: Expression error at runtime
- **WHEN** a transform expression throws during a run
- **THEN** the run is marked failed with the expression error and the failing step is recorded

### Requirement: Run status
Run status SHALL be one of `pending`, `running`, `completed`, `failed`, `cancelled`, `terminated`. Terminal statuses SHALL never change. When a run ends outside the normal path (for example terminated by an operator), its status SHALL be reconciled the next time it is read.

#### Scenario: Late status write
- **WHEN** a status update arrives for a run that is already completed
- **THEN** the stored status stays completed

### Requirement: Cancellation
Running or pending runs SHALL be cancellable. Cancelling SHALL mark the run cancelled and cancel its open user tasks.

#### Scenario: Cancel a finished run
- **WHEN** cancellation is requested for a completed run
- **THEN** the request is rejected with HTTP 409

### Requirement: Step history
The system SHALL record a step for every AI attempt, connector call, transform and user task, with status, input, output, reasoning, validation result, error and timestamps.

#### Scenario: Live run state
- **WHEN** a running run is read
- **THEN** the response includes the active, completed and failed element ids and current variables
