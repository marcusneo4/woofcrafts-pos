# Phase 3: Backend & API Stability Report

**Audit Date:** March 4, 2025

---

## Findings Summary

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | No request body size limit – memory exhaustion risk | **High** | server.js |
| 2 | email-template divide-by-zero when subtotal=0 | **High** | email-template.js |
| 3 | email-template throws if item lacks price/quantity | **High** | email-template.js |
| 4 | product-images path traversal with encoded sequences | **Medium** | server.js |
| 5 | upload-image: no base64 validation before Buffer.from | **Medium** | server.js |
| 6 | JSON.parse error handling could expose stack traces | **Low** | server.js |
| 7 | email-config exports transporter even when auth undefined | **Low** | email-config.js |

---

## Applied Fixes

- **#1** Added `MAX_BODY_SIZE` (10MB) for upload, 1MB for order email; destroy request and return 413 when exceeded
- **#2** `email-template.js`: guard `discount/subtotal` with `subtotal > 0` to avoid divide-by-zero
- **#3** `email-template.js`: coerce `item.quantity`, `item.price`, `item.name` with `Number()` / `String()` and defaults
- **#4** `product-images`: strip `..`, `/`, `\` from filename; use `path.resolve` + `startsWith` for traversal check
- **#5** `upload-image`: validate base64 format with regex before `Buffer.from`
- **#6** JSON parse errors return generic "Invalid JSON" instead of raw message
- **#7** Server validates order items (name, quantity, price types) before passing to email template
