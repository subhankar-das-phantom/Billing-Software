# Bharat Enterprise — Security, Architecture & Data Protection

> Multi-tenant defense, authentication, cryptographic hashing, role-based access control (RBAC), and network security.

Bharat Enterprise is engineered to meet strict data isolation and enterprise-grade security standards.

---

## 1. Authentication & Session Security

* **JWT (JSON Web Tokens)**: Cryptographically signed tokens using `HS256` algorithms with configurable expiry lifetimes.
* **Dual-Mode Token Transport**: For high-throughput cross-origin SPA requests, offline demo mode, and SSE stream compatibility, tokens are delivered via `httpOnly` secure cookies while the client SPA includes the token in `Authorization: Bearer <token>` headers. Backend middleware evaluates cookies first with Authorization header fallback. (A dedicated transition roadmap to pure `httpOnly` cookie authentication is maintained in `AUTH_MIGRATION_ROADMAP.md`).
* **Password Hashing**: User passwords are encrypted using `bcryptjs` with high work factors (10+ salt rounds). Plaintext passwords are never logged or stored.

---

## 2. Multi-Tenant Boundary Enforcement

* **Logical Data Separation**: Multi-tenancy is enforced directly through foreign key references (`tenantId`).
* **Cross-Tenant Attack Immunization**: Every controller and service method resolves `tenantId` strictly from the authenticated JWT session (`req.user.tenantId` or `req.admin._id`), never from client-controlled request parameters or query bodies. Any attempt to query or update an entity belonging to another tenant yields a `404 Not Found` or `403 Forbidden` response.

---

## 3. Role-Based Access Control (RBAC)

The platform distinguishes between administrative owners and operational staff:
* **Admin Role**: Complete governance over subscription settings, firm branding, financial reporting, employee creation, and ledger reversals.
* **Employee Role**: Granular permission switches (`invoices.create`, `invoices.view`, `customers.edit`, `products.view`). Staff cannot alter master firm preferences or subscription tiers.
* **Activity Audit Trail**: Sensitive operations (e.g. price modifications, manual balance reconciliations, invoice cancellations) log the acting user ID and user type (`Admin` vs `Employee`).

---

## 4. Network & Application Defense

* **Helmet Security Headers**: Strict Content-Security-Policy (CSP), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Strict-Transport-Security` (HSTS).
* **Rate Limiting**: Express middleware enforces tiered IP-based and user-based request throttling (`authLimiter`, `generalLimiter`) to prevent brute-force attacks and denial-of-service attempts.
* **Input Sanitization**: All inbound parameters pass through schema-driven validators (`express-validator`) enforcing strict types, positive numeric boundaries, and string lengths before reaching domain logic.

---

## 5. Public Capability Tokens & Share Security

* **Dedicated Cryptographic Secret**: Share token encryption uses AES-256-GCM authenticated encryption derived strictly from `SHARE_TOKEN_SECRET` (never reusing `JWT_SECRET`).
* **Search Engine Indexing Prevention**: Public share routes are protected with `X-Robots-Tag: noindex, nofollow, noarchive` and dynamically injected `<meta name="robots" content="noindex,nofollow,noarchive">` in document heads.
* **Explicit Caching Policy**: Customer-facing share endpoints enforce `Cache-Control: private, no-store` to prevent caching by public proxies or shared intermediate caches.
* **Public Data Minimization Contract**: Public invoice views and PDF rendering strictly consume sanitized DTO payloads (`adaptPublicDTOToPDFInvoice`), mathematically preventing internal database IDs, tenant details, and profit margins from reaching public representations.
