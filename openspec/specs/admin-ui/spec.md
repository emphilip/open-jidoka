# admin-ui Specification

## Purpose
Browser application for designing workflows, operating runs, handling human tasks, and managing connections and audit.

## Requirements

### Requirement: Sign-in
The admin UI SHALL require the admin API token and a display name before showing any screen, keep them in the browser, send the name as the actor, and return to sign-in when the API responds 401.

#### Scenario: Expired token
- **WHEN** any API call returns 401
- **THEN** the stored token is cleared and the sign-in screen is shown

### Requirement: Navigation
The UI SHALL provide navigation to Workflows, Runs, Task inbox, Connections and Audit log, and a sign-out action.

#### Scenario: Deep link
- **WHEN** a user opens `/runs/<id>` directly
- **THEN** that run's page loads after sign-in

### Requirement: Modeler properties panel
The workflow screen SHALL provide a BPMN modeler with a properties panel for the selected element: name; for tasks the task type, result variable and JSON config with a per-type template; for user tasks the result variable and config; for sequence flows the JSONata condition and default-flow toggle; for timers the ISO 8601 duration.

#### Scenario: Invalid JSON config
- **WHEN** a user enters invalid JSON in a task's config
- **THEN** the panel shows the parse error and does not save it to the diagram

### Requirement: Modeler actions
The workflow screen SHALL save drafts, validate, publish, list published versions, and start a run of the live version with JSON input. Validation problems SHALL be marked on their elements, and clicking a problem SHALL select its element.

#### Scenario: Click a validation problem
- **WHEN** validation reports an error on a task and the user clicks it in the problem list
- **THEN** that task is selected in the modeler

### Requirement: Workflow list
The UI SHALL list workflows with key, live version and last update, allow archiving and restoring, and create workflows from a key, name, description and optional BPMN file.

#### Scenario: Import a BPMN file
- **WHEN** a user creates a workflow with a `.bpmn` file
- **THEN** the modeler opens with that diagram

### Requirement: Runs
The UI SHALL list runs filterable by status and workflow, and show a run's status, timing, error, input, output or current variables, its diagram with active, completed and failed elements highlighted, and its steps with attempt, status, validation issues, judge confidence and reasoning, output and errors. Running runs SHALL refresh automatically and SHALL be cancellable after confirmation.

#### Scenario: Filter steps by element
- **WHEN** a user clicks an element in the run diagram
- **THEN** only that element's steps are listed

### Requirement: Task inbox
The UI SHALL list open tasks with instructions, context and their form fields, distinguish AI review tasks, and complete them with Approve or Reject, parsing `json` fields and reporting invalid JSON.

#### Scenario: Approve a review with a correction
- **WHEN** a reviewer enters corrected output JSON and approves
- **THEN** the task is completed with that output and disappears from the inbox

### Requirement: Connections and audit
The UI SHALL list, create, edit and delete connections using each connector type's config fields and secret description, and show the audit log.

#### Scenario: Delete a connection
- **WHEN** a user deletes a connection
- **THEN** they are asked to confirm first
