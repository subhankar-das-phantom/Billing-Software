import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Shield, FileText, Users, Eye, Lock, Scale,
  UserCheck, ShieldCheck, HardDrive, Trash2, Bell, Mail,
  Heart, Gavel, Globe, CreditCard, Laptop, BookOpen,
  AlertTriangle, Rocket, Ban, Server, ScrollText, Gift,
  Package, Truck, ShoppingCart, Layers, BarChart3
} from 'lucide-react';

const sections = [
  {
    id: 'tc-introduction',
    num: '1',
    title: 'Introduction & Service Description',
    icon: ScrollText,
    color: 'from-blue-500 to-accent2-500',
    content: (
      <>
        <p>Welcome to <strong>Bharat Enterprise Billing System</strong> ("Platform", "Service", "we", "us", or "our"). These Terms & Conditions ("Terms") govern your access to and use of our cloud-based business management, billing, invoicing, inventory, purchasing, and operational analytics platform.</p>
        <p>The Platform provides software tools to facilitate business administration, record-keeping, and operational visibility, including:</p>
        <ul>
          <li><strong>Customer & Product Management</strong> — Customer profiles, outstanding balances, product catalogs, and pricing rules.</li>
          <li><strong>Invoicing & Billing</strong> — Generation of tax invoices, proforma bills, credit notes, and delivery slips.</li>
          <li><strong>Payments & Collections</strong> — Customer receipt recording, payment allocations, credit adjustments, and outstanding ledger tracking.</li>
          <li><strong>Supplier Management</strong> — Supplier vendor master records, payment terms, and vendor contact profiles.</li>
          <li><strong>Purchase Entry & Stock Inward</strong> — Recording inward supplier invoices, lots, rates, taxes, and supplier invoice details.</li>
          <li><strong>Inventory Management & Modes</strong> — Warehouse stock tracking supporting both standard unit-based inventory tracking and batch-based inventory tracking depending on product configuration.</li>
          <li><strong>Batch Tracking & FIFO Allocation</strong> — Product lot numbering, expiry horizon tracking, automated First-In-First-Out (FIFO) allocation algorithms, and manual batch allocation controls.</li>
          <li><strong>Inventory Movement Ledger</strong> — Comprehensive stock movement transaction audit history tracking purchases, sales, returns, and manual adjustments.</li>
          <li><strong>Operational Reporting & Analytics</strong> — Inward/outward movement reports, purchase summaries, supplier-wise and product-wise analysis, and inventory intelligence indicators.</li>
          <li><strong>Employee Management & RBAC</strong> — Team member provisioning with tenant-controlled, role-based granular permissions.</li>
          <li><strong>GST-Related Reporting Tools</strong> — Generation of tax summaries and reports based strictly on user-entered transaction data.</li>
          <li><strong>Subscription-Based Feature Access</strong> — Multi-tiered SaaS access plans tailored to evolving business sizes.</li>
        </ul>
        <div className="pp-callout">
          <strong>Important Notice:</strong> Bharat Enterprise Billing System provides business software tools. We do <strong>not</strong> provide certified accounting services, professional financial advice, statutory auditing, or legal tax filing services.
        </div>
        <p>We recommend reading these Terms alongside our <Link to="/privacy-policy" className="text-blue-400 hover:text-blue-300 transition-colors">Privacy Policy</Link>, which explains how we process and protect your business data.</p>
      </>
    )
  },
  {
    id: 'tc-acceptance',
    num: '2',
    title: 'Acceptance of Terms',
    icon: FileText,
    color: 'from-emerald-500 to-teal-500',
    content: (
      <>
        <ul>
          <li>By registering, accessing, or using the Platform, you confirm that you have read, understood, and unconditionally agree to these Terms.</li>
          <li>If you are using the Platform on behalf of a company, partnership, or enterprise, you represent and warrant that you possess the legal authority to bind that business entity to these Terms.</li>
          <li>Continued access to or use of the Platform following any modifications or version releases constitutes acceptance of the updated Terms.</li>
          <li>If you do not agree with any provision of these Terms, you must immediately discontinue use of the Platform and request account closure.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-eligibility',
    num: '3',
    title: 'Eligibility & Business Usage',
    icon: Globe,
    color: 'from-accent-500 to-accent-500',
    content: (
      <>
        <ul>
          <li>The Platform is designed strictly for <strong>commercial, professional, and business use</strong>, not personal or consumer use.</li>
          <li>You must be at least <strong>18 years of age</strong> and legally competent to enter into binding agreements.</li>
          <li>The Platform is tailored primarily for <strong>Indian businesses</strong>, including pharmaceutical distributors, wholesalers, retail enterprises, and small-to-medium businesses (SMBs).</li>
          <li>You represent that your business operates in full compliance with all applicable local, state, and national laws and regulations.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-account',
    num: '4',
    title: 'Account Responsibilities & Security',
    icon: UserCheck,
    color: 'from-amber-500 to-orange-500',
    content: (
      <>
        <ul>
          <li><strong>Credential Confidentiality</strong> — You are responsible for safeguarding your login credentials and ensuring they are not shared with unauthorized individuals.</li>
          <li><strong>Accurate Registration</strong> — You must provide accurate, complete, and current business and contact information during signup and keep it updated.</li>
          <li><strong>Notification of Breach</strong> — You must notify us immediately at our official support address if you suspect any unauthorized access or compromise of your account.</li>
          <li><strong>Single Admin Ownership</strong> — Each tenant is registered to and owned by one primary Admin account holder, who assumes legal responsibility for all activity within that tenant.</li>
          <li><strong>No Reselling or Transfers</strong> — You may not sublicense, sell, rent, or transfer your account or tenant access to any third party without our prior written consent.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-multi-tenant',
    num: '5',
    title: 'Multi-Tenant Architecture & Data Isolation',
    icon: Lock,
    color: 'from-cyan-500 to-blue-500',
    content: (
      <>
        <p>The Platform operates on a secure <strong>multi-tenant cloud architecture</strong> where multiple organizations utilize shared application infrastructure while maintaining logical separation of data.</p>
        <ul>
          <li><strong>Logical Isolation</strong> — All database records, catalog items, invoices, purchases, and settings are strictly partitioned by tenant. You cannot view, query, or modify another organization's data.</li>
          <li><strong>Admin Control</strong> — All business data belongs to the organization (tenant Admin), not individual employee or user accounts.</li>
          <li><strong>Prohibition of Cross-Tenant Intrusion</strong> — Any attempt to exploit, probe, scan, or breach multi-tenant barriers constitutes a material violation of these Terms.</li>
          <li><strong>Remedies</strong> — Circumventing tenant isolation will result in immediate termination of service and may lead to legal action under applicable cybersecurity laws.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-employee-access',
    num: '6',
    title: 'Employee Access & Role-Based Permissions (RBAC)',
    icon: Users,
    color: 'from-rose-500 to-pink-500',
    content: (
      <>
        <p>The Platform enables organization administrators to provision employee user accounts and configure granular access controls across different business workflows.</p>
        <ul>
          <li><strong>Admin-Managed Authorization</strong> — Business Admins configure and manage employee roles and module permissions (such as viewing, creating, editing, deleting, or cancelling entries in Customers, Products, Invoices, Payments, Purchases, and Reports).</li>
          <li><strong>Subordinate Access</strong> — Employees operate solely under the authority and supervision of the tenant Admin. Employees have no independent ownership claim over tenant business data.</li>
          <li><strong>Prompt Revocation</strong> — Admins are solely responsible for promptly deactivating, suspending, or revoking access for departing or re-assigned employees.</li>
          <li><strong>Audit & Activity Logging</strong> — Employee actions within the Platform (including creation, updates, and cancellations of transactions) may be recorded in activity logs for administrative accountability, compliance, and dispute resolution.</li>
          <li><strong>Plan Availability</strong> — The capacity to provision employee accounts and utilize advanced granular permissions varies according to your active subscription plan.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-inventory-responsibility',
    num: '7',
    title: 'Inventory Tracking & User Responsibility',
    icon: Package,
    color: 'from-indigo-500 to-purple-500',
    content: (
      <>
        <p>The Platform provides robust inventory tracking tools supporting both <strong>standard quantity-based inventory</strong> and <strong>batch-tracked inventory</strong> depending on product configuration.</p>
        <ul>
          <li><strong>Data Entry Responsibility</strong> — You are solely responsible for inputting accurate product names, HSN codes, batch numbers, manufacturing dates, expiry dates, purchase prices, MRP, selling rates, and stock quantities.</li>
          <li><strong>Workflow Calculations</strong> — All automated stock balances, lot allocations, and inventory ledger records depend strictly upon the transactions, returns, and adjustments entered by your organization.</li>
          <li><strong>Mandatory Verification</strong> — Users are advised to periodically conduct physical stock audits and verify digital inventory records against physical warehouse stock before making significant purchasing, sales, or financial decisions.</li>
          <li><strong>No Absolute Certification</strong> — Bharat Enterprise does not warrant that system-computed inventory balances will perfectly reflect physical warehouse conditions without regular reconciliation, shrinkage accounting, and physical verifications by the user.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-suppliers-purchases',
    num: '8',
    title: 'Supplier Management & Purchase Entry',
    icon: Truck,
    color: 'from-amber-500 to-yellow-500',
    content: (
      <>
        <p>The Platform offers dedicated supplier management and purchase recording tools for tracking inward inventory and vendor relationships.</p>
        <ul>
          <li><strong>Supplier Information</strong> — Users may store supplier profiles including trade names, contact persons, phone numbers, email addresses, billing addresses, GSTIN numbers, state codes, payment terms, opening balances, and operational notes.</li>
          <li><strong>No Independent Verification</strong> — Bharat Enterprise does not independently verify, authenticate, or guarantee the accuracy, legal standing, or tax compliance of supplier information entered by users.</li>
          <li><strong>Purchase Entry Recording</strong> — Users may record inward purchases by capturing supplier details, inward invoice/reference numbers, purchase dates, product line items, invoiced quantities, free promotional quantities, purchase rates, selling rates, MRP, batch lots, expiry dates, and applicable GST taxes and trade discounts.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-purchase-lifecycle',
    num: '9',
    title: 'Purchase Lifecycle & Inventory Integration',
    icon: ShoppingCart,
    color: 'from-emerald-500 to-cyan-500',
    content: (
      <>
        <p>Purchases recorded on the Platform operate under an explicit operational lifecycle:</p>
        <div className="pp-callout">
          <strong>COMPLETED &rarr; CANCELLED</strong>
        </div>
        <ul>
          <li><strong>Purchase Completion</strong> — Submitting a purchase entry commits the transaction as <strong>Completed</strong>. This atomically updates product stock levels, establishes or supplements batch inventory lots, and records corresponding entries in the Inventory Ledger.</li>
          <li><strong>Purchase Cancellation</strong> — Completed purchase records may be cancelled by authorized administrators or permitted personnel. Cancellation atomically reverses the inventory additions previously applied to current stock and batch allocations, preventing overstatement of physical inventory.</li>
          <li><strong>Immutable Audit Records</strong> — To protect operational and financial integrity, completed and cancelled purchase transactions and their associated stock movements are permanently preserved in transaction logs and cannot be erased.</li>
          <li><strong>In-Browser Drafts</strong> — Temporary form inputs during active purchase composition may be held in local browser session storage for convenience; such unsaved data is not committed to system records until explicitly submitted.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-batch-fifo',
    num: '10',
    title: 'Batch Tracking & FIFO Inventory Allocation',
    icon: Layers,
    color: 'from-violet-500 to-indigo-500',
    content: (
      <>
        <p>The Platform includes specialized features for managing batch-tracked goods, such as pharmaceuticals, consumables, and perishable merchandise.</p>
        <ul>
          <li><strong>First-In-First-Out (FIFO) Allocation</strong> — When billing batch-tracked items, the Platform provides automated FIFO allocation algorithms to suggest or deduct older valid stock lots first based on recorded receipt or expiry dates.</li>
          <li><strong>Manual Batch Selection</strong> — Where preferred or required by customer request, users may manually select specific batch lots, adjust quantities across multiple batches, and override default allocations.</li>
          <li><strong>Universal Capability</strong> — Batch tracking and FIFO allocation tools are supported across our standard billing tiers (Starter, Business, and Professional) according to individual product settings.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-operational-reports',
    num: '11',
    title: 'Operational Reports & Business Disclaimers',
    icon: BarChart3,
    color: 'from-blue-500 to-teal-500',
    content: (
      <>
        <p>The Platform generates a variety of operational reports, including Purchase Summaries, Supplier-wise Reports, Product-wise Purchase Breakdown, Inventory Movement Ledgers, and Professional Inventory Intelligence.</p>
        <div className="pp-callout pp-callout-warning">
          <strong>Operational Purpose Only:</strong> All reports, dashboards, metrics, and stock valuations provided by the Platform are intended strictly for <em>internal operational management and visibility</em>. They do <strong>not</strong> constitute certified financial statements, formal Cost of Goods Sold (COGS) audit valuations, statutory Profit & Loss (P&L) statements, or tax filings.
        </div>
        <ul>
          <li><strong>User Review Required</strong> — Users must review and reconcile all operational reports before relying on them for commercial commitments, financial audits, or tax submissions.</li>
          <li><strong>Consultation</strong> — Users must consult certified Chartered Accountants or professional financial advisors for statutory tax filings, audited financial statements, and compliance matters.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-billing-financial',
    num: '12',
    title: 'Billing & Customer Ledger Responsibility',
    icon: CreditCard,
    color: 'from-yellow-500 to-amber-500',
    content: (
      <>
        <ul>
          <li><strong>Accuracy of Invoices</strong> — You are solely responsible for the prices, discounts, line items, customer details, and payment terms specified on invoices and credit notes.</li>
          <li><strong>No Payment Handling</strong> — The Platform does not process, receive, or hold payments between you and your customers. Customer payment and collection entries recorded in the Platform are internal accounting records entered by you.</li>
          <li><strong>Calculation Basis</strong> — Automated calculations (such as totals, GST amounts, discounts, and round-offs) depend strictly upon user-configured settings and transaction inputs.</li>
          <li><strong>Independent Records</strong> — You are advised to maintain secure, independent backups of essential business, billing, and accounting records.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-gst',
    num: '13',
    title: 'GST & Statutory Compliance Disclaimer',
    icon: Scale,
    color: 'from-accent2-500 to-accent-500',
    content: (
      <>
        <ul>
          <li><strong>Tax Calculation Tools</strong> — The Platform provides GST-related reporting and calculation tools based on the tax rates, HSN/SAC codes, and state configurations selected by the user.</li>
          <li><strong>No Compliance Guarantee</strong> — Bharat Enterprise does <strong>not</strong> guarantee statutory tax compliance, correctness of rates, or acceptance of filings by tax authorities.</li>
          <li><strong>Your Responsibility</strong> — You are solely responsible for ensuring that all tax invoices, credit notes, e-way bill details, and tax filings strictly adhere to applicable GST legislation and regulations.</li>
          <li><strong>Regulatory Changes</strong> — Tax laws and statutory reporting requirements evolve. You are responsible for configuring rates, rules, and classifications in accordance with current laws.</li>
        </ul>
        <div className="pp-callout pp-callout-warning">
          <strong>Disclaimer:</strong> Always consult a qualified Chartered Accountant or tax professional for statutory GST compliance and tax filing obligations.
        </div>
      </>
    )
  },
  {
    id: 'tc-data-ownership',
    num: '14',
    title: 'Data Ownership & Confidentiality',
    icon: ShieldCheck,
    color: 'from-teal-500 to-emerald-500',
    content: (
      <>
        <ul>
          <li><strong>Customer Ownership</strong> — All proprietary business data, customer records, supplier profiles, inventory data, purchase entries, and invoices entered into the Platform remain your exclusive property.</li>
          <li><strong>Tenant Entity</strong> — Business data belongs to the tenant organization (Admin), not to individual employee users.</li>
          <li><strong>Limited Processing License</strong> — You grant us a limited, worldwide, non-exclusive license to host, store, process, and back up your data solely for the purpose of operating, maintaining, and delivering the Platform.</li>
          <li><strong>No Sale of Data</strong> — We never sell, rent, monetize, or trade your commercial or customer data to third parties.</li>
          <li><strong>Aggregated Insights</strong> — We may generate anonymized, aggregated statistical metrics that cannot identify you or your customers to monitor system performance and platform health.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-acceptable-use',
    num: '15',
    title: 'Acceptable Use Policy',
    icon: Ban,
    color: 'from-red-500 to-rose-500',
    content: (
      <>
        <p>You agree to use the Platform exclusively for legitimate, lawful business operations. You must <strong>not</strong>:</p>
        <ul>
          <li>Engage in unlawful, fraudulent, deceptive, or prohibited trade practices.</li>
          <li>Attempt to breach, probe, or bypass tenant isolation or access controls.</li>
          <li>Reverse engineer, decompile, disassemble, or derive source code from the Platform.</li>
          <li>Resell, white-label, sublicense, or commercially exploit Platform access without authorization.</li>
          <li>Upload malicious payloads, viruses, scripts, or disruptive code.</li>
          <li>Utilize automated crawlers, scrapers, or bots to extract data from the Platform.</li>
          <li>Impersonate any person, business entity, or administrative authority.</li>
        </ul>
        <div className="pp-callout pp-callout-warning">
          <strong>Enforcement:</strong> Violations of our Acceptable Use Policy may result in immediate suspension or permanent termination of access without refund.
        </div>
      </>
    )
  },
  {
    id: 'tc-availability',
    num: '16',
    title: 'Service Availability & Cloud Dependencies',
    icon: Laptop,
    color: 'from-blue-500 to-cyan-500',
    content: (
      <>
        <ul>
          <li><strong>Best-Effort Availability</strong> — We implement modern engineering practices to deliver high reliability and performance, but we do not guarantee 100% uninterrupted or error-free service.</li>
          <li><strong>Maintenance Windows</strong> — Periodic scheduled maintenance or infrastructure upgrades may cause brief temporary downtime, communicated in advance when practical.</li>
          <li><strong>Cloud Infrastructure</strong> — The Platform relies on industry-standard cloud providers, including <strong>MongoDB Atlas</strong>, <strong>Vercel</strong>, and <strong>Render</strong>. We are not liable for outages resulting from third-party hosting, carrier network failures, or upstream cloud disruptions.</li>
          <li><strong>Force Majeure</strong> — We are not responsible for service delays or failures caused by natural disasters, telecommunications outages, government actions, or events beyond our reasonable control.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-backups',
    num: '17',
    title: 'Backups & Disaster Recovery',
    icon: HardDrive,
    color: 'from-sky-500 to-blue-500',
    content: (
      <>
        <ul>
          <li><strong>Automated Cloud Backups</strong> — MongoDB Atlas performs regular automated database snapshots for disaster recovery.</li>
          <li><strong>Recovery Protocols</strong> — In the event of an infrastructure incident, backups are utilized to restore service integrity.</li>
          <li><strong>User Archival Responsibility</strong> — While we maintain system-level disaster recovery backups, users are strongly encouraged to routinely export and maintain independent local archives of their critical invoices, ledgers, and financial records.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-ip',
    num: '18',
    title: 'Intellectual Property',
    icon: BookOpen,
    color: 'from-accent-500 to-accent-500',
    content: (
      <>
        <ul>
          <li><strong>Platform Rights</strong> — All software code, algorithms, user interfaces, design elements, visual themes, documentation, and trademarks associated with Bharat Enterprise are our proprietary intellectual property.</li>
          <li><strong>Limited License</strong> — You are granted a revocable, non-exclusive, non-transferable license to access and use the Platform during your active subscription.</li>
          <li><strong>Restrictions</strong> — You may not duplicate, redistribute, modify, or create derivative works of any Platform software or user interface components.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-third-party',
    num: '19',
    title: 'Third-Party Services & Payment Gateway',
    icon: Server,
    color: 'from-emerald-500 to-green-500',
    content: (
      <>
        <ul>
          <li>The Platform utilizes <strong>MongoDB Atlas</strong> for cloud database storage, <strong>Vercel</strong> for frontend distribution, and <strong>Render</strong> for backend API hosting.</li>
          <li>We partner with secure third-party payment gateways for subscription billing. All payment processing is subject to industry-standard payment security protocols. We do not store credit cards, debit cards, or UPI PINs.</li>
          <li>We do not share your commercial business data with external advertising networks or social media tracking pixels.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-liability',
    num: '20',
    title: 'Limitation of Liability',
    icon: AlertTriangle,
    color: 'from-slate-500 to-slate-600',
    content: (
      <>
        <ul>
          <li>The Platform is provided on an <strong>"as is"</strong> and <strong>"as available"</strong> basis without warranties of any kind, whether express or implied.</li>
          <li>We do not warrant that the Platform will meet every unique business requirement or operate continuously without defect.</li>
          <li>To the maximum extent permitted by law, Bharat Enterprise and its operators shall not be liable for any indirect, consequential, special, punitive, or incidental damages, including loss of business, revenue, profits, or data.</li>
          <li>Our total cumulative liability arising out of or related to these Terms or the Platform shall not exceed the subscription fees paid by you in the <strong>twelve (12) months</strong> immediately preceding the event giving rise to the claim.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-termination',
    num: '21',
    title: 'Suspension & Account Termination',
    icon: Trash2,
    color: 'from-red-500 to-rose-500',
    content: (
      <>
        <h4>Voluntary Closure</h4>
        <ul>
          <li>You may terminate your account at any time by contacting our support team.</li>
          <li>Before requesting closure, please export all required financial, customer, and tax records.</li>
          <li>Following closure, your data is scheduled for secure purging within <strong>90 days</strong>, subject to statutory retention obligations.</li>
        </ul>
        <h4>Involuntary Suspension</h4>
        <ul>
          <li>We reserve the right to suspend or terminate accounts that breach these Terms, engage in fraudulent activities, or threaten multi-tenant system security.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-subscription',
    num: '22',
    title: 'Subscription Plans & Feature Availability',
    icon: Rocket,
    color: 'from-pink-500 to-rose-500',
    content: (
      <>
        <p>The Platform operates on a <strong>Subscription SaaS model</strong> offering tiered feature access:</p>
        <div className="pp-table-wrap">
          <table>
            <thead>
              <tr><th>Plan</th><th>Price</th><th>Key Capabilities</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Starter</strong></td>
                <td>₹299/mo</td>
                <td>Core billing and invoicing, basic inventory tracking, Batch & FIFO allocation support, single employee seat.</td>
              </tr>
              <tr>
                <td><strong>Business</strong></td>
                <td>₹499/mo</td>
                <td>Everything in Starter plus Payments, Collections, Credit Notes, Customer Outstanding Ledger, Supplier Management, Purchase Entry, Purchase Reports, and Inventory Movement Ledger.</td>
              </tr>
              <tr>
                <td><strong>Professional</strong></td>
                <td>₹699/mo</td>
                <td>Everything in Business plus Employee Management, Role-Based Access Control (RBAC), Employee Analytics, Activity Logs, GST Reports, Advanced Reporting, and Professional Inventory Intelligence.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul>
          <li><strong>14-Day Free Trial</strong> — New registrations receive a complimentary 14-day trial of the Professional plan. No credit card is required.</li>
          <li><strong>Billing Cycles</strong> — Subscriptions are billed in advance: 1 month, 3 months (5% discount), 6 months (10% discount), or 12 months (20% discount).</li>
          <li><strong>Proration on Upgrades</strong> — Upgrading plans prorates remaining credit into active days on the new plan based on the price differential.</li>
          <li><strong>Grace Period & Read-Only Mode</strong> — Following subscription expiration, a 7-day grace period is provided. Thereafter, the account shifts to read-only access until renewed.</li>
          <li><strong>Subscription Changes & Data Integrity</strong> — Changing or downgrading subscription tiers adjusts access to features specific to higher tiers. However, subscription plan changes do <strong>not</strong> automatically delete your historical business records, invoices, purchase transactions, or inventory movement history.</li>
          <li><strong>Refund Policy</strong> — All subscription payments are final and non-refundable, except where mandated by applicable consumer laws.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-referral',
    num: '23',
    title: 'Referral Program',
    icon: Gift,
    color: 'from-emerald-500 to-cyan-500',
    content: (
      <>
        <p>The Platform provides an optional <strong>Referral Program</strong> rewarding users who invite other businesses:</p>
        <ul>
          <li><strong>How It Works</strong> — Users receive a unique referral link. When a referred business signs up and completes their first paid subscription, reward days are credited.</li>
          <li><strong>Rewards</strong> — Referrers earn <strong>+30 free subscription days</strong>, and the referred business receives <strong>+15 free days</strong>, subject to active campaign terms.</li>
          <li><strong>Conditions</strong> — Rewards require completion of a paid subscription purchase. Codes may only be used once per new business, self-referrals are prohibited, and rewards hold no monetary or cash value.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-governing-law',
    num: '24',
    title: 'Governing Law & Jurisdiction',
    icon: Gavel,
    color: 'from-accent2-500 to-blue-500',
    content: (
      <>
        <ul>
          <li>These Terms shall be governed by and construed in accordance with the laws of <strong>India</strong>.</li>
          <li>Any legal suit, action, or proceeding arising out of or related to these Terms shall be instituted exclusively in the competent courts in India.</li>
          <li>If any provision of these Terms is held invalid or unenforceable, the remaining provisions shall remain in full force and effect.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-contact',
    num: '25',
    title: 'Contact Information',
    icon: Mail,
    color: 'from-emerald-500 to-teal-500',
    content: (
      <>
        <p>For questions, clarifications, or notices regarding these Terms & Conditions:</p>
        <div className="pp-table-wrap">
          <table>
            <tbody>
              <tr><td><strong>Platform</strong></td><td>Bharat Enterprise Billing System</td></tr>
              <tr><td><strong>Email</strong></td><td><a href="mailto:support.bharatenterprises@gmail.com" onClick={(e) => { const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent); if (!isMobile) { e.preventDefault(); navigator.clipboard.writeText('support.bharatenterprises@gmail.com').then(() => { const el = document.getElementById('tc-email-copied'); if(el) { el.style.opacity='1'; setTimeout(()=> el.style.opacity='0', 2000); } }); } }} className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer" title="Click to copy or email">support.bharatenterprises@gmail.com</a> <span id="tc-email-copied" className="text-emerald-400 text-xs ml-2 transition-opacity duration-300" style={{opacity:0}}>✓ Copied!</span></td></tr>
              <tr><td><strong>Region</strong></td><td>India</td></tr>
              <tr><td><strong>Response Time</strong></td><td>Within 7 business days</td></tr>
            </tbody>
          </table>
        </div>
      </>
    )
  }
];

export default function TermsPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pp-page">
      {/* Background effects */}
      <div className="pp-bg-gradient pp-bg-gradient-1" />
      <div className="pp-bg-gradient pp-bg-gradient-2" />
      <div className="pp-bg-grid" />

      {/* Header */}
      <header className="pp-header">
        <div className="pp-header-inner">
          <Link to="/landing" className="pp-back-link">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="pp-header-content">
            <div className="pp-header-badge">
              <Gavel className="w-4 h-4" />
              Legal Document — Version 2.0.0
            </div>
            <h1 className="pp-title">Terms & Conditions</h1>
            <p className="pp-subtitle">Bharat Enterprise Billing System</p>
            <p className="pp-last-updated">Last Updated: September 2, 2026</p>
          </div>
        </div>
      </header>

      {/* Table of Contents */}
      <nav className="pp-toc">
        <div className="pp-toc-inner">
          <h2 className="pp-toc-title">Table of Contents</h2>
          <div className="pp-toc-grid">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })}
                className="pp-toc-link"
              >
                <span className="pp-toc-num">{s.num}</span>
                <span>{s.title}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Sections */}
      <main className="pp-main">
        <div className="pp-main-inner">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="pp-section">
              <div className="pp-section-header">
                <div className={`pp-section-icon bg-gradient-to-br ${section.color}`}>
                  <section.icon className="w-5 h-5 text-white" />
                </div>
                <h2 className="pp-section-title">
                  <span className="pp-section-num">{section.num}.</span>
                  {section.title}
                </h2>
              </div>
              <div className="pp-section-body">
                {section.content}
              </div>
            </section>
          ))}

          {/* Summary Table */}
          <section className="pp-section pp-summary-section">
            <div className="pp-section-header">
              <div className="pp-section-icon bg-gradient-to-br from-blue-500 to-accent-500">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <h2 className="pp-section-title">Quick Summary of Key Terms</h2>
            </div>
            <div className="pp-section-body">
              <div className="pp-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Topic</th>
                      <th>Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Account Ownership</td><td>Admin owns tenant organization and is responsible for all activity.</td></tr>
                    <tr><td>Multi-Tenant Isolation</td><td>Strict logical data separation; no cross-tenant access.</td></tr>
                    <tr><td>Employee Access & RBAC</td><td>Admin configures granular module permissions; access is subordinate to Admin.</td></tr>
                    <tr><td>Inventory Responsibility</td><td>Users are responsible for entering accurate stock, batch, and expiry data.</td></tr>
                    <tr><td>Suppliers & Purchases</td><td>Supplier data is user-managed; purchase entries record inward stock.</td></tr>
                    <tr><td>Purchase Lifecycle</td><td>Completed purchases update stock; cancellation reverses stock; records are preserved.</td></tr>
                    <tr><td>Batch & FIFO</td><td>Platform provides automated FIFO and manual allocation across tiers.</td></tr>
                    <tr><td>Operational Reports</td><td>Provided for operational management only; not certified financial, COGS, or tax advice.</td></tr>
                    <tr><td>GST Compliance</td><td>Platform provides tax calculation tools; users must verify statutory compliance.</td></tr>
                    <tr><td>Payment Data</td><td>Subscriptions processed securely via authorized payment gateways; no payment card data stored.</td></tr>
                    <tr><td>Subscription Tiers</td><td>Starter (₹299), Business (₹499), Professional (₹699); downgrades preserve historical data.</td></tr>
                    <tr><td>Referral Program</td><td>Earn free subscription days for referring new businesses; no cash value.</td></tr>
                    <tr><td>Governing Law</td><td>Indian law; exclusive jurisdiction of Indian courts.</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="pp-footer">
        <div className="pp-footer-inner">
          <p>These Terms & Conditions are effective as of September 2, 2026 (Version 2.0.0).</p>
          <p className="pp-footer-copyright">
            © {new Date().getFullYear()} Bharat Enterprise Billing System. All rights reserved.
          </p>
          <p className="pp-footer-love">
            Built with <Heart className="w-3 h-3 inline text-red-400 fill-red-400" /> in India
          </p>
          <Link to="/landing" className="pp-footer-home">
            ← Back to Home
          </Link>
        </div>
      </footer>
    </div>
  );
}
