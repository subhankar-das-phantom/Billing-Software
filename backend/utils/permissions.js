const PERMISSIONS_REGISTRY = {
  customers: ['view', 'create', 'edit', 'delete'],
  products: ['view', 'create', 'edit', 'delete'],
  invoices: ['view', 'create', 'edit', 'cancel'],
  payments: ['view', 'create', 'edit', 'delete'],
  collections: ['view'],
  creditNotes: ['view', 'create', 'edit'],
  notes: ['view', 'create', 'edit', 'delete'],
  reports: ['view'],
  inventory: ['view', 'create', 'edit', 'delete'],
  batches: ['view', 'create', 'edit', 'delete'],
  ledger: ['view'],
  suppliers: ['view', 'create', 'edit', 'delete'],
  purchases: ['view', 'create', 'edit', 'cancel']
};

const buildPermissions = (modules, defaultAccess = false) => {
  const perms = {};
  for (const mod of Object.keys(PERMISSIONS_REGISTRY)) {
    perms[mod] = {};
    for (const action of PERMISSIONS_REGISTRY[mod]) {
      perms[mod][action] = defaultAccess;
    }
  }

  // Override with specified modules
  for (const mod in modules) {
    if (perms[mod]) {
      for (const action of modules[mod]) {
        if (PERMISSIONS_REGISTRY[mod].includes(action)) {
          perms[mod][action] = true;
        }
      }
    }
  }

  return perms;
};

const ROLE_PRESETS = {
  full_access: buildPermissions({}, true),
  viewer: buildPermissions({
    customers: ['view'],
    products: ['view'],
    invoices: ['view'],
    payments: ['view'],
    collections: ['view'],
    creditNotes: ['view'],
    notes: ['view'],
    reports: ['view'],
    inventory: ['view'],
    batches: ['view'],
    ledger: ['view'],
    suppliers: ['view'],
    purchases: ['view']
  }, false),
  payment_collector: buildPermissions({
    payments: ['view', 'create'],
    collections: ['view'],
    customers: ['view'], // contextual
    invoices: ['view']   // contextual
  }, false),
  billing_operator: buildPermissions({
    customers: ['view', 'create'],
    products: ['view'],
    invoices: ['view', 'create', 'cancel'],
    payments: ['view', 'create'],
    collections: ['view'],
    notes: ['view', 'create'],
    suppliers: ['view'],
    purchases: ['view']
  }, false),
  inventory_manager: buildPermissions({
    products: ['view', 'create', 'edit'],
    inventory: ['view', 'create', 'edit'],
    batches: ['view', 'create', 'edit', 'delete'],
    ledger: ['view'],
    suppliers: ['view', 'create', 'edit'],
    purchases: ['view', 'create', 'edit']
  }, false),
  custom: {} // Custom implies it's managed fully by the admin, not pre-filled
};

module.exports = {
  PERMISSIONS_REGISTRY,
  ROLE_PRESETS
};
