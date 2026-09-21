import React, { useEffect } from 'react';
import LandingNav from './components/LandingNav';
import HeroSection from './components/HeroSection';
import CapabilityStrip from './components/CapabilityStrip';
import BillingShowcase from './components/BillingShowcase';
import InventoryShowcase from './components/InventoryShowcase';
import CustomerShowcase from './components/CustomerShowcase';
import BusinessFlow from './components/BusinessFlow';
import GSTShowcase from './components/GSTShowcase';
import AnalyticsShowcase from './components/AnalyticsShowcase';
import FeatureGrid from './components/FeatureGrid';
import PricingSection from './components/PricingSection';
import FAQSection from './components/FAQSection';
import FinalCTA from './components/FinalCTA';
import LandingFooter from './components/LandingFooter';

/**
 * Bharat Enterprise Master Landing Page.
 * Modular, product-first B2B SaaS architecture showcasing real application screenshots.
 * Full Dark and Light theme support aligned with canonical design system tokens.
 */
export default function LandingPage() {
  useEffect(() => {
    // Set descriptive, professional document title
    document.title = 'Bharat Enterprise — Billing, Multi-Batch Inventory & Customer Khata Suite';

    // Update meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.name = 'description';
      document.head.appendChild(metaDescription);
    }
    metaDescription.content =
      'Enterprise billing, multi-batch inventory tracking, customer ledger accounting, and Indian GST compliance for distributors, wholesalers, and retail enterprises.';
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white antialiased font-sans transition-colors duration-200">
      {/* Sticky Top Header Navigation with Theme Toggle */}
      <LandingNav />

      {/* Main Page Landmark */}
      <main id="main-content" tabIndex={-1} className="focus:outline-hidden">
        {/* Hero Section with Live Executive Dashboard */}
        <HeroSection />

        {/* Capability Pills Strip */}
        <CapabilityStrip />

        {/* GST Invoicing Showcase (invoice.png) */}
        <BillingShowcase />

        {/* Multi-Batch Stock Management Showcase (inventory.png) */}
        <InventoryShowcase />

        {/* Customer Ledger & Khata Showcase (customer-ledger.png) */}
        <CustomerShowcase />

        {/* Integrated Business Lifecycle Workflow */}
        <BusinessFlow />

        {/* Indian GST & Regulatory Compliance Section */}
        <GSTShowcase />

        {/* Analytics & Procurement Telemetry Hub (analytics.png & purchases.png) */}
        <AnalyticsShowcase />

        {/* Enterprise Breadth & Feature Matrix */}
        <FeatureGrid />

        {/* Public SaaS Subscription Pricing Plans */}
        <PricingSection />

        {/* Operational FAQs Accordion */}
        <FAQSection />

        {/* High-Contrast Conversion Banner */}
        <FinalCTA />
      </main>

      {/* Footer Navigation & Legal Links */}
      <LandingFooter />
    </div>
  );
}
