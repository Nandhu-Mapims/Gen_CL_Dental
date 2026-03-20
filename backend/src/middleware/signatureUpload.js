/**
 * Multer config for supervisor signature images (JPEG/PNG only).
 */
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_ROOT = path.join(__dirname, '../../uploads/signatures');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
    } catch (e) {
      return cb(e);
    }
    cb(null, UPLOAD_ROOT);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext === '.png' || ext === '.jpg' || ext === '.jpeg' ? ext : '.png';
    cb(null, `${req.params.id}_${Date.now()}${safeExt}`);
  },
});

const allowed = new Set(['image/jpeg', 'image/png', 'image/jpg']);

function fileFilter(_req, file, cb) {
  if (file && allowed.has(String(file.mimetype || '').toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG or PNG images are allowed'));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

module.exports = {
  uploadSignature: upload.single('signature'),
  UPLOAD_ROOT,
};
