# ai-tasks Specification

## Purpose
Defines how workflow steps use OpenJEV for free-form reasoning, structured document extraction and constrained decisions, always capturing the model's reasoning.

## Requirements

### Requirement: OpenJEV client
All model calls SHALL go through one OpenJEV client interface, selected by `OPENJEV_MODE`: `mock` (default; schema-shaped fake data, no network) or `http` (an OpenAI-compatible chat completions endpoint at `OPENJEV_BASE_URL` with `OPENJEV_API_KEY` and `OPENJEV_MODEL`). Requests SHALL time out after `OPENJEV_TIMEOUT_MS` (default 120000).

#### Scenario: Missing http configuration
- **WHEN** the worker starts with `OPENJEV_MODE=http` and no base URL or model
- **THEN** it fails to start with an error naming the missing settings

### Requirement: Reasoning capture
Every OpenJEV task SHALL request structured JSON containing the result and a reasoning string, and SHALL record both.

#### Scenario: Prompt without output schema
- **WHEN** an `openjev.prompt` task has no `outputSchema`
- **THEN** the result is a string and reasoning is still recorded

### Requirement: Prompt tasks
`openjev.prompt` SHALL send the resolved prompt and optional system message, model and temperature, and return a value matching `outputSchema` when given.

#### Scenario: Structured prompt
- **WHEN** a prompt task defines an object `outputSchema`
- **THEN** the step output is an object of that shape

### Requirement: Document extraction
`openjev.extract` SHALL send the document with the extraction instructions and schema at temperature 0, and return an object matching the schema with null for absent fields. Text-like documents (text/*, JSON, XML, CSV) SHALL be inlined; other files SHALL be attached.

#### Scenario: PDF document
- **WHEN** the document is a PDF
- **THEN** it is attached to the request rather than inlined as text

### Requirement: Document sources
Documents SHALL be loadable from `text`, `base64`, `url` or a SharePoint item reference. URL documents SHALL be http(s) only, SHALL NOT follow redirects, and SHALL respect `DOCUMENT_URL_ALLOWLIST` when set. Documents SHALL NOT exceed `DOCUMENT_MAX_BYTES` (default 20 MiB).

#### Scenario: Host not allowed
- **WHEN** `DOCUMENT_URL_ALLOWLIST` is set and a document URL's host is not in it
- **THEN** the step fails without retrying

### Requirement: Decisions
`openjev.decide` SHALL require at least two options and return `{ choice, confidence, reasoning }`, where choice is one of the options and confidence is between 0 and 1.

#### Scenario: Routing on a decision
- **WHEN** a decide task stores its result in `vars.decision` and a following gateway checks `vars.decision.choice`
- **THEN** the run follows the flow matching the model's choice

### Requirement: Feedback on retry
When an attempt fails validation, the next attempt's prompt SHALL include the validation issues and ask for a corrected answer.

#### Scenario: Second attempt
- **WHEN** attempt 1 fails with "Total must be positive"
- **THEN** attempt 2's prompt contains that issue
