const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const auth = require('../middleware/auth');
const { uploadSubmittedSessionSignature, uploadReviewerSessionSignature } = require('../middleware/sessionSignatureUpload');

// Staff/auditor submit checklist
router.post('/', auth(['STAFF', 'SUPERVISOR', 'DEPT_ADMIN']), auditController.submitAudit);

// Operational checklists by department (optional location/asset/shift)
router.get('/patient-checklists', auditController.getPatientChecklists);

router.get('/check-duplicate', auth(['STAFF', 'SUPERVISOR', 'DEPT_ADMIN']), auditController.checkDuplicateSubmission);

// Dashboard stats (SUPER_ADMIN, QA, DEPT_ADMIN, SUPERVISOR)
router.get('/stats', auth(['SUPER_ADMIN', 'QA', 'DEPT_ADMIN', 'SUPERVISOR']), auditController.getStats);

router.get('/executive-analytics', auth(['SUPER_ADMIN']), auditController.getExecutiveAnalytics);

router.get('/analytics/time-series', auth(['SUPER_ADMIN', 'QA']), auditController.getTimeSeriesAnalytics);
router.get('/analytics/user-activity', auth(['SUPER_ADMIN', 'QA']), auditController.getUserActivityAnalytics);
router.get('/analytics/admissions', auth(['SUPER_ADMIN', 'QA']), auditController.getAdmissionAnalytics);
router.get('/analytics/forms', auth(['SUPER_ADMIN', 'QA']), auditController.getFormTemplateAnalytics);
router.get('/analytics/comprehensive', auth(['SUPER_ADMIN', 'QA']), auditController.getComprehensiveAnalytics);

router.get('/export', auth(['SUPER_ADMIN', 'QA']), auditController.exportSubmissions);

router.get('/session/:id', auth(['SUPER_ADMIN', 'QA', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF']), auditController.getSubmissionsBySession);
router.post(
  '/session/:id/submitted-signature',
  auth(['STAFF', 'SUPERVISOR', 'DEPT_ADMIN']),
  uploadSubmittedSessionSignature,
  auditController.uploadSubmittedSessionSignature
);
router.post(
  '/session/:id/reviewer-signature',
  auth(['SUPER_ADMIN', 'SUPERVISOR', 'DEPT_ADMIN']),
  uploadReviewerSessionSignature,
  auditController.uploadReviewerSessionSignature
);
router.get('/report-summary', auth(['SUPER_ADMIN', 'QA', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF']), auditController.getReportSummary);

router.get('/', auth(['SUPER_ADMIN', 'QA', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF']), auditController.getSubmissions);

module.exports = router;
