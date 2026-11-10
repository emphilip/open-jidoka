# ai-validation Specification

## Purpose
Ensures OpenJEV output is checked before a workflow relies on it, with retries, an independent reviewer model, and escalation to people.

## Requirements

### Requirement: Validation layers
When an AI task defines `validation`, each attempt SHALL be checked by: built-in checks (output present; a decide choice is one of the options), optional JSON Schema, and optional JSONata rules evaluated against `{ output, reasoning, context }` where a falsy result fails with the rule's message. All of these SHALL run and report every issue together.

#### Scenario: Several deterministic failures
- **WHEN** an output violates the schema and two rules
- **THEN** the attempt's validation lists all three issues

### Requirement: Judge review
When `validation.judge` is set and the deterministic checks pass, an independent OpenJEV call SHALL review the task input (including the source document for extractions), the output and the stated reasoning against `criteria`, returning passed, confidence, issues and reasoning. The attempt SHALL fail when the judge does not pass it or its confidence is below `minConfidence` (default 0.7). The judge SHALL NOT run when deterministic checks already failed.

#### Scenario: Low judge confidence
- **WHEN** the judge passes an output with confidence 0.6 and `minConfidence` is 0.8
- **THEN** the attempt fails validation with a confidence issue

### Requirement: Attempts
An AI task SHALL make up to `maxAttempts` attempts (default 2 when validation is set, otherwise 1). Every attempt SHALL be recorded with its output, reasoning and validation result.

#### Scenario: Pass on second attempt
- **WHEN** attempt 1 fails validation and attempt 2 passes
- **THEN** the step continues with attempt 2's output and both attempts appear in the run history

### Requirement: Failure policies
After the final failed attempt, `onFailure` SHALL decide the outcome: `fail` (default) fails the run with the issues; `continue` proceeds with the last output; `humanReview` creates a review task showing the output, reasoning, issues and input.

#### Scenario: Human review approves a correction
- **WHEN** a reviewer approves with a corrected `output`
- **THEN** the step result is the corrected output

#### Scenario: Human review rejects
- **WHEN** a reviewer rejects the review task
- **THEN** the run fails with a review-rejected error naming the reviewer
