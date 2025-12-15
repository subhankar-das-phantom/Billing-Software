# Security & Architecture Notes

## React Server Components (RSC) - DISABLED

**Date:** 2025-12-14  
**Decision:** This project uses **client-side rendering (CSR) only** via Vite.

### Why No SSR/RSC?

1. **Security:** Avoids server-side vulnerabilities like React2Shell (CVE-2025-55182)
2. **Simplicity:** Single-deployment model (static files)
3. **Performance:** Leverages CDN caching for static assets
4. **Backend Separation:** Node.js backend is separate and doesn't serve React

### Packages to NEVER Install

These packages enable React Server Components and should **never** be added:

- ❌ `react-server-dom-webpack`
- ❌ `react-server-dom-parcel`  
- ❌ `react-server-dom-turbopack`
- ❌ `next` (Next.js - unless explicitly migrating)
- ❌ `@remix-run/*` (unless explicitly migrating)

### Security Checklist

- [ ] Keep React & React DOM at latest patched versions
- [ ] Run `npm audit` before every deployment
- [ ] Review `package.json` changes in PRs for server-related packages
- [ ] Never import from `react-dom/server` in client code
- [ ] Monitor CVE databases for React vulnerabilities

### Current Security Status

| Package   | Version | Status                                | Last Checked|
|-----------|---------|---------------------------------------|-------------|
| react     | 19.2.3  | ✅ Patched (React2Shell + follow-ups)|  2025-12-14 |
| react-dom | 19.2.3  | ✅ Patched (React2Shell + follow-ups)| 2025-12-14  |

### If You Need SSR in the Future

1. Evaluate alternatives first (e.g., static site generation)
2. Use a mature framework (Next.js) with auto-patching
3. Enable dependabot/renovate for automatic security updates
4. Implement WAF rules for RSC endpoints
5. Regular penetration testing

---

**Maintained by:** Development Team  
**Review Frequency:** Quarterly or when vulnerabilities disclosed
