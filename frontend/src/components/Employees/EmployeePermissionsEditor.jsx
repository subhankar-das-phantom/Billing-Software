import React, { useState, useEffect } from 'react';
import { Shield, Save, Check, RefreshCw } from 'lucide-react';
import { employeeService } from '../../services/employees/employeeService';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';

const PERMISSION_MODULES = {
  customers: { label: 'Customers', actions: ['view', 'create', 'edit', 'delete'] },
  products: { label: 'Products', actions: ['view', 'create', 'edit', 'delete'] },
  invoices: { label: 'Invoices', actions: ['view', 'create', 'edit', 'cancel'] },
  payments: { label: 'Payments', actions: ['view', 'create', 'edit', 'delete'] },
  creditNotes: { label: 'Credit Notes', actions: ['view', 'create', 'edit'] },
  notes: { label: 'Notes', actions: ['view', 'create', 'edit', 'delete'] },
  reports: { label: 'Reports', actions: ['view'] },
  inventory: { label: 'Inventory', actions: ['view', 'create', 'edit', 'delete'] },
  ledger: { label: 'Ledger', actions: ['view'] }
};

const ROLES = [
  { id: 'full_access', label: 'Full Access' },
  { id: 'billing_operator', label: 'Billing Operator' },
  { id: 'payment_collector', label: 'Payment Collector' },
  { id: 'inventory_manager', label: 'Inventory Manager' },
  { id: 'viewer', label: 'Viewer' },
  { id: 'custom', label: 'Custom' }
];

export default function EmployeePermissionsEditor({ employee, onUpdate }) {
  const { showToast } = useAuth();
  const [role, setRole] = useState(employee.role || 'full_access');
  const [permissions, setPermissions] = useState(employee.permissions || {});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setRole(employee.role || 'full_access');
    setPermissions(employee.permissions || {});
  }, [employee]);

  const handleRoleChange = async (e) => {
    const newRole = e.target.value;
    setRole(newRole);
    if (newRole !== 'custom') {
      try {
        setIsSaving(true);
        // Call backend to auto-fill preset
        const data = await employeeService.updatePermissions(employee.id, { role: newRole });
        if (data.success) {
          setPermissions(data.employee.permissions);
          onUpdate(data.employee);
          showToast('Role preset applied successfully', 'success');
        }
      } catch (err) {
        showToast('Failed to apply preset', 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleCheckboxChange = (moduleKey, action) => {
    setRole('custom');
    setPermissions(prev => {
      const modulePerms = prev[moduleKey] || {};
      return {
        ...prev,
        [moduleKey]: {
          ...modulePerms,
          [action]: !modulePerms[action]
        }
      };
    });
  };

  const savePermissions = async () => {
    try {
      setIsSaving(true);
      const data = await employeeService.updatePermissions(employee.id, { role, permissions });
      if (data.success) {
        onUpdate(data.employee);
        showToast('Permissions saved successfully', 'success');
      }
    } catch (err) {
      showToast('Failed to save permissions', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Shield size={20} className="text-accent-400 shrink-0" />
          Access & Permissions
        </h3>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <select 
            value={role} 
            onChange={handleRoleChange}
            className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 w-full sm:w-auto"
          >
            {ROLES.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={savePermissions}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 w-full sm:w-auto shrink-0"
          >
            {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            Save Changes
          </motion.button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="py-3 px-4 text-sm font-semibold text-slate-400">Module</th>
              {['view', 'create', 'edit', 'delete', 'cancel'].map(action => (
                <th key={action} className="py-3 px-4 text-sm font-semibold text-slate-400 capitalize text-center">{action}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(PERMISSION_MODULES).map(([moduleKey, config]) => (
              <tr key={moduleKey} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                <td className="py-3 px-4 text-sm font-medium text-white">{config.label}</td>
                {['view', 'create', 'edit', 'delete', 'cancel'].map(action => (
                  <td key={action} className="py-3 px-4 text-center">
                    {config.actions.includes(action) ? (
                      <input
                        type="checkbox"
                        checked={!!permissions[moduleKey]?.[action]}
                        onChange={() => handleCheckboxChange(moduleKey, action)}
                        className="w-4 h-4 bg-slate-900 border-slate-700 rounded text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                      />
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
