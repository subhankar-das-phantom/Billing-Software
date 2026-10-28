const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  employeeLogin,
  getMe, 
  updateProfile, 
  changePassword, 
  logout,
  heartbeat,
  updatePreferences
} = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/auth');
const { registerValidator, loginValidator, updateProfileValidator, changePasswordValidator } = require('../middleware/validators');
const { registerLimiter, registrationGuard } = require('../middleware/registrationGuard');

// Public routes
router.post('/register', registerLimiter, registrationGuard, registerValidator, register);
router.post('/login', loginValidator, login);
router.post('/employee/login', loginValidator, employeeLogin);

// Protected routes (both admin and employee)
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.post('/heartbeat', protect, heartbeat);
router.put('/preferences', protect, updatePreferences);

// Admin-only routes
router.put('/change-password', protect, adminOnly, changePasswordValidator, changePassword);
router.put('/profile', protect, adminOnly, updateProfileValidator, updateProfile);

module.exports = router;
