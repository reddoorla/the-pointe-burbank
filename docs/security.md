# Security

This starter maps to **OWASP ASVS Level 2** as a baseline and treats the OWASP Top 10 as a checklist gated in CI.

## Defaults shipped

### Headers

- **Content-Security-Policy** — strict allowlist per directive ([svelte.config.js](../svelte.config.js)). `default-src 'self'`, `script-src` whitelisted to Prismic + Vimeo, `frame-ancestors 'self'` (clickjacking), `form-action 'self'`, `base-uri 'self'`. Violations POST to `/api/csp-report`.
- **HSTS** — `max-age=63072000; includeSubDomains; preload` ([netlify.toml](../netlify.toml)).
- **X-Frame-Options** `SAMEORIGIN`, **X-Content-Type-Options** `nosniff`, **Referrer-Policy** `strict-origin-when-cross-origin`, **Permissions-Policy** disabling camera/microphone/geolocation/FLoC, **Cross-Origin-Opener-Policy** `same-origin`.
- Headers are set both at the edge ([netlify.toml](../netlify.toml)) and in [hooks.server.ts](../src/hooks.server.ts) so they travel with the app, not the host.

### Output handling

- SvelteKit auto-escapes all template interpolation. `{@html}` is reserved for Prismic-typed serializers; never used with user input.
- No `dangerouslySetInnerHTML`-style escape hatches in the starter.

### Dependency hygiene

- **Dependabot** opens grouped monthly PRs for npm and GitHub Actions ([.github/dependabot.yml](../.github/dependabot.yml)). Routine cadence — high-severity CVEs are caught immediately by the per-PR `pnpm audit` gate, independent of Dependabot's schedule.
- **`pnpm audit --audit-level=high`** runs on every PR. High and critical CVEs fail CI.
- Lockfile (`pnpm-lock.yaml`) committed and CI uses `--frozen-lockfile`.

## OWASP Top 10 mapping

| Risk                                             | Coverage                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| **A01 Broken Access Control**                    | Server-only secrets via env vars; no client-side auth in the starter                            |
| **A02 Cryptographic Failures**                   | TLS-only via HSTS preload                                                                       |
| **A03 Injection**                                | Auto-escaped templates; parameterize when adding a DB                                           |
| **A04 Insecure Design**                          | Threat model produced during discovery                                                          |
| **A05 Security Misconfiguration**                | Locked CSP + headers ([svelte.config.js](../svelte.config.js), [netlify.toml](../netlify.toml)) |
| **A06 Vulnerable & Outdated Components**         | `pnpm audit` on every PR + Dependabot monthly grouped updates                                   |
| **A07 Identification & Authentication Failures** | Use vetted providers (Auth.js, Clerk, Supabase Auth) when adding auth — never roll your own     |
| **A08 Software & Data Integrity Failures**       | Lockfile pinned; SRI when third-party scripts are added                                         |
| **A09 Logging & Monitoring**                     | CSP violations land at `/api/csp-report`; forward to a real sink in production                  |
| **A10 SSRF**                                     | Outbound calls go through an allowlist; no user-controlled URLs are dereferenced                |

## CSP violation reports

The endpoint is at [`/api/csp-report`](../src/routes/api/csp-report/+server.ts). It accepts both legacy `application/csp-report` bodies and the modern `application/reports+json` batched format, and currently `console.warn`s the payload.

**Before launch**, replace the `console.warn` with a forwarder to your monitoring system (Sentry, Datadog, Logflare). Treat repeated violations from the same `blocked-uri` as a real signal — either a misconfigured CDN or an exploit attempt.

## Adding a new origin to CSP

Whenever you add a third-party CDN, analytics tag, or embed:

1. Identify the directive that controls it (`script-src`, `img-src`, `frame-src`, `connect-src`).
2. Add the host to that directive in [svelte.config.js](../svelte.config.js). Prefer specific subdomains over `*.example.com`.
3. Verify locally — open DevTools console, look for CSP violation messages.
4. After deploy, watch `/api/csp-report` logs for missed cases.

## Pre-launch security review

Run through [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) chapters V1–V14 and produce a remediation report. Pay particular attention to:

- V2 Authentication, V3 Session Management — if auth is added
- V5 Validation, Sanitization, Encoding — for any user input
- V8 Data Protection — for any PII
- V13 API & Web Service — for backend endpoints

## Reporting vulnerabilities

If you find a vulnerability in this starter, please email contact@tuckerlemos.com rather than opening a public issue.
