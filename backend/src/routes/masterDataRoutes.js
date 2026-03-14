const express = require('express');
const router = express.Router();
const masterDataController = require('../controllers/masterDataController');
const auth = require('../middleware/auth');

// Admin: get full master data (designations, wards, units)
router.get('/', auth(['SUPER_ADMIN', 'QA', 'DEPT_ADMIN']), masterDataController.getMasterData);

// Admin: update master data (replace full list)
router.put('/', auth(['SUPER_ADMIN']), masterDataController.updateMasterData);

// Admin: add a single designation to the list
router.post('/designations', auth(['SUPER_ADMIN']), masterDataController.addDesignation);

// Admin: delete a single designation
router.delete('/designations/:name', auth(['SUPER_ADMIN']), masterDataController.deleteDesignation);

module.exports = router;
