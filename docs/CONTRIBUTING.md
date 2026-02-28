# Contributing

## Prerequisites

- Node.js 20+
- npm 10+

## Setup

1. `npm install`
2. `npm run version:check`
3. `npm run verify`

## Development

- Start app: `npm start`
- Local script runtime: `./script_test/start.ps1 -OpenBrowser -ForceRestart`

## Quality gates

- Lint: `npm run lint`
- Tests: `npm test`
- Formatting: `npm run format:check`
- Full gate: `npm run verify`

## Scope boundaries

- Keep browser-only code in `public/js`.
- Keep server concerns in `server/`.

## Commit hygiene

- Prefer small, focused commits.
- Include a test or validation step for behavior changes.
- Update docs when introducing new runtime flags, endpoints, or storage behavior.
