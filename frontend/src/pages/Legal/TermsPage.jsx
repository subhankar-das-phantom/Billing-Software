import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Shield, FileText, Users, Eye, Lock, Scale,
  UserCheck, ShieldCheck, HardDrive, Trash2, Bell, Mail,
  Heart, Gavel, Globe, CreditCard, Laptop, BookOpen,
  AlertTriangle, Rocket, Ban, Server, ScrollText
} from 'lucide-react';

const sections = [
  {
    id: 'tc-introduction',
    num: '1',
    title: 'Introduction',
    icon: ScrollText,
    color: 'from-blue-500 to-accent2-500',
    content: (
      <>
        <p>Welcome to <strong>Bharat Enterprise Billing System</strong> ("Platform", "Service", "we", "us", or "our"). These Terms & Conditions ("Terms") govern your access to and use of our cloud-based billing, invoicing, and inventory management platform.</p>
        <p>By creating an account, accessing, or using the Platform, you agree to be bound by these Terms. If you do not agree, please do not use the Platform.</p>
        <p>We recommend reading these Terms alongside our <Link to="/privacy-policy" className="text-blue-400 hover:text-blue-300 transition-colors">Privacy Policy</Link>, which explains how we handle your data.</p>
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
          <li>By registering or using the Platform, you confirm that you have read, understood, and agree to these Terms.</li>
          <li>If you are using the Platform on behalf of a business, you represent that you have the authority to bind that entity.</li>
          <li>Continued use after modifications constitutes acceptance of updated Terms.</li>
          <li>If you do not agree to any part, you must stop using the Platform and request account termination.</li>
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
          <li>The Platform is designed for <strong>businesses and professionals</strong>, not personal use.</li>
          <li>You must be at least <strong>18 years old</strong> to create an account.</li>
          <li>The Platform currently targets <strong>Indian businesses</strong>, including pharmaceutical distributors, retailers, and SMEs.</li>
          <li>You confirm you are operating a lawful business compliant with applicable laws.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-account',
    num: '4',
    title: 'Account Responsibilities',
    icon: UserCheck,
    color: 'from-amber-500 to-orange-500',
    content: (
      <>
        <ul>
          <li><strong>Account Security</strong> — Keep your login credentials confidential and do not share them.</li>
          <li><strong>Accurate Information</strong> — Provide accurate, current, and complete information during registration.</li>
          <li><strong>Unauthorized Access</strong> — Notify us immediately of any suspected unauthorized use.</li>
          <li><strong>Single Admin Ownership</strong> — Each tenant is owned by one Admin, responsible for all tenant activity.</li>
          <li><strong>No Account Sharing</strong> — Do not share, sell, or transfer your account without our consent.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-multi-tenant',
    num: '5',
    title: 'Multi-Tenant Access Rules',
    icon: Lock,
    color: 'from-cyan-500 to-blue-500',
    content: (
      <>
        <p>The Platform operates on a <strong>multi-tenant SaaS architecture</strong> with strict data isolation.</p>
        <ul>
          <li><strong>Tenant Isolation</strong> — Your data is logically separated. You cannot access other tenants' data.</li>
          <li><strong>Admin Ownership</strong> — All business data belongs to the tenant, not individual users.</li>
          <li><strong>No Cross-Tenant Interference</strong> — Attempting to access other tenants' data violates these Terms.</li>
          <li><strong>Breach Consequences</strong> — Circumventing tenant isolation may result in immediate termination.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-employee-access',
    num: '6',
    title: 'Employee Access & Permissions',
    icon: Users,
    color: 'from-rose-500 to-pink-500',
    content: (
      <>
        <ul>
          <li><strong>Admin-Managed Access</strong> — Admins create Employee accounts with permitted access levels.</li>
          <li><strong>Employee Responsibility</strong> — Employees operate under the Admin's responsibility.</li>
          <li><strong>Access Revocation</strong> — Admins must revoke access for departing employees promptly.</li>
          <li><strong>No Independent Ownership</strong> — Employees do not own tenant data; access is inherited from Admin.</li>
          <li><strong>Activity Tracking</strong> — Employee actions may be logged for audit purposes.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-billing',
    num: '7',
    title: 'Billing & Financial Responsibility',
    icon: CreditCard,
    color: 'from-yellow-500 to-amber-500',
    content: (
      <>
        <ul>
          <li><strong>Data Accuracy</strong> — You are solely responsible for the accuracy of all financial data entered.</li>
          <li><strong>No Financial Advice</strong> — The Platform is a software tool, not an accounting or tax advisor.</li>
          <li><strong>No Payment Processing</strong> — We do not process or store credit card, debit card, UPI, or bank details.</li>
          <li><strong>Calculation Basis</strong> — Automatic calculations are based entirely on your data and configurations.</li>
          <li><strong>Record Keeping</strong> — Maintain independent records of critical financial data.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-gst',
    num: '8',
    title: 'GST & Legal Compliance Disclaimer',
    icon: Scale,
    color: 'from-accent2-500 to-accent-500',
    content: (
      <>
        <ul>
          <li><strong>Your Responsibility</strong> — Ensure invoices, tax rates, HSN/SAC codes, and GSTIN comply with applicable laws.</li>
          <li><strong>Not a Tax Advisor</strong> — We do not verify accuracy or legality of your tax configurations.</li>
          <li><strong>Regulatory Changes</strong> — Stay updated on tax law changes and adjust accordingly.</li>
          <li><strong>Jurisdiction</strong> — The Platform follows Indian GST conventions; verify compliance with local regulations.</li>
        </ul>
        <div className="pp-callout pp-callout-warning">
          <strong>Disclaimer:</strong> Consult a qualified Chartered Accountant or tax professional for all GST compliance and filing matters.
        </div>
      </>
    )
  },
  {
    id: 'tc-data-ownership',
    num: '9',
    title: 'Data Ownership',
    icon: ShieldCheck,
    color: 'from-teal-500 to-emerald-500',
    content: (
      <>
        <ul>
          <li><strong>Your Data</strong> — All business data you enter remains your property.</li>
          <li><strong>Tenant Data</strong> — Data belongs to the tenant (Admin), not individual employee accounts.</li>
          <li><strong>Limited License</strong> — You grant us a limited license to store and process your data to provide the Service.</li>
          <li><strong>No Sale of Data</strong> — We never sell or rent your business data to third parties.</li>
          <li><strong>Data Portability</strong> — We may provide export tools or assistance upon request.</li>
          <li><strong>Anonymized Analytics</strong> — Anonymized aggregate data may be used to improve the Platform.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-acceptable-use',
    num: '10',
    title: 'Acceptable Use Policy',
    icon: Ban,
    color: 'from-red-500 to-rose-500',
    content: (
      <>
        <p>You agree to use the Platform only for lawful business purposes. You may <strong>not</strong>:</p>
        <ul>
          <li>Use the Platform for illegal, fraudulent, or harmful activity.</li>
          <li>Attempt to access other tenants' data or systems.</li>
          <li>Reverse engineer, decompile, or derive source code from the Platform.</li>
          <li>Resell, sublicense, or redistribute Platform access without consent.</li>
          <li>Upload malicious content or disruptive code.</li>
          <li>Use automated bots or scrapers without authorization.</li>
          <li>Impersonate any person or entity.</li>
          <li>Circumvent security measures or tenant isolation.</li>
        </ul>
        <div className="pp-callout pp-callout-warning">
          <strong>Warning:</strong> Violations may result in immediate account suspension or termination without prior notice.
        </div>
      </>
    )
  },
  {
    id: 'tc-availability',
    num: '11',
    title: 'Service Availability',
    icon: Laptop,
    color: 'from-blue-500 to-cyan-500',
    content: (
      <>
        <ul>
          <li><strong>Best Effort</strong> — We strive for reliability but the Platform may experience downtime.</li>
          <li><strong>No Guarantee</strong> — We do not guarantee uninterrupted, error-free, or always-available access.</li>
          <li><strong>Scheduled Maintenance</strong> — Temporary outages may occur with advance notice when possible.</li>
          <li><strong>Third-Party Dependencies</strong> — Downtime from Vercel, Render, or MongoDB Atlas is beyond our control.</li>
          <li><strong>Force Majeure</strong> — We are not liable for disruptions from natural disasters, outages, or government actions.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-backups',
    num: '12',
    title: 'Backups & Disaster Recovery',
    icon: HardDrive,
    color: 'from-sky-500 to-blue-500',
    content: (
      <>
        <ul>
          <li><strong>Automated Backups</strong> — MongoDB Atlas maintains automated backups.</li>
          <li><strong>Disaster Recovery</strong> — Backups may restore service after data loss or failure.</li>
          <li><strong>Backup Retention</strong> — Backups may persist temporarily after deletion, with same security protections.</li>
          <li><strong>No Guaranteed Recovery</strong> — Reasonable efforts are made but full recovery is not guaranteed.</li>
          <li><strong>User Responsibility</strong> — Maintain your own independent records of critical data.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-ip',
    num: '13',
    title: 'Intellectual Property',
    icon: BookOpen,
    color: 'from-accent-500 to-accent-500',
    content: (
      <>
        <ul>
          <li><strong>Platform Ownership</strong> — Design, code, features, branding, and documentation are our intellectual property.</li>
          <li><strong>Limited License</strong> — You receive a limited, non-exclusive, revocable license for internal business use.</li>
          <li><strong>Restrictions</strong> — Do not copy, modify, distribute, sell, or create derivative works without consent.</li>
          <li><strong>Your Content</strong> — You retain ownership of your business data.</li>
          <li><strong>Feedback</strong> — Suggestions may be used without compensation obligation.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-third-party',
    num: '14',
    title: 'Third-Party Services',
    icon: Server,
    color: 'from-emerald-500 to-green-500',
    content: (
      <>
        <ul>
          <li>The Platform relies on <strong>MongoDB Atlas</strong>, <strong>Vercel</strong>, and <strong>Render</strong> for infrastructure.</li>
          <li>We are not responsible for availability or security of third-party services.</li>
          <li>No current integration with payment gateways, social logins, or ad networks.</li>
          <li>Future integrations will be reflected in updated Terms.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-liability',
    num: '15',
    title: 'Limitation of Liability',
    icon: AlertTriangle,
    color: 'from-slate-500 to-slate-600',
    content: (
      <>
        <ul>
          <li>The Platform is provided <strong>"as is"</strong> and <strong>"as available"</strong> without warranties.</li>
          <li>We do not warrant uninterrupted, error-free, or completely secure operation.</li>
          <li>We are not liable for indirect, incidental, special, or consequential damages.</li>
          <li>We are not responsible for calculation accuracy based on user-provided data.</li>
          <li>Total liability is limited to fees paid (if any) in the 12 months preceding the claim.</li>
          <li>We are not liable for third-party provider outages.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-termination',
    num: '16',
    title: 'Suspension & Account Termination',
    icon: Trash2,
    color: 'from-red-500 to-rose-500',
    content: (
      <>
        <h4>Voluntary Termination</h4>
        <ul>
          <li>Request termination at any time by contacting support.</li>
          <li>Data deletion completed within <strong>90 days</strong>, subject to legal requirements.</li>
          <li>Export important data before requesting termination.</li>
        </ul>
        <h4>Involuntary Termination</h4>
        <ul>
          <li>We may suspend accounts that violate these Terms, pose security risks, or engage in illegal activity.</li>
        </ul>
        <h4>Post-Termination</h4>
        <ul>
          <li>All tenant data is permanently deleted.</li>
          <li>Anonymized data may be retained for analytics.</li>
          <li>Backups may persist temporarily before purge cycles.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-modifications',
    num: '17',
    title: 'Modifications to the Service',
    icon: Bell,
    color: 'from-orange-500 to-amber-500',
    content: (
      <>
        <ul>
          <li>We may modify, update, or discontinue any part of the Platform at any time.</li>
          <li>Significant changes will be communicated via in-app notifications or email.</li>
          <li>Continued use after modifications constitutes acceptance.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-subscription',
    num: '18',
    title: 'Future Subscription & Billing Terms',
    icon: Rocket,
    color: 'from-pink-500 to-rose-500',
    content: (
      <>
        <ul>
          <li>The Platform is currently offered <strong>free of charge</strong> during its launch phase.</li>
          <li><strong>Paid plans</strong> or premium features may be introduced in the future.</li>
          <li>Existing users will receive advance notice of pricing changes.</li>
          <li>Early adopters may receive preferential pricing.</li>
          <li>We will never charge without explicit consent and prior notification.</li>
        </ul>
        <div className="pp-callout">
          <strong>Note:</strong> Any future paid plans will include detailed terms covering billing cycles, refund policies, and cancellation procedures.
        </div>
      </>
    )
  },
  {
    id: 'tc-governing-law',
    num: '19',
    title: 'Governing Law',
    icon: Gavel,
    color: 'from-accent2-500 to-blue-500',
    content: (
      <>
        <ul>
          <li>These Terms are governed by the laws of <strong>India</strong>.</li>
          <li>Disputes shall be subject to the exclusive jurisdiction of <strong>Indian courts</strong>.</li>
          <li>If any provision is found invalid, remaining provisions continue in effect.</li>
          <li>Failure to enforce any provision does not constitute a waiver.</li>
        </ul>
      </>
    )
  },
  {
    id: 'tc-contact',
    num: '20',
    title: 'Contact Information',
    icon: Mail,
    color: 'from-emerald-500 to-teal-500',
    content: (
      <>
        <p>For questions or requests regarding these Terms & Conditions:</p>
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
              Legal Document
            </div>
            <h1 className="pp-title">Terms & Conditions</h1>
            <p className="pp-subtitle">Bharat Enterprise Billing System</p>
            <p className="pp-last-updated">Last Updated: May 17, 2026</p>
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
                    <tr><td>Account Ownership</td><td>Admin owns tenant; responsible for all activity</td></tr>
                    <tr><td>Multi-Tenant Isolation</td><td>Strict data isolation; no cross-tenant access</td></tr>
                    <tr><td>Employee Access</td><td>Admin-managed; employees don't own data</td></tr>
                    <tr><td>Financial Data</td><td>Users responsible for accuracy</td></tr>
                    <tr><td>GST Compliance</td><td>Users must verify compliance in their jurisdiction</td></tr>
                    <tr><td>Payment Data</td><td>No card/UPI data stored</td></tr>
                    <tr><td>Service Availability</td><td>Best effort; no 100% uptime guarantee</td></tr>
                    <tr><td>Backups</td><td>For disaster recovery; may persist temporarily</td></tr>
                    <tr><td>Acceptable Use</td><td>No abuse, reverse engineering, or resale</td></tr>
                    <tr><td>Intellectual Property</td><td>Platform IP belongs to Bharat Enterprise</td></tr>
                    <tr><td>Future Pricing</td><td>Paid plans may come with advance notice</td></tr>
                    <tr><td>Governing Law</td><td>Indian law; Indian courts</td></tr>
                    <tr><td>Target Market</td><td>Indian businesses (pharma, retail, SMBs)</td></tr>
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
          <p>These Terms & Conditions are effective as of May 17, 2026.</p>
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
