const mongoose = require('mongoose');
const FormTemplate = require('../models/FormTemplate');
const ChecklistItem = require('../models/ChecklistItem');
const AuditSubmission = require('../models/AuditSubmission');
const User = require('../models/User');
const Department = require('../models/Department');

const PURGE_TYPES = ['form', 'user', 'department'];

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
}

async function previewForm(id) {
  const form = await FormTemplate.findById(id).populate('departments', 'name code').lean();
  if (!form) return null;
  const [checklistCount, submissionCount] = await Promise.all([
    ChecklistItem.countDocuments({ formTemplate: id }),
    AuditSubmission.countDocuments({ formTemplate: id }),
  ]);
  return {
    type: 'form',
    id,
    label: form.name,
    isActive: form.isActive,
    formContext: form.formContext,
    departments: (form.departments || []).map((d) => d.name).join(', '),
    checklistCount,
    submissionCount,
    canPurge: submissionCount === 0,
    blockReason: submissionCount > 0
      ? `This form has ${submissionCount} audit submission row(s). Purge is blocked to protect reports.`
      : null,
  };
}

async function previewUser(id) {
  const user = await User.findById(id).select('-passwordHash').populate('department', 'name code').lean();
  if (!user) return null;
  const submissionCount = await AuditSubmission.countDocuments({
    $or: [
      { submittedBy: id },
      { assignedToUserId: id },
      { correctivePreventiveBy: id },
      { reviewerSignatureBy: id },
    ],
  });
  return {
    type: 'user',
    id,
    label: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    department: user.department?.name || '—',
    submissionCount,
    canPurge: submissionCount === 0,
    blockReason: submissionCount > 0
      ? `This user is linked to ${submissionCount} audit submission row(s). Purge is blocked.`
      : null,
  };
}

async function previewDepartment(id) {
  const dept = await Department.findById(id).lean();
  if (!dept) return null;
  const [userCount, formCount, submissionCount, childCount] = await Promise.all([
    User.countDocuments({ department: id }),
    FormTemplate.countDocuments({ departments: id }),
    AuditSubmission.countDocuments({ department: id }),
    Department.countDocuments({ parent: id }),
  ]);
  const blocked = userCount > 0 || formCount > 0 || submissionCount > 0 || childCount > 0;
  const reasons = [];
  if (userCount) reasons.push(`${userCount} user(s)`);
  if (formCount) reasons.push(`${formCount} form(s)`);
  if (submissionCount) reasons.push(`${submissionCount} submission row(s)`);
  if (childCount) reasons.push(`${childCount} sub-department(s)`);
  return {
    type: 'department',
    id,
    label: dept.name,
    code: dept.code,
    isActive: dept.isActive,
    userCount,
    formCount,
    submissionCount,
    childCount,
    canPurge: !blocked,
    blockReason: blocked ? `Department still has: ${reasons.join(', ')}.` : null,
  };
}

exports.listPurgeCandidates = async (req, res) => {
  try {
    const { type } = req.params;
    if (!PURGE_TYPES.includes(type)) {
      return res.status(400).json({ message: `Invalid type. Use: ${PURGE_TYPES.join(', ')}` });
    }

    if (type === 'form') {
      const forms = await FormTemplate.find({ isActive: false })
        .populate('departments', 'name code')
        .sort({ updatedAt: -1 })
        .lean();
      const items = await Promise.all(forms.map((f) => previewForm(f._id)));
      return res.json(items.filter(Boolean));
    }

    if (type === 'user') {
      const users = await User.find({ isActive: false })
        .select('-passwordHash')
        .populate('department', 'name code')
        .sort({ updatedAt: -1 })
        .lean();
      const items = await Promise.all(users.map((u) => previewUser(u._id)));
      return res.json(items.filter(Boolean));
    }

    const depts = await Department.find({ isActive: false }).sort({ name: 1 }).lean();
    const items = await Promise.all(depts.map((d) => previewDepartment(d._id)));
    return res.json(items.filter(Boolean));
  } catch (err) {
    console.error('listPurgeCandidates error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.previewPurge = async (req, res) => {
  try {
    const { type, id } = req.params;
    if (!PURGE_TYPES.includes(type)) {
      return res.status(400).json({ message: `Invalid type. Use: ${PURGE_TYPES.join(', ')}` });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    let preview = null;
    if (type === 'form') preview = await previewForm(id);
    else if (type === 'user') preview = await previewUser(id);
    else preview = await previewDepartment(id);

    if (!preview) return res.status(404).json({ message: `${type} not found` });
    res.json(preview);
  } catch (err) {
    console.error('previewPurge error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.executePurge = async (req, res) => {
  try {
    const { type, id } = req.params;
    if (!PURGE_TYPES.includes(type)) {
      return res.status(400).json({ message: `Invalid type. Use: ${PURGE_TYPES.join(', ')}` });
    }
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const preview =
      type === 'form'
        ? await previewForm(id)
        : type === 'user'
          ? await previewUser(id)
          : await previewDepartment(id);

    if (!preview) return res.status(404).json({ message: `${type} not found` });
    if (!preview.canPurge) {
      return res.status(409).json({ message: preview.blockReason || 'Cannot purge this record' });
    }

    if (type === 'form') {
      await ChecklistItem.deleteMany({ formTemplate: id });
      await FormTemplate.findByIdAndDelete(id);
    } else if (type === 'user') {
      const requesterId = req.user?.sub || req.user?.id || req.user?._id;
      if (requesterId && String(requesterId) === String(id)) {
        return res.status(400).json({ message: 'You cannot permanently delete your own account.' });
      }
      await User.findByIdAndDelete(id);
    } else {
      await Department.findByIdAndDelete(id);
    }

    res.json({ ok: true, purged: preview });
  } catch (err) {
    console.error('executePurge error', err);
    res.status(500).json({ message: 'Server error' });
  }
};
