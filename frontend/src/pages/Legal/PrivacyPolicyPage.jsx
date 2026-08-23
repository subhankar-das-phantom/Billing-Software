import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Database, Users, Eye, Server, Cookie, Clock, Share2, Globe, FileText, UserCheck, ShieldCheck, HardDrive, Trash2, Baby, Bell, Mail, Heart, Gift } from 'lucide-react';

const sections = [
  {
    id: 'introduction',
    num: '1',
    title: 'Introduction',
    icon: Shield,
    color: 'from-blue-500 to-accent2-500',
    content: (
      <>
        <p>Welcome to <strong>Bharat Enterprise Billing System</strong> ("Platform", "we", "us", or "our"). We are a cloud-based, multi-tenant billing and inventory management platform designed for pharmaceutical distributors, retailers, and small businesses across India.</p>
        <p>We are committed to protecting the privacy and security of your data. This Privacy Policy explains what information we collect, how we use it, how we protect it, and what rights you have regarding your data.</p>
        <p>By creating an account or using our Platform, you agree to the practices described in this Privacy Policy. If you do not agree, please do not use the Platform.</p>
        <p>This policy is written in plain language so that small business owners and their teams can easily understand how their data is handled.</p>
      </>
    )
  },
  {
    id: 'information-we-collect',
    num: '2',
    title: 'Information We Collect',
    icon: Database,
    color: 'from-emerald-500 to-teal-500',
    content: (
      <>
        <p>We collect information necessary to provide you with a reliable billing, invoicing, and inventory management experience.</p>

        <h4>2.1 Account Information</h4>
        <ul>
          <li>Full name, email address, and phone number</li>
          <li>Business name and address</li>
          <li>Password (stored in encrypted form only)</li>
          <li>Role designation (Admin or Employee)</li>
        </ul>

        <h4>2.2 Business & Customer Data</h4>
        <ul>
          <li>Customer names, addresses, phone numbers, and GSTIN</li>
          <li>Supplier/vendor details</li>
          <li>Product and inventory catalogs</li>
          <li>Customer ledger and outstanding balances</li>
        </ul>

        <h4>2.3 Invoice & Payment Data</h4>
        <ul>
          <li>Invoice details (items, quantities, prices, taxes, discounts)</li>
          <li>Payment records and payment modes</li>
          <li>Credit notes and adjustment entries</li>
          <li>Outstanding and ageing reports</li>
        </ul>

        <h4>2.4 Subscription & Payment Data</h4>
        <ul>
          <li>Current subscription plan and billing cycle</li>
          <li>Payment transaction IDs and timestamps (via Razorpay)</li>
          <li>Subscription history, renewals, and plan changes</li>
          <li>Grace period and trial status</li>
        </ul>

        <h4>2.5 Referral Data</h4>
        <ul>
          <li>Unique referral codes generated for your account</li>
          <li>Referral link sharing activity</li>
          <li>Referred user signup and purchase status</li>
          <li>Referral reward grants and history</li>
        </ul>

        <h4>2.6 Device & Browser Information</h4>
        <ul>
          <li>IP address, browser type and version</li>
          <li>Operating system and device type</li>
          <li>Screen resolution</li>
        </ul>

        <h4>2.7 Usage Analytics</h4>
        <ul>
          <li>Pages visited and features used</li>
          <li>Session duration and frequency of use</li>
          <li>Error logs and performance metrics</li>
        </ul>

        <div className="pp-callout">
          <strong>Note:</strong> We do not collect or store any payment card numbers, bank account details, or UPI credentials. All platform subscription payments are processed securely by our partner, <strong>Razorpay</strong>. Internal business payments recorded on the Platform are simply transaction records entered by you.
        </div>
      </>
    )
  },
  {
    id: 'how-we-use-information',
    num: '3',
    title: 'How We Use Information',
    icon: Eye,
    color: 'from-accent-500 to-accent-500',
    content: (
      <>
        <ul>
          <li><strong>Service Delivery</strong> — To provide billing, invoicing, inventory tracking, customer ledger management, credit note processing, and GST reporting features.</li>
          <li><strong>Account Management</strong> — To authenticate users, manage sessions, and enforce role-based access within your tenant.</li>
          <li><strong>Subscription Management</strong> — To manage your subscription lifecycle including free trials, plan upgrades, renewals, grace periods, and payment verification via Razorpay.</li>
          <li><strong>Referral Program</strong> — To track referral code usage, verify eligible conversions, and grant subscription day rewards to both referrer and referred users.</li>
          <li><strong>Platform Improvement</strong> — To analyze usage patterns, diagnose technical issues, and improve performance, reliability, and usability.</li>
          <li><strong>Communication</strong> — To send important service updates, security alerts, subscription expiry notifications, or policy change notifications.</li>
          <li><strong>Compliance & Security</strong> — To detect unauthorized access, prevent abuse, and comply with applicable legal obligations.</li>
          <li><strong>Reporting & Analytics</strong> — To generate dashboard insights and business reports for your use within the Platform.</li>
        </ul>
        <p>We do <strong>not</strong> sell, rent, or trade your personal or business data to any third party for marketing purposes.</p>
      </>
    )
  },
  {
    id: 'multi-tenant-isolation',
    num: '4',
    title: 'Multi-Tenant Data Isolation & Security',
    icon: Lock,
    color: 'from-amber-500 to-orange-500',
    content: (
      <>
        <p>Our Platform operates on a <strong>multi-tenant architecture</strong>, meaning multiple businesses use the same application infrastructure while their data remains strictly separated.</p>
        <ul>
          <li><strong>Tenant-scoped data access</strong> — Every database query is scoped to your tenant. You cannot view, modify, or access data belonging to another tenant.</li>
          <li><strong>Tenant-scoped indexes</strong> — Database indexes are designed to enforce uniqueness within your tenant, not across the entire platform.</li>
          <li><strong>Admin-owned tenants</strong> — Each tenant is owned by an Admin account. All business data belongs to the tenant, not to individual user accounts.</li>
          <li><strong>No cross-tenant data leakage</strong> — Our backend enforces tenant isolation at the middleware and database query level.</li>
        </ul>
        <p>We regularly audit and test our tenant isolation mechanisms to prevent unauthorized cross-tenant data access.</p>
      </>
    )
  },
  {
    id: 'authentication',
    num: '5',
    title: 'Authentication & Access Control',
    icon: ShieldCheck,
    color: 'from-cyan-500 to-blue-500',
    content: (
      <>
        <ul>
          <li><strong>Password Encryption</strong> — All user passwords are securely hashed using industry-standard encryption algorithms (bcrypt). We never store passwords in plain text.</li>
          <li><strong>Session Management</strong> — Authenticated sessions are managed using secure tokens that expire after inactivity.</li>
          <li><strong>Role-Based Access</strong> — Admin and Employee roles ensure users only access authorized features and data.</li>
          <li><strong>Protected API Endpoints</strong> — All backend API routes are protected by authentication middleware. Unauthenticated requests are rejected.</li>
        </ul>
      </>
    )
  },
  {
    id: 'data-storage',
    num: '6',
    title: 'Data Storage & Cloud Infrastructure',
    icon: Server,
    color: 'from-rose-500 to-pink-500',
    content: (
      <>
        <p>Your data is stored and processed using the following cloud infrastructure providers:</p>
        <div className="pp-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Provider</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Frontend Hosting</td><td>Vercel</td><td>Serves the web application interface</td></tr>
              <tr><td>Backend API</td><td>Render</td><td>Hosts the backend server and API</td></tr>
              <tr><td>Database</td><td>MongoDB Atlas</td><td>Stores all application data in the cloud</td></tr>
            </tbody>
          </table>
        </div>
        <p>All providers enforce HTTPS for communications and maintain their own security certifications.</p>
      </>
    )
  },
  {
    id: 'cookies',
    num: '7',
    title: 'Cookies & Session Handling',
    icon: Cookie,
    color: 'from-yellow-500 to-amber-500',
    content: (
      <>
        <ul>
          <li><strong>Authentication Cookies</strong> — To maintain your logged-in session securely.</li>
          <li><strong>Session Tokens</strong> — To identify and validate your active session.</li>
          <li><strong>Preference Storage</strong> — To remember your display preferences.</li>
        </ul>
        <p>We do <strong>not</strong> use third-party advertising cookies or tracking pixels. Cookies are strictly functional.</p>
      </>
    )
  },
  {
    id: 'data-retention',
    num: '8',
    title: 'Data Retention',
    icon: Clock,
    color: 'from-accent2-500 to-accent-500',
    content: (
      <>
        <ul>
          <li><strong>Active Accounts</strong> — All business data is retained for the lifetime of your active account.</li>
          <li><strong>Closed Accounts</strong> — Data will be scheduled for deletion upon termination. Certain data may be retained for legal compliance.</li>
          <li><strong>Backup Retention</strong> — Backup copies may be maintained for disaster recovery with the same security protections.</li>
          <li><strong>Anonymized Data</strong> — Aggregated data that cannot identify you may be retained for analytics.</li>
        </ul>
      </>
    )
  },
  {
    id: 'data-sharing',
    num: '9',
    title: 'Data Sharing Policy',
    icon: Share2,
    color: 'from-teal-500 to-emerald-500',
    content: (
      <>
        <p>We do <strong>not</strong> sell, rent, or share your data with third parties for marketing purposes. Data may be shared only:</p>
        <ul>
          <li><strong>With Your Consent</strong> — When you explicitly authorize sharing.</li>
          <li><strong>Service Providers</strong> — With trusted infrastructure providers subject to confidentiality obligations.</li>
          <li><strong>Legal Compliance</strong> — When required by law or governmental authority.</li>
          <li><strong>Safety & Security</strong> — To protect users, our Platform, or the public.</li>
          <li><strong>Business Transfers</strong> — In the event of a merger or acquisition, with prior notification.</li>
        </ul>
      </>
    )
  },
  {
    id: 'third-party-services',
    num: '10',
    title: 'Third-Party Services',
    icon: Globe,
    color: 'from-blue-500 to-cyan-500',
    content: (
      <>
        <p>The Platform relies on MongoDB Atlas, Vercel, and Render for infrastructure. We partner with <strong>Razorpay</strong> to process subscription payments securely. We do <strong>not</strong> currently integrate with:</p>
        <ul>
          <li>External analytics platforms (e.g., Google Analytics)</li>
          <li>Social media login providers</li>
          <li>Advertising networks</li>
        </ul>
        <p>If new integrations are introduced, this policy will be updated accordingly.</p>
      </>
    )
  },
  {
    id: 'financial-gst',
    num: '11',
    title: 'Financial & GST Data Handling',
    icon: FileText,
    color: 'from-emerald-500 to-green-500',
    content: (
      <>
        <ul>
          <li>The Platform is a <strong>software tool, not a tax advisor</strong>. It assists in generating invoices and reports based on your input.</li>
          <li><strong>You are responsible for verifying GST compliance</strong> in your jurisdiction, including tax rates, HSN/SAC codes, and filings.</li>
          <li>Tax data accuracy depends on the rates and rules you configure.</li>
          <li><strong>No payment card data is stored.</strong> Platform subscriptions use Razorpay. Customer payment records are internal business entries only.</li>
        </ul>
        <div className="pp-callout pp-callout-warning">
          <strong>Disclaimer:</strong> Bharat Enterprise Billing System is not a substitute for professional accounting or tax advisory services. Please consult a qualified Chartered Accountant for GST compliance.
        </div>
      </>
    )
  },
  {
    id: 'user-responsibilities',
    num: '12',
    title: 'User Responsibilities',
    icon: UserCheck,
    color: 'from-accent-500 to-accent-500',
    content: (
      <>
        <ul>
          <li><strong>Account Security</strong> — Keep your credentials confidential.</li>
          <li><strong>Data Accuracy</strong> — Ensure business data and tax configurations are accurate.</li>
          <li><strong>Legal Compliance</strong> — Comply with all applicable laws including GST and data protection.</li>
          <li><strong>Employee Management</strong> — Admins must manage and revoke employee access appropriately.</li>
          <li><strong>Authorized Use</strong> — Use the Platform only for lawful business purposes.</li>
          <li><strong>Timely Reporting</strong> — Report suspected security breaches promptly.</li>
        </ul>
      </>
    )
  },
  {
    id: 'data-security',
    num: '13',
    title: 'Data Security Measures',
    icon: ShieldCheck,
    color: 'from-blue-500 to-blue-600',
    content: (
      <>
        <ul>
          <li><strong>Encryption at Rest</strong> — Data is encrypted using MongoDB Atlas encryption.</li>
          <li><strong>Encryption in Transit</strong> — All communication uses TLS/SSL (HTTPS).</li>
          <li><strong>Password Hashing</strong> — Passwords are hashed with bcrypt, never stored in plain text.</li>
          <li><strong>Access Controls</strong> — Role-based access ensures authorized data viewing only.</li>
          <li><strong>Tenant Isolation</strong> — Queries are scoped to prevent cross-tenant access.</li>
          <li><strong>Regular Updates</strong> — Dependencies and infrastructure are regularly updated.</li>
        </ul>
        <div className="pp-callout pp-callout-warning">
          <strong>Important:</strong> While we follow reasonable security practices, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security. In the event of a data breach, affected users will be notified promptly.
        </div>
      </>
    )
  },
  {
    id: 'employee-access',
    num: '14',
    title: 'Employee Access Rules',
    icon: Users,
    color: 'from-orange-500 to-red-500',
    content: (
      <>
        <ul>
          <li><strong>Admin accounts</strong> have full control over the tenant, including data management and employee access.</li>
          <li><strong>Employee accounts</strong> are created by Admins and can only access permitted data and features.</li>
          <li>Employees <strong>inherit access from Admin accounts</strong> — they do not own tenant data.</li>
          <li>Admins are responsible for <strong>revoking access</strong> when employees leave the organization.</li>
          <li>Employee actions are scoped to their assigned tenant only.</li>
        </ul>
      </>
    )
  },
  {
    id: 'limitation-of-liability',
    num: '15',
    title: 'Limitation of Liability',
    icon: Shield,
    color: 'from-slate-500 to-slate-600',
    content: (
      <>
        <ul>
          <li>The Platform is provided <strong>"as is"</strong> and <strong>"as available"</strong> without warranties of any kind.</li>
          <li>We do not guarantee uninterrupted, error-free, or completely secure operation.</li>
          <li>We are not liable for loss of data, revenue, or business except where required by law.</li>
          <li>We are not responsible for the accuracy of calculations based on user-provided data.</li>
          <li>We are not responsible for downtime caused by third-party infrastructure providers.</li>
        </ul>
      </>
    )
  },
  {
    id: 'data-backup',
    num: '16',
    title: 'Data Backup & Recovery',
    icon: HardDrive,
    color: 'from-sky-500 to-blue-500',
    content: (
      <>
        <ul>
          <li><strong>Automated Backups</strong> — MongoDB Atlas maintains automated backups as part of its managed service.</li>
          <li><strong>Disaster Recovery</strong> — Backups may be used to restore service in the event of data loss or failure.</li>
          <li><strong>Backup Security</strong> — Backup data has the same encryption and access protections as primary data.</li>
          <li><strong>No Guaranteed Recovery</strong> — We make reasonable efforts but cannot guarantee all data recovery in every scenario.</li>
        </ul>
        <p>We recommend users maintain their own records of critical business data.</p>
      </>
    )
  },
  {
    id: 'account-termination',
    num: '17',
    title: 'Account Termination & Data Deletion',
    icon: Trash2,
    color: 'from-red-500 to-rose-500',
    content: (
      <>
        <h4>Voluntary Termination</h4>
        <ul>
          <li>You may request termination at any time by contacting support.</li>
          <li>Data deletion will be completed within <strong>90 days</strong>, subject to legal retention requirements.</li>
        </ul>
        <h4>Involuntary Termination</h4>
        <ul>
          <li>We may suspend accounts that violate Terms of Service or pose security risks.</li>
        </ul>
        <h4>Data Deletion Scope</h4>
        <ul>
          <li>All tenant-specific data will be permanently deleted upon termination.</li>
          <li>Anonymized aggregate data may be retained for analytics.</li>
          <li>Backup copies may persist briefly before regular purge cycles.</li>
        </ul>
        <p>We recommend exporting important data before requesting termination.</p>
      </>
    )
  },
  {
    id: 'childrens-privacy',
    num: '18',
    title: "Children's Privacy",
    icon: Baby,
    color: 'from-pink-500 to-rose-500',
    content: (
      <>
        <p>The Platform is designed for businesses and professionals. It is <strong>not intended for individuals under 18 years of age</strong>.</p>
        <p>We do not knowingly collect personal information from children. If we discover data from a minor, it will be promptly deleted.</p>
      </>
    )
  },
  {
    id: 'changes-to-policy',
    num: '19',
    title: 'Changes to Privacy Policy',
    icon: Bell,
    color: 'from-accent2-500 to-blue-500',
    content: (
      <>
        <ul>
          <li><strong>Notification</strong> — Significant changes will be communicated through in-app notifications or email.</li>
          <li><strong>Effective Date</strong> — Changes take effect on the date specified in the updated policy.</li>
          <li><strong>Continued Use</strong> — Continued use after changes constitutes acceptance.</li>
        </ul>
        <p>We encourage periodic review of this Privacy Policy.</p>
      </>
    )
  },
  {
    id: 'contact-information',
    num: '20',
    title: 'Contact Information',
    icon: Mail,
    color: 'from-emerald-500 to-teal-500',
    content: (
      <>
        <p>For privacy-related questions, concerns, or requests:</p>
        <div className="pp-table-wrap">
          <table>
            <tbody>
              <tr><td><strong>Platform</strong></td><td>Bharat Enterprise Billing System</td></tr>
              <tr><td><strong>Email</strong></td><td><a href="mailto:support.bharatenterprises@gmail.com" onClick={(e) => { const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent); if (!isMobile) { e.preventDefault(); navigator.clipboard.writeText('support.bharatenterprises@gmail.com').then(() => { const el = document.getElementById('pp-email-copied'); if(el) { el.style.opacity='1'; setTimeout(()=> el.style.opacity='0', 2000); } }); } }} className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer" title="Click to copy or email">support.bharatenterprises@gmail.com</a> <span id="pp-email-copied" className="text-emerald-400 text-xs ml-2 transition-opacity duration-300" style={{opacity:0}}>✓ Copied!</span></td></tr>
              <tr><td><strong>Region</strong></td><td>India</td></tr>
              <tr><td><strong>Response Time</strong></td><td>Within 7 business days</td></tr>
            </tbody>
          </table>
        </div>
      </>
    )
  }
];

