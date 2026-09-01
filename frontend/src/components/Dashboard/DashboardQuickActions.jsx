import React from 'react';
import { Link } from 'react-router-dom';
import { 
  FilePlus, 
  Wallet, 
  Package, 
  ShoppingCart, 
  Users, 
  FileBarChart, 
  ArrowUpRight
} from 'lucide-react';

export const DashboardQuickActions = () => {
  const actions = [
    {
      to: '/invoices/create',
      label: 'Create Invoice',
      sublabel: 'New billing document',
      icon: FilePlus,
      shortcut: 'Alt+N',
      iconColor: 'text-blue-400'
    },
    {
      to: '/collections',
      label: 'Record Payment',
      sublabel: 'Customer receipts',
      icon: Wallet,
      shortcut: 'Collect',
      iconColor: 'text-emerald-400'
    },
    {
      to: '/products',
      label: 'Product Catalog',
      sublabel: 'Items & barcode list',
      icon: Package,
      shortcut: 'Items',
      iconColor: 'text-violet-400'
    },
    {
      to: '/purchases/new',
      label: 'Purchase Order',
      sublabel: 'Vendor stock inward',
      icon: ShoppingCart,
      shortcut: 'Inward',
      iconColor: 'text-teal-400'
    },
    {
      to: '/customers',
      label: 'Customers',
      sublabel: 'Accounts & ledgers',
      icon: Users,
      shortcut: 'Clients',
      iconColor: 'text-amber-400'
    },
    {
      to: '/reports',
      label: 'Reports & GST',
      sublabel: 'Sales & tax metrics',
      icon: FileBarChart,
      shortcut: 'Analytics',
      iconColor: 'text-cyan-400'
    }
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Quick Actions</h2>
          <p className="text-xs text-slate-400">Direct shortcuts for daily business operations</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              to={action.to}
              className="flex flex-col justify-between p-3.5 rounded-lg bg-slate-950/40 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/50 transition-colors group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-md bg-slate-800 text-slate-400 group-hover:text-white transition-colors">
                    <Icon className={`w-4 h-4 ${action.iconColor}`} />
                  </div>
                  {action.shortcut && (
                    <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-slate-800 text-slate-400">
                      {action.shortcut}
                    </span>
                  )}
                </div>

                <h3 className="font-medium text-xs text-white group-hover:text-blue-300 transition-colors">
                  {action.label}
                </h3>
                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                  {action.sublabel}
                </p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-end">
                <ArrowUpRight className="w-3 h-3 text-slate-600 group-hover:text-slate-300 transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardQuickActions;
