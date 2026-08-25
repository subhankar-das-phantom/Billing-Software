const Employee = require('../models/Employee');
const Session = require('../models/Session');
const getTenantId = require('../utils/getTenantId');
const { ROLE_PRESETS } = require('../utils/permissions');

const { escapeRegex } = require('../utils/searchUtils');

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private (Admin only)
exports.getEmployees = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const query = { createdByAdmin: tenantId };

    // Filter by active status
    if (req.query.status === 'active') {
      query.isActive = true;
    } else if (req.query.status === 'inactive') {
      query.isActive = false;
    }

    // Search by name or email
    if (req.query.search) {
      const escaped = escapeRegex(req.query.search);
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } }
      ];
    }

    const employees = await Employee.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Employee.countDocuments(query);

    // Get employee data with metrics and online status
    const employeesWithStats = await Promise.all(
      employees.map(async (emp) => {
        const profile = emp.getFullProfile();
        // Check if employee has an active session with recent activity (within 5 minutes)
        const activeSession = await Session.findOne({
          user: emp._id,
          userModel: 'Employee',
          isActive: true,
          lastActivityAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // 5 minutes
        });
        return {
          ...profile,
          isOnline: !!activeSession
        };
      })
    );

    res.status(200).json({
      success: true,
      count: employees.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      employees: employeesWithStats
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single employee
// @route   GET /api/employees/:id
// @access  Private (Admin only)
exports.getEmployee = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const employee = await Employee.findOne({
      _id: req.params.id,
      createdByAdmin: tenantId
    }).select('-password');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get recent sessions for this employee
    const recentSessions = await Session.find({
      user: employee._id,
      userModel: 'Employee'
    })
      .sort({ loginTime: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      employee: employee.getFullProfile(),
      recentSessions: recentSessions.map(s => ({
        loginTime: s.loginTime,
        logoutTime: s.logoutTime,
        duration: s.sessionDuration,
        isActive: s.isActive,
        ipAddress: s.ipAddress
      }))
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create employee
// @route   POST /api/employees
// @access  Private (Admin only)
exports.createEmployee = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { email, password, name, phone, address, dob, govId } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, and name'
      });
    }

    // Validate Gov ID if provided
    if (govId && govId.type && govId.number) {
      if (govId.type === 'Aadhar' && !/^\d{12}$/.test(govId.number)) {
        return res.status(400).json({ success: false, message: 'Aadhar must be exactly 12 digits' });
      }
      if (govId.type === 'PAN' && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(govId.number)) {
        return res.status(400).json({ success: false, message: 'Invalid PAN format' });
      }
    }

    // Check if email already exists
    const existingEmail = await Employee.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'An employee with this email already exists'
      });
    }

    // Create employee
    const employee = await Employee.create({
      email,
      password,
      name,
      phone: phone || '',
      address: address || '',
      dob: dob || undefined,
      govId: (govId && govId.type && govId.number) ? govId : undefined,
      createdByAdmin: tenantId
    });

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      employee: employee.getFullProfile()
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private (Admin only)
exports.updateEmployee = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { email, name, phone, address, dob, govId } = req.body;

    const employee = await Employee.findOne({
      _id: req.params.id,
      createdByAdmin: tenantId
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Validate Gov ID if provided
    if (govId && govId.type && govId.number) {
      if (govId.type === 'Aadhar' && !/^\d{12}$/.test(govId.number)) {
        return res.status(400).json({ success: false, message: 'Aadhar must be exactly 12 digits' });
      }
      if (govId.type === 'PAN' && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(govId.number)) {
        return res.status(400).json({ success: false, message: 'Invalid PAN format' });
      }
    }

    // Check if new email conflicts with existing
    if (email && email.toLowerCase() !== employee.email) {
      const existingEmail = await Employee.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: employee._id }
      });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'An employee with this email already exists'
        });
      }
      employee.email = email.toLowerCase();
    }

    // Update other fields
    if (name) employee.name = name;
    if (phone !== undefined) employee.phone = phone;
    if (address !== undefined) employee.address = address;
    if (dob !== undefined) employee.dob = dob || null;
    if (govId) {
      if (govId.type && govId.number) {
        employee.govId = govId;
      } else {
        employee.govId = undefined; // clear if empty or invalid
      }
    }

    await employee.save();

    res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      employee: employee.getFullProfile()
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset employee password
// @route   PUT /api/employees/:id/password
// @access  Private (Admin only)
exports.resetPassword = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    const employee = await Employee.findOne({
      _id: req.params.id,
      createdByAdmin: tenantId
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Update password (will be hashed by pre-save hook)
    employee.password = newPassword;
    await employee.save();

    // Close all active sessions to force re-login
    await Session.closeAllSessions(employee._id, 'Employee');

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. Employee will need to login again.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle employee status (activate/deactivate)
// @route   PUT /api/employees/:id/status
// @access  Private (Admin only)
exports.toggleStatus = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Please provide isActive as a boolean value'
      });
    }

    const employee = await Employee.findOne({
      _id: req.params.id,
      createdByAdmin: tenantId
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    employee.isActive = isActive;
    await employee.save();

    // If deactivating, close all active sessions
    if (!isActive) {
      await Session.closeAllSessions(employee._id, 'Employee');
    }

    res.status(200).json({
      success: true,
      message: isActive ? 'Employee activated successfully' : 'Employee deactivated successfully',
      employee: employee.getFullProfile()
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete employee (soft delete - deactivate)
// @route   DELETE /api/employees/:id
// @access  Private (Admin only)
exports.deleteEmployee = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const employee = await Employee.findOne({
      _id: req.params.id,
      createdByAdmin: tenantId
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Soft delete - just deactivate
    employee.isActive = false;
    await employee.save();

    // Close all active sessions
    await Session.closeAllSessions(employee._id, 'Employee');

    res.status(200).json({
      success: true,
      message: 'Employee deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update employee permissions
// @route   PUT /api/employees/:id/permissions
// @access  Private (Admin only)
exports.updatePermissions = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { role, permissions } = req.body;

    const employee = await Employee.findOne({
      _id: req.params.id,
      createdByAdmin: tenantId
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    if (role) {
      employee.role = role;
    }

    if (permissions) {
      employee.permissions = permissions;
    } else if (role && ROLE_PRESETS[role]) {
      // Auto-fill from preset if only role is provided
      employee.permissions = ROLE_PRESETS[role];
    }

    await employee.save();

    // Do NOT close sessions on permission change to allow seamless updates,
    // or maybe close them if needed. For now, let's keep it seamless.

    res.status(200).json({
      success: true,
      message: 'Employee permissions updated successfully',
      employee: employee.getFullProfile()
    });
  } catch (error) {
    next(error);
  }
};