export default function PrivacyPolicyPage() {
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
              <Shield className="w-4 h-4" />
              Legal Document
            </div>
            <h1 className="pp-title">Privacy Policy</h1>
            <p className="pp-subtitle">Bharat Enterprise Billing System</p>
            <p className="pp-last-updated">Last Updated: June 16, 2026</p>
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
              <h2 className="pp-section-title">Quick Summary</h2>
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
                    <tr><td>Data Ownership</td><td>Tenant data is owned by the Admin account</td></tr>
                    <tr><td>Data Isolation</td><td>Strict multi-tenant isolation; no cross-tenant access</td></tr>
                    <tr><td>Password Security</td><td>Encrypted using bcrypt; never stored in plain text</td></tr>
                    <tr><td>Payment Card Data</td><td>Not collected or stored by the Platform</td></tr>
                    <tr><td>GST Compliance</td><td>Users are responsible for verifying compliance</td></tr>
                    <tr><td>Subscription Data</td><td>Plan, billing cycle, and payment IDs tracked; no card data stored</td></tr>
                    <tr><td>Referral Data</td><td>Referral codes, link sharing, and reward grants tracked</td></tr>
                    <tr><td>Data Sharing</td><td>Never sold or rented to third parties</td></tr>
                    <tr><td>Security</td><td>Reasonable measures; no platform is 100% secure</td></tr>
                    <tr><td>Backups</td><td>Maintained for disaster recovery</td></tr>
                    <tr><td>Employee Access</td><td>Controlled by tenant Admin</td></tr>
                    <tr><td>Analytics</td><td>Used to improve performance and usability</td></tr>
                    <tr><td>Target Market</td><td>Indian businesses (pharma distributors, retailers, SMBs)</td></tr>
                    <tr><td>Children</td><td>Not intended for users under 18</td></tr>
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
          <p>This Privacy Policy is effective as of June 16, 2026.</p>
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
