# Security Policy

## Supported scope

This policy applies to:

- `public/`
- `server/`
- `script_test/`
- workflow/config files in repo root

## Reporting a vulnerability

Please avoid opening public issues for sensitive findings.

Send details to project maintainers with:

- impact summary
- reproduction steps
- affected paths/endpoints
- suggested remediation

## Baseline controls in this repo

- Security headers are set by the Node server.
- Request payload size is bounded.
- State payloads are validated as JSON-safe objects.
- CI runs dependency audit and CodeQL scanning.

## Secrets handling

- Do not commit API tokens, credentials, or private keys.
- Keep runtime secrets in environment variables.
- Rotate any secret immediately if exposure is suspected.
