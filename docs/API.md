# API Reference

## Health

### `GET /health`

Returns:

```json
{ "ok": true }
```

## State

### `GET /api/state`

Returns:

```json
{ "version": 1, "data": { "...": "..." } }
```

### `POST /api/state`

Accepts:

```json
{ "version": 1, "updatedAt": "ISO_DATE", "data": { "...": "..." } }
```

Backward compatible payloads with direct object body are accepted.

Errors:

- `400 invalid_payload`
- `400 invalid_state_data`

## Backups

### `GET /api/state/backups`

Lists primary and secondary backup snapshots.

### `POST /api/state/backups/upload`

Body:

```json
{ "name": "optional_name", "backup": { "version": 1, "data": {} } }
```

### `POST /api/state/backups/restore`

Body:

```json
{ "name": "server_state_....json", "source": "primary" }
```

## Agent (optional)

- `GET /api/agent/health`
- `POST /api/agent/chat`
- `GET /api/agent/runtime`
- `POST /api/agent/runtime/task`
- `POST /api/agent/runtime/maintenance`
- `POST /api/agent/runtime/command`
