import React from 'react';
import { CalendarClock, AlertTriangle, History, Check } from 'lucide-react';
import ProductWindow from './ProductWindow';

export default function InventoryShowcase() {
  const inventoryHighlights = [
    {
      icon: CalendarClock,
      title: 'Batch & Expiry Date Horizons',
      description: 'Assign specific manufacturing dates and expiry horizons to every incoming consignment to prevent expired stock dispatch.',
    },
    {
      icon: AlertTriangle,
      title: 'Proactive Reorder & Low-Stock Alerts',
      description: 'Set custom safety stock thresholds per SKU. The catalog flags critical and out-of-stock items before fulfillment stalls.',
    },
    {
      icon: History,
      title: 'Complete Inventory Movement Ledger',
      description: 'Audit every inventory addition, sale deduction, return credit, or manual adjustment with an immutable movement history.',
    },
  ];

  return (
    <section id="inventory" className="py-20 lg:py-28 border-t border-slate-800/80 bg-slate-900/40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: ProductWindow (Inverted column layout for visual rhythm) */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <ProductWindow
              src="/landing/product/inventory.png"
              alt="Multi-Batch Stock Catalog and Inventory Management"
              variant="editorial"
              title="Catalog & Multi-Batch Inventory"
              status="50 SKUs • Healthy"
            />
          </div>

          {/* Right Column: Narrative (No eyebrow kicker) */}
          <div className="lg:col-span-5 flex flex-col space-y-6 order-1 lg:order-2">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 tracking-tight leading-tight">
              Granular Batch Tracking with Real-Time Expiry Horizons
            </h2>

            <p className="text-base text-slate-400 leading-relaxed">
              Track multi-batch inventories with distinct MRPs, purchase costs, and custom units of measurement — whether bottles, strips, rolls, or bulk cartons.
            </p>

            <div className="space-y-4 pt-2">
              {inventoryHighlights.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="flex items-start space-x-3.5">
                    <div className="p-2 rounded-lg bg-slate-850 border border-slate-800 text-blue-400 shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex items-center space-x-2 text-xs text-slate-400">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Includes instant CSV/Excel export for warehouse stock audits</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
