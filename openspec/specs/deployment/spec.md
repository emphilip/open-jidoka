# deployment Specification

## Purpose
Defines how OpenJidoka is packaged, configured and started, so the whole platform runs from containers with durable state.

## Requirements

### Requirement: Containerized stack
The platform SHALL run with Docker Compose as Postgres, Temporal (persisting to Postgres), Temporal UI, API, worker and admin UI containers, publishing ports only on localhost, with host ports configurable (`ADMIN_PORT`, `API_HOST_PORT`, `TEMPORAL_UI_PORT`) and workers scalable (`WORKER_REPLICAS`).

#### Scenario: Required secrets missing
- **WHEN** the stack is started without `POSTGRES_PASSWORD` or `ADMIN_API_TOKEN`
- **THEN** Compose refuses to start with a message naming the variable

### Requirement: Admin delivery
The admin UI container SHALL serve the built app with client-side routes falling back to the app, proxy `/api` to the API, and send `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy` headers.

#### Scenario: Deep link served
- **WHEN** `/workflows/<id>` is requested from the admin container
- **THEN** the app is returned with HTTP 200

### Requirement: Migrations
Database migrations SHALL apply automatically, once and in order, when the API or worker starts, safely when several start together, and SHALL be recorded so each runs once.

#### Scenario: Concurrent start
- **WHEN** the API and worker start at the same time against an empty database
- **THEN** each migration is applied exactly once

### Requirement: Seed data
A one-shot, idempotent seed SHALL create and publish the example invoice-approval workflow and placeholder Teams and SharePoint connections.

#### Scenario: Seed twice
- **WHEN** the seed runs twice
- **THEN** no duplicates are created

### Requirement: Configuration
All credentials and environment-specific settings SHALL come from environment variables (`.env`, never committed), documented in `.env.example` with placeholder values that are safe to source in a shell.

#### Scenario: Example file sourced
- **WHEN** `.env.example` is sourced by a POSIX shell
- **THEN** it loads without syntax errors
