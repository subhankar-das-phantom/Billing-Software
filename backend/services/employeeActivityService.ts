/**
 * Employee Activity Service
 *
 * Provides activity-first querying for employee work attribution and
 * safe, throttled daily work session tracking.
 *
 * Enforces:
 * - Zero N+1 queries (batched parallel execution)
 * - Activity-first discovery (activities are authoritative; sessions are contextual)
 * - Independent statistics (session counts and activity counts are decoupled)
 * - Robust IST business-day time range boundaries
 * - Safe daily session maintenance without uncontrolled document growth
 */

import mongoose, { Types } from 'mongoose';
import Session from '../models/Session';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import Product from '../models/Product';
import Employee from '../models/Employee';

export interface ActivityTimeRange {
  range: string;
  from: Date;
  to: Date;
  hours?: number;
}

export interface ActivityLogFilter {
  range?: string;
  hours?: number | string;
  employeeId?: string | Types.ObjectId;
  startDate?: string;
  endDate?: string;
}

export interface ActivitySummary {
  invoiceCount: number;
  paymentCount: number;
  productsAdded: number;
  productsUpdated: number;
  totalSales: number;
  totalPayments: number;
}

export interface FormattedInvoiceActivity {
  invoiceNumber: string;
  customer: string;
  amount: number;
  time: Date;
  status?: string;
}

export interface FormattedPaymentActivity {
  invoiceNumber: string;
  amount: number;
  method: string;
  time: Date;
}

export interface FormattedProductActivity {
  name: string;
  time: Date;
}

export interface ActivityLogEntry {
  session: {
    id: any;
    loginTime: Date;
    logoutTime?: Date | null;
    duration: number;
    isActive: boolean;
    ipAddress?: string;
  } | null;
  isDirectActivity?: boolean;
  employee: {
    id: any;
    name: string;
    email: string;
  };
  activities: {
    invoicesCreated: FormattedInvoiceActivity[];
    paymentsRecorded: FormattedPaymentActivity[];
    productsAdded: FormattedProductActivity[];
    productsUpdated: FormattedProductActivity[];
  };
  summary: ActivitySummary;
}

export interface ActivityLogResponse {
  success: boolean;
  timeRange: ActivityTimeRange;
  stats: {
    totalSessions: number;
    totalInvoices: number;
    totalPayments: number;
    totalSales: number;
    totalProducts: number;
  };
  count: number;
  employees: Array<{ id: any; name: string; email: string }>;
  log: ActivityLogEntry[];
}

/**
 * Format date to YYYY-MM-DD in Asia/Kolkata (IST = UTC+05:30)
 */
function getISTDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * Parse an IST boundary date string (YYYY-MM-DD) into a concrete Date.
 */
