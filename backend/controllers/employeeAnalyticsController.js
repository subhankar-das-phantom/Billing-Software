const Employee = require('../models/Employee');
const Session = require('../models/Session');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Product = require('../models/Product');

// @desc    Get detailed activity log with session and work attribution
// @route   GET /api/analytics/activity-log
// @access  Private (Admin only)
exports.getActivityLog = async (req, res, next) => {
  try {
    // Parse time range (default 24 hours, max 72 hours)
    let hours = parseInt(req.query.hours) || 24;
    hours = Math.min(hours, 72); // Cap at 72 hours
    
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);
    
    const employeeId = req.query.employeeId;

    // Build session query
    const sessionQuery = {
      userModel: 'Employee',
      loginTime: { $gte: startTime }
    };
    
    if (employeeId) {
      sessionQuery.user = employeeId;
    }

    // Get all sessions in time range
    const sessions = await Session.find(sessionQuery)
      .populate('user', 'name email')
      .sort({ loginTime: -1 });

    // For each session, get activities performed during that session
    const activityLog = await Promise.all(
      sessions.map(async (session) => {
        const sessionStart = session.loginTime;
        const sessionEnd = session.logoutTime || new Date();

        // Get invoices created during this session
        const invoices = await Invoice.find({
          'createdBy.user': session.user._id,
          'createdBy.userModel': 'Employee',
          createdAt: { $gte: sessionStart, $lte: sessionEnd }
        }).select('invoiceNumber invoiceDate totals.netTotal customer.customerName createdAt');

        // Get payments recorded during this session
        const payments = await Payment.find({
          'createdBy.user': session.user._id,
          'createdBy.userModel': 'Employee',
          createdAt: { $gte: sessionStart, $lte: sessionEnd }
        }).select('amount paymentDate paymentMethod invoiceSnapshot.invoiceNumber createdAt');

        // Get products added/updated during this session
        const productsAdded = await Product.find({
          'createdBy.user': session.user._id,
          'createdBy.userModel': 'Employee',
          createdAt: { $gte: sessionStart, $lte: sessionEnd }
        }).select('name createdAt');

        const productsUpdated = await Product.find({
          'lastUpdatedBy.user': session.user._id,
          'lastUpdatedBy.userModel': 'Employee',
          updatedAt: { $gte: sessionStart, $lte: sessionEnd },
          createdAt: { $lt: sessionStart } // Only updates, not creations
        }).select('name updatedAt');

        // Calculate session totals
        const totalSales = invoices.reduce((sum, inv) => sum + (inv.totals?.netTotal || 0), 0);
        const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

        return {
          session: {
            id: session._id,
            loginTime: session.loginTime,
            logoutTime: session.logoutTime,
            duration: session.sessionDuration,
            isActive: session.isActive,
            ipAddress: session.ipAddress
          },
          employee: {
            id: session.user._id,
            name: session.user.name,
            email: session.user.email
          },
          activities: {
            invoicesCreated: invoices.map(inv => ({
              invoiceNumber: inv.invoiceNumber,
              customer: inv.customer?.customerName,
              amount: inv.totals?.netTotal,
              time: inv.createdAt
            })),
            paymentsRecorded: payments.map(p => ({
              invoiceNumber: p.invoiceSnapshot?.invoiceNumber,
              amount: p.amount,
              method: p.paymentMethod,
              time: p.createdAt
            })),
            productsAdded: productsAdded.map(p => ({
              name: p.name,
              time: p.createdAt
            })),
            productsUpdated: productsUpdated.map(p => ({
              name: p.name,
              time: p.updatedAt
            }))
          },
          summary: {
            invoiceCount: invoices.length,
            paymentCount: payments.length,
            productsAdded: productsAdded.length,
            productsUpdated: productsUpdated.length,
            totalSales,
            totalPayments
          }
        };
      })
    );

    // Get distinct employees for filter dropdown
    const employees = await Employee.find({}).select('name email');

    res.status(200).json({
      success: true,
      timeRange: {
        hours,
        from: startTime,
        to: new Date()
      },
      count: activityLog.length,
      employees: employees.map(e => ({ id: e._id, name: e.name, email: e.email })),
      log: activityLog
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all employees with analytics summary
// @route   GET /api/analytics/employees
// @access  Private (Admin only)
exports.getEmployeeAnalytics = async (req, res, next) => {
  try {
    const employees = await Employee.find({}).select('-password').sort({ createdAt: -1 });

    // Get session stats for each employee
    const employeeAnalytics = await Promise.all(
      employees.map(async (emp) => {
        // Get active session if any
        const activeSession = await Session.getActiveSession(emp._id, 'Employee');
        
        // Get today's sessions
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySessions = await Session.find({
          user: emp._id,
          userModel: 'Employee',
          loginTime: { $gte: today }
        });
        const todayDuration = todaySessions.reduce((sum, s) => sum + (s.sessionDuration || 0), 0);

        // Get last 30 days sessions
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const monthSessions = await Session.find({
          user: emp._id,
          userModel: 'Employee',
          loginTime: { $gte: thirtyDaysAgo }
        });
        const monthDuration = monthSessions.reduce((sum, s) => sum + (s.sessionDuration || 0), 0);

        return {
          id: emp._id,
          name: emp.name,
          email: emp.email,
          userId: emp.userId,
          isActive: emp.isActive,
          lastLogin: emp.lastLogin,
          isOnline: !!activeSession,
          metrics: emp.metrics,
          sessionStats: {
            todayLogins: todaySessions.length,
            todayDuration, // minutes
            monthLogins: monthSessions.length,
            monthDuration // minutes
          }
        };
      })
    );

    res.status(200).json({
      success: true,
      count: employeeAnalytics.length,
      employees: employeeAnalytics
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get detailed analytics for single employee
// @route   GET /api/analytics/employees/:id
// @access  Private (Admin only)
exports.getEmployeeDetails = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id).select('-password');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get session statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);
    
    const thisMonth = new Date();
    thisMonth.setDate(thisMonth.getDate() - 30);

    // Session stats by period
    const [dailyStats, weeklyStats, monthlyStats] = await Promise.all([
      Session.getSessionStats(employee._id, 'Employee', today, new Date()),
      Session.getSessionStats(employee._id, 'Employee', thisWeek, new Date()),
      Session.getSessionStats(employee._id, 'Employee', thisMonth, new Date())
    ]);

    // Get ALL invoices created by this employee
    const invoicesCreated = await Invoice.find({
      'createdBy.user': employee._id,
      'createdBy.userModel': 'Employee'
    })
      .sort({ createdAt: -1 })
      .select('invoiceNumber invoiceDate totals.netTotal customer.customerName createdAt');

    // Get ALL payments recorded by this employee
    const paymentsRecorded = await Payment.find({
      'createdBy.user': employee._id,
      'createdBy.userModel': 'Employee'
    })
      .sort({ createdAt: -1 })
      .select('amount paymentDate paymentMethod invoiceSnapshot.invoiceNumber createdAt');

    res.status(200).json({
      success: true,
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        userId: employee.userId,
        phone: employee.phone,
        isActive: employee.isActive,
        lastLogin: employee.lastLogin,
        createdAt: employee.createdAt,
        metrics: employee.metrics
      },
      sessionStats: {
        today: dailyStats,
        thisWeek: weeklyStats,
        thisMonth: monthlyStats
      },
      recentActivity: {
        invoices: invoicesCreated,
        payments: paymentsRecorded
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get employee session history
// @route   GET /api/analytics/employees/:id/sessions
// @access  Private (Admin only)
exports.getEmployeeSessions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Date filter
    const query = {
      user: employee._id,
      userModel: 'Employee'
    };

    if (req.query.startDate) {
      query.loginTime = { $gte: new Date(req.query.startDate) };
    }
    if (req.query.endDate) {
      query.loginTime = { ...query.loginTime, $lte: new Date(req.query.endDate) };
    }

    const sessions = await Session.find(query)
      .sort({ loginTime: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Session.countDocuments(query);

    res.status(200).json({
      success: true,
      count: sessions.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      sessions: sessions.map(s => ({
        id: s._id,
        loginTime: s.loginTime,
        logoutTime: s.logoutTime,
        duration: s.sessionDuration,
        isActive: s.isActive,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent
      }))
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get employee comparison (side-by-side)
// @route   GET /api/analytics/employees/comparison
// @access  Private (Admin only)
exports.getEmployeeComparison = async (req, res, next) => {
  try {
    // Get date range (default to last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (parseInt(req.query.days) || 30));

    const employees = await Employee.find({ isActive: true }).select('-password');

    const comparison = await Promise.all(
      employees.map(async (emp) => {
        // Get session stats for the period
        const sessionStats = await Session.getSessionStats(
          emp._id, 'Employee', startDate, endDate
        );

        // Get invoices in period
        const invoices = await Invoice.find({
          'createdBy.user': emp._id,
          'createdBy.userModel': 'Employee',
          createdAt: { $gte: startDate, $lte: endDate }
        });

        const invoiceCount = invoices.length;
        const totalSales = invoices.reduce((sum, inv) => sum + (inv.totals?.netTotal || 0), 0);

        // Get payments in period
        const payments = await Payment.find({
          'createdBy.user': emp._id,
          'createdBy.userModel': 'Employee',
          createdAt: { $gte: startDate, $lte: endDate }
        });

        const paymentCount = payments.length;
        const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

        return {
          id: emp._id,
          name: emp.name,
          userId: emp.userId,
          period: {
            startDate,
            endDate,
            invoicesCreated: invoiceCount,
            salesGenerated: totalSales,
            paymentsRecorded: paymentCount,
            paymentsAmount: totalPayments,
            sessionsCount: sessionStats.totalSessions,
            totalSessionTime: sessionStats.totalDuration, // minutes
            avgSessionTime: sessionStats.avgDuration // minutes
          },
          allTimeMetrics: emp.metrics
        };
      })
    );

    // Sort by total sales generated in period
    comparison.sort((a, b) => b.period.salesGenerated - a.period.salesGenerated);

    res.status(200).json({
      success: true,
      period: {
        startDate,
        endDate,
        days: parseInt(req.query.days) || 30
      },
      employees: comparison
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get overall session summary
// @route   GET /api/analytics/sessions/summary
// @access  Private (Admin only)
exports.getSessionSummary = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);

    const thisMonth = new Date();
    thisMonth.setDate(thisMonth.getDate() - 30);

    // Get active sessions
    const activeSessions = await Session.find({ isActive: true })
      .populate('user', 'name email userId')
      .sort({ loginTime: -1 });

    // Get session counts
    const [todayCount, weekCount, monthCount] = await Promise.all([
      Session.countDocuments({ loginTime: { $gte: today } }),
      Session.countDocuments({ loginTime: { $gte: thisWeek } }),
      Session.countDocuments({ loginTime: { $gte: thisMonth } })
    ]);

    // Get average session duration this month
    const monthSessions = await Session.find({
      loginTime: { $gte: thisMonth },
      sessionDuration: { $gt: 0 }
    });
    const avgDuration = monthSessions.length > 0
      ? Math.round(monthSessions.reduce((sum, s) => sum + s.sessionDuration, 0) / monthSessions.length)
      : 0;

    res.status(200).json({
      success: true,
      activeSessions: activeSessions.map(s => ({
        user: s.user,
        userModel: s.userModel,
        loginTime: s.loginTime,
        lastActivity: s.lastActivityAt,
        ipAddress: s.ipAddress
      })),
      stats: {
        activeNow: activeSessions.length,
        todayLogins: todayCount,
        weekLogins: weekCount,
        monthLogins: monthCount,
        avgSessionDuration: avgDuration // minutes
      }
    });
  } catch (error) {
    next(error);
  }
};
