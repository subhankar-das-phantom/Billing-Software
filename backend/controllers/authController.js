const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @desc    Login admin
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

    // Check for admin
    const admin = await Admin.findOne({ email }).select('+password');

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

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

    // Generate token
    const token = generateToken(admin._id);

    // Set HTTP-only cookie
    const cookieOptions = {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production' // HTTPS only in production
    };

    res.cookie('token', token, cookieOptions);

    res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        email: admin.email,
        firmName: admin.firmName,
        firmAddress: admin.firmAddress,
        firmPhone: admin.firmPhone,
        firmGSTIN: admin.firmGSTIN
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in admin
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.admin.id);

    res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        email: admin.email,
        firmName: admin.firmName,
        firmAddress: admin.firmAddress,
        firmPhone: admin.firmPhone,
        firmGSTIN: admin.firmGSTIN,
        lastLogin: admin.lastLogin
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update admin profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const { firmName, firmAddress, firmPhone, firmGSTIN } = req.body;

    const admin = await Admin.findByIdAndUpdate(
      req.admin.id,
      { firmName, firmAddress, firmPhone, firmGSTIN },
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
        firmGSTIN: admin.firmGSTIN
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout admin
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    res.cookie('token', '', {
      httpOnly: true,
      expires: new Date(0)
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};
