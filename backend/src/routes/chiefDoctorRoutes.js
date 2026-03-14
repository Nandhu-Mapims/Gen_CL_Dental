const express = require('express');
const router = express.Router();
const chiefDoctorController = require('../controllers/chiefDoctorController');
const auth = require('../middleware/auth');

// Admin: CRUD operations
router.post('/', auth('SUPER_ADMIN'), chiefDoctorController.createChiefDoctor);
router.get('/', auth(['SUPER_ADMIN', 'QA', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF']), chiefDoctorController.listChiefDoctors);
router.put('/:id', auth('SUPER_ADMIN'), chiefDoctorController.updateChiefDoctor);
router.delete('/:id', auth('SUPER_ADMIN'), chiefDoctorController.deleteChiefDoctor);

module.exports = router;
