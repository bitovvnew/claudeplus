---
name: security-checklist
description: "A practical security pass for web apps and APIs (OWASP-style). Use before releases or when touching auth, payments, file uploads or user input."
---

# Security Checklist

Assume every input is hostile.

## Check
- AuthN/AuthZ on every route; object-level permission checks (no IDOR).
- Parameterized queries; output encoding; CSP for web UIs.
- Secrets only from env/secret store; rotate anything that was ever committed.
- File uploads: type/size limits, stored outside web root, scanned if public.
- Rate limiting and lockouts on auth; secure cookies (HttpOnly, Secure, SameSite).
- Dependency audit; least-privilege tokens in CI.
