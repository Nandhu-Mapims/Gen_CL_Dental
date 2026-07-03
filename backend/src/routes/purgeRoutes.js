const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const purgeController = require('../controllers/purgeController');

// Hidden SUPER_ADMIN purge API — not linked in normal UI
router.get('/forms', auth('SUPER_ADMIN'), (req, res) => {
  req.params.type = 'form';
  return purgeController.listPurgeCandidates(req, res);
});
router.get('/users', auth('SUPER_ADMIN'), (req, res) => {
  req.params.type = 'user';
  return purgeController.listPurgeCandidates(req, res);
});
router.get('/departments', auth('SUPER_ADMIN'), (req, res) => {
  req.params.type = 'department';
  return purgeController.listPurgeCandidates(req, res);
});
router.get('/:type/:id', auth('SUPER_ADMIN'), purgeController.previewPurge);
router.delete('/:type/:id', auth('SUPER_ADMIN'), purgeController.executePurge);

module.exports = router;
