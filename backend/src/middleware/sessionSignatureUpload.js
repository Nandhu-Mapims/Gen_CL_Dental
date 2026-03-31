/**
 * Multer config for per-session signature images (JPEG/PNG only).
 * - submitted signature: staff signing at submission time
 * - reviewer signature: supervisor/reviewer signing during review
 */
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_ROOT = path.join(__dirname, '../../uploads/session-signatures');

function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch (e) {
    // ignore; multer will surface failure when writing
  }
}

function makeUploader(subdir) {
  const dir = path.join(UPLOAD_ROOT, subdir);
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ext === '.png' || ext === '.jpg' || ext === '.jpeg' ? ext : '.jpg';
      const idPart = req.params?.id ? String(req.params.id) : 'session';
      cb(null, `${idPart}_${Date.now()}${safeExt}`);
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

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 },
  });
}

module.exports = {
  uploadSubmittedSessionSignature: makeUploader('submitted').single('signature'),
  uploadReviewerSessionSignature: makeUploader('reviewer').single('signature'),
  UPLOAD_ROOT,
};

