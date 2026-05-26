# Privacy Policy

**Bharat Enterprise Billing System**

*Last Updated: May 17, 2026*

---

## 1. Introduction

Welcome to **Bharat Enterprise Billing System** ("Platform", "we", "us", or "our"). We are a cloud-based, multi-tenant billing and inventory management platform designed for pharmaceutical distributors, retailers, and small businesses across India.

We are committed to protecting the privacy and security of your data. This Privacy Policy explains what information we collect, how we use it, how we protect it, and what rights you have regarding your data.

By creating an account or using our Platform, you agree to the practices described in this Privacy Policy. If you do not agree, please do not use the Platform.

This policy is written in plain language so that small business owners and their teams can easily understand how their data is handled.

---

## 2. Information We Collect

We collect information necessary to provide you with a reliable billing, invoicing, and inventory management experience. The types of information we collect include:

### 2.1 Account Information

- Full name
- Email address
- Phone number
- Business name and address
- Password (stored in encrypted form only)
- Role designation (Admin or Employee)

### 2.2 Business & Customer Data

- Customer names, addresses, phone numbers, and GSTIN
- Supplier/vendor details
- Product and inventory catalogs
- Customer ledger and outstanding balances
- Notes and remarks associated with customers or transactions

### 2.3 Invoice & Payment Data

- Invoice details (items, quantities, prices, taxes, discounts)
- Payment records and payment modes
- Credit notes and adjustment entries
- Outstanding and ageing reports
- Manual journal entries

### 2.4 Device & Browser Information

- IP address
- Browser type and version
- Operating system
- Device type (desktop, mobile, tablet)
- Screen resolution

### 2.5 Usage Analytics

- Pages visited and features used
- Session duration and frequency of use
- Error logs and performance metrics
- Dashboard interaction patterns

> **Note:** We do not collect or store any payment card numbers, bank account details, or UPI credentials. All payment references recorded on the Platform are business transaction records entered by you — not payment gateway data.

---

## 3. How We Use Information

We use the information we collect for the following purposes:

- **Service Delivery** — To provide billing, invoicing, inventory tracking, customer ledger management, credit note processing, and GST reporting features.
- **Account Management** — To authenticate users, manage sessions, and enforce role-based access within your tenant.
- **Platform Improvement** — To analyze usage patterns, diagnose technical issues, and improve performance, reliability, and usability.
- **Communication** — To send important service updates, security alerts, or policy change notifications.
- **Compliance & Security** — To detect unauthorized access, prevent abuse, and comply with applicable legal obligations.
- **Reporting & Analytics** — To generate dashboard insights and business reports for your use within the Platform.

We do **not** sell, rent, or trade your personal or business data to any third party for marketing purposes.

---

## 4. Multi-Tenant Data Isolation & Security

Our Platform operates on a **multi-tenant architecture**, meaning multiple businesses use the same application infrastructure while their data remains strictly separated.

### Key Isolation Guarantees:

- **Tenant-scoped data access** — Every database query is scoped to your tenant. You cannot view, modify, or access data belonging to another tenant.
- **Tenant-scoped indexes** — Database indexes are designed to enforce uniqueness within your tenant, not across the entire platform.
- **Admin-owned tenants** — Each tenant is owned by an Admin account. All business data (customers, invoices, products, payments, credit notes) belongs to the tenant, not to individual user accounts.
- **No cross-tenant data leakage** — Our backend enforces tenant isolation at the middleware and database query level. Employees and admins can only interact with data within their assigned tenant.

We regularly audit and test our tenant isolation mechanisms to prevent unauthorized cross-tenant data access.

---

## 5. Authentication & Access Control

We take authentication and access control seriously:

- **Password Encryption** — All user passwords are securely hashed using industry-standard encryption algorithms (bcrypt). We never store passwords in plain text.
- **Session Management** — Authenticated sessions are managed using secure tokens. Sessions expire after a period of inactivity to reduce unauthorized access risk.
- **Role-Based Access** — The Platform supports Admin and Employee roles. Admins have full control over their tenant's data and can manage employee access. Employees can only access features and data permitted by their Admin.
- **Protected API Endpoints** — All backend API routes are protected by authentication middleware. Unauthenticated requests are rejected.

---

## 6. Data Storage & Cloud Infrastructure

Your data is stored and processed using the following cloud infrastructure providers:

| Component | Provider | Purpose |
|-----------|----------|---------|
| Frontend Hosting | **Vercel** | Serves the web application interface |
| Backend API | **Render** | Hosts the backend server and API |
| Database | **MongoDB Atlas** | Stores all application data in the cloud |

### Infrastructure Details:

- **MongoDB Atlas** provides enterprise-grade security features including encryption at rest, encryption in transit (TLS/SSL), network isolation, and automated backups.
- **Vercel** and **Render** enforce HTTPS for all communications, ensuring data is encrypted during transmission.
- All infrastructure providers maintain their own security certifications and compliance programs.

We select infrastructure providers that follow industry-standard security practices. However, we encourage you to review the privacy policies of these providers for additional details:

