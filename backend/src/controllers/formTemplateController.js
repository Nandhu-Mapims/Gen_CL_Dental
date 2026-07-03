const FormTemplate = require('../models/FormTemplate');
const User = require('../models/User');
const mongoose = require('mongoose');
const { userMatchesFormContext, formContextMongoFilter } = require('../utils/formContextAccess');

function normalizeUserId(id) {
  if (!id) return null;
  if (typeof id === 'object' && id._id != null) id = id._id;
  const str = String(id).trim();
  if (!str || !mongoose.Types.ObjectId.isValid(str)) return null;
  return str;
}

// Assign users to a form template
exports.assignUsersToForm = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;

    if (!Array.isArray(userIds)) {
      return res.status(400).json({ message: 'userIds must be an array' });
    }

    const formTemplate = await FormTemplate.findById(id);
    if (!formTemplate) {
      return res.status(404).json({ message: 'Form template not found' });
    }

    const formCtx = formTemplate.formContext || 'NON_CLINICAL';
    const uniqueIds = [...new Set(userIds.map(normalizeUserId).filter(Boolean))];

    if (uniqueIds.length > 0) {
      const users = await User.find({ _id: { $in: uniqueIds }, isActive: true }).populate(
        'department',
        '_id'
      );
      if (users.length !== uniqueIds.length) {
        const found = new Set(users.map((u) => String(u._id)));
        const missing = uniqueIds.filter((uid) => !found.has(String(uid)));
        return res.status(400).json({
          message: `Invalid or inactive user ID(s): ${missing.join(', ')}. Remove stale assignments and pick active users only.`,
        });
      }
      const mismatched = users.filter((u) => !userMatchesFormContext(u.userContext, formCtx));
      if (mismatched.length > 0) {
        return res.status(400).json({
          message: `These users cannot be assigned to a ${formCtx} form (check User Management — clinical / non-clinical / both): ${mismatched.map((u) => u.name || u.email).join(', ')}`,
        });
      }
    }

    formTemplate.assignedUsers = uniqueIds;
    await formTemplate.save();

    await formTemplate.populate('assignedUsers', 'name email department');
    await formTemplate.populate('departments', 'name code');

    res.json(formTemplate);
  } catch (err) {
    console.error('assignUsersToForm error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get forms accessible by a user
exports.getAccessibleForms = async (req, res) => {
  try {
    const userId = req.user?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const user = await User.findById(userId).select('role userContext').lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const contextFilter = formContextMongoFilter(user.userContext);

    if (user.role === 'SUPER_ADMIN') {
      const forms = await FormTemplate.find({ isActive: true, ...contextFilter })
        .populate('departments', 'name code')
        .populate('assignedUsers', 'name email')
        .sort({ name: 1 });
      return res.json(forms);
    }

    // Get user details — auditors/chiefs see only assigned or common forms, scoped by userContext.
    const query = {
      isActive: true,
      ...contextFilter,
      $or: [
        { assignedUsers: userId },
        { isCommon: true },
      ],
    };

    const forms = await FormTemplate.find(query)
      .populate('departments', 'name code')
      .populate('assignedUsers', 'name email')
      .sort({ name: 1 });

    res.json(forms);
  } catch (err) {
    console.error('getAccessibleForms error', err);
    res.status(500).json({ message: 'Server error' });
  }
};
