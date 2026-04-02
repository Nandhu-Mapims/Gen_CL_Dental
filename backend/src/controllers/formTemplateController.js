const FormTemplate = require('../models/FormTemplate');
const User = require('../models/User');
const { userMatchesFormContext } = require('../utils/formContextAccess');

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

    // Verify all user IDs exist; each user's profile must match this form's type (clinical vs non-clinical)
    if (userIds.length > 0) {
      const users = await User.find({ _id: { $in: userIds } }).populate('department', '_id');
      if (users.length !== userIds.length) {
        return res.status(400).json({ message: 'One or more user IDs are invalid' });
      }
      const mismatched = users.filter((u) => !userMatchesFormContext(u.userContext, formCtx));
      if (mismatched.length > 0) {
        return res.status(400).json({
          message: `These users cannot be assigned to a ${formCtx} form (check User Management — clinical / non-clinical / both): ${mismatched.map((u) => u.name || u.email).join(', ')}`,
        });
      }
    }

    formTemplate.assignedUsers = userIds;
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
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (userRole === 'SUPER_ADMIN') {
      const forms = await FormTemplate.find({ isActive: true })
        .populate('departments', 'name code')
        .populate('assignedUsers', 'name email')
        .sort({ name: 1 });
      return res.json(forms);
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Admin only allocates: auditors/chiefs see only forms they are explicitly assigned to (or common forms).
    // Clinical-only / non-clinical-only users never see the other form type (even if mis-assigned).
    const uc = user.userContext || 'NON_CLINICAL';
    const query = {
      isActive: true,
      $or: [
        { assignedUsers: userId }, // Explicitly assigned by admin (cross-audit only)
        { isCommon: true },       // Common forms for all
      ],
    };
    if (uc === 'CLINICAL') {
      query.formContext = 'CLINICAL';
    } else if (uc === 'NON_CLINICAL') {
      query.formContext = 'NON_CLINICAL';
    }

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
