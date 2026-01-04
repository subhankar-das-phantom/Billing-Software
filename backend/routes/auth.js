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
  heartbeat
} = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/auth');
const { registerValidator, loginValidator, updateProfileValidator } = require('../middleware/validators');

// Public routes
router.post('/register', registerValidator, register);
router.post('/login', loginValidator, login);
router.post('/employee/login', employeeLogin);

// Protected routes (both admin and employee)
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.put('/change-password', protect, changePassword);
router.post('/heartbeat', protect, heartbeat);

// Admin-only routes
router.put('/profile', protect, adminOnly, updateProfileValidator, updateProfile);

module.exports = router;
