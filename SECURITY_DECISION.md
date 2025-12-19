# Security Decision Record
**Date:** December 19, 2025  
**Decision:** Accept Risk & Secure Current Credentials

---

## Decision Summary

After security audit revealed exposed EmailJS credentials in Git history, the decision was made to:

✅ **ACCEPT THE RISK** and keep current API keys  
✅ **SECURE GOING FORWARD** with domain restrictions and monitoring  
❌ **NOT ROTATE** credentials at this time

---

## Rationale

1. **EmailJS public keys are designed for client-side use** - Unlike private API keys, EmailJS public keys are meant to be visible in client code
2. **No evidence of compromise** - Repository has not been accessed by unauthorized parties
3. **Domain restrictions provide sufficient protection** - EmailJS security features can prevent abuse
4. **Future leaks prevented** - `.gitignore` updated to prevent future credential exposure

---

## Risk Assessment

### Accepted Risks:
- 🟡 Credentials visible in Git history (low risk with domain restrictions)
- 🟡 Potential for someone to find credentials (mitigated by security measures)

### Mitigated By:
- ✅ Domain restrictions (only whitelisted domains can use the keys)
- ✅ Email quota limits (prevents spam/abuse)
- ✅ Usage monitoring (alerts for suspicious activity)
- ✅ `.gitignore` protection (prevents future leaks)

---

## Security Measures Implemented

| Measure | Status | Notes |
|---------|--------|-------|
| Update `.gitignore` | ✅ COMPLETED | Blocks credential files |
| Remove tracked credentials | ✅ COMPLETED | `emailjs-credentials.txt` removed |
| Document security setup | ✅ COMPLETED | See `EMAILJS_SECURITY_SETUP.md` |
| Enable domain restrictions | ⏳ USER ACTION | **Must be completed TODAY** |
| Set quota alerts | ⏳ USER ACTION | Recommended |
| Monitor usage | ⏳ ONGOING | Check monthly |

---

## Action Items

**CRITICAL (Do Today):**
- [ ] Log in to EmailJS Dashboard
- [ ] Enable domain restrictions (whitelist GitHub Pages domain)
- [ ] Add localhost to allowed origins
- [ ] Enable "Block unlisted origins"

**HIGH PRIORITY (This Week):**
- [ ] Set up email quota alerts
- [ ] Review current EmailJS usage
- [ ] Test domain restrictions work

**ONGOING:**
- [ ] Monitor EmailJS dashboard monthly
- [ ] Check for suspicious activity
- [ ] Review `.gitignore` before commits

---

## Contingency Plan

If evidence of abuse is detected:

1. **Immediately disable EmailJS service** (Dashboard > Services > Disable)
2. **Generate new credentials** (follow rotation guide in `SECURITY_AUDIT_REPORT.md`)
3. **Update `js/app.js`** with new credentials
4. **Re-enable service** with stricter restrictions

---

## Review Schedule

- **Weekly:** Check EmailJS usage stats
- **Monthly:** Review security measures
- **Quarterly:** Re-evaluate if credential rotation is needed

---

*This decision record documents the conscious choice to accept security risks with appropriate mitigations in place.*
