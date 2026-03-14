const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/login', authController.login);

// Change password (all authenticated roles)
router.patch('/change-password', auth(['STAFF', 'SUPERVISOR', 'DEPT_ADMIN', 'QA', 'SUPER_ADMIN']), authController.changePassword);

// User management (SUPER_ADMIN only for create/update/delete/list)
router.post('/users', auth('SUPER_ADMIN'), authController.registerUser);
router.get('/users/chiefs', auth(['SUPER_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF']), authController.listSupervisors);
router.get('/users/supervisors', auth(['SUPER_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF']), authController.listSupervisors);
router.get('/users', auth('SUPER_ADMIN'), authController.listUsers);
router.put('/users/:id', auth('SUPER_ADMIN'), authController.updateUser);
router.delete('/users/:id', auth('SUPER_ADMIN'), authController.deleteUser);

module.exports = router;
