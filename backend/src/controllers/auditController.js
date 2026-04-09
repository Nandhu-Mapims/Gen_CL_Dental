const mongoose = require('mongoose');
const AuditSubmission = require('../models/AuditSubmission');
const FormTemplate = require('../models/FormTemplate');
const User = require('../models/User');
const { userMatchesFormContext } = require('../utils/formContextAccess');

function toObjectId(id) {
  if (!id) return null;
  const str = String(id).trim();
  return str && mongoose.Types.ObjectId.isValid(str) ? new mongoose.Types.ObjectId(str) : null;
}

/** Clinical-only staff: submissions report must not show department-wide data — only own clinical-form rows. */
async function applyClinicalStaffReportScope(req, filter) {
  const userId = req.user?.sub || req.user?.id || req.user?._id;
  if (!userId) return;
  const userDoc = await User.findById(userId).select('role userContext').lean();
  if (!userDoc || userDoc.role !== 'STAFF' || userDoc.userContext !== 'CLINICAL') return;

  const clinicalFormIds = await FormTemplate.find({ formContext: 'CLINICAL' }).distinct('_id');
  filter.submittedBy = userId;
  filter.formTemplate = { $in: clinicalFormIds.length ? clinicalFormIds : [] };
}

async function assertClinicalStaffCanOpenSession(req, anchorDoc) {
  const userId = req.user?.sub || req.user?.id || req.user?._id;
  if (!userId || !anchorDoc) return;
  const userDoc = await User.findById(userId).select('role userContext').lean();
  if (!userDoc || userDoc.role !== 'STAFF' || userDoc.userContext !== 'CLINICAL') return;

  const submitterId = anchorDoc.submittedBy?._id || anchorDoc.submittedBy;
  if (String(submitterId) !== String(userId)) {
    const err = new Error('FORBIDDEN_SESSION');
    throw err;
  }
  const formId = anchorDoc.formTemplate?._id || anchorDoc.formTemplate;
  const ft = await FormTemplate.findById(formId).select('formContext').lean();
  if (!ft || ft.formContext !== 'CLINICAL') {
    const err = new Error('FORBIDDEN_SESSION');
    throw err;
  }
}

// Submit operations checklist (Department/Service, Location, Asset, Shift)
exports.submitAudit = async (req, res) => {
  try {
    const {
      departmentId,
      formTemplateId,
      items,
      location,
      asset,
      shift,
      locationId,
      assetId,
      shiftId,
      assignedToUserId,
      auditDate: auditDateInput,
      auditTime: auditTimeInput,
      patientUhid,
      patientName,
    } = req.body;
    const userId = req.user?.sub || req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required. Please log in again.' });
    }

    if (!departmentId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Missing required fields: department and checklist items.' });
    }

    const locationStr = (location != null && String(location).trim()) ? String(location).trim() : '';
    const assetStr = (asset != null && String(asset).trim()) ? String(asset).trim() : '';
    const shiftStr = (shift != null && String(shift).trim()) ? String(shift).trim() : '';

    let departmentForSubmission = departmentId;
    let clinicalUhid = '';
    let clinicalName = '';
    if (formTemplateId) {
      const form = await FormTemplate.findById(formTemplateId).select('departments formContext').lean();
      if (form?.departments?.length) {
        const bodyDeptStr = (departmentId && departmentId.toString) ? departmentId.toString() : String(departmentId);
        const formDeptIds = form.departments.map((d) => (d && d._id ? d._id.toString() : d.toString()));
        if (formDeptIds.includes(bodyDeptStr)) {
          departmentForSubmission = departmentId;
        } else {
          departmentForSubmission = form.departments[0]._id || form.departments[0];
        }
      }
      if (form?.formContext === 'CLINICAL') {
        clinicalUhid = patientUhid != null ? String(patientUhid).trim().toUpperCase() : '';
        clinicalName = patientName != null ? String(patientName).trim() : '';
        if (!clinicalUhid || !clinicalName) {
          return res.status(400).json({
            message: 'Patient UHID and patient name are required for clinical forms.',
          });
        }
      }
      if (form) {
        const submitter = await User.findById(userId).select('role userContext').lean();
        const bypassContext = submitter && ['SUPER_ADMIN', 'QA'].includes(submitter.role);
        if (submitter && !bypassContext && !userMatchesFormContext(submitter.userContext, form.formContext)) {
          return res.status(400).json({
            message:
              'Your user type does not match this form. Clinical-only users may use clinical forms only; non-clinical-only users may use non-clinical forms only (or ask for a “both” profile).',
          });
        }
      }
    }

    const now = new Date();
    const auditDateStr = auditDateInput && typeof auditDateInput === 'string' ? auditDateInput.trim() : null;
    const auditTimeStr = auditTimeInput && typeof auditTimeInput === 'string' ? auditTimeInput.trim() : null;
    const auditDate = auditDateStr ? new Date(auditDateStr + 'T00:00:00.000Z') : new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const auditTime = auditTimeStr || now.getUTCHours().toString().padStart(2, '0') + ':' + now.getUTCMinutes().toString().padStart(2, '0');

    for (const it of items) {
      const val = (it.responseValue || it.yesNoNa || '').toString().toUpperCase();
      if (val === 'NO' && (!it.remarks || !String(it.remarks).trim())) {
        return res.status(400).json({
          message: 'Remarks are required when "NO" is selected. Please add remarks for all NO responses.',
        });
      }
    }

    if (clinicalUhid) {
      const deptOid = toObjectId(departmentForSubmission);
      if (!deptOid) {
        return res.status(400).json({ message: 'Invalid department. Cannot submit clinical checklist.' });
      }
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const uhidRegex = new RegExp('^' + clinicalUhid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
      const recent = await AuditSubmission.findOne({
        department: deptOid,
        patientUhid: uhidRegex,
        submittedAt: { $gte: twentyFourHoursAgo },
      })
        .sort({ submittedAt: -1 })
        .select('submittedAt')
        .lean();
      if (recent?.submittedAt) {
        const nextEligibleAt = new Date(new Date(recent.submittedAt).getTime() + 24 * 60 * 60 * 1000);
        return res.status(409).json({
          message:
            'Your department has already submitted a checklist for this patient UHID in the last 24 hours. Other departments may still submit for the same UHID.',
          nextEligibleAt: nextEligibleAt.toISOString(),
        });
      }
    }

    const docs = items.map((it) => {
      const rawVal = (it.responseValue || it.yesNoNa || '').toString().trim().toUpperCase();
      const yesNoNaForSchema = rawVal === 'YES' || rawVal === 'NO' ? rawVal : undefined;
      return {
        department: departmentForSubmission,
        formTemplate: formTemplateId || undefined,
        locationId: locationId || undefined,
        assetId: assetId || undefined,
        shiftId: shiftId || undefined,
        assignedToUserId: assignedToUserId || undefined,
        location: locationStr || undefined,
        asset: assetStr || undefined,
        shift: shiftStr || undefined,
        checklistItemId: it.checklistItemId,
        yesNoNa: yesNoNaForSchema,
        responseValue: rawVal || it.responseValue || it.yesNoNa || '',
        remarks: it.remarks || '',
        responsibility: it.responsibility || '',
        submittedBy: userId,
        submittedAt: now,
        auditDate,
        auditTime,
        isLocked: true,
        ...(clinicalUhid
          ? { patientUhid: clinicalUhid, patientName: clinicalName }
          : {}),
      };
    });

    const created = await AuditSubmission.insertMany(docs);
    res.status(201).json(created);
  } catch (err) {
    console.error('submitAudit error', err);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Duplicate record. Please use unique values.' });
    }
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors || {}).map((e) => e.message).join('; ') || err.message;
      return res.status(400).json({ message: msg || 'Validation failed. Check your data.' });
    }
    res.status(500).json({ message: err.message || 'Server error', error: err.message });
  }
};

