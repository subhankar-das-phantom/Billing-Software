import express from 'express';
import {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
} from '../controllers/notificationController';

const { protect } = require('../../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', listNotifications);
router.get('/unread-count', unreadCount);
router.put('/read-all', markAllRead);
router.put('/:id/read', markRead);

export default router;
