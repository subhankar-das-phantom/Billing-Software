# Bharat Enterprise — Privacy Policy

> Authoritative Privacy Policy for Bharat Enterprise Billing System detailing data collection, processing, isolation, and user controls. Effective Date: September 2, 2026 (Version 2.0.0).

---

## 1. Introduction

Welcome to **Bharat Enterprise Billing System** ("Platform", "we", "us", or "our"). We are a cloud-based, multi-tenant billing, inventory, purchasing, and business management platform designed for wholesale distributors, retailers, stockists, and enterprises across India.

We are dedicated to safeguarding the privacy and security of your commercial and personal data. This Privacy Policy explains what information we process, why we process it, how we protect it, and the controls you have over your data.

---

## 2. Information We Collect & Process

We collect and process only the information necessary to provide you with a reliable billing, invoicing, purchasing, inventory management, and operational reporting experience:

* **Account & Authentication Information**: Full name, official email address, contact phone number, registered firm name, commercial address, and encrypted account credentials (passwords hashed using `bcryptjs`; never stored in plaintext).
* **Customer & Ledger Data**: Customer business names, billing/shipping addresses, phone numbers, email addresses, GSTIN, running ledger entries, and outstanding debt balances.
* **Supplier & Procurement Data**: Vendor business names, contact persons, billing addresses, GSTIN numbers, state codes, payment terms, and inward purchase records.
* **Inventory & Movement Data**: Product catalog configurations, real-time stock quantities (`currentStockQty`), and immutable `StockMovement` ledger entries recording sales, purchases, and reconciliations.
* **Invoice & Payment Data**: Tax invoices, proforma bills, credit notes, itemized rates, discounts, GST breakdowns, and customer payment receipts.
* **Employee & RBAC Data**: Staff user profiles, assigned system roles, and activity logs documenting administrative actions.
* **Subscription & Billing Data**: Active subscription tier (Starter, Business, or Professional), billing frequency, validity period, and support correspondence records.

---

## 3. Data Protection & Tenant Isolation

* **Strict Multi-Tenant Separation**: All data records are partitioned logically by tenant (`tenantId`). Data belonging to your enterprise is inaccessible to any other tenant on the platform.
* **Zero Commercial Exploitation**: We do **not** sell, rent, monetize, or broker your business data, customer ledgers, invoices, or supplier registries to third-party advertisers or data brokers.
* **Encryption in Transit**: All communication between your browser and our backend infrastructure is encrypted using Transport Layer Security (TLS 1.2 / TLS 1.3).
* **Financial Data Security**: We do not store credit/debit card numbers or bank account credentials on our servers. All subscription invoices and renewals are coordinated through official business channels.

---

## 4. Your Rights & Data Portability

* **Complete Exportability**: You retain full ownership of your commercial data. You may export customer directories, product lists, invoice registries, and GST reports in standard formats (PDF, Excel/CSV) at any time.
* **Account Deletion & Rectification**: Organization Admins can request complete termination and purging of their tenant account and associated databases by contacting platform support.
