# workflow-definitions Specification

## Purpose
Lets designers create BPMN workflow definitions, edit drafts, validate them, and publish immutable versions that runs execute.

## Requirements

### Requirement: Workflow identity
Each workflow SHALL have a unique, immutable key matching `^[a-z0-9][a-z0-9_-]{1,62}$`, a name and an optional description.

#### Scenario: Duplicate key
- **WHEN** a workflow is created with a key that already exists
- **THEN** the request is rejected with HTTP 409

#### Scenario: Invalid key
- **WHEN** a workflow is created with a key containing uppercase letters or spaces
- **THEN** the request is rejected with HTTP 400

### Requirement: Drafts
A workflow SHALL have one editable draft BPMN document. Creating a workflow without BPMN SHALL produce a draft containing a single start event. Imported BPMN without diagram layout SHALL be given a generated layout so it can be displayed.

#### Scenario: Import BPMN authored as code
- **WHEN** a workflow is created with BPMN XML that has no diagram interchange
- **THEN** the stored draft contains generated shape positions and opens in the modeler

### Requirement: Supported BPMN elements
The system SHALL execute plain start events, end events, tasks (task, service, send, business rule, script), user tasks, exclusive gateways, parallel gateways, intermediate timer catch events with ISO 8601 durations, and sequence flows with optional conditions. Text annotations, associations and data objects SHALL be ignored. Any other element SHALL be a validation error.

#### Scenario: Unsupported element
- **WHEN** a draft containing a sub-process or boundary event is validated
- **THEN** validation reports an error referencing that element

### Requirement: Task configuration
Task configuration SHALL be stored in the BPMN file as a `jidoka:taskConfig` extension element (namespace `http://openjidoka.dev/schema/bpmn/1.0`) with `taskType` and `resultVariable` attributes and a JSON object body. Supported task types SHALL be `openjev.prompt`, `openjev.extract`, `openjev.decide`, `connector` and `transform`.

#### Scenario: Script task without explicit type
- **WHEN** a script task has no task type
- **THEN** it is treated as a `transform` task whose expression is the script body or `config.expression`

### Requirement: Validation errors
Validation SHALL return errors, each optionally referencing a BPMN element id, for: no start or no end event; elements other than end events without outgoing flows; end events with outgoing or start events with incoming flows; tasks without a known task type or missing required config; config that is not a JSON object; exclusive gateway flows that have no condition and are not the default; invalid timer durations; and JSONata syntax errors.

#### Scenario: Gateway flow without condition
- **WHEN** an exclusive gateway has two outgoing flows, neither of which is the default and one has no condition
- **THEN** validation reports an error on the flow without a condition

### Requirement: Validation warnings
Validation SHALL return warnings, which do not block publishing, for unreachable elements, AI tasks without validation, and parallel gateways that both join and split.

#### Scenario: Mixed parallel gateway
- **WHEN** a parallel gateway has more than one incoming and more than one outgoing flow
- **THEN** validation reports a warning that it waits for all incoming flows

### Requirement: Publishing
Publishing SHALL validate the submitted or draft BPMN and, when it has no errors, store it with its executable form as the next version number (starting at 1). Published versions SHALL be immutable. Publishing with errors SHALL be rejected with HTTP 422 and the error list.

#### Scenario: Publish twice
- **WHEN** a valid workflow is published twice
- **THEN** versions 1 and 2 exist and version 1 is unchanged

### Requirement: Archiving
Workflows SHALL be archivable and restorable. Archived workflows SHALL be hidden from the default list and SHALL NOT start new runs.

#### Scenario: Start an archived workflow
- **WHEN** a run is requested for an archived workflow
- **THEN** the request is rejected with HTTP 409
