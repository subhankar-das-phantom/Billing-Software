const axios = require('axios');
const mongoose = require('mongoose');

const API_BASE = 'http://localhost:5000/api';

// Test data
const testAdmin = {
  email: `admin_rbac_${Date.now()}@test.com`,
  password: 'password123',
  firmName: 'RBAC Enterprise'
};

const testEmployee = {
  name: 'John Doe',
  email: `emp_rbac_${Date.now()}@test.com`,
  password: 'password123',
};

let adminCookie = '';
let employeeCookie = '';
let employeeId = null;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(type, message) {
  const icons = { pass: `${colors.green}✓${colors.reset}`, fail: `${colors.red}✗${colors.reset}` };
  console.log(`${icons[type]} ${message}`);
}

async function request(method, endpoint, body = null, cookie = '') {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { 'Cookie': cookie } : {})
      },
      withCredentials: true,
      validateStatus: () => true
    };
    
    if (body) config.data = body;

    const response = await axios(config);
    let newCookie = cookie;
    
    const setCookie = response.headers['set-cookie'];
    if (setCookie && setCookie[0] && setCookie[0].includes('token=')) {
      newCookie = setCookie[0].split(';')[0];
    }

    return { status: response.status, data: response.data, cookie: newCookie };
  } catch (err) {
    throw new Error(err.message);
  }
}

async function runTests() {
  console.log('\n' + colors.cyan + '═══ RBAC PERMISSIONS TESTS ═══' + colors.reset + '\n');
  
  // 1. Register Admin
  let res = await request('POST', '/auth/register', testAdmin);
  if (res.status === 201) {
    adminCookie = res.cookie;
    log('pass', 'Admin Registered');
  } else {
    log('fail', `Admin Register Failed: ${res.data.message}`);
    return;
  }

  // 2. Create Employee
  res = await request('POST', '/employees', testEmployee, adminCookie);
  if (res.status === 201) {
    employeeId = res.data.employee.id;
    log('pass', `Employee Created (${employeeId})`);
  } else {
    log('fail', `Employee Create Failed: ${res.data.message}`);
    return;
  }

  // 3. Login Employee
  res = await request('POST', '/auth/employee/login', {
    email: testEmployee.email,
    password: testEmployee.password
  });
  if (res.status === 200) {
    employeeCookie = res.cookie;
    log('pass', 'Employee Logged In');
  } else {
    log('fail', 'Employee Login Failed');
    return;
  }

  // 4. Test Admin Access (Bypass)
  res = await request('GET', '/customers', null, adminCookie);
  if (res.status === 200) log('pass', 'Admin can view customers (bypass)');
  else log('fail', 'Admin could not view customers');

  // 5. Setup Employee Permissions (view customers only)
  res = await request('PUT', `/employees/${employeeId}/permissions`, {
    role: 'custom',
    permissions: {
      customers: { view: true, create: false, edit: false, delete: false },
      invoices: { view: false, create: false, edit: false, cancel: false }
    }
  }, adminCookie);
  if (res.status === 200) log('pass', 'Admin updated employee permissions');
  else log('fail', 'Admin failed to update permissions');

  // Wait a second for token/cache propagation if any (none expected)
  await new Promise(r => setTimeout(r, 500));
  
  // Re-login employee to get fresh permissions
  res = await request('POST', '/auth/employee/login', {
    email: testEmployee.email,
    password: testEmployee.password
  });
  employeeCookie = res.cookie;

  // 6. Test Employee Authorized Action
  res = await request('GET', '/customers', null, employeeCookie);
  if (res.status === 200) log('pass', 'Employee can view customers (allowed)');
  else log('fail', 'Employee failed to view customers');

  // 7. Test Employee Unauthorized Action (wrong action)
  res = await request('POST', '/customers', { customerName: 'Test' }, employeeCookie);
  if (res.status === 403) log('pass', 'Employee blocked from creating customers (denied action)');
  else log('fail', `Employee create customer returned ${res.status}`);

  // 8. Test Employee Unauthorized Action (wrong module)
  res = await request('GET', '/invoices', null, employeeCookie);
  if (res.status === 403) log('pass', 'Employee blocked from viewing invoices (denied module)');
  else log('fail', `Employee view invoices returned ${res.status}`);

  console.log('\n' + colors.yellow + 'Done with RBAC Tests.' + colors.reset);
}

runTests();
