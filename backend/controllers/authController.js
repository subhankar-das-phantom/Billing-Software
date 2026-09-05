const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Employee = require('../models/Employee');
const Session = require('../models/Session');
const { ROLE_PRESETS } = require('../utils/permissions');
const employeeActivityService = require('../services/employeeActivityService');
const ensureActiveWorkSession = employeeActivityService.ensureActiveWorkSession || employeeActivityService.default?.ensureActiveWorkSession;

/**
 * Cookie options helper
 */
const getCookieOptions = () => ({
  httpOnly: true,
  maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
  secure: process.env.NODE_ENV === 'production'
});

/**
 * Generate JWT Token with role
 * @param {string} id - User ID
 * @param {string} role - 'admin' or 'employee'
 */
const generateToken = (id, role = 'admin') => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

const getPopulatedEmployeeProfile = async (employee) => {
  const profile = employee.getPublicProfile();
  if (employee.createdByAdmin) {
    const admin = await Admin.findById(employee.createdByAdmin).select('preferences').lean();
    if (admin && admin.preferences) {
      profile.preferences = {
        ...admin.preferences,
        ...profile.preferences
      };
    }
  }
  return profile;
};

/**
 * Create session for login tracking
 */
const createSession = async (userId, userModel, req) => {
  try {
    // Close any existing active sessions for this user
    await Session.closeAllSessions(userId, userModel);
    
    // Create new session
    await Session.create({
      user: userId,
      userModel: userModel,
      ipAddress: req.ip || req.connection?.remoteAddress || '',
      userAgent: req.get('User-Agent') || ''
    });
  } catch (error) {
    // Log but don't throw - session creation should not block login
    console.error(`Session creation failed: ${error.message}`);
  }
};

/**
 * Close active session on logout
 */
const closeActiveSession = async (userId, userModel) => {
  try {
    const activeSession = await Session.getActiveSession(userId, userModel);
    if (activeSession) {
      await activeSession.closeSession();
    }
  } catch (error) {
    console.error(`Session close failed: ${error.message}`);
  }
};

