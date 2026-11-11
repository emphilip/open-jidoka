# Spec Delta

## ADDED Requirements

### Requirement: Responsive layout
Every admin screen SHALL be usable from 360px wide upwards without horizontal page scrolling. On screens narrower than 1024px the navigation SHALL collapse into a drawer opened from a menu button; from 1024px it SHALL be a fixed sidebar. Wide tables MAY scroll horizontally within their own container.

#### Scenario: Navigate on a phone
- **WHEN** a signed-in user on a 390px wide screen taps the menu button and chooses Runs
- **THEN** the drawer closes and the runs list is shown without horizontal page scrolling

#### Scenario: Desktop sidebar
- **WHEN** the window is at least 1024px wide
- **THEN** the navigation is always visible and the current section is highlighted

### Requirement: Status presentation
Run, step and task statuses SHALL be shown as labelled badges with the status name in text; color SHALL only reinforce the text. Validation failures, errors and success messages SHALL be shown as alerts with a text title.

#### Scenario: Failed run badge
- **WHEN** a run has status failed
- **THEN** its badge reads "failed" and its error is shown in an error alert on the run page

### Requirement: Empty states
The workflows, runs, task inbox and connections screens SHALL show an empty state explaining what belongs there and offering the next action when they have no items.

#### Scenario: No workflows yet
- **WHEN** a user opens Workflows and none exist
- **THEN** an empty state explains workflows and offers to create one or import a BPMN file

#### Scenario: Empty inbox
- **WHEN** no tasks are open
- **THEN** the task inbox says nothing is waiting and links to the runs list