- [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy)
- [Render Privacy Policy](https://render.com/privacy)
- [MongoDB Atlas Privacy Policy](https://www.mongodb.com/legal/privacy-policy)

---

## 7. Cookies & Session Handling

The Platform uses cookies and similar technologies for the following purposes:

- **Authentication Cookies** — To maintain your logged-in session securely.
- **Session Tokens** — To identify and validate your active session on the Platform.
- **Preference Storage** — To remember your display preferences (e.g., theme settings, table configurations).

We do **not** use third-party advertising cookies or tracking pixels. Cookies used by the Platform are strictly functional and necessary for the service to operate correctly.

You can configure your browser to block or delete cookies, but doing so may prevent you from using the Platform.

---

## 8. Data Retention

We retain your data for as long as your account is active and as needed to provide you with our services.

- **Active Accounts** — All business data (invoices, customers, products, payments, credit notes, ledger entries) is retained for the lifetime of your active account.
- **Closed/Terminated Accounts** — Upon account termination, your data will be scheduled for deletion. We may retain certain data for a reasonable period to comply with legal obligations, resolve disputes, or enforce agreements.
- **Backup Retention** — Backup copies of data may be maintained for disaster recovery purposes. These backups are subject to the same security protections as primary data and are periodically purged.
- **Anonymized Data** — We may retain anonymized, aggregated data (which cannot identify you or your business) indefinitely for analytics and platform improvement purposes.

---

## 9. Data Sharing Policy

We do **not** sell, rent, or share your personal or business data with third parties for their marketing or commercial purposes.

We may share data only in the following limited circumstances:

- **With Your Consent** — When you explicitly authorize us to share data with a third party.
- **Service Providers** — With trusted infrastructure and service providers (listed in Section 6) who process data on our behalf, subject to strict confidentiality obligations.
- **Legal Compliance** — When required by law, regulation, court order, or governmental authority.
- **Safety & Security** — To protect the rights, property, or safety of our users, our Platform, or the public.
- **Business Transfers** — In the event of a merger, acquisition, or sale of assets, your data may be transferred as part of the transaction. You will be notified of any such change.

---

## 10. Third-Party Services

The Platform integrates with or relies on the following third-party services:

| Service | Purpose |
|---------|---------|
| MongoDB Atlas | Cloud database storage |
| Vercel | Frontend hosting and deployment |
| Render | Backend API hosting |

We do **not** currently integrate with:
- Third-party payment gateways (no card/UPI processing)
- Third-party analytics platforms (e.g., Google Analytics)
- Social media login providers
- Advertising networks

If we introduce new third-party integrations in the future, this Privacy Policy will be updated accordingly.

---

## 11. Financial & GST Data Handling

The Platform provides tools for generating GST-compliant invoices, managing tax calculations, and producing GST reports. However:

- **We are a software tool, not a tax advisor.** The Platform assists in generating invoices and reports based on the data you enter. It does not provide legal, tax, or financial advice.
- **You are responsible for verifying GST compliance.** It is your responsibility to ensure that invoices, tax rates, HSN/SAC codes, and filings comply with the GST laws and regulations applicable in your jurisdiction.
- **Tax data accuracy depends on your input.** The Platform calculates taxes based on the rates and rules you configure. We do not independently verify the accuracy or legality of your tax settings.
- **No payment card data is stored.** The Platform records payment transactions (cash, cheque, bank transfer, etc.) as entered by you. We do not process, store, or have access to credit card numbers, debit card numbers, or UPI credentials.

> **Disclaimer:** Bharat Enterprise Billing System is not a substitute for professional accounting or tax advisory services. Please consult a qualified Chartered Accountant or tax professional for GST compliance matters.

---

## 12. User Responsibilities

As a user of the Platform, you are responsible for:

- **Account Security** — Keeping your login credentials confidential and not sharing your password with unauthorized individuals.
- **Data Accuracy** — Ensuring that the business data, customer details, invoice information, and tax configurations you enter are accurate and up to date.
- **Legal Compliance** — Complying with all applicable laws and regulations, including GST laws, data protection regulations, and business licensing requirements in your jurisdiction.
- **Employee Management** — If you are an Admin, managing employee access appropriately and revoking access for employees who no longer require it.
- **Authorized Use** — Using the Platform only for lawful business purposes and not attempting to access data belonging to other tenants.
- **Timely Reporting** — Promptly reporting any suspected security breaches, unauthorized access, or vulnerabilities to our support team.

---

## 13. Data Security Measures

We implement reasonable and industry-standard security measures to protect your data, including:

- **Encryption at Rest** — Data stored in our database is encrypted using MongoDB Atlas encryption features.
- **Encryption in Transit** — All data transmitted between your browser and our servers is encrypted using TLS/SSL (HTTPS).
- **Password Hashing** — User passwords are hashed using bcrypt and are never stored in plain text.
- **Access Controls** — Role-based access controls ensure that users can only access data they are authorized to view.
- **Tenant Isolation** — Database queries are scoped to prevent cross-tenant data access.
- **Session Security** — Authentication tokens are securely managed and expire after inactivity.
- **Regular Updates** — We regularly update our dependencies and infrastructure to address known security vulnerabilities.

> **Important:** While we follow reasonable security practices to protect your data, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security. In the unlikely event of a data breach, we will notify affected users promptly and take appropriate remedial action.

---

## 14. Employee Access Rules

The Platform supports a multi-user model within each tenant:

- **Admin accounts** have full control over the tenant, including the ability to create, modify, and delete business data, manage employees, and configure settings.
- **Employee accounts** are created and managed by the tenant Admin. Employees can only access data and features that the Admin has permitted.
- **Employees inherit access from Admin accounts.** They do not own tenant data — the Admin does.
- **Admins are responsible for managing employee access**, including revoking access when an employee leaves the organization or no longer requires access.
- **Employee actions are performed within the scope of the tenant** they belong to. Employees cannot access data from other tenants.

We recommend that Admins periodically review employee access and remove inactive or unauthorized accounts.

---

## 15. Limitation of Liability

- The Platform is provided **"as is"** and **"as available"** without warranties of any kind, express or implied.
- We do not guarantee uninterrupted, error-free, or completely secure operation of the Platform.
- We are not liable for any loss of data, revenue, or business arising from the use of the Platform, except where required by applicable law.
- We are not responsible for the accuracy of financial calculations, tax computations, or reports generated based on user-provided data.
- Our total liability for any claims arising from the use of the Platform shall be limited to the fees paid by you (if any) in the 12 months preceding the claim.
- We are not responsible for downtime caused by our third-party infrastructure providers (Vercel, Render, MongoDB Atlas).

---

## 16. Data Backup & Recovery

- **Automated Backups** — Our database provider (MongoDB Atlas) maintains automated backups as part of its managed service.
- **Disaster Recovery** — Backups may be used for disaster recovery purposes to restore service in the event of data loss or infrastructure failure.
- **Backup Security** — Backup data is subject to the same encryption and access control protections as primary data.
- **No Guaranteed Recovery** — While we make reasonable efforts to maintain backups, we do not guarantee that all data can be recovered in every scenario. We recommend that users maintain their own records of critical business data.

---

## 17. Account Termination & Data Deletion

### Voluntary Termination

- You may request account termination at any time by contacting our support team.
- Upon receiving a termination request, we will schedule your tenant data for deletion.
- Data deletion will be completed within **90 days** of the termination request, subject to legal retention requirements.

### Involuntary Termination

- We reserve the right to suspend or terminate accounts that violate our Terms of Service, engage in unauthorized activities, or pose a security risk to the Platform.

### Data Deletion Scope

- Upon termination, all tenant-specific data — including customers, invoices, products, payments, credit notes, ledger entries, and employee accounts — will be permanently deleted.
- Anonymized, aggregated data that cannot identify your business may be retained for analytics purposes.
- Backup copies may persist for a limited period before being purged through our regular backup rotation cycle.

### Data Export

- We recommend exporting your important business data before requesting account termination. We may provide data export tools or assist with data export upon request.

---

## 18. Children's Privacy

The Platform is designed for use by businesses and professionals. It is **not intended for use by individuals under the age of 18**.

We do not knowingly collect personal information from children. If we become aware that we have inadvertently collected data from a minor, we will take steps to delete such information promptly.

If you believe that a minor has provided us with personal information, please contact us immediately at the address provided in Section 20.

---

## 19. Changes to Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or platform features.

- **Notification** — We will notify users of significant changes through in-app notifications, email, or a prominent notice on the Platform.
- **Effective Date** — Changes will take effect on the date specified in the updated policy.
- **Continued Use** — Your continued use of the Platform after changes are posted constitutes your acceptance of the revised Privacy Policy.
- **Review** — We encourage you to review this Privacy Policy periodically to stay informed about how we protect your data.

---

## 20. Contact Information

If you have any questions, concerns, or requests regarding this Privacy Policy or your data, please contact us:

| | |
|---|---|
| **Platform** | Bharat Enterprise Billing System |
| **Email** | [support.bharatenterprises@gmail.com] |
| **Address** | India |
| **Response Time** | We aim to respond to all privacy-related inquiries within **7 business days**. |

---

## Summary of Key Points

| Topic | Summary |
|-------|---------|
| Data Ownership | Tenant data is owned by the Admin account |
| Data Isolation | Strict multi-tenant isolation; no cross-tenant access |
| Password Security | Encrypted using bcrypt; never stored in plain text |
| Payment Card Data | Not collected or stored by the Platform |
| GST Compliance | Users are responsible for verifying compliance |
| Data Sharing | Never sold or rented to third parties |
| Security | Reasonable industry-standard measures; no platform is 100% secure |
| Backups | Maintained for disaster recovery |
| Employee Access | Controlled by tenant Admin |
| Analytics | Used to improve platform performance and usability |
| Target Market | Indian businesses (pharmaceutical distributors, retailers, SMBs) |
| Children | Not intended for users under 18 |

---

*This Privacy Policy is effective as of May 17, 2026.*

*© 2026 Bharat Enterprise Billing System. All rights reserved.*
