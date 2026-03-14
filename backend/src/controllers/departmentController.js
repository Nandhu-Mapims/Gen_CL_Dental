const Department = require('../models/Department');
const AuditSubmission = require('../models/AuditSubmission');
const User = require('../models/User');
const FormTemplate = require('../models/FormTemplate');

exports.createDepartment = async (req, res) => {
  try {
    const { name, code, parentId, locationId } = req.body;
    const existing = await Department.findOne({ $or: [{ name }, { code }] });
    if (existing) {
      return res.status(400).json({ message: 'Department with same name or code exists' });
    }
    const dept = await Department.create({ name, code, parent: parentId || null, location: locationId || null });
    await dept.populate('parent', 'name code');
    await dept.populate('location', 'areaName code locationType');
    res.status(201).json(dept);
  } catch (err) {
    console.error('createDepartment error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, isActive, parentId, locationId } = req.body;
    const update = { name, code, isActive };
    if (parentId !== undefined) update.parent = parentId || null;
    if (locationId !== undefined) update.location = locationId || null;
    const dept = await Department.findByIdAndUpdate(id, update, { new: true })
      .populate('parent', 'name code')
      .populate('location', 'areaName code locationType');
    if (!dept) return res.status(404).json({ message: 'Department not found' });
    res.json(dept);
  } catch (err) {
    console.error('updateDepartment error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    await Department.findByIdAndDelete(id);
    res.status(204).send();
  } catch (err) {
    console.error('deleteDepartment error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.listDepartments = async (_req, res) => {
  try {
    const depts = await Department.find()
      .populate('parent', 'name code')
      .populate('location', 'areaName code locationType')
      .sort({ name: 1 });
    res.json(depts);
  } catch (err) {
    console.error('listDepartments error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all users with their department information
exports.getDepartmentUsers = async (_req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .populate('department', 'name code')
      .select('name email role designation department')
      .sort({ designation: 1, name: 1 });
    res.json(users);
  } catch (err) {
    console.error('getDepartmentUsers error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get department activity logs (submissions, edits, etc.)
exports.getDepartmentLogs = async (req, res) => {
  try {
    const { departmentId } = req.query;
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const User = require('../models/User');
    const user = await User.findById(userId).populate('department');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Allow all users to view all departments
    const targetDepartmentId = departmentId;

    // Get all departments if no specific department requested; filter out null if id invalid
    const rawDepartments = targetDepartmentId
      ? [await Department.findById(targetDepartmentId)]
      : await Department.find({ isActive: true }).sort({ name: 1 });
    const departments = rawDepartments.filter(Boolean);

    console.log(`[getDepartmentLogs] Found ${departments.length} active departments for user ${user.role}:`, departments.map(d => d.name));

    const departmentLogs = [];

    // Ensure we process ALL departments, even if they have no submissions
    for (const dept of departments) {
      if (!dept) {
        console.log(`[getDepartmentLogs] Skipping null department`);
        continue;
      }

      try {
        const deptFilter = { department: dept._id };

        const formSubmissions = await AuditSubmission.aggregate([
          { $match: deptFilter },
          {
            $addFields: {
              submittedAtRounded: {
                $dateFromParts: {
                  year: { $year: '$submittedAt' },
                  month: { $month: '$submittedAt' },
                  day: { $dayOfMonth: '$submittedAt' },
                  hour: { $hour: '$submittedAt' },
                  minute: { $minute: '$submittedAt' },
                  second: { $second: '$submittedAt' }
                }
              }
            }
          },
          {
            $group: {
              _id: {
                submittedAt: '$submittedAtRounded',
                department: '$department',
                formTemplate: '$formTemplate',
                submittedBy: '$submittedBy'
              },
              firstSubmissionId: { $first: '$_id' },
              location: { $first: '$location' },
              asset: { $first: '$asset' },
              shift: { $first: '$shift' },
              submittedAt: { $first: '$submittedAt' },
              createdAt: { $first: '$createdAt' },
              updatedAt: { $max: '$updatedAt' },
              submittedBy: { $first: '$submittedBy' },
              formTemplate: { $first: '$formTemplate' },
              auditDate: { $first: '$auditDate' },
              auditTime: { $first: '$auditTime' },
              itemCount: { $sum: 1 }
            }
          },
          { $sort: { submittedAt: -1 } },
          { $limit: 100 }
        ]);

        // Populate the submittedBy field
        const userIds = [...new Set(formSubmissions.map((s) => String(s.submittedBy)).filter(Boolean))];
        const formTemplateIds = [...new Set(formSubmissions.map((s) => String(s.formTemplate)).filter(Boolean))];

        const [usersList, formTemplates] = await Promise.all([
          userIds.length > 0 ? User.find({ _id: { $in: userIds } }).select('name email designation') : [],
          formTemplateIds.length > 0 ? FormTemplate.find({ _id: { $in: formTemplateIds } }).select('name') : [],
        ]);

        const usersById = new Map(usersList.map((u) => [String(u._id), u]));
        const formsById = new Map(formTemplates.map((f) => [String(f._id), f]));

        const submissions = formSubmissions.map((formSub) => {
          const user = usersById.get(String(formSub.submittedBy));
          const formTemplate = formsById.get(String(formSub.formTemplate));
          return {
            _id: formSub.firstSubmissionId,
            location: formSub.location || null,
            asset: formSub.asset || null,
            shift: formSub.shift || null,
            submittedAt: formSub.submittedAt,
            createdAt: formSub.createdAt || formSub.submittedAt,
            updatedAt: formSub.updatedAt || formSub.submittedAt,
            submittedBy: user ? { name: user.name, email: user.email, designation: user.designation } : null,
            formTemplate: formSub.formTemplate || null,
            formTemplateName: formTemplate?.name || 'Unknown Form',
            auditDate: formSub.auditDate || null,
            auditTime: formSub.auditTime || null,
            itemCount: formSub.itemCount,
            sessionKey: `${formSub.submittedAt?.getTime?.() ?? 0}_${formSub.submittedBy}`,
          };
        });

        const uniqueSessions = new Set(submissions.map(s => s.sessionKey).filter(Boolean));

        const submissionsByDate = {};
        if (submissions && submissions.length > 0) {
          submissions.forEach(sub => {
            if (sub.submittedAt) {
              const dateKey = new Date(sub.submittedAt).toISOString().split('T')[0];
              if (!submissionsByDate[dateKey]) submissionsByDate[dateKey] = [];
              submissionsByDate[dateKey].push({
                id: sub._id,
                location: sub.location,
                asset: sub.asset,
                shift: sub.shift,
                submittedAt: sub.submittedAt,
                submittedBy: sub.submittedBy?.name || 'Unknown',
              });
            }
          });
        }

        const editedSubmissions = submissions.filter(sub => {
          const createdAt = sub.createdAt ? new Date(sub.createdAt) : new Date(sub.submittedAt);
          const updatedAt = sub.updatedAt ? new Date(sub.updatedAt) : new Date(sub.submittedAt);
          return updatedAt.getTime() - createdAt.getTime() > 1000;
        });

        const editedFormsMap = new Map();
        editedSubmissions.forEach(sub => {
          const roundedTime = Math.floor(new Date(sub.submittedAt).getTime() / 1000) * 1000;
          const formKey = `${sub.sessionKey}_${roundedTime}`;
          if (!editedFormsMap.has(formKey)) {
            editedFormsMap.set(formKey, {
              id: sub._id,
              location: sub.location,
              asset: sub.asset,
              shift: sub.shift,
              submittedAt: sub.submittedAt,
              updatedAt: sub.updatedAt,
              editedAt: sub.updatedAt,
              submittedBy: sub.submittedBy?.name || 'Unknown',
            });
          } else {
            const existing = editedFormsMap.get(formKey);
            if (new Date(sub.updatedAt) > new Date(existing.editedAt)) {
              existing.updatedAt = sub.updatedAt;
              existing.editedAt = sub.updatedAt;
            }
          }
        });
        const recentlyEdited = Array.from(editedFormsMap.values()).sort((a, b) => new Date(b.editedAt) - new Date(a.editedAt));

        const latestSubmission = submissions.length > 0 ? submissions[0].submittedAt : null;

        const submissionDates = Object.keys(submissionsByDate)
          .sort()
          .reverse()
          .map(date => ({
            date,
            count: submissionsByDate[date].length,
            uniqueSessions: new Set(submissionsByDate[date].map(s => `${s.submittedAt}_${s.submittedBy}`)).size,
          }));

        const submissionsByContext = {};
        if (submissions && submissions.length > 0) {
          submissions.forEach(sub => {
            const key = [sub.location || '', sub.asset || '', sub.shift || ''].join('|') || sub.sessionKey;
            if (!sub.submittedAt) return;
            if (!submissionsByContext[key]) {
              submissionsByContext[key] = {
                location: sub.location,
                asset: sub.asset,
                shift: sub.shift,
                submissions: [],
                firstSubmission: sub.submittedAt,
                lastSubmission: sub.submittedAt,
                editedCount: 0,
              };
            }
            const createdAt = sub.createdAt ? new Date(sub.createdAt) : new Date(sub.submittedAt);
            const updatedAt = sub.updatedAt ? new Date(sub.updatedAt) : new Date(sub.submittedAt);
            const isEdited = updatedAt.getTime() - createdAt.getTime() > 1000;
            submissionsByContext[key].submissions.push({
              id: sub._id,
              submittedAt: sub.submittedAt,
              updatedAt: sub.updatedAt || sub.submittedAt,
              isEdited,
              submittedBy: sub.submittedBy?.name || 'Unknown',
            });
            if (sub.submittedAt < submissionsByContext[key].firstSubmission) submissionsByContext[key].firstSubmission = sub.submittedAt;
            if (sub.submittedAt > submissionsByContext[key].lastSubmission) submissionsByContext[key].lastSubmission = sub.submittedAt;
            if (isEdited) submissionsByContext[key].editedCount++;
          });
        }

        const contextsList = Object.values(submissionsByContext)
          .map(ctx => ({ ...ctx, submissionCount: ctx.submissions.length }))
          .sort((a, b) => new Date(b.lastSubmission) - new Date(a.lastSubmission));

        departmentLogs.push({
          department: { _id: dept._id, name: dept.name, code: dept.code },
          totalFormsSubmitted: uniqueSessions.size,
          totalSubmissions: submissions.length,
          latestSubmissionDate: latestSubmission,
          submissionDates: submissionDates.slice(0, 30),
          recentlyEdited: recentlyEdited.slice(0, 20),
          recentlyEditedCount: recentlyEdited.length,
          contexts: contextsList,
          allSubmissions: submissions.map(sub => {
            const createdAt = sub.createdAt ? new Date(sub.createdAt) : new Date(sub.submittedAt);
            const updatedAt = sub.updatedAt ? new Date(sub.updatedAt) : new Date(sub.submittedAt);
            return {
              id: sub._id,
              location: sub.location,
              asset: sub.asset,
              shift: sub.shift,
              submittedAt: sub.submittedAt,
              updatedAt: sub.updatedAt || sub.submittedAt,
              isEdited: updatedAt.getTime() - createdAt.getTime() > 1000,
              submittedBy: sub.submittedBy ? { name: sub.submittedBy.name, email: sub.submittedBy.email, designation: sub.submittedBy.designation } : { name: 'Unknown' },
              formTemplate: sub.formTemplate,
              formTemplateName: sub.formTemplateName || 'Unknown Form',
              auditDate: sub.auditDate,
              auditTime: sub.auditTime,
            };
          }),
        });
      } catch (deptError) {
        console.error(`[getDepartmentLogs] Error processing department ${dept.name} (${dept.code}):`, deptError);
        // Still add the department with empty data so it shows in the list
        departmentLogs.push({
          department: { _id: dept._id, name: dept.name, code: dept.code },
          totalFormsSubmitted: 0,
          totalSubmissions: 0,
          latestSubmissionDate: null,
          submissionDates: [],
          recentlyEdited: [],
          recentlyEditedCount: 0,
          contexts: [],
          allSubmissions: [],
        });
      }
    }

    console.log(`[getDepartmentLogs] Returning ${departmentLogs.length} department logs`);

    res.json({
      departments: departmentLogs,
      totalDepartments: departmentLogs.length,
    });
  } catch (err) {
    console.error('getDepartmentLogs error', err);
    res.status(500).json({ message: 'Server error' });
  }
};


