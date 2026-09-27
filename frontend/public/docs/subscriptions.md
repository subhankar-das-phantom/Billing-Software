# Bharat Enterprise — SaaS Multi-Tenancy & Subscriptions

> SaaS tenant lifecycle, subscription states, write-access gating, and multi-tenant operational controls.

Bharat Enterprise is built on a multi-tenant Software-as-a-Service (SaaS) architecture, allowing enterprises to manage billing and inventory under isolated tenancies.

---

## 1. Tenant Lifecycle & Statuses

Each tenant account operates under a defined subscription status:

| Status | Description | Read Access | Write Access |
| :--- | :--- | :---: | :---: |
| **`trial`** | Initial 14-day evaluation period with full operational capabilities. | Allowed | Allowed |
| **`active`** | Paid, valid subscription tier (Monthly, Quarterly, or Annual). | Allowed | Allowed |
| **`grace`** | Buffer period (typically 3–5 days) following subscription expiry. | Allowed | Allowed (Warning banner displayed) |
| **`expired`** | Subscription has lapsed past the grace window. | Allowed | **Blocked** (`403 Forbidden: WRITE_ACCESS_LOCKED`) |
| **`suspended`** | Account paused due to administrative or policy violation. | Blocked | Blocked |

---

## 2. Write-Access Middleware (`checkWriteAccess`)

All mutating HTTP operations (`POST`, `PUT`, `DELETE`, `PATCH`) pass through SaaS gating middleware before execution:

* **Non-Blocking Reads**: Expired tenants can always log in and export historical invoices, customer ledgers, and financial reports (`GET` requests are never blocked).
* **Guarded Writes**: Creation of new invoices, products, customers, or payments requires an `active`, `trial`, or `grace` subscription status.
* **Instant State Synchrony**: Global subscription states are pre-seeded synchronously from `localStorage` on page mount to prevent visual layout shifts (zero CLS) or flashing upgrade modals.

---

## 3. Subscription Management & Upgrades

* **Direct Support Upgrades & Renewals**: Subscription plan upgrades, extensions, and renewals are managed directly through our dedicated support team at `support.bharatenterprise@gmail.com`. Users can initiate pre-composed email requests directly from the Subscription page detailing their firm name, contact person, selected tier (Starter, Business, or Professional), and duration (Monthly, Quarterly, Semi-Annual, or Annual).
* **Automatic Renewal & Referral Days**: Tenants can earn extended subscription validity through the enterprise referral program (e.g. +30 free days per qualifying business onboarded).
