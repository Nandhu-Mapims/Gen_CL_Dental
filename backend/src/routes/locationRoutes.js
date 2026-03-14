const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const auth = require('../middleware/auth');

const ALL_ROLES = ['SUPER_ADMIN', 'QA', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF'];

router.get('/', auth(ALL_ROLES), locationController.list);
router.post('/', auth('SUPER_ADMIN'), locationController.create);
router.put('/:id', auth('SUPER_ADMIN'), locationController.update);
router.delete('/:id', auth('SUPER_ADMIN'), locationController.remove);

module.exports = router;
