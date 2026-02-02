# PRD: Secure Remote Access for Local Dashboard via Cloudflare Tunnel

## Goal
Provide secure, encrypted, authenticated access to the local dashboard from any device using a custom domain and Google (Gmail) login.

## Problem Statement
The dashboard runs locally and needs:
- Remote access from anywhere
- Trusted authentication (Gmail/Google OAuth)
- End-to-end encryption (HTTPS)
- No manual port forwarding or exposed public server

## Target Users
- Primary user (single account)
- Optional trusted devices (phone, laptop)

## Success Criteria
- User can access `https://dashboard.<yourdomain>` from any device
- Google login required for access
- HTTPS enforced (TLS)
- No open inbound ports on router
- Access can be revoked easily
- Setup survives PC reboots

## Scope
In:
- Cloudflare Tunnel to local web server
- Cloudflare Access with Google login
- TLS via Cloudflare
- Custom domain
- Basic operational documentation

Out:
- Multi-user roles
- Data synchronization or cloud storage
- Monitoring or analytics beyond basics

## Functional Requirements
1) Local Hosting
   - Dashboard served via a local static server (e.g., `python -m http.server` or Node).
2) Remote Access
   - Domain `dashboard.<yourdomain>` resolves to the local host via Cloudflare Tunnel.
3) Authentication
   - Only authenticated Gmail account(s) can access.
4) Encryption
   - HTTPS enforced for all connections.
5) Availability
   - Tunnel runs as a service and auto-restarts on reboot.
6) Access Control
   - Ability to whitelist Gmail address(es).

## Non-Functional Requirements
- Security: no public inbound ports; HTTPS only.
- Reliability: 95% availability while PC is on.
- Usability: one URL works on all devices.
- Maintainability: easy to update Access policy and tunnel config.

## Architecture
- Local server: `http://localhost:8000`
- Cloudflare Tunnel: `dashboard.<yourdomain>` -> `http://localhost:8000`
- Auth: Cloudflare Access -> Google OAuth
- TLS: Managed by Cloudflare

## User Flow
1) User visits `https://dashboard.<yourdomain>`.
2) Cloudflare Access prompts for Gmail login.
3) If Gmail address is allowed, access is granted and the local dashboard is proxied.

## Security
- Google OAuth authentication
- HTTPS/TLS for all traffic
- No inbound router port forwarding
- Access policy restricted to specific Gmail address(es)

## Implementation Plan (High-Level)
1) Domain Setup
   - Add domain to Cloudflare
   - Set DNS to Cloudflare nameservers
2) Local Server
   - Serve dashboard at `localhost:8000`
3) Cloudflared Tunnel
   - Install Cloudflared
   - Create tunnel and map hostname
4) Cloudflare Access
   - Create Access Application for `dashboard.<yourdomain>`
   - Add Gmail allowlist
5) Run as Service
   - Register cloudflared as Windows service
6) Verification
   - Test on phone/laptop using the public URL

## Risks
- PC must be on for access
- Misconfigured Access policies could lock out the user
- If domain/DNS is misconfigured, the URL will not resolve

## Open Questions
- Exact domain name?
- Preferred local web server (Python or Node)?
- Additional Gmail accounts to allow?
