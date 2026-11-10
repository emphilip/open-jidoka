# human-tasks Specification

## Purpose
Pauses workflows for people: approvals modelled as BPMN user tasks, and reviews of AI output that failed validation.

## Requirements

### Requirement: Task creation
Reaching a user task SHALL create an open task with name, kind (`user` or `review`), optional assignee and candidate groups, resolved instructions, form fields (`text`, `number`, `boolean`, `json`) and resolved context, and the run SHALL wait until it is completed.

#### Scenario: Templated instructions
- **WHEN** a user task's instructions contain `{{ vars.invoice.vendor }}`
- **THEN** the open task shows the vendor's name

### Requirement: Task completion
An open task SHALL be completed with an optional `approved` flag and a result object. The task's step result SHALL be `{ ...result, approved, actor }`. A task SHALL be completable once; later completions SHALL be rejected (HTTP 409) or ignored by the run.

#### Scenario: Complete twice
- **WHEN** a completed task is completed again
- **THEN** the request is rejected with HTTP 409 and the run is unaffected

### Requirement: Inbox
Open tasks SHALL be listable, newest first, with their workflow name, filterable by status and assignee.

#### Scenario: Assignee filter
- **WHEN** tasks are listed for a given assignee
- **THEN** only that assignee's tasks are returned

### Requirement: Task lifecycle with runs
Open tasks SHALL be cancelled when their run ends for any reason.

#### Scenario: Run cancelled while waiting
- **WHEN** a run with an open task is cancelled
- **THEN** the task status becomes cancelled
