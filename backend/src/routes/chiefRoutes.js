const express = require('express');
const router = express.Router();
const chiefController = require('../controllers/chiefController');
const auth = require('../middleware/auth');
const { uploadReviewerSessionSignature } = require('../middleware/sessionSignatureUpload');

const SUPERVISOR_ROLES = ['SUPER_ADMIN', 'SUPERVISOR', 'DEPT_ADMIN'];

router.get('/admin/analytics', auth('SUPER_ADMIN'), chiefController.getChiefAnalytics);
router.get('/my-analytics', auth(SUPERVISOR_ROLES), chiefController.getMyAnalytics);

// New session-based endpoints (quality checklist, no patient/IPID)
router.get('/sessions', auth(SUPERVISOR_ROLES), chiefController.getSupervisorSessions);
router.get('/session-submissions', auth(SUPERVISOR_ROLES), chiefController.getSessionSubmissions);
router.post('/session-signature', auth(SUPERVISOR_ROLES), uploadReviewerSessionSignature, chiefController.uploadReviewerSessionSignature);

// Legacy patient-based endpoints (kept for backward compatibility with old data)
router.get('/patients', auth(SUPERVISOR_ROLES), chiefController.getChiefPatients);
router.get('/patient-submissions', auth(SUPERVISOR_ROLES), chiefController.getChiefPatientSubmissions);

router.put('/submissions/:id/corrective-preventive', auth(SUPERVISOR_ROLES), chiefController.updateCorrectivePreventive);
router.get('/doctor-performance', auth(SUPERVISOR_ROLES), chiefController.getDoctorPerformance);

module.exports = router;
