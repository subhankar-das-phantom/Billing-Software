# Bharat Enterprise — Security, Architecture & Data Protection

> Multi-tenant defense, authentication, cryptographic hashing, role-based access control (RBAC), and network security.

Bharat Enterprise is engineered to meet strict data isolation and enterprise-grade security standards.

---

## 1. Authentication & Session Security

* **JWT (JSON Web Tokens)**: Cryptographically signed tokens using `HS256` or `RS256` algorithms with configurable expiry lifetimes.
* **HTTP-Only Cookie Storage**: Tokens are delivered in secure, `httpOnly`, `sameSite: 'strict'` (or `'none'` in cross-domain staging) cookies with `secure: true` in production, shielding credentials from XSS attacks.
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
