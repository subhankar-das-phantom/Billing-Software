/**
 * Bharat Enterprise Billing System - API Test Suite
 * 
 * This is a simple test script to verify all API endpoints work correctly.
 * Run with: node tests/api.test.js
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Test data
const testUser = {
  email: `test_${Date.now()}@example.com`,
  password: 'Test123!',
  firmName: 'Test Enterprise',
  firmPhone: '9876543210',
  firmAddress: 'Test Address, City',
  firmGSTIN: '22AAAAA0000A1Z5'
};

let authCookie = '';
let testProductId = null;
let testCustomerId = null;
let testInvoiceId = null;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(type, message) {
  const icons = {
    pass: `${colors.green}✓${colors.reset}`,
    fail: `${colors.red}✗${colors.reset}`,
    info: `${colors.blue}ℹ${colors.reset}`,
    section: `${colors.cyan}▸${colors.reset}`
  };
  console.log(`${icons[type]} ${message}`);
}

async function request(method, endpoint, body = null) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(authCookie ? { 'Cookie': authCookie } : {})
      },
      withCredentials: true,
      validateStatus: () => true // Don't throw on any status code
    };
    
    if (body) {
      config.data = body;
    }

    const response = await axios(config);
    
    // Capture cookies from login/register
    const setCookie = response.headers['set-cookie'];
    if (setCookie && setCookie[0] && setCookie[0].includes('token=')) {
      authCookie = setCookie[0].split(';')[0];
    }

    return { status: response.status, data: response.data };
  } catch (err) {
    throw new Error(err.message);
  }
}

// ===================== AUTH TESTS =====================
async function testAuth() {
  console.log('\n' + colors.cyan + '═══ AUTHENTICATION TESTS ═══' + colors.reset + '\n');
  
  // Test 1: Register new user
  try {
    const res = await request('POST', '/auth/register', testUser);
    if (res.status === 201 && res.data.success) {
      log('pass', 'Register new user - Success');
    } else {
      log('fail', `Register new user - Failed: ${res.data.message}`);
    }
  } catch (err) {
    log('fail', `Register new user - Error: ${err.message}`);
  }

  // Test 2: Register with existing email (should fail)
  try {
    const res = await request('POST', '/auth/register', testUser);
    if (res.status === 400 && res.data.message.includes('already exists')) {
      log('pass', 'Register duplicate email blocked - Success');
    } else {
      log('fail', 'Register duplicate email blocked - Should have failed');
    }
  } catch (err) {
    log('fail', `Register duplicate - Error: ${err.message}`);
  }

  // Clear auth for login test
  authCookie = '';

  // Test 3: Login with valid credentials
  try {
    const res = await request('POST', '/auth/login', {
      email: testUser.email,
      password: testUser.password
    });
    if (res.status === 200 && res.data.success) {
      log('pass', 'Login with valid credentials - Success');
    } else {
      log('fail', `Login - Failed: ${res.data.message}`);
    }
  } catch (err) {
    log('fail', `Login - Error: ${err.message}`);
  }

  // Test 4: Get current user
  try {
    const res = await request('GET', '/auth/me');
    if (res.status === 200 && res.data.admin) {
      log('pass', 'Get current user (/me) - Success');
    } else {
      log('fail', `Get current user - Failed: ${res.data.message}`);
    }
  } catch (err) {
    log('fail', `Get current user - Error: ${err.message}`);
  }

  // Test 5: Login with invalid credentials
  try {
    const res = await request('POST', '/auth/login', {
      email: testUser.email,
      password: 'wrongpassword'
    });
    if (res.status === 401) {
      log('pass', 'Invalid login rejected - Success');
    } else {
      log('fail', 'Invalid login rejected - Should have failed');
    }
  } catch (err) {
    log('fail', `Invalid login test - Error: ${err.message}`);
  }
}

// ===================== PRODUCT TESTS =====================
async function testProducts() {
  console.log('\n' + colors.cyan + '═══ PRODUCT TESTS ═══' + colors.reset + '\n');

  const testProduct = {
    productName: 'Test Medicine 500mg',
    hsnCode: '30049099',
    batchNo: 'BATCH001',
    expiryDate: '2025-12-31',
    newMRP: 150.00,
    rate: 120.00,
    gstPercentage: 12,
    openingStockQty: 100,
    unit: 'Strips'
  };

  // Test 1: Create product
  try {
    const res = await request('POST', '/products', testProduct);
    if (res.status === 201 && res.data.product) {
      testProductId = res.data.product._id;
      log('pass', `Create product - Success (ID: ${testProductId})`);
    } else {
      log('fail', `Create product - Failed: ${res.data.message}`);
    }
  } catch (err) {
    log('fail', `Create product - Error: ${err.message}`);
  }

  // Test 2: Get all products
  try {
    const res = await request('GET', '/products');
    if (res.status === 200 && Array.isArray(res.data.products)) {
      log('pass', `Get all products - Success (Count: ${res.data.products.length})`);
    } else {
      log('fail', `Get all products - Failed`);
    }
  } catch (err) {
    log('fail', `Get all products - Error: ${err.message}`);
  }

  // Test 3: Get single product
  if (testProductId) {
    try {
      const res = await request('GET', `/products/${testProductId}`);
      if (res.status === 200 && res.data.product) {
        log('pass', 'Get single product - Success');
      } else {
        log('fail', `Get single product - Failed`);
      }
    } catch (err) {
      log('fail', `Get single product - Error: ${err.message}`);
    }
  }

  // Test 4: Update product
  if (testProductId) {
    try {
      const res = await request('PUT', `/products/${testProductId}`, {
        productName: 'Updated Medicine 500mg',
        rate: 125.00
      });
      if (res.status === 200 && res.data.product) {
        log('pass', 'Update product - Success');
      } else {
        log('fail', `Update product - Failed`);
      }
    } catch (err) {
      log('fail', `Update product - Error: ${err.message}`);
    }
  }

  // Test 5: Adjust stock
  if (testProductId) {
    try {
      const res = await request('PUT', `/products/${testProductId}/stock`, {
        quantity: 50,
        type: 'in',
        reason: 'Test stock adjustment'
      });
      if (res.status === 200 && res.data.product) {
        log('pass', `Adjust stock - Success (New qty: ${res.data.product.currentStockQty})`);
      } else {
        log('fail', `Adjust stock - Failed: ${res.data.message}`);
      }
    } catch (err) {
      log('fail', `Adjust stock - Error: ${err.message}`);
    }
  }
}

// ===================== CUSTOMER TESTS =====================
async function testCustomers() {
  console.log('\n' + colors.cyan + '═══ CUSTOMER TESTS ═══' + colors.reset + '\n');

  // Use timestamp to create unique test data
  const timestamp = Date.now().toString().slice(-8);
  const testCustomer = {
    customerName: `Test Medical Store ${timestamp}`,
    address: '123 Test Street, City',
    phone: `98${timestamp}`, // Unique phone number
    gstin: '', // Optional, leave empty
    dlNo: `DL-${timestamp}`
  };

  // Test 1: Create customer
  try {
    const res = await request('POST', '/customers', testCustomer);
    if (res.status === 201 && res.data.customer) {
      testCustomerId = res.data.customer._id;
      log('pass', `Create customer - Success (ID: ${testCustomerId})`);
    } else {
      log('fail', `Create customer - Failed: ${res.data.message}`);
    }
  } catch (err) {
    log('fail', `Create customer - Error: ${err.message}`);
  }

  // Test 2: Get all customers
  try {
    const res = await request('GET', '/customers');
    if (res.status === 200 && Array.isArray(res.data.customers)) {
      log('pass', `Get all customers - Success (Count: ${res.data.customers.length})`);
    } else {
      log('fail', `Get all customers - Failed`);
    }
  } catch (err) {
    log('fail', `Get all customers - Error: ${err.message}`);
  }

  // Test 3: Get single customer
  if (testCustomerId) {
    try {
      const res = await request('GET', `/customers/${testCustomerId}`);
      if (res.status === 200 && res.data.customer) {
        log('pass', 'Get single customer - Success');
      } else {
        log('fail', `Get single customer - Failed`);
      }
    } catch (err) {
      log('fail', `Get single customer - Error: ${err.message}`);
    }
  }

  // Test 4: Update customer
  if (testCustomerId) {
    try {
      const res = await request('PUT', `/customers/${testCustomerId}`, {
        customerName: `Updated Medical Store ${timestamp}`,
        phone: `99${timestamp}` // Unique updated phone
      });
      if (res.status === 200 && res.data.customer) {
        log('pass', 'Update customer - Success');
      } else {
        log('fail', `Update customer - Failed: ${res.data.message || 'Unknown error'}`);
      }
    } catch (err) {
      log('fail', `Update customer - Error: ${err.message}`);
    }
  }
}

// ===================== INVOICE TESTS =====================
async function testInvoices() {
  console.log('\n' + colors.cyan + '═══ INVOICE TESTS ═══' + colors.reset + '\n');

  // Test 1: Create invoice
  if (testCustomerId && testProductId) {
    try {
      const res = await request('POST', '/invoices', {
        customerId: testCustomerId,
        items: [{
          productId: testProductId,
          quantitySold: 5,
          ratePerUnit: 120,
          freeQuantity: 1,
          schemeDiscount: 5
        }],
        paymentType: 'Credit',
        notes: 'Test invoice'
      });
      if (res.status === 201 && res.data.invoice) {
        testInvoiceId = res.data.invoice._id;
        log('pass', `Create invoice - Success (ID: ${testInvoiceId}, Total: ₹${res.data.invoice.totals?.netTotal})`);
      } else {
        log('fail', `Create invoice - Failed: ${res.data.message}`);
      }
    } catch (err) {
      log('fail', `Create invoice - Error: ${err.message}`);
    }
  } else {
    log('fail', 'Create invoice - Skipped (missing product/customer)');
  }

  // Test 2: Get all invoices
  try {
    const res = await request('GET', '/invoices');
    if (res.status === 200 && Array.isArray(res.data.invoices)) {
      log('pass', `Get all invoices - Success (Count: ${res.data.invoices.length})`);
    } else {
      log('fail', `Get all invoices - Failed`);
    }
  } catch (err) {
    log('fail', `Get all invoices - Error: ${err.message}`);
  }

  // Test 3: Get single invoice
  if (testInvoiceId) {
    try {
      const res = await request('GET', `/invoices/${testInvoiceId}`);
      if (res.status === 200 && res.data.invoice) {
        log('pass', 'Get single invoice - Success');
      } else {
        log('fail', `Get single invoice - Failed`);
      }
    } catch (err) {
      log('fail', `Get single invoice - Error: ${err.message}`);
    }
  }

  // Test 4: Update invoice status
  if (testInvoiceId) {
    try {
      const res = await request('PUT', `/invoices/${testInvoiceId}/status`, {
        status: 'Printed'
      });
      if (res.status === 200 && res.data.invoice) {
        log('pass', 'Update invoice status - Success');
      } else {
        log('fail', `Update invoice status - Failed`);
      }
    } catch (err) {
      log('fail', `Update invoice status - Error: ${err.message}`);
    }
  }

  // Test 5: Get customer invoices
  if (testCustomerId) {
    try {
      const res = await request('GET', `/invoices/customer/${testCustomerId}`);
      if (res.status === 200) {
        log('pass', `Get customer invoices - Success (Count: ${res.data.invoices?.length || 0})`);
      } else {
        log('fail', `Get customer invoices - Failed`);
      }
    } catch (err) {
      log('fail', `Get customer invoices - Error: ${err.message}`);
    }
  }
}

// ===================== DASHBOARD TESTS =====================
async function testDashboard() {
  console.log('\n' + colors.cyan + '═══ DASHBOARD TESTS ═══' + colors.reset + '\n');

  try {
    const res = await request('GET', '/dashboard/stats');
    if (res.status === 200 && res.data.stats) {
      log('pass', `Get dashboard stats - Success`);
      console.log(`   Products: ${res.data.stats.totalProducts || 0}`);
      console.log(`   Customers: ${res.data.stats.totalCustomers || 0}`);
      console.log(`   Invoices: ${res.data.stats.totalInvoices || 0}`);
    } else {
      log('fail', `Get dashboard stats - Failed`);
    }
  } catch (err) {
    log('fail', `Get dashboard stats - Error: ${err.message}`);
  }
}

// ===================== CLEANUP =====================
async function cleanup() {
  console.log('\n' + colors.yellow + '═══ CLEANUP ═══' + colors.reset + '\n');

  let deleted = 0;
  let failed = 0;

  // Delete test invoice first (depends on customer/product)
  if (testInvoiceId) {
    try {
      const res = await request('DELETE', `/invoices/${testInvoiceId}`);
      if (res.status === 200) {
        log('pass', `Deleted test invoice: ${testInvoiceId}`);
        deleted++;
      } else {
        log('fail', `Failed to delete invoice: ${res.data.message || 'Unknown error'}`);
        failed++;
      }
    } catch (err) {
      log('fail', `Error deleting invoice: ${err.message}`);
      failed++;
    }
  }

  // Delete test customer
  if (testCustomerId) {
    try {
      const res = await request('DELETE', `/customers/${testCustomerId}`);
      if (res.status === 200) {
        log('pass', `Deleted test customer: ${testCustomerId}`);
        deleted++;
      } else {
        log('fail', `Failed to delete customer: ${res.data.message || 'Unknown error'}`);
        failed++;
      }
    } catch (err) {
      log('fail', `Error deleting customer: ${err.message}`);
      failed++;
    }
  }

  // Delete test product
  if (testProductId) {
    try {
      const res = await request('DELETE', `/products/${testProductId}`);
      if (res.status === 200) {
        log('pass', `Deleted test product: ${testProductId}`);
        deleted++;
      } else {
        log('fail', `Failed to delete product: ${res.data.message || 'Unknown error'}`);
        failed++;
      }
    } catch (err) {
      log('fail', `Error deleting product: ${err.message}`);
      failed++;
    }
  }

  // Note: We don't delete the test user as it requires database access
  console.log(`\n   ${colors.green}Deleted: ${deleted}${colors.reset} | ${colors.red}Failed: ${failed}${colors.reset}`);
  log('info', `Test user remains: ${testUser.email}`);
  log('info', 'You can delete the test user directly from MongoDB if needed');
}

// ===================== RUN ALL TESTS =====================
async function runTests() {
  console.log('\n' + colors.cyan + '╔════════════════════════════════════════════════════════╗' + colors.reset);
  console.log(colors.cyan + '║  BHARAT ENTERPRISE BILLING SYSTEM - API TEST SUITE     ║' + colors.reset);
  console.log(colors.cyan + '╚════════════════════════════════════════════════════════╝' + colors.reset);
  console.log(`\n${colors.blue}Testing against: ${API_BASE}${colors.reset}`);
  
  const startTime = Date.now();

  try {
    await testAuth();
    await testProducts();
    await testCustomers();
    await testInvoices();
    await testDashboard();
    await cleanup();
  } catch (err) {
    console.error('\n' + colors.red + 'Test suite failed with error:' + colors.reset, err);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n' + colors.cyan + '═══════════════════════════════════════════════════════' + colors.reset);
  console.log(`${colors.green}Tests completed in ${duration}s${colors.reset}\n`);
}

// Run tests
runTests();
