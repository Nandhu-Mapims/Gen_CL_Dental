const express = require('express');
const router = express.Router();
const deptController = require('../controllers/departmentController');
const auth = require('../middleware/auth');

router.post('/', auth('SUPER_ADMIN'), deptController.createDepartment);
router.get('/logs', auth(['SUPER_ADMIN', 'QA', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF']), deptController.getDepartmentLogs);
router.get('/users', auth(['SUPER_ADMIN', 'QA', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF']), deptController.getDepartmentUsers);
router.get('/', auth(['SUPER_ADMIN', 'QA', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF']), deptController.listDepartments);
router.put('/:id', auth('SUPER_ADMIN'), deptController.updateDepartment);
router.delete('/:id', auth('SUPER_ADMIN'), deptController.deleteDepartment);

module.exports = router;


