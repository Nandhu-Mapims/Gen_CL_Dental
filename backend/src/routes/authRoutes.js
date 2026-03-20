const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const { uploadSignature } = require('../middleware/signatureUpload');

function handleSignatureUpload(req, res, next) {
  uploadSignature(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Signature image must be 2MB or smaller' });
      }
      return res.status(400).json({ message: err.message || 'Invalid upload' });
    }
    next();
  });
}

router.post('/login', authController.login);

// Change password (all authenticated roles)
router.patch('/change-password', auth(['STAFF', 'SUPERVISOR', 'DEPT_ADMIN', 'QA', 'SUPER_ADMIN']), authController.changePassword);

// User management (SUPER_ADMIN only for create/update/delete/list)
router.post('/users', auth('SUPER_ADMIN'), authController.registerUser);
router.get('/users/chiefs', auth(['SUPER_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF']), authController.listSupervisors);
router.get('/users/supervisors', auth(['SUPER_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF']), authController.listSupervisors);
router.get('/users', auth('SUPER_ADMIN'), authController.listUsers);
router.put('/users/:id', auth('SUPER_ADMIN'), authController.updateUser);
router.post(
  '/users/:id/signature',
  auth('SUPER_ADMIN'),
  handleSignatureUpload,
  authController.uploadUserSignature
);
router.delete('/users/:id/signature', auth('SUPER_ADMIN'), authController.deleteUserSignature);
router.delete('/users/:id', auth('SUPER_ADMIN'), authController.deleteUser);

module.exports = router;
