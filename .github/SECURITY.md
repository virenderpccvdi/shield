# Security Policy

## Supported Versions

Only the latest production release is actively supported with security patches.

| Version | Supported |
|---------|-----------|
| Latest (`main`) | ✅ Active |
| Older branches | ❌ No patches |

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Report security issues privately via one of these channels:

1. **GitHub Private Vulnerability Reporting** (preferred)  
   Use the [Security Advisories](../../security/advisories/new) tab in this repository — GitHub keeps it private until a fix is released.

2. **Email**  
   Send details to `security@rstglobal.in` with subject line: `[SHIELD] Security Report`

### What to include

- Description of the vulnerability and its impact
- Steps to reproduce (proof-of-concept or working exploit if available)
- Affected component (`shield-auth`, `shield-gateway`, `shield-ai`, etc.)
- Suggested fix if you have one

### Response SLA

| Severity | Acknowledgement | Fix Target |
|----------|-----------------|------------|
| Critical (CVSS ≥ 9.0) | 24 hours | 72 hours |
| High (CVSS 7–9) | 48 hours | 7 days |
| Medium (CVSS 4–7) | 5 days | 30 days |
| Low (CVSS < 4) | 14 days | Next release |

## Security Practices

- All HTTP endpoints require JWT authentication (except `/health`, `/docs`, `/actuator`)
- JWTs signed with HS512 (512-bit minimum secret)
- All secrets stored in Azure Key Vault / environment variables — never in source code
- Dependencies scanned nightly via OWASP Dependency Check (pipeline: `Shield-Security-Nightly`)
- Container images scanned on every build via OWASP in CI
- PII fields masked in application logs via `PiiMaskingConverter`
- Rate limiting enforced at the gateway (Resilience4j) and NGINX layer
- All database queries use parameterized statements (no raw string interpolation)
- Child-safe AI chat endpoint (`/ai/safe-chat`) uses additional content filtering

## Known Mitigations

| CVE / Issue | Status | Notes |
|-------------|--------|-------|
| `python-jose` (unmaintained) | Tracked | Migration to `PyJWT` planned — does not affect external-facing attack surface |
| `withOpacity` Flutter deprecation | Fixed | Replaced with `.withValues()` in next release |

## Dependency Update Policy

- **Critical/High CVEs**: Patch within 72 hours
- **Medium CVEs**: Patch within 30 days
- **Low CVEs**: Patch in next scheduled release
- Dependabot is configured for automated PR creation on all dependency updates
- OWASP scan runs nightly; failures on CVSS ≥ 9 block deployment
