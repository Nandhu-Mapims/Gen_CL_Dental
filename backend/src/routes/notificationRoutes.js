const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/auth');

// All notification routes require an authenticated user
router.get('/', auth(['STAFF', 'SUPERVISOR', 'DEPT_ADMIN', 'QA', 'SUPER_ADMIN']), notificationController.getMyNotifications);
router.post('/:id/read', auth(['STAFF', 'SUPERVISOR', 'DEPT_ADMIN', 'QA', 'SUPER_ADMIN']), notificationController.markAsRead);
router.post('/read-all', auth(['STAFF', 'SUPERVISOR', 'DEPT_ADMIN', 'QA', 'SUPER_ADMIN']), notificationController.markAllAsRead);

module.exports = router;

