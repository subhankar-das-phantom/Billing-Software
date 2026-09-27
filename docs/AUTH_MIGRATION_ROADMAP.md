# Bharat Enterprise — Architecture Migration Roadmap: Pure HTTP-Only Cookie Authentication

## 1. Executive Summary

This document establishes the architectural migration path from the current **dual-mode token transport** (HTTP-only cookies + `Authorization: Bearer` fallback with client `localStorage` caching) toward a **pure HTTP-only cookie-only authentication architecture**.

Per the **v2.9.2 Production Hardening Charter**, runtime authentication contracts are strictly preserved in v2.9.2 to prevent breaking active user sessions, mobile viewports, or cross-domain staging setups. This roadmap outlines the phased execution strategy for a future major release.

---

## 2. Current Architecture vs Target State

### Current Dual-Mode Architecture (v2.9.2)
```text
Login Request
     ↓
Backend sets httpOnly cookie ('token')
     +
Backend returns JSON payload { success: true, token: 'jwt...', user: {...} }
     ↓
Frontend stores token in localStorage ('token')
     ↓
API requests include both:
  1. Cookie: token=... (via credentials: true)
  2. Authorization: Bearer <token>
     ↓
Backend middleware checks:
  req.cookies.token → req.headers.authorization → req.query.token (SSE)
```

**Pros**:
- High resilience across cross-domain deployments (e.g. Vercel frontend on `*.vercel.app` & Render backend on `*.onrender.com`).
- Offline/isolated demo mode support (`demo_client_jwt_token_secure_isolated`).
- Seamless EventSource/SSE compatibility (`/api/stock-events?token=...`).

**Risks**:
- `localStorage` JWT is accessible to client-side scripts, necessitating strict Content Security Policy (CSP) enforcement.

---

### Target Architecture (Future Major Milestone)
```text
Login Request
     ↓
Backend sets SameSite=Lax / Strict, Secure, httpOnly cookie ('__Host-token')
     +
Backend returns JSON payload { success: true, user: {...} } (zero token string)
     ↓
Frontend stores ZERO credentials in localStorage
     ↓
API requests rely strictly on ambient browser cookie:
  Cookie: __Host-token=... (with credentials: true)
     ↓
CSRF Protection:
  Double-submit CSRF cookie or custom non-standard header ('X-Requested-With' / 'X-CSRF-Token')
     ↓
Backend middleware checks:
  req.cookies['__Host-token'] strictly
```

---

## 3. Prerequisite Milestones Before Pure Cookie Cutover

Before removing `localStorage` token handling, the following infrastructure milestones must be met:

### 1. Custom Domain Unification (Same-Site Cookie Boundary)
In production, cross-origin cookies between distinct third-party domains (`*.vercel.app` and `*.onrender.com`) require `SameSite=None; Secure`, which are subject to third-party cookie restrictions in Safari, Brave, and modern Chromium.
- **Requirement**: Both frontend and backend must reside under a common apex domain:
  - Frontend: `app.bharatenterprise.com`
  - Backend API: `api.bharatenterprise.com`
- This allows `SameSite=Lax` or `SameSite=Strict` first-party cookies with `__Host-` prefix.

### 2. EventSource (SSE) Cookie / Fetch Adapter
Standard browser `EventSource` cannot send custom headers and historically had inconsistent cross-origin cookie support.
- **Requirement**: Migrate `useStockSSE` to `@microsoft/fetch-event-source` or authenticated SSE over fetch stream with credentials support.

### 3. Demo Mode Isolation
Currently, `enterDemoMode` writes a dummy token to `localStorage` to unlock `<ProtectedRoute>` without a backend round-trip.
- **Requirement**: Implement an in-memory session flag or dedicated mock cookie for standalone demo previews.

### 4. CSRF Defense Implementation
Pure cookie transport exposes mutating state endpoints (e.g. `POST /api/invoices`, `POST /api/payments`) to Cross-Site Request Forgery if cross-origin protections fail.
- **Requirement**: Introduce double-submit CSRF tokens via `csurf` / custom Express header validation (`X-CSRF-Token`).

---

## 4. Phase-by-Phase Execution Plan

| Phase | Milestone | Scope | Breaking? |
| :--- | :--- | :--- | :---: |
| **Phase 1 (v2.9.2)** | **Documentation & Safety Alignment** | Accurately document dual-mode auth. Remove premature claims of pure cookie auth from public docs. Validate CSP and Helmet headers. | No |
| **Phase 2 (v3.0.0-rc)** | **Unified Domain & CSRF Layer** | Map apex custom domain. Implement CSRF protection middleware and header validation. | No |
| **Phase 3 (v3.0.0)** | **Pure Cookie Cutover** | Remove token string from login response. Deprecate `localStorage.getItem('token')` in frontend. Enforce `__Host-token` cookie. | Yes (Clean Session Re-login) |

---

## 5. Security Invariants Maintained During Transition

Even in the current dual-mode model:
1. **CSP Strictness**: `default-src 'self'` prevents external script injection.
2. **Short Token TTLs**: JWT lifetime is bounded (configurable via `JWT_EXPIRE`).
3. **Bcrypt Salt Rounds**: Password hashing uses work factor 10+.
4. **Tenant Scoping**: All operations resolve `tenantId` from verified JWT claims on the server; client cannot spoof tenant boundaries.
