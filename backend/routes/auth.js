const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, changePassword, logout } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { registerValidator, loginValidator, updateProfileValidator } = require('../middleware/validators');

router.post('/register', registerValidator, register);
router.post('/login', loginValidator, login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfileValidator, updateProfile);
router.put('/change-password', protect, changePassword);

module.exports = router;