// @desc    Register new admin
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { email, password, firmName, firmAddress, firmPhone, firmGSTIN, firmDL } = req.body;

    // Check if admin with email already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    // Create admin
    const admin = await Admin.create({
      email,
      password,
      firmName: firmName || 'My Enterprise',
      firmAddress: firmAddress || '',
      firmPhone: firmPhone || '',
      firmGSTIN: firmGSTIN || '',
      firmDL: firmDL || ''
    });

    // Automatically provision a Free Trial subscription for the new user!
    try {
      const { createTrialSubscription } = require('../saas/services/subscriptionService');
      await createTrialSubscription(admin._id.toString());
    } catch (trialErr) {
      console.error('Failed to create trial subscription:', trialErr);
      // We don't block registration, but this should ideally be logged to an error tracker
    }

    // Generate token with admin role
    const token = generateToken(admin._id, 'admin');

    // Create session
    await createSession(admin._id, 'Admin', req);

    res.cookie('token', token, getCookieOptions());

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      role: 'admin',
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        firmName: admin.firmName,
        firmAddress: admin.firmAddress,
        firmPhone: admin.firmPhone,
        firmGSTIN: admin.firmGSTIN,
        firmDL: admin.firmDL,
        preferences: admin.preferences,
        paymentInformation: admin.paymentInformation
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login (auto-detects Admin or Employee)
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // First, try to find as Admin
    const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password');

    if (admin) {
      // Check if password matches
      const isMatch = await admin.matchPassword(password);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Update last login
      admin.lastLogin = new Date();
      await admin.save();

      // Generate token with admin role
      const token = generateToken(admin._id, 'admin');

      // Create session
      await createSession(admin._id, 'Admin', req);

      res.cookie('token', token, getCookieOptions());

      return res.status(200).json({
        success: true,
        role: 'admin',
        token,
        admin: {
          id: admin._id,
          email: admin.email,
          firmName: admin.firmName,
          firmAddress: admin.firmAddress,
          firmPhone: admin.firmPhone,
          firmGSTIN: admin.firmGSTIN,
          firmDL: admin.firmDL,
          preferences: admin.preferences,
          paymentInformation: admin.paymentInformation
        }
      });
    }

    // If not an Admin, try Employee
    const employee = await Employee.findOne({ email: email.toLowerCase() }).select('+password').populate('createdByAdmin', 'firmName');

    if (employee) {
      // Check if employee is active
      if (!employee.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Your account has been deactivated. Please contact admin.'
        });
      }

      // Check if password matches
      const isMatch = await employee.matchPassword(password);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Backward compatibility for legacy employees
      if (!employee.role || !employee.permissions || (employee.permissions instanceof Map ? employee.permissions.size === 0 : Object.keys(employee.permissions).length === 0)) {
        employee.role = 'full_access';
        employee.permissions = ROLE_PRESETS.full_access;
      }

      // Update last login
      employee.lastLogin = new Date();
      await employee.save();

      // Generate token with employee role
      const token = generateToken(employee._id, 'employee');

      // Create session
      await createSession(employee._id, 'Employee', req);

      res.cookie('token', token, getCookieOptions());

      return res.status(200).json({
        success: true,
        role: 'employee',
        token,
        employee: { ...(await getPopulatedEmployeeProfile(employee)), firmName: employee.createdByAdmin?.firmName || 'Your firm' }
      });
    }

    // Neither Admin nor Employee found
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login employee
// @route   POST /api/auth/employee/login
// @access  Public
exports.employeeLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find employee by email
    const employee = await Employee.findOne({ 
      email: email.toLowerCase() 
    }).select('+password').populate('createdByAdmin', 'firmName');

    if (!employee) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if employee is active
    if (!employee.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact admin.'
      });
    }

    // Check if password matches
    const isMatch = await employee.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Backward compatibility for legacy employees
    if (!employee.role || !employee.permissions || (employee.permissions instanceof Map ? employee.permissions.size === 0 : Object.keys(employee.permissions).length === 0)) {
      employee.role = 'full_access';
      employee.permissions = ROLE_PRESETS.full_access;
    }

    // Update last login
    employee.lastLogin = new Date();
    await employee.save();

    // Generate token with employee role
    const token = generateToken(employee._id, 'employee');

    // Create session
    await createSession(employee._id, 'Employee', req);

    res.cookie('token', token, getCookieOptions());

    res.status(200).json({
      success: true,
      role: 'employee',
      token,
      employee: { ...(await getPopulatedEmployeeProfile(employee)), firmName: employee.createdByAdmin?.firmName || 'Your firm' }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user (admin or employee)
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    if (req.userRole === 'employee') {
      // Backward compatibility for legacy employees fetching me
      if (!req.user.role || !req.user.permissions || (req.user.permissions instanceof Map ? req.user.permissions.size === 0 : Object.keys(req.user.permissions).length === 0)) {
        req.user.role = 'full_access';
        req.user.permissions = ROLE_PRESETS.full_access;
        await req.user.save();
      }

      // Return employee profile
      const employee = await Employee.findById(req.user._id).populate('createdByAdmin', 'firmName');
      res.status(200).json({
        success: true,
        role: 'employee',
        user: { ...(await getPopulatedEmployeeProfile(employee)), firmName: employee.createdByAdmin?.firmName || 'Your firm' }
      });
    } else {
      // Return admin profile
      const admin = await Admin.findById(req.user._id);
      
      res.status(200).json({
        success: true,
        role: 'admin',
        admin: {
          id: admin._id,
          email: admin.email,
          firmName: admin.firmName,
          firmAddress: admin.firmAddress,
          firmPhone: admin.firmPhone,
          firmGSTIN: admin.firmGSTIN,
          firmDL: admin.firmDL,
          lastLogin: admin.lastLogin,
          preferences: admin.preferences,
          paymentInformation: admin.paymentInformation
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update admin profile (Admin only)
// @route   PUT /api/auth/profile
// @access  Private (Admin only)
exports.updateProfile = async (req, res, next) => {
  try {
    // Only admin can update firm profile
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can update firm settings'
      });
    }

    const { firmName, firmAddress, firmPhone, firmGSTIN, firmDL, paymentInformation } = req.body;

    const admin = await Admin.findByIdAndUpdate(
      req.user._id,
      { firmName, firmAddress, firmPhone, firmGSTIN, firmDL, paymentInformation },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        email: admin.email,
        firmName: admin.firmName,
        firmAddress: admin.firmAddress,
        firmPhone: admin.firmPhone,
        firmGSTIN: admin.firmGSTIN,
        firmDL: admin.firmDL,
        preferences: admin.preferences,
        paymentInformation: admin.paymentInformation
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password (for logged in user)
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    let user;
    if (req.userRole === 'employee') {
      user = await Employee.findById(req.user._id).select('+password');
    } else {
      user = await Admin.findById(req.user._id).select('+password');
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user (admin or employee)
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    // Close active session
    if (req.user) {
      await closeActiveSession(req.user._id, req.userModel);
    }

    res.cookie('token', '', {
      httpOnly: true,
      expires: new Date(0),
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      secure: process.env.NODE_ENV === 'production'
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update session activity (heartbeat)
// @route   POST /api/auth/heartbeat
// @access  Private
exports.heartbeat = async (req, res, next) => {
  try {
    if (req.userRole === 'employee' && ensureActiveWorkSession) {
      await ensureActiveWorkSession(req.user._id, 'Employee', req);
    } else {
      const activeSession = await Session.getActiveSession(req.user._id, req.userModel);
      if (activeSession) {
        await activeSession.updateActivity();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Activity updated'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user preferences (Admin or Employee)
// @route   PUT /api/auth/preferences
// @access  Private
// Valid invoice column keys — authoritative whitelist
const VALID_INVOICE_COLUMNS = new Set([
  'qty', 'free', 'productName', 'hsn', 'batchNo', 'expiry',
  'mrp', 'rate', 'net', 'disc', 'gst', 'amount'
]);

exports.updatePreferences = async (req, res, next) => {
  try {
    const { showCalculator, invoiceColumns, enableBatchTracking } = req.body;
    
    let user;
    if (req.userRole === 'employee') {
      user = await Employee.findById(req.user._id);
    } else {
      user = await Admin.findById(req.user._id);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update preferences if provided
    if (showCalculator !== undefined) {
      user.set('preferences.showCalculator', showCalculator);
    }

    if (invoiceColumns !== undefined) {
      // Validate: must be an array
      if (!Array.isArray(invoiceColumns)) {
        return res.status(400).json({
          success: false,
          message: 'invoiceColumns must be an array'
        });
      }

      // Validate: every value must be a known column key
      const invalid = invoiceColumns.filter(col => !VALID_INVOICE_COLUMNS.has(col));
      if (invalid.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid invoice column(s): ${invalid.join(', ')}`
        });
      }

      // Deduplicate while preserving order
      const deduplicated = [...new Set(invoiceColumns)];
      user.set('preferences.invoiceColumns', deduplicated);
    }

    await user.save();

    if (enableBatchTracking !== undefined && req.userRole === 'admin') {
      const { toggleBatchTracking } = require('../services/inventoryService');
      if (user.preferences.enableBatchTracking !== enableBatchTracking) {
        await toggleBatchTracking(user._id, enableBatchTracking);
        user = await Admin.findById(req.user._id);
      }
    }

    res.status(200).json({
      success: true,
      preferences: user.preferences
    });
  } catch (error) {
    next(error);
  }
};
