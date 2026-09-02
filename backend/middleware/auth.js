const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Employee = require('../models/Employee');

/**
 * Cookie options for clearing tokens
 */
const getCookieOptions = () => ({
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
  secure: process.env.NODE_ENV === 'production'
});

/**
 * Clear auth cookie helper
 */
const clearAuthCookie = (res) => {
  res.clearCookie('token', getCookieOptions());
};

/**
 * Protect routes - verify JWT and load user (Admin or Employee)
 * Sets req.user, req.userRole, req.userModel for downstream use
 * Also sets req.admin for backward compatibility
 */
const protect = async (req, res, next) => {
  let token;

  // Check for token in cookies first (HTTP-only cookie)
  if (req.cookies.token) {
    token = req.cookies.token;
  }
  // Fallback to Authorization header (for backward compatibility)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Fallback to query string (for SSE — EventSource cannot send headers or cookies cross-origin)
  else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized - no token'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check role from token to determine user type
    if (decoded.role === 'employee') {
      // Load employee
      const employee = await Employee.findById(decoded.id).select('-password');
      
      if (!employee) {
        clearAuthCookie(res);
        return res.status(401).json({
          success: false,
          message: 'Not authorized - user not found'
        });
      }

      // Check if employee is active
      if (!employee.isActive) {
        clearAuthCookie(res);
        return res.status(401).json({
          success: false,
          message: 'Account has been deactivated. Please contact admin.'
        });
      }

      // Set user info on request
      req.user = employee;
      req.userRole = 'employee';
      req.userModel = 'Employee';
      req.admin = null; // Employee is not admin
    } else {
      // Default to admin (for backward compatibility with existing tokens)
      const admin = await Admin.findById(decoded.id).select('-password');

      if (!admin) {
        clearAuthCookie(res);
        return res.status(401).json({
          success: false,
          message: 'Not authorized - admin not found'
        });
      }

      // Check if admin is active (if field exists)
      if (admin.isActive === false) {
        clearAuthCookie(res);
        return res.status(401).json({
          success: false,
          message: 'Account has been deactivated'
        });
      }

      // Set user info on request
      req.user = admin;
      req.userRole = 'admin';
      req.userModel = 'Admin';
      req.admin = admin; // For backward compatibility
    }

    next();
  } catch (error) {
    // Clear invalid/expired token cookie to prevent repeated errors
    clearAuthCookie(res);
    
    // Log only the error type, not the full stack trace
    if (process.env.NODE_ENV === 'development') {
      console.log(`Auth: ${error.name} - ${error.message}`);
    }
    
    return res.status(401).json({
      success: false,
      message: 'Not authorized - token invalid or expired'
    });
  }
};

/**
 * Admin-only middleware - must be used AFTER protect middleware
 * Blocks employees from accessing admin-only routes
 */
const adminOnly = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  next();
};

/**
 * Get attribution object for createdBy/updatedBy fields
 * Returns the proper structure for polymorphic references
 */
const getAttribution = (req) => {
  return {
    user: req.user._id,
    userModel: req.userModel
  };
};

/**
 * Require permission for a specific module and action
 * Must be used AFTER protect middleware
 * @param {string} moduleName - Primary module name
 * @param {string} action - Action (e.g. 'view', 'create')
 * @param {string} [fallbackModule] - Fallback module if primary module not configured
 */
const requirePermission = (moduleName, action, fallbackModule) => {
  return (req, res, next) => {
    // Admins have full access
    if (req.userRole === 'admin') {
      return next();
    }

    // Check if employee has the requested permission
    try {
      let perms = req.user.permissions?.get(moduleName);
      
      // If module is unconfigured, check fallback module
      if (!perms && fallbackModule) {
        perms = req.user.permissions?.get(fallbackModule);
      }
      
      if (!perms || !perms[action]) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Requires '${action}' permission for '${moduleName}'.`
        });
      }
      
      next();
    } catch (error) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Error checking permissions.'
      });
    }
  };
};

module.exports = { protect, adminOnly, getAttribution, requirePermission };
