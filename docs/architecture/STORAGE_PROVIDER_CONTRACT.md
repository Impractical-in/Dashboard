# Storage Provider Contract (Future Multi-Device Sync)

## Goal

Enable switching between:

- local browser storage
- dashboard server storage
- future Google-backed storage as canonical source of truth

without rewriting feature pages.

## Required interface

Provider must implement:

- `init(): Promise<void>`
- `load(key, fallback): any`
- `save(key, value): Promise<void> | void`
- `snapshot(): object`
- `restore(snapshot): Promise<void> | void`
- `health(): { mode: string, writable: boolean }`

## Behavioral rules

- Reads must be deterministic and return JSON-safe values.
- Writes must be idempotent per key/value payload.
- Provider should preserve last-write metadata (`updatedAt`) for merge strategy.
- On network failure, provider should degrade to local cache and queue retries.

## Google-backed canonical mode (planned)

- Canonical data resides in Google-backed storage.
- Local browser and server cache are replicas.
- Conflict handling should be explicit:
  - server timestamp ordering for non-collaborative records
  - field-level merge for structured docs where feasible
