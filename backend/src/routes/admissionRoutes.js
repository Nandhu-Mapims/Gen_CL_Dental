const express = require('express');
const router = express.Router();
const admissionController = require('../controllers/admissionController');
const auth = require('../middleware/auth');

// Create new admission
router.post('/', auth(['admin', 'auditor']), admissionController.createAdmission);

// Get admission by IPID
router.get('/ipid/:ipid', auth(['admin', 'auditor', 'chief']), admissionController.getAdmissionByIPID);

// Get all admissions for a patient (by UHID)
router.get('/patient/:uhid', auth(['admin', 'auditor', 'chief']), admissionController.getPatientAdmissions);

// Get active admission for a patient
router.get('/patient/:uhid/active', auth(['admin', 'auditor', 'chief']), admissionController.getActiveAdmission);

// Discharge admission
router.put('/:ipid/discharge', auth(['admin', 'auditor']), admissionController.dischargeAdmission);

// Get all admissions (with filters)
router.get('/', auth(['admin']), admissionController.getAllAdmissions);

// Get distinct wards and units (for dropdowns)
router.get('/wards-and-units', auth(['admin', 'auditor', 'chief']), admissionController.getWardsAndUnits);

module.exports = router;