// User: fetch previous submissions; filter by department, location, asset, shift (ids or strings), date range
exports.getSubmissions = async (req, res) => {
  try {
    const { departmentId, location, asset, shift, locationId, shiftId, submittedBy, fromDate, toDate, formContext, patientUhid, limit = 500 } = req.query;
    const filter = {};
    if (departmentId) filter.department = toObjectId(departmentId) || departmentId;
    const locOid = toObjectId(locationId);
    if (locOid) filter.locationId = locOid;
    const shiftOid = toObjectId(shiftId);
    if (shiftOid) filter.shiftId = shiftOid;
    if (location && String(location).trim()) filter.location = { $regex: new RegExp('^' + String(location).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') };
    if (asset && String(asset).trim()) filter.asset = { $regex: new RegExp('^' + String(asset).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') };
    if (shift && String(shift).trim()) filter.shift = { $regex: new RegExp('^' + String(shift).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') };
    if (submittedBy) filter.submittedBy = submittedBy;
    if (fromDate || toDate) {
      filter.submittedAt = {};
      if (fromDate) filter.submittedAt.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filter.submittedAt.$lte = end;
      }
    }

    // Optional admin filter: clinical vs non-clinical templates
    if (formContext === 'CLINICAL' || formContext === 'NON_CLINICAL') {
      const formTemplateIds = await FormTemplate.find({ formContext }).distinct('_id');
      filter.formTemplate = { $in: formTemplateIds };
    }

    if (patientUhid && String(patientUhid).trim()) {
      const p = String(patientUhid).trim();
      filter.patientUhid = {
        $regex: new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'),
      };
    }

    await applyClinicalStaffReportScope(req, filter);

    const submissions = await AuditSubmission.find(filter)
      .populate('department', 'name code')
      .populate('formTemplate', 'name')
      .populate('checklistItemId', 'label section responseType')
      .populate('submittedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(submissions);
  } catch (err) {
    console.error('getSubmissions error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all submission rows for a session (same form fill: department + formTemplate + submittedAt + submittedBy)
exports.getSubmissionsBySession = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await AuditSubmission.findById(id)
      .populate('department', 'name code')
      .populate('formTemplate', 'name')
      .populate('checklistItemId', 'label section responseType order')
      .populate('submittedBy', 'name email')
      .populate('assignedToUserId', 'name email designation signatureImage')
      .lean();
    if (!doc) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    try {
      await assertClinicalStaffCanOpenSession(req, doc);
    } catch (e) {
      if (e.message === 'FORBIDDEN_SESSION') {
        return res.status(403).json({
          message: 'You can only open reports for your own clinical checklist submissions.',
        });
      }
      throw e;
    }
    const submittedAt = new Date(doc.submittedAt);
    const start = new Date(submittedAt);
    start.setMilliseconds(0);
    const end = new Date(start.getTime() + 1000);
    const sessionSubmissions = await AuditSubmission.find({
      department: doc.department?._id || doc.department,
      formTemplate: doc.formTemplate?._id || doc.formTemplate,
      submittedBy: doc.submittedBy?._id || doc.submittedBy,
      submittedAt: { $gte: start, $lt: end },
    })
      .populate('department', 'name code')
      .populate('formTemplate', 'name')
      .populate('checklistItemId', 'label section responseType order')
      .populate('submittedBy', 'name email')
      .populate('assignedToUserId', 'name email designation signatureImage')
      .sort({ createdAt: 1 })
      .lean();
    res.json(sessionSubmissions);
  } catch (err) {
    console.error('getSubmissionsBySession error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

function buildSessionWindowFromDoc(doc) {
  const submittedAt = new Date(doc.submittedAt);
  const start = new Date(submittedAt);
  start.setMilliseconds(0);
  const end = new Date(start.getTime() + 1000);
  return { start, end };
}

// Staff: set per-session submitted signature image (updates all rows in the session)
exports.uploadSubmittedSessionSignature = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Use form field name "signature".' });
    }

    const anchor = await AuditSubmission.findById(id).select('department formTemplate submittedBy submittedAt').lean();
    if (!anchor) return res.status(404).json({ message: 'Submission not found' });

    const { start, end } = buildSessionWindowFromDoc(anchor);
    const publicPath = `/uploads/session-signatures/submitted/${req.file.filename}`;
    const now = new Date();

    await AuditSubmission.updateMany(
      {
        department: anchor.department,
        formTemplate: anchor.formTemplate,
        submittedBy: anchor.submittedBy,
        submittedAt: { $gte: start, $lt: end },
      },
      {
        $set: {
          submittedSignatureImage: publicPath,
          submittedSignatureAt: now,
        },
      }
    );

    res.json({ ok: true, submittedSignatureImage: publicPath, submittedSignatureAt: now });
  } catch (err) {
    console.error('uploadSubmittedSessionSignature error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Supervisor/reviewer: set per-session reviewer signature image (updates all rows in the session)
exports.uploadReviewerSessionSignature = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Use form field name "signature".' });
    }

    const anchor = await AuditSubmission.findById(id).select('department formTemplate submittedBy submittedAt assignedToUserId').lean();
    if (!anchor) return res.status(404).json({ message: 'Submission not found' });

    const { start, end } = buildSessionWindowFromDoc(anchor);
    const publicPath = `/uploads/session-signatures/reviewer/${req.file.filename}`;
    const now = new Date();
    const reviewerId = req.user?.sub || req.user?.id || req.user?._id || null;

    await AuditSubmission.updateMany(
      {
        department: anchor.department,
        formTemplate: anchor.formTemplate,
        submittedBy: anchor.submittedBy,
        submittedAt: { $gte: start, $lt: end },
      },
      {
        $set: {
          reviewerSignatureImage: publicPath,
          reviewerSignatureAt: now,
          reviewerSignatureBy: reviewerId,
        },
      }
    );

    res.json({ ok: true, reviewerSignatureImage: publicPath, reviewerSignatureAt: now, reviewerSignatureBy: reviewerId });
  } catch (err) {
    console.error('uploadReviewerSessionSignature error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Report summary: completion %, overdue (non-compliant) count, rejection reasons, staff performance
exports.getReportSummary = async (req, res) => {
  try {
    const { fromDate, toDate, departmentId, locationId, shiftId, formContext, patientUhid } = req.query;
    const match = {};
    if (departmentId) match.department = toObjectId(departmentId) || departmentId;
    const locOid = toObjectId(locationId);
    if (locOid) match.locationId = locOid;
    const shiftOid = toObjectId(shiftId);
    if (shiftOid) match.shiftId = shiftOid;
    if (fromDate || toDate) {
      match.submittedAt = {};
      if (fromDate) match.submittedAt.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        match.submittedAt.$lte = end;
      }
    }

    // Optional admin filter: clinical vs non-clinical templates
    if (formContext === 'CLINICAL' || formContext === 'NON_CLINICAL') {
      const formTemplateIds = await FormTemplate.find({ formContext }).distinct('_id');
      match.formTemplate = { $in: formTemplateIds };
    }

    if (patientUhid && String(patientUhid).trim()) {
      const p = String(patientUhid).trim();
      match.patientUhid = {
        $regex: new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'),
      };
    }

    await applyClinicalStaffReportScope(req, match);

    const sessionKey = {
      $concat: [
        { $dateToString: { format: '%Y-%m-%dT%H:%M:%S', date: '$submittedAt' } },
        '|',
        { $toString: '$submittedBy' },
        '|',
        { $toString: '$department' },
        '|',
        { $toString: '$formTemplate' },
      ],
    };

    const [sessionStats, noResponses, staffAgg] = await Promise.all([
      AuditSubmission.aggregate([
        { $match: match },
        {
          $group: {
            _id: sessionKey,
            totalItems: { $sum: 1 },
            yesCount: { $sum: { $cond: [{ $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['YES']] }, 1, 0] } },
            noCount: { $sum: { $cond: [{ $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['NO']] }, 1, 0] } },
          },
        },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            fullyCompliantSessions: { $sum: { $cond: [{ $and: [{ $gt: ['$totalItems', 0] }, { $eq: ['$yesCount', '$totalItems'] }] }, 1, 0] } },
          },
        },
      ]),
      AuditSubmission.aggregate([
        { $match: { ...match, $or: [{ responseValue: 'NO' }, { yesNoNa: 'NO' }] } },
        {
          $lookup: {
            from: 'checklistitems',
            localField: 'checklistItemId',
            foreignField: '_id',
            as: 'item',
          },
        },
        { $unwind: { path: '$item', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { label: { $ifNull: ['$item.label', 'Unknown'] }, remarks: { $ifNull: ['$remarks', ''] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 50 },
      ]),
      AuditSubmission.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$submittedBy',
            totalRows: { $sum: 1 },
            yesRows: { $sum: { $cond: [{ $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['YES']] }, 1, 0] } },
          },
        },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            userId: '$_id',
            name: { $ifNull: ['$user.name', 'Unknown'] },
            totalSubmissions: '$totalRows',
            compliantCount: '$yesRows',
            complianceRate: { $cond: [{ $gt: ['$totalRows', 0] }, { $round: [{ $multiply: [{ $divide: ['$yesRows', '$totalRows'] }, 100] }, 1] }, 0] },
          },
        },
        { $sort: { totalSubmissions: -1 } },
      ]),
    ]);

    const totalSessions = sessionStats[0]?.totalSessions ?? 0;
    const fullyCompliantSessions = sessionStats[0]?.fullyCompliantSessions ?? 0;
    const completionPercent = totalSessions > 0 ? Math.round((fullyCompliantSessions / totalSessions) * 100) : 0;

    const overdueCount = await AuditSubmission.countDocuments({
      ...match,
      $or: [{ responseValue: 'NO' }, { yesNoNa: 'NO' }],
    });

    const rejectionReasons = noResponses.map((r) => ({
      checklistLabel: r._id?.label ?? 'Unknown',
      remarks: r._id?.remarks ?? '',
      count: r.count,
    }));

    res.json({
      completionPercent,
      totalSessions,
      fullyCompliantSessions,
      overdueCount,
      rejectionReasons,
      staffPerformance: staffAgg,
    });
  } catch (err) {
    console.error('getReportSummary error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Dashboard: comprehensive stats with case counts
exports.getStats = async (req, res) => {
  try {
    // Check if clearance stats are requested (optional, as they're expensive)
    const includeClearance = req.query.includeClearance === 'true';
    const { formContext } = req.query;

    let formContextMatch = null;
    if (formContext === 'CLINICAL' || formContext === 'NON_CLINICAL') {
      const formTemplateIds = await FormTemplate.find({ formContext, isActive: true }).distinct('_id');
      formContextMatch = { formTemplate: { $in: formTemplateIds } };
    }

    // Parallel execution of basic stats queries
    const [deptStats, caseCounts, overall, uniqueCases] = await Promise.all([
      // Department stats aggregation
      AuditSubmission.aggregate([
        ...(formContextMatch ? [{ $match: formContextMatch }] : []),
        {
          $group: {
            _id: '$department',
            total: { $sum: 1 },
            compliant: {
              $sum: {
                $cond: [
                  { $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['YES']] },
                  1,
                  0
                ]
              }
            },
            nonCompliant: {
              $sum: {
                $cond: [
                  { $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['NO']] },
                  1,
                  0
                ]
              }
            },
          },
        },
      ]),
      // Session counts: by department (session = same submittedAt second + submittedBy)
      AuditSubmission.aggregate([
        ...(formContextMatch ? [{ $match: formContextMatch }] : []),
        {
          $group: {
            _id: {
              department: '$department',
              sessionKey: { $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, '|', { $ifNull: ['$auditTime', ''] }, '|', { $ifNull: [{ $toString: '$submittedBy' }, ''] }] },
            },
          },
        },
        {
          $group: {
            _id: '$_id.department',
            caseCount: { $sum: 1 },
          },
        },
      ]),
      // Overall stats aggregation
      AuditSubmission.aggregate([
        ...(formContextMatch ? [{ $match: formContextMatch }] : []),
        {
          $group: {
            _id: null,
            totalSubmissions: { $sum: 1 },
            totalCompliant: {
              $sum: {
                $cond: [
                  { $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['YES']] },
                  1,
                  0
                ]
              }
            },
          },
        },
      ]),
      // Unique sessions (for totalCases: count distinct session keys)
      AuditSubmission.aggregate([
        ...(formContextMatch ? [{ $match: formContextMatch }] : []),
        { $group: { _id: { $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, '|', { $ifNull: ['$auditTime', ''] }, '|', { $ifNull: [{ $toString: '$submittedBy' }, ''] }] } } },
        { $count: 'total' },
      ]),
    ]);

    // Merge department stats with case counts
    const statsWithCases = deptStats.map((stat) => {
      const caseStat = caseCounts.find((c) => c._id?.toString() === stat._id?.toString());
      return {
        ...stat,
        caseCount: caseStat?.caseCount || 0,
      };
    });

    const totalSessions = (uniqueCases[0] && uniqueCases[0].total) ? uniqueCases[0].total : 0;
    const response = {
      departmentStats: statsWithCases,
      overall: overall[0] || {
        totalSubmissions: 0,
        totalCompliant: 0,
      },
      totalCases: totalSessions,
      clearanceStats: {
        byDepartment: [],
        byForm: [],
      },
    };

    // Only calculate clearance stats if explicitly requested (expensive operation)
    if (includeClearance) {
      try {
        const ChecklistItem = require('../models/ChecklistItem');
        const FormTemplate = require('../models/FormTemplate');
        const allForms = await FormTemplate.find({ isActive: true }).populate('departments').lean();
        
        // Get form item counts in one query
        const formItemCounts = await ChecklistItem.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: '$formTemplate', count: { $sum: 1 } } }
        ]);
        const formItemCountMap = {};
        formItemCounts.forEach(item => {
          formItemCountMap[item._id?.toString()] = item.count;
        });

        // Optimized clearance stats using aggregation
        const clearanceStats = [];
        const deptClearanceStats = {};

        // Process only departments that have stats
        for (const dept of statsWithCases) {
          const deptId = dept._id;
          const assignedForms = allForms.filter((form) => {
            const contextOk = formContextMatch ? form.formContext === formContext : true;
            const deptOk = form.departments.some((d) => d._id?.toString() === deptId?.toString()) || form.isCommon;
            return contextOk && deptOk;
          });

          for (const form of assignedForms) {
            const itemCount = formItemCountMap[form._id?.toString()];
            if (!itemCount || itemCount === 0) continue;

            // Use aggregation to calculate clearance in one query
            const clearanceData = await AuditSubmission.aggregate([
              {
                $match: {
                  department: deptId,
                  formTemplate: form._id,
                }
              },
              {
                $group: {
                  _id: { $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, '|', { $ifNull: ['$auditTime', ''] }, '|', { $toString: '$submittedBy' }] },
                  submissions: {
                    $push: {
                      responseValue: { $ifNull: ['$responseValue', '$yesNoNa'] },
                      submittedAt: '$submittedAt'
                    }
                  }
                }
              },
              {
                $project: {
                  latestSubmissions: {
                    $slice: [
                      {
                        $sortArray: {
                          input: '$submissions',
                          sortBy: { submittedAt: -1 }
                        }
                      },
                      itemCount
                    ]
                  }
                }
              },
              {
                $project: {
                  isFullyCleared: {
                    $cond: {
                      if: { $eq: [{ $size: '$latestSubmissions' }, itemCount] },
                      then: {
                        $allElementsTrue: {
                          $map: {
                            input: '$latestSubmissions',
                            as: 'sub',
                            in: {
                              $eq: [
                                { $toUpper: { $ifNull: ['$$sub.responseValue', ''] } },
                                'YES'
                              ]
                            }
                          }
                        }
                      },
                      else: false
                    }
                  }
                }
              },
              {
                $group: {
                  _id: null,
                  totalCases: { $sum: 1 },
                  fullyClearedCases: {
                    $sum: { $cond: ['$isFullyCleared', 1, 0] }
                  }
                }
              }
            ]);

            const result = clearanceData[0];
            if (result && result.totalCases > 0) {
              const clearanceRate = Math.round((result.fullyClearedCases / result.totalCases) * 100);
              
              clearanceStats.push({
                departmentId: deptId,
                formId: form._id,
                formName: form.name,
                totalCases: result.totalCases,
                fullyClearedCases: result.fullyClearedCases,
                clearanceRate,
              });

              // Aggregate by department
              const deptIdStr = deptId?.toString();
              if (!deptClearanceStats[deptIdStr]) {
                deptClearanceStats[deptIdStr] = {
                  departmentId: deptIdStr,
                  totalCases: 0,
                  fullyClearedCases: 0,
                };
              }
              deptClearanceStats[deptIdStr].totalCases += result.totalCases;
              deptClearanceStats[deptIdStr].fullyClearedCases += result.fullyClearedCases;
            }
          }
        }

        // Calculate clearance rates for departments
        Object.keys(deptClearanceStats).forEach(deptId => {
          const stat = deptClearanceStats[deptId];
          stat.clearanceRate = stat.totalCases > 0
            ? Math.round((stat.fullyClearedCases / stat.totalCases) * 100)
            : 0;
        });

        response.clearanceStats = {
          byDepartment: Object.values(deptClearanceStats),
          byForm: clearanceStats,
        };
      } catch (clearanceErr) {
        console.error('Error calculating clearance stats:', clearanceErr);
        // Continue without clearance stats if calculation fails
      }
    }

    res.json(response);
  } catch (err) {
    console.error('getStats error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.checkDuplicateSubmission = async (req, res) => {
  try {
    const { departmentId, patientUhid } = req.query;
    if (!departmentId || !patientUhid || !String(patientUhid).trim()) {
      return res.json({ exists: false });
    }
    const deptOid = toObjectId(departmentId);
    if (!deptOid) {
      return res.json({ exists: false });
    }
    const u = String(patientUhid).trim().toUpperCase();
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const uhidRegex = new RegExp('^' + u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
    const recent = await AuditSubmission.findOne({
      department: deptOid,
      patientUhid: uhidRegex,
      submittedAt: { $gte: twentyFourHoursAgo },
    })
      .sort({ submittedAt: -1 })
      .select('submittedAt')
      .lean();
    if (recent?.submittedAt) {
      const nextEligibleAt = new Date(new Date(recent.submittedAt).getTime() + 24 * 60 * 60 * 1000);
      return res.json({
        exists: true,
        nextEligibleAt: nextEligibleAt.toISOString(),
      });
    }
    return res.json({ exists: false });
  } catch (err) {
    console.error('checkDuplicateSubmission error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get department checklists by operational context (departmentId, optional location/asset/shift)
// Authentication optional; returns checklists with latest submissions for the context
exports.getPatientChecklists = async (req, res) => {
  try {
    const { departmentId, location, asset, shift } = req.query;
    const userId = req.user?.sub || req.user?._id;
    const User = require('../models/User');
    const Department = require('../models/Department');
    const FormTemplate = require('../models/FormTemplate');
    const ChecklistItem = require('../models/ChecklistItem');

    let user = null;
    let userDeptId = null;
    if (userId) {
      user = await User.findById(userId).populate('department');
      userDeptId = user?.department?._id?.toString();
    }

    const departments = departmentId
      ? await Department.find({ _id: departmentId, isActive: true })
      : await Department.find({ isActive: true });
    const allForms = await FormTemplate.find({ isActive: true }).populate('departments');

    const contextFilter = {};
    if (location && String(location).trim()) contextFilter.location = new RegExp('^' + String(location).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
    if (asset && String(asset).trim()) contextFilter.asset = new RegExp('^' + String(asset).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
    if (shift && String(shift).trim()) contextFilter.shift = new RegExp('^' + String(shift).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');

    const departmentChecklists = [];

    for (const dept of departments) {
      const assignedForms = allForms.filter(form =>
        form.departments.some(d => d._id?.toString() === dept._id?.toString()) || form.isCommon
      );

      for (const form of assignedForms) {
        const checklistItems = await ChecklistItem.find({
          formTemplate: form._id,
          isActive: true,
        }).sort({ order: 1, section: 1 });

        if (checklistItems.length === 0) continue;

        const subFilter = { department: dept._id, formTemplate: form._id };
        Object.assign(subFilter, contextFilter);

        const existingSubmissions = await AuditSubmission.find(subFilter)
          .populate('submittedBy', 'name email')
          .sort({ submittedAt: -1 })
          .limit(checklistItems.length * 2)
          .lean();

        const latestSubmissions = {};
        existingSubmissions.forEach(sub => {
          const itemId = sub.checklistItemId?.toString();
          if (itemId && (!latestSubmissions[itemId] ||
            new Date(sub.submittedAt) > new Date(latestSubmissions[itemId].submittedAt))) {
            latestSubmissions[itemId] = sub;
          }
        });

        const isLocked = existingSubmissions.length > 0 && existingSubmissions[0].isLocked;
        const isUserDept = userDeptId && userDeptId === dept._id?.toString();
        const isCommon = form.isCommon;
        const canEdit = user ? (!isLocked && (isUserDept || isCommon || user.role === 'SUPER_ADMIN')) : false;

        const itemsWithData = checklistItems.map(item => {
          const submission = latestSubmissions[item._id.toString()];
          return {
            item: {
              _id: item._id,
              label: item.label,
              section: item.section,
              order: item.order,
              isMandatory: item.isMandatory,
            },
            submission: submission ? {
              _id: submission._id,
              yesNoNa: submission.yesNoNa,
              responseValue: submission.responseValue || submission.yesNoNa,
              remarks: submission.remarks,
              responsibility: submission.responsibility,
              submittedAt: submission.submittedAt,
              isLocked: submission.isLocked,
            } : null,
          };
        });

        const latestSubmission = existingSubmissions.length > 0 ? existingSubmissions[0] : null;
        const submittedBy = latestSubmission?.submittedBy
          ? { _id: latestSubmission.submittedBy._id, name: latestSubmission.submittedBy.name, email: latestSubmission.submittedBy.email }
          : null;

        if (existingSubmissions.length > 0 || itemsWithData.some(item => item.submission)) {
          departmentChecklists.push({
            department: { _id: dept._id, name: dept.name, code: dept.code },
            form: { _id: form._id, name: form.name },
            items: itemsWithData,
            canEdit,
            isLocked,
            hasSubmissions: existingSubmissions.length > 0,
            submittedAt: existingSubmissions.length > 0 ? existingSubmissions[0].submittedAt : null,
            submittedBy,
          });
        }
      }
    }

    res.json({
      context: { departmentId: departmentId || null, location: location || null, asset: asset || null, shift: shift || null },
      userDepartment: user?.department || null,
      checklists: departmentChecklists,
    });
  } catch (err) {
    console.error('getPatientChecklists error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Export submissions (admin-only)
exports.exportSubmissions = async (req, res) => {
  try {
    const { departmentId, startDate, endDate, format } = req.query;
    const filter = {};
    if (departmentId) filter.department = departmentId;
    if (startDate || endDate) {
      filter.submittedAt = {};
      if (startDate) filter.submittedAt.$gte = new Date(startDate);
      if (endDate) filter.submittedAt.$lte = new Date(endDate);
    }

    const submissions = await AuditSubmission.find(filter)
      .populate('department', 'name code')
      .populate('formTemplate', 'name')
      .populate('checklistItemId', 'label section')
      .populate('submittedBy', 'name email')
      .sort({ submittedAt: -1 })
      .limit(10000);

    const formattedData = submissions.map(sub => {
      const submittedDate = sub.submittedAt ? new Date(sub.submittedAt) : new Date();
      return {
        'Submission Date': submittedDate.toLocaleDateString('en-GB'),
        'Submission Time': submittedDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        'Department/Service': sub.department?.name || sub.department?.code || 'Unknown',
        'Department Code': sub.department?.code || '',
        'Location': sub.location || '',
        'Asset': sub.asset || '',
        'Shift': sub.shift || '',
        'Form Template': sub.formTemplate?.name || '',
        'Checklist Item': sub.checklistItemId?.label || '',
        'Section': sub.checklistItemId?.section || '',
        'Response Value': sub.responseValue || sub.yesNoNa || '',
        'Remarks': sub.remarks || '',
        'Responsibility': sub.responsibility || '',
        'Submitted By': sub.submittedBy?.name || sub.submittedBy?.email || 'Unknown',
        'Submitted By Email': sub.submittedBy?.email || '',
        'Is Locked': sub.isLocked ? 'Yes' : 'No',
      };
    });

    // Handle CSV format
    if (format === 'csv') {
      if (formattedData.length === 0) {
        return res.status(404).json({ message: 'No data to export' });
      }

      // Create CSV header
      const headers = Object.keys(formattedData[0]);
      const csvRows = [
        headers.join(','),
        ...formattedData.map(row => 
          headers.map(header => {
            const value = row[header] || '';
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ];

      const csvContent = csvRows.join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit_submissions_${Date.now()}.csv"`);
      return res.send(csvContent);
    }

    // Return JSON format for PDF/preview
    res.json({
      totalRecords: formattedData.length,
      data: formattedData,
    });
  } catch (err) {
    console.error('exportSubmissions error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Executive Analytics: Strategic insights for Managing Director
exports.getExecutiveAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query // 'week', 'month', 'quarter', 'year'
    
    // Calculate date ranges
    const now = new Date()
    const currentPeriod = new Date(now)
    const previousPeriod = new Date(now)
    
    switch (period) {
      case 'week':
        currentPeriod.setDate(now.getDate() - 7)
        previousPeriod.setDate(now.getDate() - 14)
        break
      case 'month':
        currentPeriod.setMonth(now.getMonth() - 1)
        previousPeriod.setMonth(now.getMonth() - 2)
        break
      case 'quarter':
        currentPeriod.setMonth(now.getMonth() - 3)
        previousPeriod.setMonth(now.getMonth() - 6)
        break
      case 'year':
        currentPeriod.setFullYear(now.getFullYear() - 1)
        previousPeriod.setFullYear(now.getFullYear() - 2)
        break
    }

    // Current period stats
    const currentStats = await AuditSubmission.aggregate([
      {
        $match: {
          submittedAt: { $gte: currentPeriod }
        }
      },
      {
        $group: {
          _id: null,
          totalSubmissions: { $sum: 1 },
          compliant: {
            $sum: {
              $cond: [
                { $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['YES']] },
                1,
                0
              ]
            }
          },
          nonCompliant: {
            $sum: {
              $cond: [
                { $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['NO']] },
                1,
                0
              ]
            }
          },
        }
      }
    ])

    // Previous period stats
    const previousStats = await AuditSubmission.aggregate([
      {
        $match: {
          submittedAt: { $gte: previousPeriod, $lt: currentPeriod }
        }
      },
      {
        $group: {
          _id: null,
          totalSubmissions: { $sum: 1 },
          compliant: {
            $sum: {
              $cond: [
                { $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['YES']] },
                1,
                0
              ]
            }
          },
        }
      }
    ])

    const current = currentStats[0] || {
      totalSubmissions: 0,
      compliant: 0,
      nonCompliant: 0,
    }

    const previous = previousStats[0] || {
      totalSubmissions: 0,
      compliant: 0,
    }

    // Calculate trends
    const complianceRate = current.totalSubmissions > 0
      ? Math.round((current.compliant / current.totalSubmissions) * 100)
      : 0

    const previousComplianceRate = previous.totalSubmissions > 0
      ? Math.round((previous.compliant / previous.totalSubmissions) * 100)
      : 0

    const complianceTrend = complianceRate - previousComplianceRate
    const submissionTrend = previous.totalSubmissions > 0
      ? Math.round(((current.totalSubmissions - previous.totalSubmissions) / previous.totalSubmissions) * 100)
      : 0

    // Monthly trends (last 6 months) - single optimized aggregation
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    
    const monthlyTrendsData = await AuditSubmission.aggregate([
      {
        $match: {
          submittedAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$submittedAt' },
            month: { $month: '$submittedAt' }
          },
          total: { $sum: 1 },
          compliant: {
            $sum: {
              $cond: [
                { $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['YES']] },
                1,
                0
              ]
            }
          },
          sessions: { $addToSet: { $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, '|', { $ifNull: ['$auditTime', ''] }, '|', { $toString: '$submittedBy' }] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    const monthlyTrends = monthlyTrendsData.map(item => ({
      month: new Date(item._id.year, item._id.month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      submissions: item.total,
      complianceRate: item.total > 0 ? Math.round((item.compliant / item.total) * 100) : 0,
      cases: (item.sessions && item.sessions.length) || 0,
    }));

    // Department performance ranking
    const deptPerformance = await AuditSubmission.aggregate([
      {
        $match: {
          submittedAt: { $gte: currentPeriod }
        }
      },
      {
        $group: {
          _id: '$department',
          total: { $sum: 1 },
          compliant: {
            $sum: {
              $cond: [
                { $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['YES']] },
                1,
                0
              ]
            }
          },
          sessions: { $addToSet: { $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, '|', { $ifNull: ['$auditTime', ''] }, '|', { $toString: '$submittedBy' }] } }
        }
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'deptInfo'
        }
      },
      {
        $unwind: { path: '$deptInfo', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          departmentId: '$_id',
          departmentName: '$deptInfo.name',
          departmentCode: '$deptInfo.code',
          total: 1,
          compliant: 1,
          cases: { $size: '$sessions' },
          complianceRate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $round: [{ $multiply: [{ $divide: ['$compliant', '$total'] }, 100] }] },
              0
            ]
          }
        }
      },
      {
        $sort: { complianceRate: -1 }
      }
    ])

    // Risk indicators
    const highRiskDepts = deptPerformance.filter(d => 
      d.complianceRate < 70
    )

    // 100% Clearance analysis - optimized with aggregation
    const ChecklistItem = require('../models/ChecklistItem')
    const FormTemplate = require('../models/FormTemplate')
    
    const allForms = await FormTemplate.find({ isActive: true }).lean().populate('departments')
    const clearanceAnalysis = []

    // Process only top 5 departments for faster response
    const topDepts = deptPerformance.slice(0, 5)
    
    for (const dept of topDepts) {
      // Use aggregation for faster clearance calculation
      const clearanceData = await AuditSubmission.aggregate([
        {
          $match: {
            department: dept.departmentId,
            submittedAt: { $gte: currentPeriod }
          }
        },
        {
          $group: {
            _id: { $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, '|', { $ifNull: ['$auditTime', ''] }, '|', { $toString: '$submittedBy' }] },
            submissions: { $push: '$$ROOT' }
          }
        },
        {
          $project: {
            allYes: {
              $cond: {
                if: {
                  $allElementsTrue: {
                    $map: {
                      input: '$submissions',
                      as: 'sub',
                      in: {
                        $or: [
                          { $eq: [{ $toUpper: { $ifNull: ['$$sub.responseValue', '$$sub.yesNoNa'] } }, 'YES'] },
                          { $eq: [{ $toUpper: { $ifNull: ['$$sub.responseValue', '$$sub.yesNoNa'] } }, 'NA'] }
                        ]
                      }
                    }
                  }
                },
                then: true,
                else: false
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalCases: { $sum: 1 },
            fullyCleared: {
              $sum: {
                $cond: ['$allYes', 1, 0]
              }
            }
          }
        }
      ])

      const result = clearanceData[0] || { totalCases: 0, fullyCleared: 0 }
      
      clearanceAnalysis.push({
        departmentId: dept.departmentId,
        departmentName: dept.departmentName,
        departmentCode: dept.departmentCode,
        totalCases: result.totalCases,
        fullyClearedCases: result.fullyCleared,
        clearanceRate: result.totalCases > 0
          ? Math.round((result.fullyCleared / result.totalCases) * 100)
          : 0
      })
    }

    // Overall insights
    const insights = []
    
    if (complianceTrend > 0) {
      insights.push({
        type: 'positive',
        message: `Compliance rate improved by ${complianceTrend}% compared to previous period`
      })
    } else if (complianceTrend < 0) {
      insights.push({
        type: 'warning',
        message: `Compliance rate decreased by ${Math.abs(complianceTrend)}% - requires attention`
      })
    }

    if (highRiskDepts.length > 0) {
      insights.push({
        type: 'critical',
        message: `${highRiskDepts.length} department(s) identified with compliance below 70% or high open issues`
      })
    }

    const topPerformer = deptPerformance[0]
    if (topPerformer) {
      insights.push({
        type: 'positive',
        message: `${topPerformer.departmentName || topPerformer.departmentCode} leading with ${topPerformer.complianceRate}% compliance rate`
      })
    }

    const sessionCountResult = await AuditSubmission.aggregate([
      { $match: { submittedAt: { $gte: currentPeriod } } },
      { $group: { _id: { $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, '|', { $ifNull: ['$auditTime', ''] }, '|', { $toString: '$submittedBy' }] } } },
      { $count: 'total' }
    ]);
    const totalCases = (sessionCountResult[0] && sessionCountResult[0].total) || 0;

    res.json({
      period,
      currentPeriod: {
        start: currentPeriod,
        end: now
      },
      summary: {
        complianceRate,
        previousComplianceRate,
        complianceTrend,
        totalSubmissions: current.totalSubmissions,
        submissionTrend,
        totalCases,
        riskLevel: complianceRate >= 90 ? 'low' : complianceRate >= 70 ? 'medium' : 'high'
      },
      trends: {
        monthly: monthlyTrends
      },
      departmentPerformance: deptPerformance,
      clearanceAnalysis,
      riskIndicators: {
        highRiskDepartments: highRiskDepts.map(d => ({
          name: d.departmentName || d.departmentCode,
          complianceRate: d.complianceRate,
          totalCases: d.cases
        })),
        overallRiskLevel: complianceRate >= 90 ? 'Low Risk' : complianceRate >= 70 ? 'Medium Risk' : 'High Risk'
      },
      insights
    })
  } catch (err) {
    console.error('getExecutiveAnalytics error', err)
    res.status(500).json({ message: 'Server error', error: err.message })
  }
}

// Comprehensive Analytics: Time-series data with date range filtering
exports.getTimeSeriesAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query; // groupBy: 'day', 'week', 'month'
    
    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.submittedAt = {};
      if (startDate) dateFilter.submittedAt.$gte = new Date(startDate);
      if (endDate) dateFilter.submittedAt.$lte = new Date(endDate);
    }

    // Determine grouping format based on groupBy parameter
    let dateGroupFormat = {};
    switch (groupBy) {
      case 'day':
        dateGroupFormat = {
          year: { $year: '$submittedAt' },
          month: { $month: '$submittedAt' },
          day: { $dayOfMonth: '$submittedAt' }
        };
        break;
      case 'week':
        dateGroupFormat = {
          year: { $year: '$submittedAt' },
          week: { $week: '$submittedAt' }
        };
        break;
      case 'month':
        dateGroupFormat = {
          year: { $year: '$submittedAt' },
          month: { $month: '$submittedAt' }
        };
        break;
      default:
        dateGroupFormat = {
          year: { $year: '$submittedAt' },
          month: { $month: '$submittedAt' },
          day: { $dayOfMonth: '$submittedAt' }
        };
    }

    const timeSeriesData = await AuditSubmission.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: dateGroupFormat,
          totalSubmissions: { $sum: 1 },
          compliant: {
            $sum: {
              $cond: [
                { $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['YES']] },
                1,
                0
              ]
            }
          },
          nonCompliant: {
            $sum: {
              $cond: [
                { $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['NO']] },
                1,
                0
              ]
            }
          },
          uniqueSessions: { $addToSet: { $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, '|', { $ifNull: ['$auditTime', ''] }, '|', { $toString: '$submittedBy' }] } },
          uniqueDepartments: { $addToSet: '$department' },
          uniqueUsers: { $addToSet: '$submittedBy' }
        }
      },
      {
        $project: {
          _id: 1,
          totalSubmissions: 1,
          compliant: 1,
          nonCompliant: 1,
          uniqueCases: { $size: '$uniqueSessions' },
          uniqueDepartments: { $size: '$uniqueDepartments' },
          uniqueUsers: { $size: '$uniqueUsers' },
          complianceRate: {
            $cond: [
              { $gt: ['$totalSubmissions', 0] },
              { $round: [{ $multiply: [{ $divide: ['$compliant', '$totalSubmissions'] }, 100] }] },
              0
            ]
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
    ]);

    // Format dates for frontend
    const formattedData = timeSeriesData.map(item => {
      let dateLabel = '';
      if (groupBy === 'day') {
        dateLabel = new Date(item._id.year, item._id.month - 1, item._id.day).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric' 
        });
      } else if (groupBy === 'week') {
        dateLabel = `Week ${item._id.week}, ${item._id.year}`;
      } else {
        dateLabel = new Date(item._id.year, item._id.month - 1, 1).toLocaleDateString('en-US', { 
          month: 'short', 
          year: 'numeric' 
        });
      }

      return {
        date: dateLabel,
        timestamp: new Date(item._id.year, item._id.month - 1, item._id.day || 1),
        ...item
      };
    });

    res.json({
      groupBy,
      dateRange: {
        start: startDate ? new Date(startDate) : null,
        end: endDate ? new Date(endDate) : null
      },
      data: formattedData,
      summary: {
        totalDataPoints: formattedData.length,
        totalSubmissions: formattedData.reduce((sum, d) => sum + d.totalSubmissions, 0),
        totalCases: formattedData.reduce((sum, d) => sum + d.uniqueCases, 0),
        averageComplianceRate: formattedData.length > 0
          ? Math.round(formattedData.reduce((sum, d) => sum + d.complianceRate, 0) / formattedData.length)
          : 0
      }
    });
  } catch (err) {
    console.error('getTimeSeriesAnalytics error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// User Activity Analytics
exports.getUserActivityAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, departmentId } = req.query;
    const User = require('../models/User');
    
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.submittedAt = {};
      if (startDate) dateFilter.submittedAt.$gte = new Date(startDate);
      if (endDate) dateFilter.submittedAt.$lte = new Date(endDate);
    }
    
    if (departmentId) {
      dateFilter.department = departmentId;
    }

    const userActivity = await AuditSubmission.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$submittedBy',
          totalSubmissions: { $sum: 1 },
          compliant: {
            $sum: {
              $cond: [
                { $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['YES']] },
                1,
                0
              ]
            }
          },
          nonCompliant: {
            $sum: {
              $cond: [
                { $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['NO']] },
                1,
                0
              ]
            }
          },
          uniqueSessions: { $addToSet: { $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, '|', { $ifNull: ['$auditTime', ''] }, '|', { $toString: '$submittedBy' }] } },
          uniqueDepartments: { $addToSet: '$department' },
          firstSubmission: { $min: '$submittedAt' },
          lastSubmission: { $max: '$submittedAt' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          userId: '$_id',
          userName: '$userInfo.name',
          userEmail: '$userInfo.email',
          userRole: '$userInfo.role',
          totalSubmissions: 1,
          compliant: 1,
          nonCompliant: 1,
          uniqueCases: { $size: '$uniqueSessions' },
          uniqueDepartments: { $size: '$uniqueDepartments' },
          complianceRate: {
            $cond: [
              { $gt: ['$totalSubmissions', 0] },
              { $round: [{ $multiply: [{ $divide: ['$compliant', '$totalSubmissions'] }, 100] }] },
              0
            ]
          },
          firstSubmission: 1,
          lastSubmission: 1
        }
      },
      { $sort: { totalSubmissions: -1 } }
    ]);

    res.json({
      dateRange: {
        start: startDate ? new Date(startDate) : null,
        end: endDate ? new Date(endDate) : null
      },
      users: userActivity,
      summary: {
        totalUsers: userActivity.length,
        totalSubmissions: userActivity.reduce((sum, u) => sum + u.totalSubmissions, 0),
        averageComplianceRate: userActivity.length > 0
          ? Math.round(userActivity.reduce((sum, u) => sum + u.complianceRate, 0) / userActivity.length)
          : 0
      }
    });
  } catch (err) {
    console.error('getUserActivityAnalytics error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Admission/IPID Statistics
// Operational analytics: Location, Asset, Shift distributions (no patient/admission)
exports.getAdmissionAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.submittedAt = {};
      if (startDate) dateFilter.submittedAt.$gte = new Date(startDate);
      if (endDate) dateFilter.submittedAt.$lte = new Date(endDate);
    }

    const sessionKeyExpr = { $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, '|', { $ifNull: ['$auditTime', ''] }, '|', { $toString: '$submittedBy' }] };

    const [locationStats, assetStats, shiftStats, submissionsPerSession] = await Promise.all([
      AuditSubmission.aggregate([
        { $match: dateFilter },
        { $match: { location: { $exists: true, $ne: '', $nin: [null] } } },
        { $group: { _id: '$location', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ]),
      AuditSubmission.aggregate([
        { $match: dateFilter },
        { $match: { asset: { $exists: true, $ne: '', $nin: [null] } } },
        { $group: { _id: '$asset', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ]),
      AuditSubmission.aggregate([
        { $match: dateFilter },
        { $match: { shift: { $exists: true, $ne: '', $nin: [null] } } },
        { $group: { _id: '$shift', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ]),
      AuditSubmission.aggregate([
        { $match: dateFilter },
        { $group: { _id: sessionKeyExpr, submissionCount: { $sum: 1 } } },
        { $group: { _id: null, avg: { $avg: '$submissionCount' }, distribution: { $push: { sessionKey: '$_id', count: '$submissionCount' } } } },
        { $project: { average: '$avg', distribution: { $slice: ['$distribution', 20] } } }
      ])
    ]);

    const sessionDist = submissionsPerSession[0];
    res.json({
      dateRange: { start: startDate ? new Date(startDate) : null, end: endDate ? new Date(endDate) : null },
      locationDistribution: locationStats,
      assetDistribution: assetStats,
      shiftDistribution: shiftStats,
      submissionsPerSession: {
        average: sessionDist && sessionDist.average != null ? Math.round(sessionDist.average) : 0,
        distribution: (sessionDist && sessionDist.distribution) ? sessionDist.distribution.slice(0, 20) : []
      },
      summary: {
        totalSessions: (sessionDist && sessionDist.distribution) ? sessionDist.distribution.length : 0,
        averageSubmissionsPerSession: sessionDist && sessionDist.average != null ? Math.round(sessionDist.average) : 0
      }
    });
  } catch (err) {
    console.error('getAdmissionAnalytics error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Form Template Performance Analytics
exports.getFormTemplateAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, departmentId } = req.query;
    const FormTemplate = require('../models/FormTemplate');
    
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.submittedAt = {};
      if (startDate) dateFilter.submittedAt.$gte = new Date(startDate);
      if (endDate) dateFilter.submittedAt.$lte = new Date(endDate);
    }
    
    if (departmentId) {
      dateFilter.department = departmentId;
    }

    const formStats = await AuditSubmission.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$formTemplate',
          totalSubmissions: { $sum: 1 },
          compliant: {
            $sum: {
              $cond: [
                { $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['YES']] },
                1,
                0
              ]
            }
          },
          nonCompliant: {
            $sum: {
              $cond: [
                { $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['NO']] },
                1,
                0
              ]
            }
          },
          uniqueSessions: { $addToSet: { $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, '|', { $ifNull: ['$auditTime', ''] }, '|', { $toString: '$submittedBy' }] } },
          uniqueDepartments: { $addToSet: '$department' }
        }
      },
      {
        $lookup: {
          from: 'formtemplates',
          localField: '_id',
          foreignField: '_id',
          as: 'formInfo'
        }
      },
      {
        $unwind: { path: '$formInfo', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          formId: '$_id',
          formName: '$formInfo.name',
          formDescription: '$formInfo.description',
          isActive: '$formInfo.isActive',
          totalSubmissions: 1,
          compliant: 1,
          nonCompliant: 1,
          uniqueCases: { $size: '$uniqueSessions' },
          uniqueDepartments: { $size: '$uniqueDepartments' },
          complianceRate: {
            $cond: [
              { $gt: ['$totalSubmissions', 0] },
              { $round: [{ $multiply: [{ $divide: ['$compliant', '$totalSubmissions'] }, 100] }] },
              0
            ]
          }
        }
      },
      { $sort: { totalSubmissions: -1 } }
    ]);

    res.json({
      dateRange: {
        start: startDate ? new Date(startDate) : null,
        end: endDate ? new Date(endDate) : null
      },
      forms: formStats,
      summary: {
        totalForms: formStats.length,
        totalSubmissions: formStats.reduce((sum, f) => sum + f.totalSubmissions, 0),
        averageComplianceRate: formStats.length > 0
          ? Math.round(formStats.reduce((sum, f) => sum + f.complianceRate, 0) / formStats.length)
          : 0
      }
    });
  } catch (err) {
    console.error('getFormTemplateAnalytics error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Comprehensive Dashboard Analytics (all-in-one endpoint)
exports.getComprehensiveAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.submittedAt = {};
      if (startDate) dateFilter.submittedAt.$gte = new Date(startDate);
      if (endDate) dateFilter.submittedAt.$lte = new Date(endDate);
    }

    // Get all analytics in parallel
    const [
      timeSeriesDaily,
      timeSeriesWeekly,
      timeSeriesMonthly,
      userActivity,
      admissionStats,
      formStats,
      departmentStats
    ] = await Promise.all([
      // Daily trends (last 30 days)
      AuditSubmission.aggregate([
        {
          $match: {
            ...dateFilter,
            submittedAt: {
              $gte: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$submittedAt' },
              month: { $month: '$submittedAt' },
              day: { $dayOfMonth: '$submittedAt' }
            },
            total: { $sum: 1 },
            compliant: {
              $sum: {
                $cond: [
                  { $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['YES']] },
                  1,
                  0
                ]
              }
            },
            sessions: { $addToSet: { $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, '|', { $ifNull: ['$auditTime', ''] }, '|', { $toString: '$submittedBy' }] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        { $limit: 30 }
      ]),
      AuditSubmission.aggregate([
        {
          $match: {
            ...dateFilter,
            submittedAt: {
              $gte: startDate ? new Date(startDate) : new Date(Date.now() - 84 * 24 * 60 * 60 * 1000)
            }
          }
        },
        {
          $group: {
            _id: { year: { $year: '$submittedAt' }, week: { $week: '$submittedAt' } },
            total: { $sum: 1 },
            compliant: {
              $sum: {
                $cond: [
                  { $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['YES']] },
                  1,
                  0
                ]
              }
            },
            sessions: { $addToSet: { $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, '|', { $ifNull: ['$auditTime', ''] }, '|', { $toString: '$submittedBy' }] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.week': 1 } },
        { $limit: 12 }
      ]),
      AuditSubmission.aggregate([
        {
          $match: {
            ...dateFilter,
            submittedAt: {
              $gte: startDate ? new Date(startDate) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
            }
          }
        },
        {
          $group: {
            _id: { year: { $year: '$submittedAt' }, month: { $month: '$submittedAt' } },
            total: { $sum: 1 },
            compliant: {
              $sum: {
                $cond: [
                  { $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['YES']] },
                  1,
                  0
                ]
              }
            },
            sessions: { $addToSet: { $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, '|', { $ifNull: ['$auditTime', ''] }, '|', { $toString: '$submittedBy' }] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 }
      ]),
      AuditSubmission.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$submittedBy',
            total: { $sum: 1 },
            sessions: { $addToSet: { $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, '|', { $ifNull: ['$auditTime', ''] }, '|', { $toString: '$submittedBy' }] } }
          }
        },
        { $sort: { total: -1 } },
        { $limit: 10 }
      ]),
      AuditSubmission.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: { $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, '|', { $ifNull: ['$auditTime', ''] }, '|', { $toString: '$submittedBy' }] },
            submissionCount: { $sum: 1 },
            departments: { $addToSet: '$department' }
          }
        },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            avgSubmissionsPerSession: { $avg: '$submissionCount' },
            avgDepartmentsPerSession: { $avg: { $size: '$departments' } }
          }
        }
      ]),
      AuditSubmission.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$formTemplate',
            total: { $sum: 1 },
            sessions: { $addToSet: { $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, '|', { $ifNull: ['$auditTime', ''] }, '|', { $toString: '$submittedBy' }] } }
          }
        },
        { $sort: { total: -1 } },
        { $limit: 10 }
      ]),
      AuditSubmission.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$department',
            total: { $sum: 1 },
            compliant: {
              $sum: {
                $cond: [
                  { $in: [{ $toUpper: { $ifNull: ['$responseValue', '$yesNoNa'] } }, ['YES']] },
                  1,
                  0
                ]
              }
            },
            sessions: { $addToSet: { $concat: [{ $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, '|', { $ifNull: ['$auditTime', ''] }, '|', { $toString: '$submittedBy' }] } }
          }
        },
        { $sort: { total: -1 } }
      ])
    ]);

    // Format the data
    const formatTimeSeries = (data, format) => {
      return data.map(item => {
        let dateLabel = '';
        if (format === 'day') {
          dateLabel = new Date(item._id.year, item._id.month - 1, item._id.day).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
        } else if (format === 'week') {
          dateLabel = `Week ${item._id.week}, ${item._id.year}`;
        } else {
          dateLabel = new Date(item._id.year, item._id.month - 1, 1).toLocaleDateString('en-US', { 
            month: 'short', 
            year: 'numeric' 
          });
        }
        return {
          date: dateLabel,
          submissions: item.total,
          complianceRate: item.total > 0 ? Math.round((item.compliant / item.total) * 100) : 0,
          cases: (item.sessions && item.sessions.length) || 0
        };
      });
    };

    const sessionStats = admissionStats[0];
    res.json({
      dateRange: {
        start: startDate ? new Date(startDate) : null,
        end: endDate ? new Date(endDate) : null
      },
      timeSeries: {
        daily: formatTimeSeries(timeSeriesDaily, 'day'),
        weekly: formatTimeSeries(timeSeriesWeekly, 'week'),
        monthly: formatTimeSeries(timeSeriesMonthly, 'month')
      },
      topUsers: userActivity.slice(0, 10).map(u => ({
        userId: u._id,
        totalSubmissions: u.total,
        uniqueCases: (u.sessions && u.sessions.length) || 0
      })),
      sessionStats: sessionStats || {
        totalSessions: 0,
        avgSubmissionsPerSession: 0,
        avgDepartmentsPerSession: 0
      },
      topForms: formStats.slice(0, 10).map(f => ({
        formId: f._id,
        totalSubmissions: f.total,
        uniqueCases: (f.sessions && f.sessions.length) || 0
      })),
      departmentStats: departmentStats.map(d => ({
        departmentId: d._id,
        totalSubmissions: d.total,
        complianceRate: d.total > 0 ? Math.round((d.compliant / d.total) * 100) : 0,
        uniqueCases: (d.sessions && d.sessions.length) || 0
      }))
    });
  } catch (err) {
    console.error('getComprehensiveAnalytics error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
