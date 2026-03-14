const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const auth = require('../middleware/auth');

// Get patient by UHID (public for form validation)
router.get('/uhid/:uhid', auth(['admin', 'auditor', 'chief']), patientController.getPatientByUHID);

// Get all patients (admin only)
router.get('/', auth(['admin']), patientController.getAllPatients);

module.exports = router;

