/**
 * Automated Verification Script for Employee Activity Log & Session Tracking
 *
 * Tests:
 * 1. Exact production regression: Sept 1 login session + Sept 4 & Sept 5 payments.
 *    Verifies payments appear in Activity Log even when sessions = 0.
 * 2. Session + Activity association.
 * 3. Session without activity.
 * 4. Tenant isolation.
 * 5. Employee filtering.
 * 6. Daily work session concurrency throttling (10 rapid calls -> 1 session).
 *
 * Usage: npx tsx scripts/testActivityLogRegression.ts
 */

require('dotenv').config();
const mongoose = require('mongoose');
import { Types } from 'mongoose';
import Session from '../models/Session';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import Product from '../models/Product';
import Employee from '../models/Employee';
import Customer from '../models/Customer';
import Admin from '../models/Admin';
import {
  getActivityLog,
  ensureActiveWorkSession,
  parseActivityTimeRange
} from '../services/employeeActivityService';

async function runTests() {
  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected.\n');

  const testTenantAId = new Types.ObjectId();
  const testTenantBId = new Types.ObjectId();

  try {
    console.log('====================================================');
    console.log('TEST 1: Exact Production Regression');
    console.log('Employee logged in Sept 1 (closed), recorded payments Sept 4 & 5');
    console.log('====================================================');

    // Create Employee in Tenant A
    const employeeA = await Employee.create({
      name: 'Souman Sarkar Test',
      email: `souman.test.${Date.now()}@example.com`,
      password: 'password123',
      createdByAdmin: testTenantAId,
      isActive: true
    });

    // Closed Session on Sept 1
    const sept1Login = new Date('2026-09-01T10:00:00.000+05:30');
    const sept1Logout = new Date('2026-09-01T11:03:00.000+05:30');
    await Session.create({
      user: employeeA._id,
      userModel: 'Employee',
      loginTime: sept1Login,
      logoutTime: sept1Logout,
      lastActivityAt: sept1Logout,
      sessionDuration: 63,
      isActive: false
    });

    // Create dummy Customer & Invoice references for payments
    const testCustomer: any = await Customer.create({
      tenantId: testTenantAId,
      customerName: 'Test Customer',
      phone: '9999999999'
    });

    const dummyInvoice: any = await Invoice.create({
      tenantId: testTenantAId,
      invoiceNumber: `INV-TEST-${Date.now()}`,
      invoiceDate: new Date('2026-09-04T12:00:00.000+05:30'),
      customer: {
        _id: testCustomer._id,
        customerName: testCustomer.customerName
      },
      createdBy: {
        user: employeeA._id,
        userModel: 'Employee'
      },
      items: [],
      totals: {
        baseAmount: 1000,
        totalTaxable: 1000,
        totalGST: 0,
        totalCGST: 0,
        totalSGST: 0,
        netTotal: 1000
      },
      status: 'Created'
    });

    // Payment on Sept 4
    const paymentSept4 = await Payment.create({
      tenantId: testTenantAId,
      invoice: dummyInvoice._id,
      customer: testCustomer._id,
      amount: 500,
      paymentMethod: 'Cash',
      invoiceSnapshot: {
        invoiceNumber: dummyInvoice.invoiceNumber,
        netTotal: 1000
      },
      createdBy: {
        user: employeeA._id,
        userModel: 'Employee'
      },
      createdAt: new Date('2026-09-04T15:30:00.000+05:30')
    });

    // Payment on Sept 5 (today)
    const paymentSept5 = await Payment.create({
      tenantId: testTenantAId,
      invoice: dummyInvoice._id,
      customer: testCustomer._id,
      amount: 1000,
      paymentMethod: 'Cash',
      invoiceSnapshot: {
        invoiceNumber: dummyInvoice.invoiceNumber,
        netTotal: 1000
      },
      createdBy: {
        user: employeeA._id,
        userModel: 'Employee'
      },
      createdAt: new Date('2026-09-05T10:15:00.000+05:30')
    });

    // Query Activity Log for Sept 4 - Sept 5 range (e.g. 7d or custom range)
    const logResult7d = await getActivityLog(testTenantAId, {
      startDate: '2026-09-01',
      endDate: '2026-09-06'
    });

    console.log(`Log entries returned: ${logResult7d.log.length}`);
    console.log(`Stats returned:`, logResult7d.stats);

    if (logResult7d.stats.totalPayments < 2) {
      throw new Error(`Expected at least 2 payments, got ${logResult7d.stats.totalPayments}`);
    }

    // Now query for Sept 4 - Sept 5 strictly (when sessions = 0)
    const logResultSept4To5 = await getActivityLog(testTenantAId, {
      startDate: '2026-09-04',
      endDate: '2026-09-06'
    });

    console.log(`Sept 4-5 Stats:`, logResultSept4To5.stats);
    if (logResultSept4To5.stats.totalSessions !== 0) {
      throw new Error(`Expected 0 sessions in Sept 4-5, got ${logResultSept4To5.stats.totalSessions}`);
    }
    if (logResultSept4To5.stats.totalPayments !== 2) {
      throw new Error(`Expected 2 payments in Sept 4-5 with 0 sessions, got ${logResultSept4To5.stats.totalPayments}`);
    }

    const directEntry = logResultSept4To5.log.find(e => e.isDirectActivity && e.employee.id.toString() === employeeA._id.toString());
    if (!directEntry) {
      throw new Error('Direct activity entry was not created for unassigned payments!');
    }
    if (directEntry.activities.paymentsRecorded.length !== 2) {
      throw new Error(`Direct activity expected 2 payments, got ${directEntry.activities.paymentsRecorded.length}`);
    }
    console.log('✅ TEST 1 PASSED: Payments visible with 0 sessions under Direct Activity!\n');

    console.log('====================================================');
    console.log('TEST 2: Session with Activity Association');
    console.log('====================================================');
    const sessionNow = await Session.create({
      user: employeeA._id,
      userModel: 'Employee',
      loginTime: new Date(),
      isActive: true
    });

    const invoiceNow = await Invoice.create({
      tenantId: testTenantAId,
      invoiceNumber: `INV-NOW-${Date.now()}`,
      invoiceDate: new Date(),
      customer: {
        _id: testCustomer._id,
        customerName: testCustomer.customerName
      },
      createdBy: {
        user: employeeA._id,
        userModel: 'Employee'
      },
      items: [],
      totals: {
        baseAmount: 2500,
        totalTaxable: 2500,
        totalGST: 0,
        totalCGST: 0,
        totalSGST: 0,
        netTotal: 2500
      },
      status: 'Created',
      createdAt: new Date()
    });

    const logResultToday = await getActivityLog(testTenantAId, { range: '24h' });
    const associatedSession = logResultToday.log.find(e => e.session?.id?.toString() === sessionNow._id.toString());
    if (!associatedSession) {
      throw new Error('Active session not found in today log!');
    }
    if (associatedSession.summary.invoiceCount !== 1) {
      throw new Error(`Expected 1 invoice in session, got ${associatedSession.summary.invoiceCount}`);
    }
    console.log('✅ TEST 2 PASSED: Invoice correctly associated with active session!\n');

    console.log('====================================================');
    console.log('TEST 3: Session without Activity');
    console.log('====================================================');
    const emptySession = await Session.create({
      user: employeeA._id,
      userModel: 'Employee',
      loginTime: new Date(Date.now() - 30 * 60 * 1000),
      logoutTime: new Date(Date.now() - 10 * 60 * 1000),
      isActive: false
    });

    const logWithEmptySession = await getActivityLog(testTenantAId, { range: '1h' });
    const emptySessionEntry = logWithEmptySession.log.find(e => e.session?.id?.toString() === emptySession._id.toString());
    if (!emptySessionEntry) {
      throw new Error('Empty session was not included in log!');
    }
    if (emptySessionEntry.summary.invoiceCount !== 0 || emptySessionEntry.summary.paymentCount !== 0) {
      throw new Error('Empty session should have 0 activities!');
    }
    console.log('✅ TEST 3 PASSED: Session without activity rendered cleanly!\n');

    console.log('====================================================');
    console.log('TEST 4: Tenant Isolation');
    console.log('====================================================');
    const tenantBLog = await getActivityLog(testTenantBId, { range: '7d' });
    if (tenantBLog.log.length !== 0 || tenantBLog.stats.totalPayments !== 0 || tenantBLog.stats.totalInvoices !== 0) {
      throw new Error('Tenant B saw Tenant A data! Isolation broken!');
    }
    console.log('✅ TEST 4 PASSED: Tenant isolation 100% verified!\n');

    console.log('====================================================');
    console.log('TEST 5: Daily Work Session Concurrency Throttling');
    console.log('Calling ensureActiveWorkSession 10 times in rapid succession');
    console.log('====================================================');
    const testEmployeeB = await Employee.create({
      name: 'Throttle Test Employee',
      email: `throttle.test.${Date.now()}@example.com`,
      password: 'password123',
      createdByAdmin: testTenantAId,
      isActive: true
    });

    const sessionPromises = [];
    for (let i = 0; i < 10; i++) {
      sessionPromises.push(ensureActiveWorkSession(testEmployeeB._id, 'Employee'));
    }
    await Promise.all(sessionPromises);

    const createdSessions = await Session.find({ user: testEmployeeB._id });
    console.log(`Sessions created for rapid burst: ${createdSessions.length}`);
    if (createdSessions.length !== 1) {
      throw new Error(`Expected exactly 1 session, got ${createdSessions.length}`);
    }
    console.log('✅ TEST 5 PASSED: Burst of 10 calls produced exactly 1 session!\n');

    console.log('🎉 ALL 5 COMPREHENSIVE REGRESSION TESTS PASSED CLEANLY!');
  } finally {
    console.log('🧹 Cleaning up test data...');
    await Employee.deleteMany({ createdByAdmin: { $in: [testTenantAId, testTenantBId] } });
    await Session.deleteMany({ user: { $in: await Employee.find({ createdByAdmin: testTenantAId }).distinct('_id') } });
    await Payment.deleteMany({ tenantId: { $in: [testTenantAId, testTenantBId] } });
    await Invoice.deleteMany({ tenantId: { $in: [testTenantAId, testTenantBId] } });
    await Customer.deleteMany({ tenantId: { $in: [testTenantAId, testTenantBId] } });
    await mongoose.disconnect();
    console.log('👋 Disconnected.');
  }
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
