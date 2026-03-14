const express = require('express');
const router = express.Router();
const checklistController = require('../controllers/checklistController');
const auth = require('../middleware/auth');

// Admin CRUD
router.post('/', auth('SUPER_ADMIN'), checklistController.createChecklistItem);
router.put('/:id', auth('SUPER_ADMIN'), checklistController.updateChecklistItem);
router.delete('/:id', auth('SUPER_ADMIN'), checklistController.deleteChecklistItem);
router.post('/reorder', auth('SUPER_ADMIN'), checklistController.reorderChecklistItems);

// User: get checklist for a department (includes ALL + dept-specific)
router.get('/department/:departmentId', auth(['SUPER_ADMIN', 'QA', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF']), checklistController.getChecklistForDepartment);

module.exports = router;


