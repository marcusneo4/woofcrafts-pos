# Phase 4: Security & Pre-Publishing Audit Report

**Audit Date:** March 4, 2025

---

## Findings Summary

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | XSS: product.name, item.name in innerHTML without escaping | **High** | Fix |
| 2 | XSS: image src could be javascript: URL | **High** | Fix |
| 3 | Hardcoded login password in index.html | **Medium** | Fix |
| 4 | Hardcoded EXTERNAL_IMAGES_DIR path with username | **Medium** | Fix |
| 5 | showEmailPreview: customerComment/customerName not escaped | **Medium** | Fix |
| 6 | EmailJS keys in client code (accepted per SECURITY_DECISION.md) | **Low** | Document |
| 7 | No CSRF tokens on POST endpoints | **Low** | Document |
| 8 | SessionStorage auth bypassable via DevTools | **Low** | Document |

---

## Applied Fixes

- **#1 XSS** – Added `escapeHtml()` and used it for `product.name`, `item.name`, `categoryLabel` in `app.js` and `products.js`.
- **#2 XSS** – Added `safeImageSrc()` to block `javascript:`, `vbscript:`, and non-image `data:` URLs.
- **#3 Password** – Password can be set via `js/config.js` (copy from `config-example.js`); `config.js` added to `.gitignore`.
- **#4 EXTERNAL_IMAGES_DIR** – Uses `process.env.PRODUCT_IMAGES_DIR` or default `assets/Dog product images`; documented in `env-example.txt`.
- **#5 showEmailPreview** – Escaped `customerName`, `customerEmail`, `customerPhone`, `customerComment`, `orderId`, and `item.name`.

## Documented (No Code Change)

- **#6 EmailJS** – Public keys allowed per `SECURITY_DECISION.md`. Suggest domain restrictions in EmailJS dashboard.
- **#7 CSRF** – POST endpoints have no CSRF tokens. Acceptable for local/trusted network. For public hosting, consider tokens.
- **#8 SessionStorage** – Auth can be bypassed via DevTools. Treat as soft protection; suitable for single-user POS.