function parseISTBoundary(dateInput?: string, endOfDay = false): Date | null {
  const raw = String(dateInput || '').trim();
  if (!raw) return null;

  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    const timePart = endOfDay ? '23:59:59.999' : '00:00:00.000';
    const parsed = new Date(`${year}-${month}-${day}T${timePart}+05:30`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Resolves standard operational time ranges adhering to IST business hours.
 * Supports 'today', 'yesterday', '24h', '7d', '30d', numeric hours, or custom dates.
 * Safely caps queries at 90 days.
 */
export function parseActivityTimeRange(
  range?: string,
  hoursInput?: number | string,
  startDate?: string,
  endDate?: string
): ActivityTimeRange {
  const now = new Date();
  const normalizedRange = String(range || '').trim().toLowerCase();

  // 1. Custom explicit date range
  if (startDate) {
    const from = parseISTBoundary(startDate, false) || new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const to = parseISTBoundary(endDate, true) || now;
    // Cap at 90 days max
    const maxRangeMs = 90 * 24 * 60 * 60 * 1000;
    const boundedFrom = (to.getTime() - from.getTime()) > maxRangeMs
      ? new Date(to.getTime() - maxRangeMs)
      : from;

    return {
      range: 'custom',
      from: boundedFrom,
      to
    };
  }

  // 2. IST "Today" (00:00:00.000 IST to now)
  if (normalizedRange === 'today') {
    const todayYMD = getISTDateString(now);
    const from = new Date(`${todayYMD}T00:00:00.000+05:30`);
    return {
      range: 'today',
      from,
      to: now
    };
  }

  // 3. IST "Yesterday" (00:00:00.000 IST to 23:59:59.999 IST of previous day)
  if (normalizedRange === 'yesterday') {
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayYMD = getISTDateString(yesterdayDate);
    const from = new Date(`${yesterdayYMD}T00:00:00.000+05:30`);
    const to = new Date(`${yesterdayYMD}T23:59:59.999+05:30`);
    return {
      range: 'yesterday',
      from,
      to
    };
  }

  // 4. "7d" (Last 7 Days, starting 6 days ago at 00:00:00 IST up to now)
  if (normalizedRange === '7d' || normalizedRange === 'week' || normalizedRange === 'last7days') {
    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    const startYMD = getISTDateString(sixDaysAgo);
    const from = new Date(`${startYMD}T00:00:00.000+05:30`);
    return {
      range: '7d',
      from,
      to: now
    };
  }

  // 5. "30d" (Last 30 Days, starting 29 days ago at 00:00:00 IST up to now)
  if (normalizedRange === '30d' || normalizedRange === 'month' || normalizedRange === 'last30days') {
    const twentyNineDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    const startYMD = getISTDateString(twentyNineDaysAgo);
    const from = new Date(`${startYMD}T00:00:00.000+05:30`);
    return {
      range: '30d',
      from,
      to: now
    };
  }

  // 6. Rolling hours (e.g. 6, 12, 24, 48, 72, or parsed from hours query)
  let hours = typeof hoursInput === 'number' ? hoursInput : parseInt(String(hoursInput || ''), 10);
  if (normalizedRange === '24h' || (!hours && !normalizedRange)) {
    hours = 24;
  } else if (!hours && normalizedRange.endsWith('h')) {
    hours = parseInt(normalizedRange.replace('h', ''), 10) || 24;
  }

  // Cap rolling hours safely at 2160 hours (90 days)
  hours = Math.min(Math.max(hours, 1), 2160);
  const from = new Date(now.getTime() - hours * 60 * 60 * 1000);

  return {
    range: `${hours}h`,
    hours,
    from,
    to: now
  };
}

/**
 * Fetch employee activity log using Activity-First architecture.
 *
 * Executes parallel batched queries to prevent N+1 queries.
 * Associates activities with sessions in-memory.
 * Discovers and displays activities even when sessions = 0.
 */
export async function getActivityLog(
  tenantId: string | Types.ObjectId,
  filter: ActivityLogFilter = {}
): Promise<ActivityLogResponse> {
  const tenantObjId = typeof tenantId === 'string' ? new Types.ObjectId(tenantId) : tenantId;
  const timeRange = parseActivityTimeRange(filter.range, filter.hours, filter.startDate, filter.endDate);
  const { from: startTime, to: endTime } = timeRange;

  // 1. Determine tenant employees
  const tenantEmployeeQuery: any = { createdByAdmin: tenantObjId };
  if (filter.employeeId) {
    tenantEmployeeQuery._id = typeof filter.employeeId === 'string'
      ? new Types.ObjectId(filter.employeeId)
      : filter.employeeId;
  }

  const tenantEmployees = await Employee.find(tenantEmployeeQuery)
    .select('_id name email')
    .lean();

  if (!tenantEmployees.length) {
    return {
      success: true,
      timeRange,
      stats: {
        totalSessions: 0,
        totalInvoices: 0,
        totalPayments: 0,
        totalSales: 0,
        totalProducts: 0
      },
      count: 0,
      employees: [],
      log: []
    };
  }

  const tenantEmployeeIds = tenantEmployees.map(e => e._id);

  // 2. Execute parallel batched queries (Zero N+1 queries)
  const [invoices, payments, productsAdded, productsUpdated, sessions] = await Promise.all([
    // Invoices created by tenant employees in date range
    Invoice.find({
      tenantId: tenantObjId,
      'createdBy.user': { $in: tenantEmployeeIds },
      'createdBy.userModel': 'Employee',
      createdAt: { $gte: startTime, $lte: endTime }
    })
      .select('invoiceNumber invoiceDate totals.netTotal customer.customerName createdBy createdAt status')
      .lean(),

    // Payments recorded by tenant employees in date range
    Payment.find({
      tenantId: tenantObjId,
      'createdBy.user': { $in: tenantEmployeeIds },
      'createdBy.userModel': 'Employee',
      createdAt: { $gte: startTime, $lte: endTime }
    })
      .select('amount paymentDate paymentMethod invoiceSnapshot.invoiceNumber createdBy createdAt')
      .lean(),

    // Products created by tenant employees in date range
    Product.find({
      tenantId: tenantObjId,
      'createdBy.user': { $in: tenantEmployeeIds },
      'createdBy.userModel': 'Employee',
      createdAt: { $gte: startTime, $lte: endTime }
    })
      .select('name productName createdBy createdAt')
      .lean(),

    // Products updated by tenant employees in date range (excluding ones created in same range)
    Product.find({
      tenantId: tenantObjId,
      'lastUpdatedBy.user': { $in: tenantEmployeeIds },
      'lastUpdatedBy.userModel': 'Employee',
      updatedAt: { $gte: startTime, $lte: endTime },
      createdAt: { $lt: startTime }
    })
      .select('name productName lastUpdatedBy updatedAt')
      .lean(),

    // Sessions intersecting the selected range
    Session.find({
      user: { $in: tenantEmployeeIds },
      userModel: 'Employee',
      $or: [
        { loginTime: { $gte: startTime, $lte: endTime } },
        { logoutTime: { $gte: startTime, $lte: endTime } },
        { isActive: true, loginTime: { $lte: endTime } },
        { lastActivityAt: { $gte: startTime, $lte: endTime } }
      ]
    })
      .populate('user', 'name email')
      .sort({ loginTime: -1 })
      .lean()
  ]);

  // 3. Compute independent global counts
  const totalInvoices = invoices.length;
  const totalPayments = payments.length;
  const totalProducts = productsAdded.length + productsUpdated.length;
  const totalSales = invoices.reduce((sum: number, inv: any) => sum + (inv.totals?.netTotal || 0), 0);
  const totalSessions = sessions.length;

  // 4. In-Memory Session Association (Single-Pass, Non-Duplicating)
  const assignedInvoiceIds = new Set<string>();
  const assignedPaymentIds = new Set<string>();
  const assignedProductAddedIds = new Set<string>();
  const assignedProductUpdatedIds = new Set<string>();

  const logEntries: ActivityLogEntry[] = [];

  // 4a. Process Sessions and attach activities falling within their login/logout window
  for (const session of sessions) {
    if (!session.user?._id) continue;
    const sessionUserId = session.user._id.toString();
    const sessionStart = new Date(session.loginTime);
    const sessionEnd = session.logoutTime
      ? new Date(session.logoutTime)
      : (session.isActive ? new Date() : new Date(session.lastActivityAt || session.loginTime));

    // Filter activities for this employee within this session window
    const sessionInvoices = invoices.filter((inv: any) => {
      const invId = inv._id.toString();
      if (assignedInvoiceIds.has(invId)) return false;
      if (inv.createdBy?.user?.toString() !== sessionUserId) return false;
      const t = new Date(inv.createdAt);
      return t >= sessionStart && t <= sessionEnd;
    });
    sessionInvoices.forEach((inv: any) => assignedInvoiceIds.add(inv._id.toString()));

    const sessionPayments = payments.filter((p: any) => {
      const pId = p._id.toString();
      if (assignedPaymentIds.has(pId)) return false;
      if (p.createdBy?.user?.toString() !== sessionUserId) return false;
      const t = new Date(p.createdAt);
      return t >= sessionStart && t <= sessionEnd;
    });
    sessionPayments.forEach((p: any) => assignedPaymentIds.add(p._id.toString()));

    const sessionProductsAdded = productsAdded.filter((prod: any) => {
      const prodId = prod._id.toString();
      if (assignedProductAddedIds.has(prodId)) return false;
      if (prod.createdBy?.user?.toString() !== sessionUserId) return false;
      const t = new Date(prod.createdAt);
      return t >= sessionStart && t <= sessionEnd;
    });
    sessionProductsAdded.forEach((prod: any) => assignedProductAddedIds.add(prod._id.toString()));

    const sessionProductsUpdated = productsUpdated.filter((prod: any) => {
      const prodId = prod._id.toString();
      if (assignedProductUpdatedIds.has(prodId)) return false;
      if (prod.lastUpdatedBy?.user?.toString() !== sessionUserId) return false;
      const t = new Date(prod.updatedAt);
      return t >= sessionStart && t <= sessionEnd;
    });
    sessionProductsUpdated.forEach((prod: any) => assignedProductUpdatedIds.add(prod._id.toString()));

    const sessionSales = sessionInvoices.reduce((sum: number, inv: any) => sum + (inv.totals?.netTotal || 0), 0);
    const sessionPaymentsSum = sessionPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const populatedUser = session.user as any;

    logEntries.push({
      session: {
        id: session._id,
        loginTime: session.loginTime,
        logoutTime: session.logoutTime || null,
        duration: session.sessionDuration || 0,
        isActive: !!session.isActive,
        ipAddress: session.ipAddress || ''
      },
      isDirectActivity: false,
      employee: {
        id: populatedUser?._id || session.user,
        name: populatedUser?.name || 'Employee',
        email: populatedUser?.email || ''
      },
      activities: {
        invoicesCreated: sessionInvoices.map((inv: any) => ({
          invoiceNumber: inv.invoiceNumber,
          customer: inv.customer?.customerName || 'Walk-in Customer',
          amount: inv.totals?.netTotal || 0,
          time: inv.createdAt,
          status: inv.status
        })),
        paymentsRecorded: sessionPayments.map((p: any) => ({
          invoiceNumber: p.invoiceSnapshot?.invoiceNumber || 'Payment',
          amount: p.amount || 0,
          method: p.paymentMethod || 'Cash',
          time: p.createdAt
        })),
        productsAdded: sessionProductsAdded.map((prod: any) => ({
          name: prod.productName || prod.name || 'Unnamed Product',
          time: prod.createdAt
        })),
        productsUpdated: sessionProductsUpdated.map((prod: any) => ({
          name: prod.productName || prod.name || 'Unnamed Product',
          time: prod.updatedAt
        }))
      },
      summary: {
        invoiceCount: sessionInvoices.length,
        paymentCount: sessionPayments.length,
        productsAdded: sessionProductsAdded.length,
        productsUpdated: sessionProductsUpdated.length,
        totalSales: sessionSales,
        totalPayments: sessionPaymentsSum
      }
    });
  }

  // 4b. Collect Unassigned Activities into "Direct Activity" containers per employee
  for (const emp of tenantEmployees) {
    const empIdStr = emp._id.toString();

    const directInvoices = invoices.filter((inv: any) => {
      return !assignedInvoiceIds.has(inv._id.toString()) && inv.createdBy?.user?.toString() === empIdStr;
    });

    const directPayments = payments.filter((p: any) => {
      return !assignedPaymentIds.has(p._id.toString()) && p.createdBy?.user?.toString() === empIdStr;
    });

    const directProductsAdded = productsAdded.filter((prod: any) => {
      return !assignedProductAddedIds.has(prod._id.toString()) && prod.createdBy?.user?.toString() === empIdStr;
    });

    const directProductsUpdated = productsUpdated.filter((prod: any) => {
      return !assignedProductUpdatedIds.has(prod._id.toString()) && prod.lastUpdatedBy?.user?.toString() === empIdStr;
    });

    // Only create a Direct Activity entry if there are actual activities
    if (
      directInvoices.length > 0 ||
      directPayments.length > 0 ||
      directProductsAdded.length > 0 ||
      directProductsUpdated.length > 0
    ) {
      const directSales = directInvoices.reduce((sum: number, inv: any) => sum + (inv.totals?.netTotal || 0), 0);
      const directPaymentsSum = directPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      logEntries.push({
        session: null,
        isDirectActivity: true,
        employee: {
          id: emp._id,
          name: emp.name,
          email: emp.email
        },
        activities: {
          invoicesCreated: directInvoices.map((inv: any) => ({
            invoiceNumber: inv.invoiceNumber,
            customer: inv.customer?.customerName || 'Walk-in Customer',
            amount: inv.totals?.netTotal || 0,
            time: inv.createdAt,
            status: inv.status
          })),
          paymentsRecorded: directPayments.map((p: any) => ({
            invoiceNumber: p.invoiceSnapshot?.invoiceNumber || 'Payment',
            amount: p.amount || 0,
            method: p.paymentMethod || 'Cash',
            time: p.createdAt
          })),
          productsAdded: directProductsAdded.map((prod: any) => ({
            name: prod.productName || prod.name || 'Unnamed Product',
            time: prod.createdAt
          })),
          productsUpdated: directProductsUpdated.map((prod: any) => ({
            name: prod.productName || prod.name || 'Unnamed Product',
            time: prod.updatedAt
          }))
        },
        summary: {
          invoiceCount: directInvoices.length,
          paymentCount: directPayments.length,
          productsAdded: directProductsAdded.length,
          productsUpdated: directProductsUpdated.length,
          totalSales: directSales,
          totalPayments: directPaymentsSum
        }
      });
    }
  }

  // 5. Sort log entries by most recent activity/login timestamp descending
  logEntries.sort((a, b) => {
    const getTime = (entry: ActivityLogEntry): number => {
      if (entry.session?.loginTime) {
        return new Date(entry.session.loginTime).getTime();
      }
      // Direct activity: sort by latest activity time
      const allTimes = [
        ...entry.activities.invoicesCreated.map(i => new Date(i.time).getTime()),
        ...entry.activities.paymentsRecorded.map(p => new Date(p.time).getTime()),
        ...entry.activities.productsAdded.map(a => new Date(a.time).getTime()),
        ...entry.activities.productsUpdated.map(u => new Date(u.time).getTime())
      ];
      return allTimes.length > 0 ? Math.max(...allTimes) : 0;
    };

    return getTime(b) - getTime(a);
  });

  return {
    success: true,
    timeRange,
    stats: {
      totalSessions,
      totalInvoices,
      totalPayments,
      totalSales,
      totalProducts
    },
    count: logEntries.length,
    employees: tenantEmployees.map(e => ({ id: e._id, name: e.name, email: e.email })),
    log: logEntries
  };
}

/**
 * Ensures an authenticated employee has an active work session for today's work.
 *
 * Concurrency & Throttling Rules:
 * - Checks if an active session exists for this employee.
 * - If the active session is from today (< 16 hours old), updates lastActivityAt and returns.
 * - If older than 16 hours, cleanly closes the stale session.
 * - Concurrency guard: if another session was created within the last 2 minutes, reuses it.
 * - Safe & non-blocking: errors are caught and logged without failing the parent mutation.
 */
// In-flight mutex to prevent concurrent creation races for the same employee
const inFlightWorkSessions = new Map<string, Promise<any>>();

export async function ensureActiveWorkSession(
  userId: string | Types.ObjectId,
  userModel: 'Admin' | 'Employee' = 'Employee',
  req?: any
): Promise<any> {
  if (userModel !== 'Employee' || !userId) return null;

  const key = userId.toString();
  if (inFlightWorkSessions.has(key)) {
    return inFlightWorkSessions.get(key);
  }

  const promise = (async () => {
    try {
      return await _executeEnsureActiveWorkSession(userId, userModel, req);
    } finally {
      inFlightWorkSessions.delete(key);
    }
  })();

  inFlightWorkSessions.set(key, promise);
  return promise;
}

async function _executeEnsureActiveWorkSession(
  userId: string | Types.ObjectId,
  userModel: 'Admin' | 'Employee',
  req?: any
): Promise<any> {
  try {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const now = new Date();

    // 1. Look for currently active session
    const activeSession = await Session.findOne({
      user: userObjId,
      userModel: 'Employee',
      isActive: true
    }).sort({ loginTime: -1 });

    if (activeSession) {
      const sessionAgeMs = now.getTime() - new Date(activeSession.loginTime).getTime();
      const lastActivityAgeMs = now.getTime() - new Date(activeSession.lastActivityAt || activeSession.loginTime).getTime();

      // If active session is less than 16 hours old and used within the last 12 hours: touch lastActivityAt
      if (sessionAgeMs < 16 * 60 * 60 * 1000 && lastActivityAgeMs < 12 * 60 * 60 * 1000) {
        activeSession.lastActivityAt = now;
        await activeSession.save();
        return activeSession;
      }

      // If older, close stale session cleanly
      if (typeof (activeSession as any).closeSession === 'function') {
        await (activeSession as any).closeSession();
      } else {
        activeSession.isActive = false;
        activeSession.logoutTime = now;
        activeSession.sessionDuration = Math.round((now.getTime() - new Date(activeSession.loginTime).getTime()) / (1000 * 60));
        await activeSession.save();
      }
    }

    // 2. Concurrency guard: check if a session was created in the last 2 minutes
    const recentSession = await Session.findOne({
      user: userObjId,
      userModel: 'Employee',
      loginTime: { $gte: new Date(now.getTime() - 2 * 60 * 1000) }
    });

    if (recentSession) {
      recentSession.lastActivityAt = now;
      if (!recentSession.isActive) recentSession.isActive = true;
      await recentSession.save();
      return recentSession;
    }

    // 3. Create new daily work session
    const ipAddress = req?.ip || req?.connection?.remoteAddress || '';
    const userAgent = req?.get ? (req.get('User-Agent') || '') : '';

    const newSession = await Session.create({
      user: userObjId,
      userModel: 'Employee',
      loginTime: now,
      lastActivityAt: now,
      isActive: true,
      ipAddress,
      userAgent
    });

    return newSession;
  } catch (error: any) {
    // Non-blocking: never fail a business transaction because of session maintenance
    console.warn(`[employeeActivityService] ensureActiveWorkSession warning: ${error.message}`);
    return null;
  }
}

const employeeActivityService = {
  parseActivityTimeRange,
  getActivityLog,
  ensureActiveWorkSession
};

export default employeeActivityService;

