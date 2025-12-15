const express = require('express');
const router = express.Router();
const { login, getMe, updateProfile, logout } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { loginValidator, updateProfileValidator } = require('../middleware/validators');

router.post('/login', loginValidator, login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfileValidator, updateProfile);

module.exports = router;
