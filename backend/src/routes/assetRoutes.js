const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const auth = require('../middleware/auth');

router.get('/', auth(['SUPER_ADMIN', 'QA', 'DEPT_ADMIN', 'SUPERVISOR', 'STAFF']), assetController.list);

module.exports = router;
