# connectors Specification

## Purpose
Gives workflows controlled access to enterprise systems through named connections whose secrets stay out of the database.

## Requirements

### Requirement: Connections
A connection SHALL have a unique name (same pattern as workflow keys), a connector type, non-secret config, and an optional `secretEnv` naming a worker environment variable that MUST match `^OPENJIDOKA_SECRET_[A-Z0-9_]+$`. Secret values SHALL NOT be stored in the database or returned by the API.

#### Scenario: Secret outside the allowed prefix
- **WHEN** a connection is saved with `secretEnv` set to `DATABASE_URL`
- **THEN** the request is rejected with HTTP 400

#### Scenario: Secret not set on the worker
- **WHEN** a connector task uses a connection whose secret variable is unset on the worker
- **THEN** the step fails without retrying and names the missing variable

### Requirement: Connector tasks
A `connector` task SHALL call `action` on the named connection with resolved `params`, failing without retrying for unknown connections, connector types or actions.

#### Scenario: Unknown action
- **WHEN** a task calls an action the connector does not have
- **THEN** the step fails and lists the available actions

### Requirement: SharePoint
The `sharepoint` connector SHALL use Microsoft Graph with app-only credentials (tenantId, clientId, client secret) to list files, download files as base64, upload files, create list items and read list items, for a configured site and optional drive.

#### Scenario: Upload
- **WHEN** `uploadFile` is called with folder, filename and content
- **THEN** the file is created or replaced and its id, name, URL and size are returned

### Requirement: Teams
The `teams` connector SHALL post simple cards (`postMessage`: title, text, facts, optional link) and full Adaptive Cards (`postAdaptiveCard`) to a Teams Workflows webhook URL held as the connection secret, which MUST be an https URL.

#### Scenario: Invalid webhook URL
- **WHEN** the secret is not a valid https URL
- **THEN** the step fails without retrying

### Requirement: Outlook
The `outlook` connector SHALL send mail (`sendMail`: to, cc, subject, body, Text or HTML) from the configured or given mailbox via Microsoft Graph with app-only credentials.

#### Scenario: Missing recipients
- **WHEN** `sendMail` is called without `to`
- **THEN** the step fails without retrying

### Requirement: HTTP
The `http` connector SHALL send requests under the connection's base URL with optional query, body and headers, adding the secret as an auth header (default `Authorization: Bearer`), and SHALL return status and parsed JSON or text. Paths that resolve outside the base URL SHALL be rejected.

#### Scenario: Path escape
- **WHEN** a request path is `../admin` or an absolute URL on another host
- **THEN** the request is refused before any network call
